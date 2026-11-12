import { useEffect, useSyncExternalStore } from "react";
import type { AppData, Contest, DailyLog, Problem, Settings, Topic } from "./types";
import { DEFAULT_CF_SYNC, DEFAULT_SETTINGS, emptyData } from "./seed";
import { markDatesClientHydrated, ssrTodayISO } from "./dates";
import { buildRoadmap } from "./roadmap";
import {
  extractCFKeyFromUrl,
  fetchCodeforcesAccount,
  type CodeforcesSyncPayload,
} from "./codeforces";
import type { PlatformAccount, PlatformSyncResult, PrimaryPlatformId } from "@/integrations/types";
import {
  createDefaultPlatformsRecord,
  createEmptyPlatformAccount,
  getProblemDedupKey,
  mergePlatformSyncIntoAppData,
  PLATFORM_INTEGRATIONS,
  PRIMARY_PLATFORM_IDS,
} from "@/integrations/registry";
import { formatCodeforcesRank, normalizeCodeforcesSyncResult } from "@/integrations/codeforces";

/**
 * Centralized local-first data layer with dual persistence (localStorage + IndexedDB).
 * Zero mock data: starts clean and persists all user configuration, connected platforms,
 * logs, problems, roadmap progress, and contests.
 */
export const STORAGE_KEY = "cp-tracker:v1";
const IDB_NAME = "cp-tracker-db";
const IDB_VERSION = 1;
const IDB_STORE = "appdata";

let state: AppData | null = null;
let clientHydrated = false;
let hydrationScheduled = false;
let idbHydrationStarted = false;
const listeners = new Set<() => void>();

let cachedServerSnapshot: { date: string; data: AppData } | null = null;

function getServerSnapshotData(): AppData {
  const ssrDate = ssrTodayISO();
  if (!cachedServerSnapshot || cachedServerSnapshot.date !== ssrDate) {
    cachedServerSnapshot = {
      date: ssrDate,
      data: emptyData(ssrDate),
    };
  }
  return cachedServerSnapshot.data;
}

export interface BackupSummary {
  name: string;
  cfHandle: string;
  currentRating: number;
  targetRating: number;
  logsCount: number;
  problemsCount: number;
  contestsCount: number;
  topicsCount: number;
  connectedPlatformsCount: number;
  startDate: string;
}

/**
 * Safely migrates stored data from older versions, strips legacy sample/mock records,
 * and migrates existing Codeforces accounts into the unified platforms dictionary.
 */
export function migrateAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") {
    return emptyData();
  }
  const candidate = raw as Partial<AppData>;

  // If the stored record was the legacy automatic sample data (isSample === true),
  // discard the mock records so the user starts with a clean zero-record state.
  if (candidate.isSample === true) {
    return emptyData();
  }

  if (
    candidate.version !== 1 ||
    !candidate.settings ||
    typeof candidate.settings !== "object" ||
    !Array.isArray(candidate.logs) ||
    !Array.isArray(candidate.topics)
  ) {
    return emptyData();
  }

  const base = emptyData();
  const normalizedLogs: DailyLog[] = candidate.logs.map((l) => ({
    ...l,
    editorial: typeof l.editorial === "number" ? l.editorial : 0,
  }));

  const normalizedProblems: Problem[] = (
    Array.isArray(candidate.problems) ? candidate.problems : []
  ).map((p) => {
    const plat = p.platform ?? "Codeforces";
    const cfKey =
      plat === "Codeforces" ? p.cfKey || extractCFKeyFromUrl(p.url) || undefined : undefined;
    const problemId = p.problemId || (cfKey ? `CF-${cfKey}` : undefined);
    return {
      ...p,
      platform: plat,
      tags: Array.isArray(p.tags) ? p.tags : p.topic ? [p.topic] : [],
      notes: p.notes ?? "",
      source: p.source ?? "manual",
      ...(cfKey ? { cfKey } : {}),
      ...(problemId ? { problemId } : {}),
    };
  });

  const normalizedContests: Contest[] = (
    Array.isArray(candidate.contests) ? candidate.contests : []
  ).map((c) => ({
    ...c,
    solved: c.solved === undefined ? 0 : c.solved,
    performance: c.performance ?? null,
    source: c.source ?? "manual",
  }));

  // Build unified platforms record and migrate existing Codeforces data if needed
  const defaultPlatforms = createDefaultPlatformsRecord();
  const rawPlatforms = (candidate.platforms ?? {}) as Partial<
    Record<PrimaryPlatformId, Partial<PlatformAccount>>
  >;

  const mergedPlatforms: Record<PrimaryPlatformId, PlatformAccount> = {
    ...defaultPlatforms,
  };

  for (const pid of PRIMARY_PLATFORM_IDS) {
    const existingPlat = rawPlatforms[pid];
    if (existingPlat && typeof existingPlat === "object") {
      const def = defaultPlatforms[pid];
      const wasSyncing = existingPlat.connectionStatus === "syncing";
      mergedPlatforms[pid] = {
        ...def,
        ...existingPlat,
        platformId: pid,
        platformName: def.platformName,
        connectionStatus: wasSyncing
          ? existingPlat.lastSyncedAt
            ? "connected"
            : "disconnected"
          : (existingPlat.connectionStatus ?? "disconnected"),
        availableMetrics: {
          ...def.availableMetrics,
          ...(existingPlat.availableMetrics ?? {}),
        },
        extraMetrics: {
          ...def.extraMetrics,
          ...(existingPlat.extraMetrics ?? {}),
        },
        ratingHistory: Array.isArray(existingPlat.ratingHistory) ? existingPlat.ratingHistory : [],
      };
    }
  }

  // Migrate legacy Codeforces handle/profile if platforms.codeforces was not yet populated
  const legacyHandle = (candidate.settings.cfHandle || candidate.cfSync?.handle || "").trim();
  if (legacyHandle && !mergedPlatforms.codeforces.username) {
    const cfProf = candidate.cfSync?.profile;
    const cfContests = normalizedContests
      .filter((c) => c.platform.toLowerCase() === "codeforces" && c.newRating != null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const currentRating =
      cfProf?.rating ??
      (candidate.settings.currentRating > 0 ? candidate.settings.currentRating : null);
    const highestRating = cfProf?.maxRating ?? currentRating;

    mergedPlatforms.codeforces = {
      ...mergedPlatforms.codeforces,
      username: legacyHandle,
      profileUrl: `https://codeforces.com/profile/${encodeURIComponent(legacyHandle)}`,
      connectionStatus: "connected",
      currentRating,
      highestRating,
      rankTitle: formatCodeforcesRank(cfProf?.rank, currentRating ?? undefined),
      totalContests: cfProf?.contestsCount ?? cfContests.length,
      totalSolved:
        cfProf?.uniqueSolvedCount ??
        normalizedProblems.filter(
          (p) => (p.platform ?? "Codeforces") === "Codeforces" && p.status !== "unsolved",
        ).length,
      lastSyncedAt: candidate.cfSync?.lastSyncedAt ?? null,
      lastError: candidate.cfSync?.error ?? null,
      ratingHistory: cfContests.map((c) => ({
        date: c.date,
        rating: c.newRating!,
        oldRating: c.oldRating,
        delta: c.newRating! - (c.oldRating ?? c.newRating!),
        contestName: c.name,
        rank: c.rank,
        performance: null,
      })),
    };
  }

  const anyPlatformConnected = PRIMARY_PLATFORM_IDS.some(
    (pid) => mergedPlatforms[pid].username.trim().length > 0,
  );
  const hasRealActivity =
    Boolean(candidate.onboarded) ||
    Boolean(candidate.settings.name?.trim()) ||
    anyPlatformConnected ||
    normalizedLogs.length > 0 ||
    normalizedProblems.length > 0 ||
    normalizedContests.length > 0;

  return {
    version: 1,
    onboarded: candidate.onboarded ?? hasRealActivity,
    isSample: false,
    settings: {
      ...DEFAULT_SETTINGS,
      ...candidate.settings,
      cfHandle:
        mergedPlatforms.codeforces.username ||
        candidate.settings.cfHandle ||
        candidate.cfSync?.handle ||
        "",
    },
    cfSync: {
      ...DEFAULT_CF_SYNC,
      ...(candidate.cfSync ?? {}),
      syncing: false,
      status:
        candidate.cfSync?.status === "syncing"
          ? candidate.cfSync.lastSyncedAt
            ? "success"
            : "idle"
          : (candidate.cfSync?.status ?? "idle"),
    },
    platforms: mergedPlatforms,
    topics: candidate.topics.length > 0 ? candidate.topics : base.topics,
    logs: normalizedLogs,
    problems: normalizedProblems,
    contests: normalizedContests,
  };
}

export function validateBackupJSON(text: string): { data: AppData; summary: BackupSummary } {
  if (!text || !text.trim()) {
    throw new Error("Please provide a JSON backup file or paste exported JSON.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON format. Please check that the backup file is not corrupted.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("This file is not a valid CP Tracker export.");
  }

  const candidate = parsed as Partial<AppData>;
  if (
    candidate.version !== 1 ||
    !candidate.settings ||
    typeof candidate.settings !== "object" ||
    !Array.isArray(candidate.logs) ||
    !Array.isArray(candidate.topics)
  ) {
    throw new Error("This file is missing required CP Tracker v1 fields (settings, logs, topics).");
  }

  const migrated = migrateAppData({ ...candidate, isSample: false, onboarded: true });
  const connectedPlatformsCount = PRIMARY_PLATFORM_IDS.filter(
    (pid) => migrated.platforms[pid].username.trim().length > 0,
  ).length;

  return {
    data: migrated,
    summary: {
      name: migrated.settings.name || migrated.settings.cfHandle || "Tracked User",
      cfHandle: migrated.settings.cfHandle || "",
      currentRating: Number(migrated.settings.currentRating) || 0,
      targetRating: Number(migrated.settings.targetRating) || 1400,
      logsCount: migrated.logs.length,
      problemsCount: migrated.problems.length,
      contestsCount: migrated.contests.length,
      topicsCount: migrated.topics.length,
      connectedPlatformsCount,
      startDate: migrated.settings.startDate,
    },
  };
}

function openIDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeToIDB(data: AppData): Promise<void> {
  const db = await openIDB();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(data, STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore IDB write errors */
  }
}

async function readFromIDB(): Promise<AppData | null> {
  const db = await openIDB();
  if (!db) return null;
  try {
    return await new Promise<AppData | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(STORAGE_KEY);
      req.onsuccess = () => {
        const val = req.result as AppData | undefined;
        resolve(val && val.version === 1 ? migrateAppData(val) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((l) => l());
}

function hydrateFromIDBIfNeeded(hadValidLocalRecord: boolean) {
  if (idbHydrationStarted || typeof window === "undefined") return;
  idbHydrationStarted = true;

  void (async () => {
    try {
      if (navigator.storage && typeof navigator.storage.persist === "function") {
        void navigator.storage.persist();
      }
    } catch {
      /* ignore */
    }

    const idbData = await readFromIDB();
    if (!hadValidLocalRecord && idbData && idbData.onboarded) {
      state = idbData;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(idbData));
      } catch {
        /* ignore */
      }
      notify();
    } else if (state) {
      await writeToIDB(state);
    }
  })();
}

export function load(): AppData {
  if (state) return state;
  if (typeof window === "undefined") return getServerSnapshotData();

  let hadValidLocal = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppData>;
      if (parsed && parsed.isSample === true) {
        const clean = emptyData();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        state = clean;
      } else if (parsed && parsed.version === 1) {
        state = migrateAppData(parsed);
        hadValidLocal = true;
      }
    }
  } catch {
    /* fallback below */
  }

  if (!state) {
    state = emptyData();
  }
  hydrateFromIDBIfNeeded(hadValidLocal);
  return state;
}

function commit(next: AppData) {
  markDatesClientHydrated();
  state = next;
  clientHydrated = true;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or unavailable */
    }
    void writeToIDB(next);
  }
  notify();
}

function update(fn: (d: AppData) => AppData) {
  commit(fn(load()));
}

function hydrateNow() {
  if (clientHydrated || typeof window === "undefined") return;
  markDatesClientHydrated();
  clientHydrated = true;
  state = null;
  load();
  notify();
}

function scheduleClientHydration(delayMs = 0) {
  if (clientHydrated || typeof window === "undefined") return;
  if (delayMs === 0) {
    if (hydrationScheduled) return;
    hydrationScheduled = true;
    window.setTimeout(hydrateNow, 0);
  } else {
    window.setTimeout(() => {
      if (!clientHydrated && !hydrationScheduled) {
        hydrateNow();
      }
    }, delayMs);
  }
}

export function useData(options?: { isShell?: boolean }): AppData {
  const isShell = options?.isShell ?? false;
  const data = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (clientHydrated ? load() : getServerSnapshotData()),
    () => getServerSnapshotData(),
  );

  useEffect(() => {
    scheduleClientHydration(isShell ? 1500 : 0);
  }, [isShell]);

  return data;
}

export function useHydrated(options?: { isShell?: boolean }): boolean {
  const isShell = options?.isShell ?? false;
  const hydrated = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => clientHydrated,
    () => false,
  );

  useEffect(() => {
    scheduleClientHydration(isShell ? 1500 : 0);
  }, [isShell]);

  return hydrated;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const actions = {
  completeOnboarding(setup: Partial<Settings>, cfPayload?: CodeforcesSyncPayload) {
    update((d) => {
      const nextSettings: Settings = {
        ...d.settings,
        ...setup,
        currentRating:
          setup.currentRating !== undefined
            ? setup.currentRating
            : (setup.startRating ?? d.settings.currentRating),
      };
      let next: AppData = {
        ...d,
        onboarded: true,
        isSample: false,
        settings: nextSettings,
      };
      if (cfPayload) {
        const syncedAt = new Date().toISOString();
        const normalized = normalizeCodeforcesSyncResult(cfPayload, syncedAt);
        next = mergePlatformSyncIntoAppData(next, "codeforces", normalized);
        if (setup.startRating !== undefined && setup.startRating > 0) {
          next.settings.startRating = setup.startRating;
        }
      }
      return next;
    });
  },

  updateSettings(patch: Partial<Settings>) {
    update((d) => ({
      ...d,
      onboarded: true,
      isSample: false,
      settings: { ...d.settings, ...patch },
    }));
  },

  /**
   * Synchronizes a single platform independently.
   * Never erases previously saved data if an API or network failure occurs.
   */
  async syncPlatform(
    platformId: PrimaryPlatformId,
    usernameOverride?: string,
  ): Promise<{ ok: true; result: PlatformSyncResult } | { ok: false; error: string }> {
    const current = load();
    const existingAccount = current.platforms[platformId] ?? createEmptyPlatformAccount(platformId);
    const integration = PLATFORM_INTEGRATIONS[platformId];
    const handle = (usernameOverride ?? existingAccount.username).trim();

    const validation = integration.validateUsername(handle);
    if (!validation.valid) {
      return { ok: false, error: validation.error || "Invalid username." };
    }

    // Set syncing state while preserving all existing metrics and records
    update((d) => ({
      ...d,
      onboarded: true,
      settings:
        platformId === "codeforces" ? { ...d.settings, cfHandle: validation.cleaned } : d.settings,
      cfSync:
        platformId === "codeforces"
          ? {
              ...d.cfSync,
              handle: validation.cleaned,
              status: "syncing",
              syncing: true,
              error: null,
            }
          : d.cfSync,
      platforms: {
        ...d.platforms,
        [platformId]: {
          ...d.platforms[platformId],
          username: validation.cleaned,
          profileUrl: integration.buildProfileUrl(validation.cleaned),
          connectionStatus: "syncing",
          lastError: null,
        },
      },
    }));

    try {
      const result = await integration.syncAccount(validation.cleaned);
      update((d) => mergePlatformSyncIntoAppData(d, platformId, result));
      return { ok: true, result };
    } catch (err) {
      const rawMessage = (err as Error).message || "Unable to synchronize right now.";
      const safeError = rawMessage.includes("previously saved data is safe")
        ? rawMessage
        : `${rawMessage} Unable to synchronize right now. Your previously saved data is safe.`;

      // Non-destructive error state: keep all previously saved ratings, problems, and contests intact!
      update((d) => ({
        ...d,
        cfSync:
          platformId === "codeforces"
            ? {
                ...d.cfSync,
                handle: validation.cleaned,
                status: "error",
                syncing: false,
                error: safeError,
              }
            : d.cfSync,
        platforms: {
          ...d.platforms,
          [platformId]: {
            ...d.platforms[platformId],
            username: validation.cleaned,
            profileUrl: integration.buildProfileUrl(validation.cleaned),
            connectionStatus: "sync_failed",
            lastError: safeError,
          },
        },
      }));
      return { ok: false, error: safeError };
    }
  },

  /**
   * Synchronizes all connected platforms in parallel.
   * One platform failing never prevents the others from synchronizing.
   */
  async syncAllConnectedPlatforms(): Promise<{
    synced: PrimaryPlatformId[];
    failed: { platformId: PrimaryPlatformId; error: string }[];
  }> {
    const current = load();
    const connectedIds = PRIMARY_PLATFORM_IDS.filter((pid) => {
      const acc = current.platforms[pid];
      return acc && acc.username.trim().length > 0 && acc.connectionStatus !== "manual_only";
    });

    const synced: PrimaryPlatformId[] = [];
    const failed: { platformId: PrimaryPlatformId; error: string }[] = [];

    await Promise.allSettled(
      connectedIds.map(async (pid) => {
        const res = await actions.syncPlatform(pid);
        if (res.ok) {
          synced.push(pid);
        } else {
          failed.push({ platformId: pid, error: res.error });
        }
      }),
    );

    return { synced, failed };
  },

  /**
   * Connects or switches a platform account to Manual Tracking Only mode.
   */
  setPlatformManualMode(
    platformId: PrimaryPlatformId,
    username: string,
    manualStats?: {
      currentRating?: number | null;
      highestRating?: number | null;
      totalSolved?: number | null;
    },
  ) {
    const integration = PLATFORM_INTEGRATIONS[platformId];
    const cleaned = username.trim();
    if (!cleaned) return;

    update((d) => {
      const prev = d.platforms[platformId] ?? createEmptyPlatformAccount(platformId);
      const nextAcc: PlatformAccount = {
        ...prev,
        username: cleaned,
        profileUrl: integration.buildProfileUrl(cleaned),
        connectionStatus: "manual_only",
        dataSource: "manual",
        dataSourceLabel: "Manual Tracking Only (user-maintained records)",
        currentRating:
          manualStats?.currentRating !== undefined ? manualStats.currentRating : prev.currentRating,
        highestRating:
          manualStats?.highestRating !== undefined ? manualStats.highestRating : prev.highestRating,
        totalSolved:
          manualStats?.totalSolved !== undefined ? manualStats.totalSolved : prev.totalSolved,
        lastError: null,
      };
      return {
        ...d,
        onboarded: true,
        platforms: {
          ...d.platforms,
          [platformId]: nextAcc,
        },
      };
    });
  },

  /**
   * Disconnects a platform account without deleting its previously synchronized
   * problems, contests, or daily logs.
   */
  disconnectPlatform(platformId: PrimaryPlatformId) {
    update((d) => ({
      ...d,
      settings: platformId === "codeforces" ? { ...d.settings, cfHandle: "" } : d.settings,
      cfSync: platformId === "codeforces" ? { ...DEFAULT_CF_SYNC } : d.cfSync,
      platforms: {
        ...d.platforms,
        [platformId]: createEmptyPlatformAccount(platformId),
      },
    }));
  },

  /**
   * Backwards-compatible Codeforces sync wrapper used across Onboarding, Dashboard, and Settings.
   */
  async syncCodeforces(
    handleOverride?: string,
  ): Promise<{ ok: true; payload: CodeforcesSyncPayload } | { ok: false; error: string }> {
    const current = load();
    const handle = (
      handleOverride ??
      current.platforms.codeforces.username ??
      current.settings.cfHandle ??
      current.cfSync.handle
    ).trim();

    if (!handle) {
      return { ok: false, error: "No Codeforces handle configured. Connect your handle first." };
    }

    update((d) => ({
      ...d,
      settings: { ...d.settings, cfHandle: handle },
      cfSync: {
        ...d.cfSync,
        handle,
        status: "syncing",
        syncing: true,
        error: null,
      },
      platforms: {
        ...d.platforms,
        codeforces: {
          ...d.platforms.codeforces,
          username: handle,
          profileUrl: `https://codeforces.com/profile/${encodeURIComponent(handle)}`,
          connectionStatus: "syncing",
          lastError: null,
        },
      },
    }));

    try {
      const payload = await fetchCodeforcesAccount(handle);
      const syncedAt = new Date().toISOString();
      const normalized = normalizeCodeforcesSyncResult(payload, syncedAt);
      update((d) => mergePlatformSyncIntoAppData(d, "codeforces", normalized));
      return { ok: true, payload };
    } catch (err) {
      const message =
        (err as Error).message ||
        "Unable to synchronize right now. Your previously saved data is safe.";
      update((d) => ({
        ...d,
        cfSync: {
          ...d.cfSync,
          handle,
          status: "error",
          syncing: false,
          error: message,
        },
        platforms: {
          ...d.platforms,
          codeforces: {
            ...d.platforms.codeforces,
            username: handle,
            connectionStatus: "sync_failed",
            lastError: message,
          },
        },
      }));
      return { ok: false, error: message };
    }
  },

  disconnectCodeforces() {
    actions.disconnectPlatform("codeforces");
  },

  /**
   * Pull-to-refresh action: re-synchronizes storage from IndexedDB/localStorage
   * and triggers live multi-platform synchronization for all connected accounts.
   */
  async refreshDashboard(): Promise<{
    syncedCF: boolean;
    syncedPlatforms: PrimaryPlatformId[];
    error?: string;
  }> {
    const idbData = await readFromIDB();
    if (idbData && idbData.onboarded) {
      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (!localRaw) {
        commit(idbData);
      }
    }
    const { synced, failed } = await actions.syncAllConnectedPlatforms();
    notify();
    if (failed.length > 0 && synced.length === 0) {
      return {
        syncedCF: false,
        syncedPlatforms: [],
        error: failed[0]!.error,
      };
    }
    return {
      syncedCF: synced.includes("codeforces"),
      syncedPlatforms: synced,
    };
  },

  saveLog(log: DailyLog, problems: Problem[]) {
    update((d) => {
      const dup = d.logs.find((l) => l.date === log.date && l.id !== log.id);
      if (dup) throw new Error("A log already exists for this date.");
      const normalizedLog: DailyLog = {
        ...log,
        editorial: log.editorial ?? 0,
      };
      const logs = d.logs.some((l) => l.id === normalizedLog.id)
        ? d.logs.map((l) => (l.id === normalizedLog.id ? normalizedLog : l))
        : [...d.logs, normalizedLog];
      const others = d.problems.filter((p) => p.logId !== normalizedLog.id);
      const linkedProblems: Problem[] = problems.map((p) => {
        const plat = p.platform ?? "Codeforces";
        const cfKey =
          plat === "Codeforces" ? p.cfKey || extractCFKeyFromUrl(p.url) || undefined : undefined;
        const problemId = p.problemId || (cfKey ? `CF-${cfKey}` : undefined);
        return {
          ...p,
          platform: plat,
          tags: Array.isArray(p.tags) ? p.tags : p.topic ? [p.topic] : [],
          notes: p.notes ?? "",
          source: p.source ?? "manual",
          logId: normalizedLog.id,
          date: normalizedLog.date,
          ...(cfKey ? { cfKey } : {}),
          ...(problemId ? { problemId } : {}),
        };
      });
      return {
        ...d,
        onboarded: true,
        isSample: false,
        logs,
        problems: [...others, ...linkedProblems],
      };
    });
  },

  deleteLog(id: string) {
    update((d) => ({
      ...d,
      isSample: false,
      logs: d.logs.filter((l) => l.id !== id),
      problems: d.problems.filter((p) => p.logId !== id),
    }));
  },

  saveProblem(p: Problem) {
    update((d) => {
      const plat = p.platform ?? "Codeforces";
      const cfKey =
        plat === "Codeforces" ? p.cfKey || extractCFKeyFromUrl(p.url) || undefined : undefined;
      const problemId = p.problemId?.trim() || (cfKey ? `CF-${cfKey}` : undefined);
      const normalized: Problem = {
        ...p,
        platform: plat,
        tags: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : p.topic ? [p.topic] : [],
        notes: p.notes ?? "",
        source: p.source ?? "manual",
        ...(cfKey ? { cfKey } : {}),
        ...(problemId ? { problemId } : {}),
      };

      const targetDedupKey = getProblemDedupKey(normalized);

      // Deduplicate strictly within the same platform (a Codeforces problem and a LeetCode problem
      // with identical titles remain distinct!)
      const existingIdx = d.problems.findIndex(
        (x) => x.id === normalized.id || getProblemDedupKey(x) === targetDedupKey,
      );

      const problems =
        existingIdx >= 0
          ? d.problems.map((x, idx) =>
              idx === existingIdx ? { ...x, ...normalized, id: x.id } : x,
            )
          : [...d.problems, normalized];

      return {
        ...d,
        onboarded: true,
        isSample: false,
        problems,
      };
    });
  },

  deleteProblem(id: string) {
    update((d) => ({ ...d, isSample: false, problems: d.problems.filter((p) => p.id !== id) }));
  },

  saveTopic(t: Topic) {
    update((d) => ({
      ...d,
      onboarded: true,
      isSample: false,
      topics: d.topics.some((x) => x.id === t.id)
        ? d.topics.map((x) => (x.id === t.id ? t : x))
        : [...d.topics, t],
    }));
  },

  deleteTopic(id: string) {
    update((d) => ({
      ...d,
      isSample: false,
      topics: d.topics.filter((t) => t.id !== id),
    }));
  },

  resetRoadmapToDefault() {
    update((d) => ({
      ...d,
      topics: buildRoadmap(),
    }));
  },

  saveContest(c: Contest) {
    update((d) => {
      const normalized: Contest = {
        ...c,
        performance: c.performance ?? null,
        source: c.source ?? "manual",
      };
      const contests = d.contests.some((x) => x.id === normalized.id)
        ? d.contests.map((x) => (x.id === normalized.id ? normalized : x))
        : [...d.contests, normalized];
      const latestCF = [...contests]
        .filter((x) => x.platform.toLowerCase() === "codeforces" && x.newRating != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1);
      return {
        ...d,
        onboarded: true,
        isSample: false,
        contests,
        settings:
          latestCF?.newRating != null
            ? { ...d.settings, currentRating: latestCF.newRating }
            : d.settings,
      };
    });
  },

  deleteContest(id: string) {
    update((d) => ({ ...d, isSample: false, contests: d.contests.filter((c) => c.id !== id) }));
  },

  exportJSON(): string {
    return JSON.stringify(load(), null, 2);
  },

  importJSON(text: string) {
    const { data } = validateBackupJSON(text);
    commit({ ...data, onboarded: true, isSample: false });
  },

  /**
   * Resets challenge configuration (dates, targets, handle setup) separately
   * WITHOUT deleting any logged problems, daily logs, contests, or connected platform records.
   */
  resetChallengeConfig() {
    update((d) => ({
      ...d,
      onboarded: false,
      settings: {
        ...DEFAULT_SETTINGS,
        name: d.settings.name,
        cfHandle: d.settings.cfHandle,
        startRating: d.settings.startRating,
        currentRating: d.settings.currentRating,
        theme: d.settings.theme,
      },
    }));
  },

  /**
   * Clears all data and resets to a fresh zero-record state, reopening onboarding.
   */
  reset() {
    const fresh = emptyData();
    commit(fresh);
  },
};
