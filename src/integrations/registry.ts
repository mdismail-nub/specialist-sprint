import type {
  PlatformAccount,
  PlatformIntegration,
  PlatformSyncResult,
  PrimaryPlatformId,
} from "./types";
import { codeforcesIntegration } from "./codeforces";
import { codechefIntegration } from "./codechef";
import { atcoderIntegration } from "./atcoder";
import { leetcodeIntegration } from "./leetcode";
import type { AppData, Contest, Problem, ProblemPlatform } from "@/lib/cp/types";
import { extractCFKeyFromUrl } from "@/lib/cp/codeforces";

export const PRIMARY_PLATFORM_IDS: readonly PrimaryPlatformId[] = [
  "codeforces",
  "codechef",
  "atcoder",
  "leetcode",
] as const;

export const PLATFORM_INTEGRATIONS: Record<PrimaryPlatformId, PlatformIntegration> = {
  codeforces: codeforcesIntegration,
  codechef: codechefIntegration,
  atcoder: atcoderIntegration,
  leetcode: leetcodeIntegration,
};

export const PLATFORM_DISPLAY_NAME: Record<PrimaryPlatformId, ProblemPlatform> = {
  codeforces: "Codeforces",
  codechef: "CodeChef",
  atcoder: "AtCoder",
  leetcode: "LeetCode",
};

export const ALL_PROBLEM_PLATFORMS: readonly ProblemPlatform[] = [
  "Codeforces",
  "CodeChef",
  "AtCoder",
  "LeetCode",
  "CSES",
  "HackerRank",
  "GeeksforGeeks",
  "Other",
] as const;

export function createEmptyPlatformAccount(id: PrimaryPlatformId): PlatformAccount {
  const integration = PLATFORM_INTEGRATIONS[id];
  return {
    platformId: id,
    platformName: integration.name,
    username: "",
    profileUrl: "",
    connectionStatus: "disconnected",
    currentRating: null,
    highestRating: null,
    rankTitle: null,
    totalContests: null,
    totalSolved: null,
    lastSyncedAt: null,
    lastError: null,
    dataSource: integration.dataSource,
    dataSourceLabel: integration.dataSourceLabel,
    availableMetrics: {
      rating: id !== "leetcode",
      highestRating: id !== "leetcode",
      rank: true,
      contests: true,
      solvedCount: true,
      problemList: id !== "codechef",
      difficultyBreakdown: id === "leetcode" || id === "codeforces",
      topicStats: id === "leetcode" || id === "codeforces",
      globalRank: id !== "codeforces",
      countryRank: id === "codechef",
    },
    extraMetrics: {},
    ratingHistory: [],
  };
}

export function createDefaultPlatformsRecord(): Record<PrimaryPlatformId, PlatformAccount> {
  return {
    codeforces: createEmptyPlatformAccount("codeforces"),
    codechef: createEmptyPlatformAccount("codechef"),
    atcoder: createEmptyPlatformAccount("atcoder"),
    leetcode: createEmptyPlatformAccount("leetcode"),
  };
}

/**
 * Generates a canonical platform-scoped deduplication key so a Codeforces problem
 * and a LeetCode problem with identical names never collide, while repeated imports
 * of the same problem on the same platform are deduplicated.
 */
export function getProblemDedupKey(p: Problem): string {
  const plat = (p.platform ?? "Codeforces").toLowerCase();
  if (p.problemId) {
    return `${plat}:id:${p.problemId.trim().toLowerCase()}`;
  }
  if (plat === "codeforces") {
    const cfKey = p.cfKey || extractCFKeyFromUrl(p.url);
    if (cfKey) return `codeforces:cf:${cfKey.trim().toLowerCase()}`;
  }
  if (p.url && p.url.trim()) {
    return `${plat}:url:${p.url.trim().toLowerCase().replace(/\/+$/, "")}`;
  }
  return `${plat}:title:${p.title.trim().toLowerCase()}`;
}

/**
 * Pure state merger that integrates a platform sync result into AppData
 * without overwriting user problem classifications, notes, or other platforms' data.
 */
export function mergePlatformSyncIntoAppData(
  current: AppData,
  platformId: PrimaryPlatformId,
  syncResult: PlatformSyncResult,
): AppData {
  const { account, contests: incomingContests, problems: incomingProblems } = syncResult;
  const displayPlatform = PLATFORM_DISPLAY_NAME[platformId];

  // 1. Merge contests for this platform while preserving all other platforms & manual contests
  const existingContestById = new Map<string, Contest>();
  for (const c of current.contests) {
    existingContestById.set(c.id, c);
    if (c.contestId != null && c.platform.toLowerCase() === displayPlatform.toLowerCase()) {
      existingContestById.set(`${platformId}-cid-${String(c.contestId)}`, c);
    }
  }

  const matchedContestIds = new Set<string>();
  const mergedPlatformContests: Contest[] = incomingContests.map((inc) => {
    const existing =
      existingContestById.get(inc.id) ??
      (inc.contestId != null
        ? existingContestById.get(`${platformId}-cid-${String(inc.contestId)}`)
        : undefined);
    if (!existing) return inc;
    matchedContestIds.add(existing.id);
    return {
      ...inc,
      id: existing.id,
      solved: inc.solved != null && inc.solved > 0 ? inc.solved : existing.solved,
      notes: existing.notes || inc.notes,
    };
  });

  const incomingContestIdSet = new Set(incomingContests.map((c) => c.id));
  const otherContests = current.contests.filter(
    (c) =>
      !matchedContestIds.has(c.id) && !incomingContestIdSet.has(c.id) && c.source !== platformId,
  );

  // Also keep previously synced contests for this platform if a partial fetch occurred
  const preservedPreviousPlatformContests = current.contests.filter(
    (c) =>
      c.source === platformId && !matchedContestIds.has(c.id) && !incomingContestIdSet.has(c.id),
  );

  // 2. Merge problems for this platform while preserving user classifications and notes
  const existingByDedupKey = new Map<string, Problem>();
  for (const p of current.problems) {
    existingByDedupKey.set(getProblemDedupKey(p), p);
  }

  const matchedProblemIds = new Set<string>();
  const mergedPlatformProblems: Problem[] = incomingProblems.map((inc) => {
    const key = getProblemDedupKey(inc);
    const existing = existingByDedupKey.get(key);
    if (!existing) return inc;

    matchedProblemIds.add(existing.id);
    // Preserve manual solving method classification (independent, hint, editorial, resolved).
    // If previously marked "unsolved", promote to "unclassified" since it is now accepted.
    const nextStatus = existing.status === "unsolved" ? "unclassified" : existing.status;

    return {
      ...inc,
      id: existing.id,
      status: nextStatus,
      topic:
        existing.topic &&
        existing.topic !== "General" &&
        existing.topic !== "AtCoder Task" &&
        existing.topic !== "LeetCode Practice"
          ? existing.topic
          : inc.topic,
      tags:
        existing.tags && existing.tags.length > 0
          ? Array.from(new Set([...existing.tags, ...(inc.tags ?? [])]))
          : inc.tags,
      difficultyLabel: existing.difficultyLabel ?? inc.difficultyLabel ?? null,
      minutes: existing.minutes ?? inc.minutes,
      notes: existing.notes || inc.notes || "",
      ...(existing.logId ? { logId: existing.logId } : {}),
    };
  });

  const mergedDedupKeys = new Set(mergedPlatformProblems.map((p) => getProblemDedupKey(p)));
  const remainingProblems = current.problems.filter(
    (p) => !matchedProblemIds.has(p.id) && !mergedDedupKeys.has(getProblemDedupKey(p)),
  );

  // 3. Update settings & legacy cfSync if this is Codeforces
  let nextSettings = { ...current.settings };
  let nextCfSync = { ...current.cfSync };

  if (platformId === "codeforces") {
    const currentRating = account.currentRating ?? nextSettings.currentRating;
    const initialRating =
      account.ratingHistory[0]?.oldRating ?? account.ratingHistory[0]?.rating ?? currentRating;
    nextSettings = {
      ...nextSettings,
      cfHandle: account.username,
      name: nextSettings.name || account.username,
      currentRating: currentRating > 0 ? currentRating : nextSettings.currentRating,
      startRating: nextSettings.startRating > 0 ? nextSettings.startRating : initialRating,
    };
    nextCfSync = {
      handle: account.username,
      status: "success",
      syncing: false,
      lastSyncedAt: account.lastSyncedAt,
      error: null,
      profile: {
        handle: account.username,
        rating: account.currentRating ?? 0,
        maxRating: account.highestRating ?? 0,
        rank: (account.rankTitle || "unrated").toLowerCase(),
        maxRank: (account.rankTitle || "unrated").toLowerCase(),
        contestsCount: account.totalContests ?? 0,
        totalSubmissions: account.extraMetrics.totalSubmissions ?? 0,
        acceptedSubmissions: account.extraMetrics.acceptedSubmissions ?? 0,
        uniqueSolvedCount: account.totalSolved ?? 0,
      },
    };
  }

  return {
    ...current,
    settings: nextSettings,
    cfSync: nextCfSync,
    platforms: {
      ...(current.platforms ?? createDefaultPlatformsRecord()),
      [platformId]: account,
    },
    contests: [...mergedPlatformContests, ...preservedPreviousPlatformContests, ...otherContests],
    problems: [...mergedPlatformProblems, ...remainingProblems],
  };
}
