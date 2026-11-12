export type Theme = "light" | "dark" | "system";

export interface Settings {
  name: string;
  startRating: number;
  currentRating: number;
  targetRating: number;
  startDate: string; // YYYY-MM-DD
  duration: number;
  dailyMinutes: number;
  dailyProblems: number;
  theme: Theme;
}

export type TopicStatus = "not_started" | "in_progress" | "completed";

export interface Topic {
  id: string;
  phase: 1 | 2 | 3 | 4;
  name: string;
  startDay: number;
  endDay: number;
  description: string;
  objectives: string[];
  minutes: number;
  targetProblems: number;
  status: TopicStatus;
  notes: string;
}

export type ChecklistKey = "studied" | "solvedNew" | "upsolved" | "reviewed" | "notes";

export interface DailyLog {
  id: string;
  date: string;
  day: number;
  topic: string;
  minutes: number;
  attempted: number;
  independent: number;
  hinted: number;
  upsolved: number;
  maxRating: number | null;
  contest: string;
  notes: string;
  lessons: string;
  checklist: Record<ChecklistKey, boolean>;
}

export type ProblemStatus = "independent" | "hint" | "editorial" | "unsolved" | "resolved";

export interface Problem {
  id: string;
  title: string;
  url: string;
  rating: number | null;
  topic: string;
  date: string;
  status: ProblemStatus;
  minutes: number | null;
  logId?: string;
}

export interface Contest {
  id: string;
  name: string;
  date: string;
  platform: string;
  oldRating: number | null;
  newRating: number | null;
  solved: number;
  rank: number | null;
  notes: string;
}

export interface AppData {
  version: 1;
  isSample: boolean;
  settings: Settings;
  topics: Topic[];
  logs: DailyLog[];
  problems: Problem[];
  contests: Contest[];
}
