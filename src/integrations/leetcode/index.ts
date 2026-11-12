import type {
  PlatformAccount,
  PlatformIntegration,
  PlatformRatingPoint,
  PlatformSyncResult,
} from "../types";
import type { Contest, Problem } from "@/lib/cp/types";

export interface LeetCodeAcStat {
  difficulty: "All" | "Easy" | "Medium" | "Hard";
  count: number;
  submissions: number;
}

export interface LeetCodeContestHistoryItem {
  attended: boolean;
  rating: number;
  ranking: number;
  problemsSolved: number;
  totalProblems: number;
  contest: {
    title: string;
    startTime: number;
  };
}

export interface LeetCodeRecentAcItem {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string | number;
}

export interface LeetCodeTagCount {
  tagName: string;
  problemsSolved: number;
}

export interface LeetCodeGraphQLData {
  matchedUser: {
    username: string;
    profile?: {
      ranking?: number;
      realName?: string;
      userAvatar?: string;
    };
    submitStatsGlobal?: {
      acSubmissionNum?: LeetCodeAcStat[];
    };
    tagProblemCounts?: {
      advanced?: LeetCodeTagCount[];
      intermediate?: LeetCodeTagCount[];
      fundamental?: LeetCodeTagCount[];
    };
  } | null;
  userContestRanking?: {
    attendedContestsCount?: number;
    rating?: number;
    globalRanking?: number;
    topPercentage?: number;
    badge?: { name?: string } | null;
  } | null;
  userContestRankingHistory?: LeetCodeContestHistoryItem[] | null;
  recentAcSubmissionList?: LeetCodeRecentAcItem[] | null;
}

function unixSecondsToLocalISO(sec: number): string {
  const d = new Date(sec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeLeetCodeTitle(
  rating: number | null,
  badgeName?: string | null,
  topPct?: number | null,
): string {
  if (badgeName && badgeName.trim()) return badgeName.trim();
  if (rating != null && rating >= 2400) return "Guardian";
  if (rating != null && rating >= 1850) return "Knight";
  if (topPct != null && topPct > 0) return `Top ${topPct}%`;
  if (rating != null && rating > 0) return "Rated Competitor";
  return "Active Solver";
}

/**
 * Pure parser transforming read-only LeetCode public GraphQL profile responses
 * into normalized CP Tracker account, contest, and problem records.
 */
export function parseLeetCodeGraphQLPayload(
  rawData: LeetCodeGraphQLData,
  syncedAtISO: string = new Date().toISOString(),
): PlatformSyncResult {
  const user = rawData.matchedUser;
  if (!user) {
    throw new Error("LeetCode username not found or profile is not public.");
  }

  const acNums = user.submitStatsGlobal?.acSubmissionNum ?? [];
  const findCount = (diff: LeetCodeAcStat["difficulty"]) =>
    acNums.find((x) => x.difficulty === diff)?.count ?? 0;

  const totalSolved = findCount("All");
  const easySolved = findCount("Easy");
  const mediumSolved = findCount("Medium");
  const hardSolved = findCount("Hard");
  const totalAcSubmissions = acNums.find((x) => x.difficulty === "All")?.submissions ?? null;

  // Topic-wise counts from public tagProblemCounts
  const topicMap = new Map<string, number>();
  const tagGroups = [
    ...(user.tagProblemCounts?.fundamental ?? []),
    ...(user.tagProblemCounts?.intermediate ?? []),
    ...(user.tagProblemCounts?.advanced ?? []),
  ];
  for (const t of tagGroups) {
    if (t.tagName && t.problemsSolved > 0) {
      topicMap.set(t.tagName, (topicMap.get(t.tagName) ?? 0) + t.problemsSolved);
    }
  }
  const topicCounts = [...topicMap.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  // Contest history
  const attendedHistory = (rawData.userContestRankingHistory ?? []).filter((c) => c.attended);
  const contests: Contest[] = [];
  const ratingHistory: PlatformRatingPoint[] = [];

  let prevRating: number | null = null;
  for (const item of attendedHistory) {
    const newRating = Math.round(item.rating);
    const oldRating = prevRating;
    const delta = oldRating != null ? newRating - oldRating : 0;
    const date = unixSecondsToLocalISO(item.contest.startTime);
    const slug = item.contest.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    contests.push({
      id: `lc-contest-${slug}-${date}`,
      contestId: slug,
      name: item.contest.title,
      date,
      platform: "LeetCode",
      oldRating,
      newRating,
      solved: item.problemsSolved,
      rank: item.ranking > 0 ? item.ranking : null,
      performance: null,
      notes: `Solved ${item.problemsSolved}/${item.totalProblems}`,
      source: "leetcode",
    });

    ratingHistory.push({
      date,
      rating: newRating,
      oldRating,
      delta,
      contestName: item.contest.title,
      rank: item.ranking > 0 ? item.ranking : null,
      performance: null,
    });

    prevRating = newRating;
  }

  const cr = rawData.userContestRanking;
  const currentRating =
    cr?.rating != null && cr.rating > 0
      ? Math.round(cr.rating)
      : (ratingHistory.at(-1)?.rating ?? null);
  const highestRating =
    ratingHistory.length > 0
      ? Math.max(currentRating ?? 0, ...ratingHistory.map((r) => r.rating))
      : currentRating;
  const totalContests = cr?.attendedContestsCount ?? contests.length;
  const globalRanking = cr?.globalRanking ?? user.profile?.ranking ?? null;
  const topPercentage = cr?.topPercentage ?? null;

  // Deduplicate recent accepted submissions by titleSlug
  const recentAc = rawData.recentAcSubmissionList ?? [];
  const uniqueProblemsMap = new Map<string, Problem>();
  for (const sub of recentAc) {
    const slug = (sub.titleSlug || "").trim();
    if (!slug || uniqueProblemsMap.has(slug)) continue;
    const ts = Number(sub.timestamp);
    const date =
      Number.isFinite(ts) && ts > 0 ? unixSecondsToLocalISO(ts) : syncedAtISO.slice(0, 10);

    uniqueProblemsMap.set(slug, {
      id: `lc-prob-${slug}`,
      problemId: `LC-${slug}`,
      title: sub.title || slug,
      url: `https://leetcode.com/problems/${encodeURIComponent(slug)}/`,
      platform: "LeetCode",
      rating: null,
      difficultyLabel: null,
      topic: topicCounts[0]?.topic ?? "LeetCode Practice",
      tags: ["leetcode"],
      date,
      // Never assume imported accepted problems were solved independently
      status: "unclassified",
      minutes: null,
      notes: "",
      source: "leetcode",
    });
  }

  const rankTitle = computeLeetCodeTitle(currentRating, cr?.badge?.name, topPercentage);

  const account: PlatformAccount = {
    platformId: "leetcode",
    platformName: "LeetCode",
    username: user.username,
    profileUrl: `https://leetcode.com/u/${encodeURIComponent(user.username)}/`,
    // Public read-only profile exposes full aggregate difficulty/topic stats and recent AC list (up to 20 most recent)
    connectionStatus: "connected",
    currentRating,
    highestRating,
    rankTitle,
    totalContests,
    totalSolved,
    lastSyncedAt: syncedAtISO,
    lastError: null,
    dataSource: "public_profile",
    dataSourceLabel: "LeetCode Read-Only Public Profile GraphQL (no auth tokens or cookies)",
    availableMetrics: {
      rating: currentRating != null,
      highestRating: highestRating != null,
      rank: true,
      contests: true,
      solvedCount: true,
      problemList: uniqueProblemsMap.size > 0, // Public profile provides recent AC submissions; older problems can be added manually
      difficultyBreakdown: true,
      topicStats: topicCounts.length > 0,
      globalRank: globalRanking != null,
      countryRank: false,
    },
    extraMetrics: {
      easySolved,
      mediumSolved,
      hardSolved,
      globalRank: globalRanking,
      topPercentage,
      acceptedSubmissions: totalAcSubmissions,
      topicCounts,
    },
    ratingHistory,
  };

  return {
    account,
    contests,
    problems: [...uniqueProblemsMap.values()],
  };
}

export const leetcodeIntegration: PlatformIntegration = {
  id: "leetcode",
  name: "LeetCode",
  shortCode: "LC",
  dataSource: "public_profile",
  dataSourceLabel: "LeetCode Read-Only Public Profile Integration",
  ratingSystemLabel: "LeetCode Contest Rating & Easy/Medium/Hard Breakdown",

  buildProfileUrl(username: string): string {
    return `https://leetcode.com/u/${encodeURIComponent(username.trim())}/`;
  },

  validateUsername(username: string) {
    const cleaned = username.trim();
    if (!cleaned) {
      return { valid: false, cleaned, error: "Please enter a LeetCode username." };
    }
    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(cleaned)) {
      return {
        valid: false,
        cleaned,
        error: "LeetCode username must be 2–32 letters, digits, underscores, or hyphens.",
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
      `/api/platforms/leetcode?handle=${encodeURIComponent(validation.cleaned)}`,
      { headers: { Accept: "application/json" } },
    );
    const body = (await response.json()) as {
      ok: boolean;
      error?: string;
      result?: PlatformSyncResult;
    };
    if (!response.ok || !body.ok || !body.result) {
      throw new Error(body.error || "Unable to synchronize LeetCode profile right now.");
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
      supported: res.account.extraMetrics.acceptedSubmissions != null,
      count: res.account.extraMetrics.acceptedSubmissions ?? null,
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
