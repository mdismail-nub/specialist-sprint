import type { AppData, DailyLog, Problem, Settings, Topic } from "./types";
import { PHASES } from "./roadmap";
import { addDays, diffDays } from "./dates";

export const solvedOf = (l: DailyLog) => l.independent + l.hinted + l.upsolved;

/** A training day counts as complete when the problem target is met or the full checklist is done. */
export function isComplete(l: DailyLog, s: Settings): boolean {
  const all = Object.values(l.checklist).every(Boolean);
  return solvedOf(l) >= s.dailyProblems || all;
}

export function challengeDay(s: Settings, today: string): number {
  return diffDays(today, s.startDate) + 1;
}

export function phaseFor(day: number) {
  return PHASES.find((p) => day >= p.start && day <= p.end) ?? (day < 1 ? PHASES[0] : PHASES[3]);
}

export function topicForDay(topics: Topic[], day: number): Topic | undefined {
  return topics.find((t) => day >= t.startDay && day <= t.endDay);
}

export function streaks(logs: DailyLog[], s: Settings, today: string) {
  const done = new Set(logs.filter((l) => isComplete(l, s)).map((l) => l.date));
  // current: count back from today (or yesterday if today isn't done yet)
  let cursor = done.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (done.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...done].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}

export const RATING_BUCKETS = ["800", "900–1000", "1100–1200", "1300–1400", "1500+", "Unrated"] as const;
export function ratingBucket(r: number | null): (typeof RATING_BUCKETS)[number] {
  if (r == null) return "Unrated";
  if (r <= 800) return "800";
  if (r <= 1000) return "900–1000";
  if (r <= 1200) return "1100–1200";
  if (r <= 1400) return "1300–1400";
  return "1500+";
}

export const isSolved = (p: Problem) => p.status !== "unsolved";

export function topicSolved(data: AppData, t: Topic): number {
  return data.logs.filter((l) => l.day >= t.startDay && l.day <= t.endDay).reduce((a, l) => a + solvedOf(l), 0);
}

export function summary(data: AppData, today: string) {
  const s = data.settings;
  const logs = data.logs;
  const totalSolved = logs.reduce((a, l) => a + solvedOf(l), 0);
  const totalMinutes = logs.reduce((a, l) => a + l.minutes, 0);
  const independent = logs.reduce((a, l) => a + l.independent, 0);
  const completedDays = logs.filter((l) => isComplete(l, s) && l.day >= 1 && l.day <= s.duration).length;
  const day = challengeDay(s, today);
  const practiceDays = logs.filter((l) => l.minutes > 0 || solvedOf(l) > 0).length;
  return {
    day,
    totalSolved,
    totalMinutes,
    independent,
    independentPct: totalSolved ? Math.round((independent / totalSolved) * 100) : 0,
    completedDays,
    progressPct: Math.min(100, Math.round((completedDays / s.duration) * 100)),
    remainingDays: Math.max(0, s.duration - Math.max(0, day - 1)),
    practiceDays,
    avgPerDay: practiceDays ? totalSolved / practiceDays : 0,
    ...streaks(logs, s, today),
  };
}
