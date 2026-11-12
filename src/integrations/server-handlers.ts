import type { PlatformSyncResult } from "./types";
import { fetchCodeforcesAccount } from "@/lib/cp/codeforces";
import { normalizeCodeforcesSyncResult } from "./codeforces";
import { normalizeCodeChefPayload, parseCodeChefProfileHtml } from "./codechef";
import {
  parseAtCoderPayload,
  type AtCoderHistoryEntry,
  type AtCoderKenkooSubmission,
} from "./atcoder";
import { parseLeetCodeGraphQLPayload, type LeetCodeGraphQLData } from "./leetcode";

interface CacheEntry {
  expiresAt: number;
  result: PlatformSyncResult;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes server-side cache
const platformCache = new Map<string, CacheEntry>();

function getCached(key: string): PlatformSyncResult | null {
  const entry = platformCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    platformCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(key: string, result: PlatformSyncResult) {
  platformCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    result,
  });
}

async function handleCodeforcesServerSync(handle: string): Promise<PlatformSyncResult> {
  const payload = await fetchCodeforcesAccount(handle);
  return normalizeCodeforcesSyncResult(payload, new Date().toISOString());
}

async function handleCodeChefServerSync(handle: string): Promise<PlatformSyncResult> {
  const url = `https://www.codechef.com/users/${encodeURIComponent(handle)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (res.status === 404) {
    throw new Error(`CodeChef username "${handle}" was not found.`);
  }
  if (res.status === 429) {
    throw new Error("CodeChef rate limit reached. Please wait a moment and retry.");
  }
  if (!res.ok) {
    throw new Error(`CodeChef returned HTTP ${res.status}.`);
  }

  const html = await res.text();
  const parsed = parseCodeChefProfileHtml(handle, html);
  return normalizeCodeChefPayload(parsed, new Date().toISOString());
}

async function handleAtCoderServerSync(handle: string): Promise<PlatformSyncResult> {
  const encoded = encodeURIComponent(handle);
  // 1. Fetch official AtCoder contest history JSON
  const histRes = await fetch(`https://atcoder.jp/users/${encoded}/history/json`, {
    headers: {
      "User-Agent": "CP-Tracker/1.0",
      Accept: "application/json",
    },
  });

  if (histRes.status === 404) {
    throw new Error(`AtCoder user "${handle}" was not found.`);
  }
  if (!histRes.ok) {
    throw new Error(`AtCoder returned HTTP ${histRes.status}.`);
  }

  let history: AtCoderHistoryEntry[] = [];
  try {
    const parsed = await histRes.json();
    if (Array.isArray(parsed)) {
      history = parsed as AtCoderHistoryEntry[];
    }
  } catch {
    throw new Error(`Could not parse AtCoder history for "${handle}".`);
  }

  // If history is empty, verify whether the user profile page exists on AtCoder
  if (history.length === 0) {
    const profileCheck = await fetch(`https://atcoder.jp/users/${encoded}`, {
      method: "HEAD",
      headers: { "User-Agent": "CP-Tracker/1.0" },
    }).catch(() => null);
    if (profileCheck && profileCheck.status === 404) {
      throw new Error(`AtCoder user "${handle}" was not found.`);
    }
  }

  // 2. Fetch Kenkoo AtCoder Problems v3 API for solved count and recent submissions
  let acCount: number | null = null;
  let globalAcRank: number | null = null;
  let submissions: AtCoderKenkooSubmission[] = [];

  try {
    const rankRes = await fetch(
      `https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${encoded}`,
      { headers: { "User-Agent": "CP-Tracker/1.0", Accept: "application/json" } },
    );
    if (rankRes.ok) {
      const rankJson = (await rankRes.json()) as { count?: number; rank?: number };
      if (typeof rankJson.count === "number") acCount = rankJson.count;
      if (typeof rankJson.rank === "number") globalAcRank = rankJson.rank + 1;
    }
  } catch {
    // Gracefully continue if third-party Kenkoo endpoint is temporarily unavailable
  }

  try {
    // Fetch submissions from the last 180 days (up to 500 items per Kenkoo v3 call)
    const fromSec = Math.max(0, Math.floor(Date.now() / 1000) - 180 * 86400);
    const subsRes = await fetch(
      `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encoded}&from_second=${fromSec}`,
      { headers: { "User-Agent": "CP-Tracker/1.0", Accept: "application/json" } },
    );
    if (subsRes.ok) {
      const subsJson = await subsRes.json();
      if (Array.isArray(subsJson)) {
        submissions = subsJson as AtCoderKenkooSubmission[];
      }
    }
  } catch {
    // Gracefully continue if submissions endpoint is unavailable
  }

  return parseAtCoderPayload(
    handle,
    history,
    acCount,
    globalAcRank,
    submissions,
    new Date().toISOString(),
  );
}

const LEETCODE_GRAPHQL_QUERY = `
query getUserChannelProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      ranking
      realName
      userAvatar
    }
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    tagProblemCounts {
      advanced {
        tagName
        problemsSolved
      }
      intermediate {
        tagName
        problemsSolved
      }
      fundamental {
        tagName
        problemsSolved
      }
    }
  }
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    topPercentage
    badge {
      name
    }
  }
  userContestRankingHistory(username: $username) {
    attended
    rating
    ranking
    problemsSolved
    totalProblems
    contest {
      title
      startTime
    }
  }
  recentAcSubmissionList(username: $username, limit: 20) {
    id
    title
    titleSlug
    timestamp
  }
}
`;

async function handleLeetCodeServerSync(handle: string): Promise<PlatformSyncResult> {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: "https://leetcode.com",
    },
    body: JSON.stringify({
      query: LEETCODE_GRAPHQL_QUERY,
      variables: { username: handle },
    }),
  });

  if (res.status === 429) {
    throw new Error("LeetCode rate limit reached. Please wait a moment and retry.");
  }
  if (!res.ok) {
    throw new Error(`LeetCode returned HTTP ${res.status}.`);
  }

  const payload = (await res.json()) as {
    data?: LeetCodeGraphQLData;
    errors?: { message?: string }[];
  };

  if (!payload.data?.matchedUser) {
    const errMsg = payload.errors?.[0]?.message || `LeetCode user "${handle}" was not found.`;
    throw new Error(errMsg);
  }

  return parseLeetCodeGraphQLPayload(payload.data, new Date().toISOString());
}

export async function handlePlatformApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/platforms/")) {
    return null;
  }

  const platform = url.pathname.replace("/api/platforms/", "").split("/")[0]?.toLowerCase();
  const handle = (url.searchParams.get("handle") || "").trim();
  const forceRefresh = url.searchParams.get("force") === "1";

  if (!handle) {
    return new Response(
      JSON.stringify({ ok: false, error: "Please provide a username or handle." }),
      { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  const cacheKey = `${platform}:${handle.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ ok: true, cached: true, result: cached }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  }

  try {
    let result: PlatformSyncResult;
    switch (platform) {
      case "codeforces":
        result = await handleCodeforcesServerSync(handle);
        break;
      case "codechef":
        result = await handleCodeChefServerSync(handle);
        break;
      case "atcoder":
        result = await handleAtCoderServerSync(handle);
        break;
      case "leetcode":
        result = await handleLeetCodeServerSync(handle);
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: `Unsupported platform "${platform}".` }),
          { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } },
        );
    }

    setCached(cacheKey, result);
    return new Response(JSON.stringify({ ok: true, cached: false, result }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    const message =
      (err as Error).message ||
      "Unable to synchronize right now. Your previously saved data is safe.";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
