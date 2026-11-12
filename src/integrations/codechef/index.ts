import type {
  PlatformAccount,
  PlatformIntegration,
  PlatformRatingPoint,
  PlatformSyncResult,
} from "../types";
import type { Contest } from "@/lib/cp/types";

export interface CodeChefRawContest {
  code: string;
  name: string;
  rating: string | number;
  rank: string | number;
  end_date?: string;
  getyear?: string | number;
  getmonth?: string | number;
  getday?: string | number;
}

export interface CodeChefRawPayload {
  username: string;
  currentRating: number | null;
  highestRating: number | null;
  stars: string | null;
  globalRank: number | string | null;
  countryRank: number | string | null;
  totalSolved: number | null;
  contests: CodeChefRawContest[];
}

export function computeCodeChefStars(rating: number | null): string {
  if (rating == null || rating <= 0) return "Unrated";
  if (rating < 1400) return "1★";
  if (rating < 1600) return "2★";
  if (rating < 1800) return "3★";
  if (rating < 2000) return "4★";
  if (rating < 2200) return "5★";
  if (rating < 2500) return "6★";
  return "7★";
}

function normalizeCodeChefDate(c: CodeChefRawContest): string {
  if (c.end_date) {
    const m = c.end_date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
    }
  }
  if (c.getyear && c.getmonth && c.getday) {
    const y = String(c.getyear);
    const m = String(c.getmonth).padStart(2, "0");
    const d = String(c.getday).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pure parser that extracts verified CodeChef profile statistics and contest history
 * from CodeChef's public user profile HTML without fabricating any values.
 */
export function parseCodeChefProfileHtml(username: string, html: string): CodeChefRawPayload {
  if (
    !html ||
    /Page Not Found|404 - Page Not Found|The username specified does not exist/i.test(html)
  ) {
    throw new Error(`CodeChef user "${username}" was not found.`);
  }

  // Extract current rating
  const ratingBlockMatch = html.match(/class="rating-number"[^>]*>([\s\S]*?)<\/div>/i);
  const ratingDigits = ratingBlockMatch?.[1]?.replace(/<[^>]+>/g, "").match(/\d+/);
  let currentRating = ratingDigits ? Number(ratingDigits[0]) : null;

  // Extract highest rating
  const highestMatch = html.match(/Highest Rating[:\s]*(\d+)/i);
  let highestRating = highestMatch ? Number(highestMatch[1]) : null;

  // Extract embedded var all_rating = [...];
  let contests: CodeChefRawContest[] = [];
  const allRatingMatch = html.match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
  if (allRatingMatch?.[1]) {
    try {
      const parsed = JSON.parse(allRatingMatch[1]);
      if (Array.isArray(parsed)) {
        contests = parsed as CodeChefRawContest[];
      }
    } catch {
      contests = [];
    }
  }

  if (currentRating == null && contests.length > 0) {
    const lastR = Number(contests.at(-1)?.rating);
    if (Number.isFinite(lastR) && lastR > 0) currentRating = lastR;
  }
  if (highestRating == null && contests.length > 0) {
    const maxR = Math.max(
      0,
      ...contests.map((c) => Number(c.rating)).filter((n) => Number.isFinite(n)),
    );
    if (maxR > 0) highestRating = maxR;
  }

  // Extract Global Rank & Country Rank
  const globalRankMatch = html.match(
    /<a[^>]*href="\/ratings\/all"[^>]*>\s*<strong>\s*([^<]+?)\s*<\/strong>\s*<\/a>\s*Global Rank/i,
  );
  const countryRankMatch = html.match(
    /<a[^>]*href="\/ratings\/all\?filterBy=Country[^"]*"[^>]*>\s*<strong>\s*([^<]+?)\s*<\/strong>\s*<\/a>\s*Country Rank/i,
  );

  const parseRankVal = (raw?: string): number | string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  };

  const globalRank = parseRankVal(globalRankMatch?.[1]);
  const countryRank = parseRankVal(countryRankMatch?.[1]);

  // Extract Total Problems Solved
  const totalSolvedMatch =
    html.match(/Total Problems Solved:\s*(\d+)/i) || html.match(/Fully Solved\s*\((\d+)\)/i);
  const totalSolved = totalSolvedMatch ? Number(totalSolvedMatch[1]) : null;

  const stars = computeCodeChefStars(currentRating);

  // Verify that this was actually a CodeChef profile page
  const hasProfileMarker =
    currentRating != null ||
    highestRating != null ||
    totalSolved != null ||
    contests.length > 0 ||
    html.includes("user-details-container") ||
    html.includes("rating-header");

  if (!hasProfileMarker) {
    throw new Error(`Could not verify CodeChef profile for "${username}".`);
  }

  return {
    username: username.trim(),
    currentRating,
    highestRating,
    stars,
    globalRank,
    countryRank,
    totalSolved,
    contests,
  };
}

export function normalizeCodeChefPayload(
  raw: CodeChefRawPayload,
  syncedAtISO: string = new Date().toISOString(),
): PlatformSyncResult {
  const contests: Contest[] = [];
  const ratingHistory: PlatformRatingPoint[] = [];

  let prevRating: number | null = null;
  for (const c of raw.contests) {
    const newRating = Number(c.rating);
    if (!Number.isFinite(newRating)) continue;
    const rankNum = Number(c.rank);
    const rank = Number.isFinite(rankNum) && rankNum > 0 ? rankNum : null;
    const date = normalizeCodeChefDate(c);
    const oldRating = prevRating;
    const delta = oldRating != null ? newRating - oldRating : 0;

    contests.push({
      id: `cc-contest-${c.code}`,
      contestId: c.code,
      name: c.name || c.code,
      date,
      platform: "CodeChef",
      oldRating,
      newRating,
      // CodeChef's public profile contest array does not include per-contest solved problem counts
      solved: null,
      rank,
      performance: null,
      notes: "",
      source: "codechef",
    });

    ratingHistory.push({
      date,
      rating: newRating,
      oldRating,
      delta,
      contestName: c.name || c.code,
      rank,
      performance: null,
    });

    prevRating = newRating;
  }

  const stars = raw.stars || computeCodeChefStars(raw.currentRating);

  const account: PlatformAccount = {
    platformId: "codechef",
    platformName: "CodeChef",
    username: raw.username,
    profileUrl: `https://www.codechef.com/users/${encodeURIComponent(raw.username)}`,
    // CodeChef provides public profile & contest history, while individual problem list requires manual tracking
    connectionStatus: "partially_supported",
    currentRating: raw.currentRating,
    highestRating: raw.highestRating,
    rankTitle: stars,
    totalContests: contests.length,
    totalSolved: raw.totalSolved,
    lastSyncedAt: syncedAtISO,
    lastError: null,
    dataSource: "public_profile",
    dataSourceLabel: "CodeChef Public Profile Integration (rating, stars, ranks, contest history)",
    availableMetrics: {
      rating: raw.currentRating != null,
      highestRating: raw.highestRating != null,
      rank: stars !== "Unrated",
      contests: true,
      solvedCount: raw.totalSolved != null,
      problemList: false, // Individual solved problem list is not exposed in CodeChef's public profile
      difficultyBreakdown: false,
      topicStats: false,
      globalRank: raw.globalRank != null,
      countryRank: raw.countryRank != null,
    },
    extraMetrics: {
      stars,
      globalRank: raw.globalRank,
      countryRank: raw.countryRank,
    },
    ratingHistory,
  };

  return {
    account,
    contests,
    problems: [],
  };
}

export const codechefIntegration: PlatformIntegration = {
  id: "codechef",
  name: "CodeChef",
  shortCode: "CC",
  dataSource: "public_profile",
  dataSourceLabel: "CodeChef Public Profile Integration",
  ratingSystemLabel: "CodeChef Star System (1★ → 7★)",

  buildProfileUrl(username: string): string {
    return `https://www.codechef.com/users/${encodeURIComponent(username.trim())}`;
  },

  validateUsername(username: string) {
    const cleaned = username.trim();
    if (!cleaned) {
      return { valid: false, cleaned, error: "Please enter a CodeChef username." };
    }
    if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(cleaned)) {
      return {
        valid: false,
        cleaned,
        error: "Invalid CodeChef username format.",
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
      `/api/platforms/codechef?handle=${encodeURIComponent(validation.cleaned)}`,
      { headers: { Accept: "application/json" } },
    );
    const body = (await response.json()) as {
      ok: boolean;
      error?: string;
      result?: PlatformSyncResult;
    };
    if (!response.ok || !body.ok || !body.result) {
      throw new Error(body.error || "Unable to synchronize CodeChef profile right now.");
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

  async fetchSubmissions() {
    return { supported: false, count: null };
  },

  async fetchSolvedProblems(username: string) {
    const res = await this.syncAccount(username);
    return {
      supported: false,
      problems: [],
      totalCount: res.account.totalSolved,
    };
  },
};
