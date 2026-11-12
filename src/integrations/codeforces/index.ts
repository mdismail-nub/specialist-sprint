import type {
  PlatformAccount,
  PlatformIntegration,
  PlatformRatingPoint,
  PlatformSyncResult,
} from "../types";
import {
  fetchCodeforcesAccount,
  parseCodeforcesData,
  type CFRatingChange,
  type CFSubmission,
  type CFUserInfo,
  type CodeforcesSyncPayload,
} from "@/lib/cp/codeforces";
import type { Contest, Problem } from "@/lib/cp/types";

export function formatCodeforcesRank(rank?: string, rating?: number): string {
  if (rank && rank.trim()) {
    return rank
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  if (!rating || rating <= 0) return "Unrated";
  if (rating < 1200) return "Newbie";
  if (rating < 1400) return "Pupil";
  if (rating < 1600) return "Specialist";
  if (rating < 1900) return "Expert";
  if (rating < 2100) return "Candidate Master";
  if (rating < 2300) return "Master";
  if (rating < 2400) return "International Master";
  if (rating < 2600) return "Grandmaster";
  if (rating < 3000) return "International Grandmaster";
  return "Legendary Grandmaster";
}

export function normalizeCodeforcesSyncResult(
  payload: CodeforcesSyncPayload,
  syncedAtISO: string = new Date().toISOString(),
): PlatformSyncResult {
  const { profile, contests, problems } = payload;

  const sortedContests = [...contests].sort((a, b) => a.date.localeCompare(b.date));
  const ratingHistory: PlatformRatingPoint[] = sortedContests
    .filter((c) => c.newRating != null)
    .map((c) => ({
      date: c.date,
      rating: c.newRating!,
      oldRating: c.oldRating,
      delta: c.newRating! - (c.oldRating ?? c.newRating!),
      contestName: c.name,
      rank: c.rank,
      performance: null,
    }));

  const normalizedProblems: Problem[] = problems.map((p) => ({
    ...p,
    problemId: p.cfKey ? `CF-${p.cfKey}` : p.id,
    platform: "Codeforces",
    source: "codeforces",
    status: p.status ?? "unclassified",
  }));

  const normalizedContests: Contest[] = contests.map((c) => ({
    ...c,
    platform: "Codeforces",
    source: "codeforces",
    performance: null,
  }));

  const account: PlatformAccount = {
    platformId: "codeforces",
    platformName: "Codeforces",
    username: profile.handle,
    profileUrl: `https://codeforces.com/profile/${encodeURIComponent(profile.handle)}`,
    connectionStatus: "connected",
    currentRating: profile.rating > 0 ? profile.rating : null,
    highestRating: profile.maxRating > 0 ? profile.maxRating : null,
    rankTitle: formatCodeforcesRank(profile.rank, profile.rating),
    totalContests: profile.contestsCount,
    totalSolved: profile.uniqueSolvedCount,
    lastSyncedAt: syncedAtISO,
    lastError: null,
    dataSource: "official_api",
    dataSourceLabel: "Official Codeforces REST API (user.info, user.rating, user.status)",
    availableMetrics: {
      rating: true,
      highestRating: true,
      rank: true,
      contests: true,
      solvedCount: true,
      problemList: true,
      difficultyBreakdown: true,
      topicStats: true,
      globalRank: false,
      countryRank: false,
    },
    extraMetrics: {
      acceptedSubmissions: profile.acceptedSubmissions,
      totalSubmissions: profile.totalSubmissions,
    },
    ratingHistory,
  };

  return {
    account,
    contests: normalizedContests,
    problems: normalizedProblems,
  };
}

export function parseCodeforcesToPlatformResult(
  userInfo: CFUserInfo,
  ratingChanges: CFRatingChange[],
  submissions: CFSubmission[],
  syncedAtISO: string = new Date().toISOString(),
): PlatformSyncResult {
  const payload = parseCodeforcesData(userInfo, ratingChanges, submissions);
  return normalizeCodeforcesSyncResult(payload, syncedAtISO);
}

export const codeforcesIntegration: PlatformIntegration = {
  id: "codeforces",
  name: "Codeforces",
  shortCode: "CF",
  dataSource: "official_api",
  dataSourceLabel: "Official Codeforces REST API",
  ratingSystemLabel: "Codeforces Elo (Newbie → Legendary Grandmaster)",

  buildProfileUrl(username: string): string {
    return `https://codeforces.com/profile/${encodeURIComponent(username.trim())}`;
  },

  validateUsername(username: string) {
    const cleaned = username.trim();
    if (!cleaned) {
      return { valid: false, cleaned, error: "Please enter a Codeforces handle." };
    }
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(cleaned)) {
      return {
        valid: false,
        cleaned,
        error: "Codeforces handle must be 3–24 letters, digits, underscores, hyphens, or dots.",
      };
    }
    return { valid: true, cleaned };
  },

  async syncAccount(username: string): Promise<PlatformSyncResult> {
    const validation = this.validateUsername(username);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const payload = await fetchCodeforcesAccount(validation.cleaned);
    return normalizeCodeforcesSyncResult(payload, new Date().toISOString());
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
      supported: true,
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
