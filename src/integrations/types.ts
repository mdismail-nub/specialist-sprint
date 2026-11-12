import type { Contest, Problem } from "@/lib/cp/types";

export type PrimaryPlatformId = "codeforces" | "codechef" | "atcoder" | "leetcode";

export type ExtensiblePlatformId =
  PrimaryPlatformId | "cses" | "hackerrank" | "geeksforgeeks" | "other";

export type DataSourceType = "official_api" | "public_profile" | "third_party_provider" | "manual";

export type PlatformConnectionState =
  "disconnected" | "connected" | "syncing" | "sync_failed" | "partially_supported" | "manual_only";

export interface PlatformAvailableMetrics {
  rating: boolean;
  highestRating: boolean;
  rank: boolean;
  contests: boolean;
  solvedCount: boolean;
  problemList: boolean;
  difficultyBreakdown: boolean;
  topicStats: boolean;
  globalRank: boolean;
  countryRank: boolean;
}

export interface PlatformRatingPoint {
  date: string;
  rating: number;
  oldRating: number | null;
  delta: number;
  contestName: string;
  rank: number | null;
  performance?: number | null;
}

export interface PlatformExtraMetrics {
  globalRank?: number | string | null;
  countryRank?: number | string | null;
  stars?: string | null;
  colorTier?: string | null;
  easySolved?: number | null;
  mediumSolved?: number | null;
  hardSolved?: number | null;
  topPercentage?: number | null;
  acceptedSubmissions?: number | null;
  totalSubmissions?: number | null;
  topicCounts?: { topic: string; count: number }[];
}

export interface PlatformAccount {
  platformId: PrimaryPlatformId;
  platformName: string;
  username: string;
  profileUrl: string;
  connectionStatus: PlatformConnectionState;
  currentRating: number | null;
  highestRating: number | null;
  rankTitle: string | null;
  totalContests: number | null;
  totalSolved: number | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  dataSource: DataSourceType;
  dataSourceLabel: string;
  availableMetrics: PlatformAvailableMetrics;
  extraMetrics: PlatformExtraMetrics;
  ratingHistory: PlatformRatingPoint[];
}

export interface PlatformSyncResult {
  account: PlatformAccount;
  contests: Contest[];
  problems: Problem[];
}

export interface PlatformIntegration {
  readonly id: PrimaryPlatformId;
  readonly name: string;
  readonly shortCode: string;
  readonly dataSource: DataSourceType;
  readonly dataSourceLabel: string;
  readonly ratingSystemLabel: string;
  buildProfileUrl(username: string): string;
  validateUsername(username: string): { valid: boolean; cleaned: string; error?: string };
  connectAccount(username: string): Promise<PlatformSyncResult>;
  fetchProfile(username: string): Promise<Partial<PlatformAccount>>;
  fetchRatingHistory(username: string): Promise<PlatformRatingPoint[]>;
  fetchContests(username: string): Promise<Contest[]>;
  fetchSubmissions(username: string): Promise<{ supported: boolean; count: number | null }>;
  fetchSolvedProblems(
    username: string,
  ): Promise<{ supported: boolean; problems: Problem[]; totalCount: number | null }>;
  syncAccount(username: string): Promise<PlatformSyncResult>;
}
