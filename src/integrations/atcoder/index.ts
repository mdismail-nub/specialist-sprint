import type {
  PlatformAccount,
  PlatformIntegration,
  PlatformRatingPoint,
  PlatformSyncResult,
} from "../types";
import type { Contest, Problem } from "@/lib/cp/types";

export interface AtCoderHistoryEntry {
  IsRated: boolean;
  Place: number;
  OldRating: number;
  NewRating: number;
  Performance: number;
  InnerPerformance?: number;
  ContestScreenName: string;
  ContestName: string;
  ContestNameEn?: string;
  EndTime: string;
}

export interface AtCoderKenkooSubmission {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  user_id: string;
  language: string;
  point: number;
  result: string;
}

export function computeAtCoderColorRank(rating: number | null): string {
  if (rating == null || rating <= 0) return "Unrated";
  if (rating < 400) return "Gray (8 Kyu – 6 Kyu)";
  if (rating < 800) return "Brown (5 Kyu – 4 Kyu)";
  if (rating < 1200) return "Green (3 Kyu – 2 Kyu)";
  if (rating < 1600) return "Cyan (1 Kyu)";
  if (rating < 2000) return "Blue (1 Dan – 2 Dan)";
  if (rating < 2400) return "Yellow (3 Dan – 4 Dan)";
  if (rating < 2800) return "Orange (5 Dan – 6 Dan)";
  return "Red (7 Dan+)";
}

function isoDateFromTimestampOrString(endTime: string): string {
  const m = endTime.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];
  const d = new Date(endTime);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function unixToLocalDate(sec: number): string {
  const d = new Date(sec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Pure parser transforming AtCoder official contest history JSON and optional
 * Kenkoo AtCoder Problems v3 API responses into normalized CP Tracker records.
 */
export function parseAtCoderPayload(
  username: string,
  history: AtCoderHistoryEntry[],
  acCount: number | null,
  globalAcRank: number | null,
  submissions: AtCoderKenkooSubmission[] = [],
  syncedAtISO: string = new Date().toISOString(),
): PlatformSyncResult {
  const ratedContests = history.filter((h) => h.IsRated || h.NewRating > 0);
  const currentRating = ratedContests.length > 0 ? ratedContests.at(-1)!.NewRating : null;
  const highestRating =
    ratedContests.length > 0 ? Math.max(...ratedContests.map((h) => h.NewRating)) : null;

  // Deduplicate accepted submissions from Kenkoo AtCoder Problems API if available
  const sortedSubs = [...submissions].sort((a, b) => a.epoch_second - b.epoch_second);
  const acceptedSubs = sortedSubs.filter((s) => s.result === "AC" && s.problem_id);
  const uniqueProblemsMap = new Map<string, Problem>();
  const contestSolvedMap = new Map<string, Set<string>>();

  for (const sub of acceptedSubs) {
    const pid = sub.problem_id.trim();
    const cid = sub.contest_id.trim();
    if (cid) {
      const set = contestSolvedMap.get(cid) ?? new Set<string>();
      set.add(pid);
      contestSolvedMap.set(cid, set);
    }
    if (uniqueProblemsMap.has(pid)) continue;

    const displayTitle = `${pid.toUpperCase().replace("_", " ")} (${cid.toUpperCase()})`;
    uniqueProblemsMap.set(pid, {
      id: `ac-prob-${pid}`,
      problemId: `AC-${pid}`,
      contestId: cid,
      title: displayTitle,
      url: `https://atcoder.jp/contests/${encodeURIComponent(cid)}/tasks/${encodeURIComponent(pid)}`,
      platform: "AtCoder",
      rating: sub.point > 0 ? sub.point : null,
      topic: "AtCoder Task",
      tags: [cid.toUpperCase()],
      date: unixToLocalDate(sub.epoch_second),
      // Never assume imported accepted submissions were solved independently
      status: "unclassified",
      minutes: null,
      notes: "",
      source: "atcoder",
    });
  }

  const contests: Contest[] = [];
  const ratingHistory: PlatformRatingPoint[] = [];

  for (const h of history) {
    const contestSlug = h.ContestScreenName.split(".")[0] || h.ContestScreenName;
    const date = isoDateFromTimestampOrString(h.EndTime);
    const title = (h.ContestNameEn && h.ContestNameEn.trim()) || h.ContestName || contestSlug;
    const solvedInContest = contestSolvedMap.get(contestSlug)?.size ?? null;

    contests.push({
      id: `ac-contest-${contestSlug}-${date}`,
      contestId: contestSlug,
      name: title,
      date,
      platform: "AtCoder",
      oldRating: h.IsRated ? h.OldRating : null,
      newRating: h.IsRated ? h.NewRating : null,
      solved: solvedInContest,
      rank: h.Place > 0 ? h.Place : null,
      performance: h.Performance > 0 ? h.Performance : null,
      notes: h.IsRated ? `Performance: ${h.Performance}` : "Unrated participation",
      source: "atcoder",
    });

    if (h.IsRated && h.NewRating > 0) {
      ratingHistory.push({
        date,
        rating: h.NewRating,
        oldRating: h.OldRating,
        delta: h.NewRating - h.OldRating,
        contestName: title,
        rank: h.Place > 0 ? h.Place : null,
        performance: h.Performance > 0 ? h.Performance : null,
      });
    }
  }

  const totalSolved =
    acCount != null
      ? Math.max(acCount, uniqueProblemsMap.size)
      : uniqueProblemsMap.size > 0
        ? uniqueProblemsMap.size
        : null;
  const colorRank = computeAtCoderColorRank(currentRating);

  const account: PlatformAccount = {
    platformId: "atcoder",
    platformName: "AtCoder",
    username: username.trim(),
    profileUrl: `https://atcoder.jp/users/${encodeURIComponent(username.trim())}`,
    connectionStatus: "connected",
    currentRating,
    highestRating,
    rankTitle: colorRank,
    totalContests: contests.length,
    totalSolved,
    lastSyncedAt: syncedAtISO,
    lastError: null,
    dataSource: "third_party_provider",
    dataSourceLabel: "AtCoder Official Contest History JSON + AtCoder Problems (Kenkoo v3)",
    availableMetrics: {
      rating: currentRating != null,
      highestRating: highestRating != null,
      rank: currentRating != null,
      contests: true,
      solvedCount: totalSolved != null,
      problemList: uniqueProblemsMap.size > 0,
      difficultyBreakdown: false,
      topicStats: false,
      globalRank: globalAcRank != null,
      countryRank: false,
    },
    extraMetrics: {
      colorTier: colorRank,
      globalRank: globalAcRank,
      acceptedSubmissions: acceptedSubs.length > 0 ? acceptedSubs.length : acCount,
      totalSubmissions: submissions.length > 0 ? submissions.length : null,
    },
    ratingHistory,
  };

  return {
    account,
    contests,
    problems: [...uniqueProblemsMap.values()],
  };
}

export const atcoderIntegration: PlatformIntegration = {
  id: "atcoder",
  name: "AtCoder",
  shortCode: "AC",
  dataSource: "third_party_provider",
  dataSourceLabel: "AtCoder Official History JSON + AtCoder Problems v3",
  ratingSystemLabel: "AtCoder Rating & Kyu/Dan Color System (Gray → Red)",

  buildProfileUrl(username: string): string {
    return `https://atcoder.jp/users/${encodeURIComponent(username.trim())}`;
  },

  validateUsername(username: string) {
    const cleaned = username.trim();
    if (!cleaned) {
      return { valid: false, cleaned, error: "Please enter an AtCoder username." };
    }
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(cleaned)) {
      return {
        valid: false,
        cleaned,
        error: "AtCoder username must be 2–20 letters, digits, or underscores.",
      };
    }
    return { valid: true, cleaned };
  },

  async syncAccount(username: string): Promise<PlatformSyncResult> {
    const validation = this.validateUsername(username);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const response = await fetch(
      `/api/platforms/atcoder?handle=${encodeURIComponent(validation.cleaned)}`,
      { headers: { Accept: "application/json" } },
    );
    const body = (await response.json()) as {
      ok: boolean;
      error?: string;
      result?: PlatformSyncResult;
    };
    if (!response.ok || !body.ok || !body.result) {
      throw new Error(body.error || "Unable to synchronize AtCoder account right now.");
    }
    return body.result;
  },

  async connectAccount(username: string): Promise<PlatformSyncResult> {
    return this.syncAccount(username);
  },

  async fetchProfile(username: string) {
    const res = await this.syncAccount(username);
    return res.account;
  },

  async fetchRatingHistory(username: string) {
    const res = await this.syncAccount(username);
    return res.account.ratingHistory;
  },

  async fetchContests(username: string) {
    const res = await this.syncAccount(username);
    return res.contests;
  },

  async fetchSubmissions(username: string) {
    const res = await this.syncAccount(username);
    return {
      supported: res.account.extraMetrics.totalSubmissions != null,
      count: res.account.extraMetrics.totalSubmissions ?? null,
    };
  },

  async fetchSolvedProblems(username: string) {
    const res = await this.syncAccount(username);
    return {
      supported: true,
      problems: res.problems,
      totalCount: res.account.totalSolved,
    };
  },
};
