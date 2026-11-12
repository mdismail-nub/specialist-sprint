import type { AppData, CodeforcesProfile, Contest, Problem } from "./types";

export interface CFUserInfo {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  maxRank?: string;
  avatar?: string;
  titlePhoto?: string;
}

export interface CFRatingChange {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface CFProblemRef {
  contestId?: number;
  index: string;
  name: string;
  rating?: number;
  tags?: string[];
}

export interface CFSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: CFProblemRef;
}

interface CFApiEnvelope<T> {
  status: "OK" | "FAILED";
  comment?: string;
  result?: T;
}

export interface CodeforcesSyncPayload {
  profile: CodeforcesProfile;
  contests: Contest[];
  problems: Problem[];
  initialRating: number;
}

export function unixSecondsToLocalISO(seconds: number): string {
  const d = new Date(seconds * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function extractCFKeyFromUrl(url: string): string | null {
  if (!url) return null;
  const matchContest = url.match(
    /codeforces\.com\/(?:contest|gym)\/(\d+)\/problem\/([A-Za-z0-9]+)/i,
  );
  if (matchContest) {
    return `${matchContest[1]}-${matchContest[2]!.toUpperCase()}`;
  }
  const matchProblemset = url.match(/codeforces\.com\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (matchProblemset) {
    return `${matchProblemset[1]}-${matchProblemset[2]!.toUpperCase()}`;
  }
  return null;
}

/**
 * Pure parser transforming official Codeforces API responses into normalized
 * CP Tracker profile, contest history, and unique solved problem records.
 */
export function parseCodeforcesData(
  userInfo: CFUserInfo,
  ratingChanges: CFRatingChange[],
  submissions: CFSubmission[],
): CodeforcesSyncPayload {
  // 1. Deduplicate accepted ("OK") submissions by contestId + problem index
  const sortedSubs = [...submissions].sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds);
  const acceptedSubs = sortedSubs.filter((s) => s.verdict === "OK" && s.problem);

  const uniqueProblemsMap = new Map<string, Problem>();
  const contestSolvedMap = new Map<number, Set<string>>();

  for (const sub of acceptedSubs) {
    const cId = sub.problem.contestId ?? sub.contestId;
    const idx = (sub.problem.index || "").trim().toUpperCase();
    const cfKey = cId != null ? `${cId}-${idx}` : `pset-${idx}-${sub.problem.name}`;

    if (cId != null) {
      const set = contestSolvedMap.get(cId) ?? new Set<string>();
      set.add(cfKey);
      contestSolvedMap.set(cId, set);
    }

    if (uniqueProblemsMap.has(cfKey)) {
      // Already recorded earliest accepted submission for this problem; do not duplicate
      continue;
    }

    const tags = Array.isArray(sub.problem.tags) ? sub.problem.tags : [];
    const primaryTopic = tags[0] ?? "General";
    const problemUrl =
      cId != null
        ? `https://codeforces.com/contest/${cId}/problem/${idx}`
        : "https://codeforces.com/problemset";
    const displayTitle =
      cId != null ? `${cId}${idx} — ${sub.problem.name}` : `${idx} — ${sub.problem.name}`;

    uniqueProblemsMap.set(cfKey, {
      id: `cf-prob-${cfKey}`,
      cfKey,
      ...(cId != null ? { contestId: String(cId) } : {}),
      problemIndex: idx,
      title: displayTitle,
      url: problemUrl,
      platform: "Codeforces",
      rating: typeof sub.problem.rating === "number" ? sub.problem.rating : null,
      topic: primaryTopic,
      tags,
      date: unixSecondsToLocalISO(sub.creationTimeSeconds),
      // Important: Do NOT assume API-imported accepted submissions were solved independently.
      status: "unclassified",
      minutes: null,
      notes: "",
      source: "codeforces",
    });
  }

  // 2. Transform rated contests
  const sortedRatings = [...ratingChanges].sort(
    (a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds,
  );

  const contests: Contest[] = sortedRatings.map((rc) => ({
    id: `cf-contest-${rc.contestId}`,
    contestId: rc.contestId,
    name: rc.contestName,
    date: unixSecondsToLocalISO(rc.ratingUpdateTimeSeconds),
    platform: "Codeforces",
    oldRating: rc.oldRating,
    newRating: rc.newRating,
    solved: contestSolvedMap.get(rc.contestId)?.size ?? 0,
    rank: rc.rank,
    notes: "",
    source: "codeforces",
  }));

  const currentRating =
    typeof userInfo.rating === "number" ? userInfo.rating : (sortedRatings.at(-1)?.newRating ?? 0);
  const maxRating =
    typeof userInfo.maxRating === "number"
      ? userInfo.maxRating
      : Math.max(currentRating, ...sortedRatings.map((r) => r.newRating), 0);

  const firstContestOld = sortedRatings[0]?.oldRating;
  const initialRating =
    typeof firstContestOld === "number" && firstContestOld > 0 ? firstContestOld : currentRating;

  const profile: CodeforcesProfile = {
    handle: userInfo.handle,
    rating: currentRating,
    maxRating,
    rank: userInfo.rank ?? (currentRating > 0 ? "rated" : "unrated"),
    maxRank: userInfo.maxRank ?? userInfo.rank ?? "unrated",
    ...(userInfo.avatar ? { avatar: userInfo.avatar } : {}),
    contestsCount: contests.length,
    totalSubmissions: submissions.length,
    acceptedSubmissions: acceptedSubs.length,
    uniqueSolvedCount: uniqueProblemsMap.size,
  };

  return {
    profile,
    contests,
    problems: [...uniqueProblemsMap.values()],
    initialRating,
  };
}

/**
 * Pure state merger that integrates Codeforces sync payload into AppData
 * without overwriting user-classified problem statuses, personal notes, or manual records.
 */
export function mergeCodeforcesIntoAppData(
  current: AppData,
  payload: CodeforcesSyncPayload,
  syncedAtISO: string = new Date().toISOString(),
): AppData {
  // 1. Merge contests (preserve manual contests and any user notes on CF contests)
  const existingContestsById = new Map<string, Contest>();
  for (const c of current.contests) {
    existingContestsById.set(c.id, c);
    if (c.contestId != null) {
      existingContestsById.set(`cf-contest-${c.contestId}`, c);
    }
  }

  const syncedContestIds = new Set<string>();
  const mergedCFContests: Contest[] = payload.contests.map((cfContest) => {
    syncedContestIds.add(cfContest.id);
    const existing = existingContestsById.get(cfContest.id);
    if (!existing) return cfContest;
    return {
      ...cfContest,
      solved: cfContest.solved > 0 ? cfContest.solved : existing.solved,
      notes: existing.notes || cfContest.notes,
    };
  });

  const manualContests = current.contests.filter(
    (c) =>
      c.source !== "codeforces" &&
      !syncedContestIds.has(c.id) &&
      (c.contestId == null || !syncedContestIds.has(`cf-contest-${c.contestId}`)),
  );

  // 2. Merge problems (preserve manual problems and user's solving method classifications)
  const existingByCFKey = new Map<string, Problem>();
  for (const p of current.problems) {
    const key = p.cfKey || extractCFKeyFromUrl(p.url);
    if (key) {
      existingByCFKey.set(key.toUpperCase(), p);
    }
  }

  const matchedExistingIds = new Set<string>();
  const mergedCFProblems: Problem[] = payload.problems.map((cfProb) => {
    const key = (cfProb.cfKey || "").toUpperCase();
    const existing = key ? existingByCFKey.get(key) : undefined;
    if (!existing) return cfProb;

    matchedExistingIds.add(existing.id);
    // Preserve manual classification (independent, hint, editorial, resolved).
    // If previously marked "unsolved", update to "unclassified" since it is now accepted on CF.
    const nextStatus = existing.status === "unsolved" ? "unclassified" : existing.status;

    return {
      ...cfProb,
      id: existing.id,
      status: nextStatus,
      topic: existing.topic && existing.topic !== "General" ? existing.topic : cfProb.topic,
      minutes: existing.minutes ?? cfProb.minutes,
      notes: existing.notes ?? cfProb.notes ?? "",
      ...(existing.logId ? { logId: existing.logId } : {}),
    };
  });

  const remainingProblems = current.problems.filter(
    (p) => !matchedExistingIds.has(p.id) && p.source !== "codeforces",
  );

  // Also keep any previously synced CF problems if a partial fetch ever occurred
  const newCFKeys = new Set(mergedCFProblems.map((p) => p.cfKey));
  const preservedPreviousCFProblems = current.problems.filter(
    (p) =>
      !matchedExistingIds.has(p.id) &&
      p.source === "codeforces" &&
      p.cfKey &&
      !newCFKeys.has(p.cfKey),
  );

  const nextSettings = {
    ...current.settings,
    cfHandle: payload.profile.handle,
    name: current.settings.name || payload.profile.handle,
    currentRating:
      payload.profile.rating > 0 ? payload.profile.rating : current.settings.currentRating,
    startRating:
      current.settings.startRating > 0 ? current.settings.startRating : payload.initialRating,
  };

  return {
    ...current,
    settings: nextSettings,
    cfSync: {
      handle: payload.profile.handle,
      status: "success",
      lastSyncedAt: syncedAtISO,
      error: null,
      profile: payload.profile,
    },
    contests: [...mergedCFContests, ...manualContests],
    problems: [...mergedCFProblems, ...preservedPreviousCFProblems, ...remainingProblems],
  };
}

async function fetchCFEndpoint<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error(
      "Network error while contacting Codeforces. Your saved local data is preserved.",
    );
  }

  if (response.status === 429 || response.status === 503) {
    throw new Error("Codeforces API rate limit reached. Please wait a few seconds and try again.");
  }

  let json: CFApiEnvelope<T>;
  try {
    json = (await response.json()) as CFApiEnvelope<T>;
  } catch {
    throw new Error("Received an unreadable response from Codeforces API.");
  }

  if (json.status !== "OK" || json.result === undefined) {
    const comment = json.comment || `Codeforces API returned HTTP ${response.status}`;
    if (/not found/i.test(comment)) {
      throw new Error(`Codeforces handle not found. Please check the spelling.`);
    }
    if (/limit exceeded/i.test(comment)) {
      throw new Error("Codeforces API rate limit exceeded. Please wait a moment and retry.");
    }
    throw new Error(comment);
  }

  return json.result;
}

/**
 * Fetches official Codeforces user.info, user.rating, and user.status endpoints
 * with polite sequential spacing to avoid Codeforces 1-req/2s rate limiting.
 */
export async function fetchCodeforcesAccount(handle: string): Promise<CodeforcesSyncPayload> {
  const cleanHandle = handle.trim();
  if (!cleanHandle) {
    throw new Error("Please enter a Codeforces handle.");
  }
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(cleanHandle)) {
    throw new Error(
      "Invalid Codeforces handle format (use 3–24 letters, digits, underscores, hyphens, or dots).",
    );
  }

  const encoded = encodeURIComponent(cleanHandle);

  // 1. Fetch user.info
  const users = await fetchCFEndpoint<CFUserInfo[]>(
    `https://codeforces.com/api/user.info?handles=${encoded}`,
  );
  const userInfo = users[0];
  if (!userInfo) {
    throw new Error(`Codeforces handle "${cleanHandle}" was not found.`);
  }

  // Brief pause to respect Codeforces API rate limit (max 5 reqs / sec, burst sensitive)
  await new Promise((r) => setTimeout(r, 250));

  // 2. Fetch user.rating and user.status
  const [ratingChanges, submissions] = await Promise.all([
    fetchCFEndpoint<CFRatingChange[]>(`https://codeforces.com/api/user.rating?handle=${encoded}`),
    fetchCFEndpoint<CFSubmission[]>(
      `https://codeforces.com/api/user.status?handle=${encoded}&from=1&count=2000`,
    ),
  ]);

  return parseCodeforcesData(userInfo, ratingChanges, submissions);
}
