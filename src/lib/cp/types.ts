import type { PlatformAccount, PrimaryPlatformId } from "@/integrations/types";

export type Theme = "light" | "dark" | "system";

export interface Settings {
  name: string;
  cfHandle: string;
  startRating: number;
  currentRating: number;
  targetRating: number;
  startDate: string; // YYYY-MM-DD
  duration: number;
  dailyMinutes: number;
  dailyProblems: number;
  theme: Theme;
}

export interface CodeforcesProfile {
  handle: string;
  rating: number;
  maxRating: number;
  rank: string;
  maxRank: string;
  avatar?: string;
  contestsCount: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  uniqueSolvedCount: number;
}

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface CodeforcesSyncState {
  handle: string;
  status: SyncStatus;
  syncing?: boolean;
  lastSyncedAt: string | null; // ISO timestamp
  error: string | null;
  profile: CodeforcesProfile | null;
}

export type TopicStatus = "not_started" | "in_progress" | "completed";

export interface Topic {
  id: string;
  phase: 1 | 2 | 3 | 4;
  name: string;
  startDay: number;
  endDay: number;
  plannedDate?: string;
  description: string;
  objectives: string[];
  minutes: number;
  actualMinutes?: number;
  targetProblems: number;
  completedProblems?: number;
  status: TopicStatus;
  notes: string;
}

export type ChecklistKey = "studied" | "solvedNew" | "upsolved" | "reviewed" | "notes";

export type ProblemPlatform =
  | "Codeforces"
  | "CodeChef"
  | "AtCoder"
  | "LeetCode"
  | "CSES"
  | "HackerRank"
  | "GeeksforGeeks"
  | "Other";

export type ProblemDifficultyLabel = "Easy" | "Medium" | "Hard";

export interface DailyLog {
  id: string;
  date: string;
  day: number;
  topic: string;
  minutes: number;
  attempted: number;
  independent: number;
  hinted: number;
  editorial?: number;
  upsolved: number;
  maxRating: number | null;
  contest: string;
  notes: string;
  lessons: string;
  checklist: Record<ChecklistKey, boolean>;
  platformBreakdown?: Partial<Record<ProblemPlatform, number>>;
}

export type ProblemStatus =
  "independent" | "hint" | "editorial" | "unclassified" | "unsolved" | "resolved";

export type RecordSource = "manual" | PrimaryPlatformId;

export interface Problem {
  id: string;
  problemId?: string;
  title: string;
  url: string;
  platform?: ProblemPlatform;
  rating: number | null;
  difficultyLabel?: ProblemDifficultyLabel | null;
  topic: string;
  tags?: string[];
  date: string;
  status: ProblemStatus;
  minutes: number | null;
  notes?: string;
  contestId?: string;
  problemIndex?: string;
  cfKey?: string;
  source?: RecordSource;
  logId?: string;
}

export interface Contest {
  id: string;
  contestId?: number | string;
  name: string;
  date: string;
  platform: string;
  oldRating: number | null;
  newRating: number | null;
  solved: number | null;
  rank: number | null;
  performance?: number | null;
  notes: string;
  source?: RecordSource;
}

export interface AppData {
  version: 1;
  onboarded: boolean;
  isSample: boolean;
  settings: Settings;
  cfSync: CodeforcesSyncState;
  platforms: Record<PrimaryPlatformId, PlatformAccount>;
  topics: Topic[];
  logs: DailyLog[];
  problems: Problem[];
  contests: Contest[];
}
