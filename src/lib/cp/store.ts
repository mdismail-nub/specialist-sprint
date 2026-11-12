import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppData, Contest, DailyLog, Problem, Settings, Topic } from "./types";
import { DEFAULT_CF_SYNC, DEFAULT_SETTINGS, emptyData } from "./seed";
import { buildRoadmap } from "./roadmap";
import {
  extractCFKeyFromUrl,
  fetchCodeforcesAccount,
  mergeCodeforcesIntoAppData,
  type CodeforcesSyncPayload,
} from "./codeforces";

/**
 * Centralized local-first data layer with dual persistence (localStorage + IndexedDB).
 * Zero mock data: starts clean and persists all user configuration, logs, problems,
 * roadmap progress, contests, and Codeforces synchronization state.
 */
export const STORAGE_KEY = "cp-tracker:v1";
const IDB_NAME = "cp-tracker-db";
const IDB_VERSION = 1;
const IDB_STORE = "appdata";

let state: AppData | null = null;
let clientHydrated = false;
let idbHydrationStarted = false;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: AppData = emptyData();

export interface BackupSummary {
  name: string;
  cfHandle: string;
  currentRating: number;
  targetRating: number;
  logsCount: number;
  problemsCount: number;
  contestsCount: number;
  topicsCount: number;
  startDate: string;
}

/**
 * Safely migrates stored data from older versions and strips legacy sample/mock records.
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
  const hasRealActivity =
    Boolean(candidate.onboarded) ||
    Boolean(candidate.settings.name?.trim()) ||
    Boolean(candidate.settings.cfHandle?.trim()) ||
    candidate.logs.length > 0 ||
    (Array.isArray(candidate.problems) && candidate.problems.length > 0) ||
    (Array.isArray(candidate.contests) && candidate.contests.length > 0);

  const normalizedLogs: DailyLog[] = candidate.logs.map((l) => ({
    ...l,
    editorial: typeof l.editorial === "number" ? l.editorial : 0,
  }));

  const normalizedProblems: Problem[] = (
    Array.isArray(candidate.problems) ? candidate.problems : []
  ).map((p) => {
    const cfKey = p.cfKey || extractCFKeyFromUrl(p.url) || undefined;
    return {
      ...p,
      platform: p.platform ?? "Codeforces",
      tags: Array.isArray(p.tags) ? p.tags : p.topic ? [p.topic] : [],
      notes: p.notes ?? "",
      source: p.source ?? "manual",
      ...(cfKey ? { cfKey } : {}),
    };
  });

  const normalizedContests: Contest[] = (
    Array.isArray(candidate.contests) ? candidate.contests : []
  ).map((c) => ({
    ...c,
    source: c.source ?? "manual",
  }));

  return {
    version: 1,
    onboarded: candidate.onboarded ?? hasRealActivity,
    isSample: false,
    settings: {
      ...DEFAULT_SETTINGS,
      ...candidate.settings,
      cfHandle: candidate.settings.cfHandle ?? candidate.cfSync?.handle ?? "",
    },
    cfSync: {
      ...DEFAULT_CF_SYNC,
      ...(candidate.cfSync ?? {}),
      // Never get stuck in "syncing" state from a previous session reload
      status:
        candidate.cfSync?.status === "syncing"
          ? candidate.cfSync.lastSyncedAt
            ? "success"
            : "idle"
          : (candidate.cfSync?.status ?? "idle"),
    },
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
  if (typeof window === "undefined") return SERVER_SNAPSHOT;

  let hadValidLocal = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppData>;
      if (parsed && parsed.isSample === true) {
        // Cleanly remove old sample data from localStorage
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

export function useData(): AppData {
  const data = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (clientHydrated ? load() : SERVER_SNAPSHOT),
    () => SERVER_SNAPSHOT,
  );

  useEffect(() => {
    if (!clientHydrated) {
      clientHydrated = true;
      load();
      notify();
    }
  }, []);

  return data;
}

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(clientHydrated);
  useEffect(() => {
    if (!clientHydrated) {
      clientHydrated = true;
      load();
      notify();
    }
    setHydrated(true);
  }, []);
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
        next = mergeCodeforcesIntoAppData(next, cfPayload, new Date().toISOString());
        // Respect explicit startRating if entered by the user
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

  async syncCodeforces(handleOverride?: string): Promise<CodeforcesSyncPayload> {
    const current = load();
    const handle = (handleOverride ?? current.settings.cfHandle ?? current.cfSync.handle).trim();
    if (!handle) {
      throw new Error("No Codeforces handle configured. Connect your handle first.");
    }

    // Set syncing state without clearing existing data
    update((d) => ({
      ...d,
      settings: { ...d.settings, cfHandle: handle },
      cfSync: {
        ...d.cfSync,
        handle,
        status: "syncing",
        error: null,
      },
    }));

    try {
      const payload = await fetchCodeforcesAccount(handle);
      const syncedAt = new Date().toISOString();
      update((d) => mergeCodeforcesIntoAppData(d, payload, syncedAt));
      return payload;
    } catch (err) {
      const message = (err as Error).message || "Failed to synchronize with Codeforces.";
      // Preserve all previously saved data on API failure!
      update((d) => ({
        ...d,
        cfSync: {
          ...d.cfSync,
          handle,
          status: "error",
          error: message,
        },
      }));
      throw err;
    }
  },

  disconnectCodeforces() {
    update((d) => ({
      ...d,
      settings: { ...d.settings, cfHandle: "" },
      cfSync: { ...DEFAULT_CF_SYNC },
    }));
  },

  /**
   * Pull-to-refresh action: re-synchronizes storage from IndexedDB/localStorage
   * and triggers live Codeforces API sync if a handle is connected.
   */
  async refreshDashboard(): Promise<{ syncedCF: boolean }> {
    const idbData = await readFromIDB();
    if (idbData && idbData.onboarded) {
      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (!localRaw) {
        commit(idbData);
      }
    }
    const current = load();
    const handle = current.settings.cfHandle.trim();
    if (handle) {
      await actions.syncCodeforces(handle);
      return { syncedCF: true };
    }
    notify();
    return { syncedCF: false };
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
        const cfKey = p.cfKey || extractCFKeyFromUrl(p.url) || undefined;
        return {
          ...p,
          platform: p.platform ?? "Codeforces",
          tags: Array.isArray(p.tags) ? p.tags : p.topic ? [p.topic] : [],
          notes: p.notes ?? "",
          source: p.source ?? "manual",
          logId: normalizedLog.id,
          date: normalizedLog.date,
          ...(cfKey ? { cfKey } : {}),
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
      const cfKey = p.cfKey || extractCFKeyFromUrl(p.url) || undefined;
      const normalized: Problem = {
        ...p,
        platform: p.platform ?? "Codeforces",
        tags: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : p.topic ? [p.topic] : [],
        notes: p.notes ?? "",
        source: p.source ?? "manual",
        ...(cfKey ? { cfKey } : {}),
      };

      // Deduplicate by id, cfKey, or same platform + normalized URL/title
      const existingIdx = d.problems.findIndex(
        (x) =>
          x.id === normalized.id ||
          (cfKey && x.cfKey && x.cfKey.toUpperCase() === cfKey.toUpperCase()) ||
          (normalized.url &&
            x.url &&
            x.url.trim().toLowerCase() === normalized.url.trim().toLowerCase()) ||
          ((x.platform ?? "Codeforces") === normalized.platform &&
            x.title.trim().toLowerCase() === normalized.title.trim().toLowerCase()),
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
        source: c.source ?? "manual",
      };
      const contests = d.contests.some((x) => x.id === normalized.id)
        ? d.contests.map((x) => (x.id === normalized.id ? normalized : x))
        : [...d.contests, normalized];
      const latest = [...contests]
        .filter((x) => x.newRating != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1);
      return {
        ...d,
        onboarded: true,
        isSample: false,
        contests,
        settings:
          latest?.newRating != null
            ? { ...d.settings, currentRating: latest.newRating }
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
   * WITHOUT deleting any logged problems, daily logs, contests, or roadmap notes.
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
