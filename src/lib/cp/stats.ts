import type { AppData, DailyLog, Problem, Settings, Topic, TopicStatus } from "./types";
import { PHASES } from "./roadmap";
import { addDays, diffDays } from "./dates";

export const solvedOf = (l: DailyLog) => l.independent + l.hinted + (l.editorial ?? 0) + l.upsolved;

/** A training day counts as complete when the problem target is met or the full checklist is done. */
export function isComplete(l: DailyLog, s: Settings): boolean {
  const all = Object.values(l.checklist).every(Boolean);
  return (s.dailyProblems > 0 && solvedOf(l) >= s.dailyProblems) || all;
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

export const RATING_BUCKETS = [
  "800",
  "900–1000",
  "1100–1200",
  "1300–1400",
  "1500+",
  "Unrated",
] as const;

export function ratingBucket(r: number | null): (typeof RATING_BUCKETS)[number] {
  if (r == null) return "Unrated";
  if (r <= 800) return "800";
  if (r <= 1000) return "900–1000";
  if (r <= 1200) return "1100–1200";
  if (r <= 1400) return "1300–1400";
  return "1500+";
}

export const isSolved = (p: Problem) => p.status !== "unsolved";

export const isClassifiedSolved = (p: Problem) =>
  p.status === "independent" ||
  p.status === "hint" ||
  p.status === "editorial" ||
  p.status === "resolved";

function topicMatchesName(
  problemOrLogTopic: string,
  tags: string[] | undefined,
  topicName: string,
): boolean {
  const needle = topicName.trim().toLowerCase();
  if (!needle) return false;
  if (problemOrLogTopic.trim().toLowerCase() === needle) return true;
  if (tags && tags.some((tag) => tag.trim().toLowerCase() === needle)) return true;
  return false;
}

export function topicSolved(data: AppData, t: Topic): number {
  const fromLogs = data.logs
    .filter(
      (l) =>
        l.topic.trim().toLowerCase() === t.name.trim().toLowerCase() ||
        (l.day >= t.startDay && l.day <= t.endDay && !l.topic.trim()),
    )
    .reduce((a, l) => a + solvedOf(l), 0);

  const standaloneProblems = data.problems.filter(
    (p) => !p.logId && isSolved(p) && topicMatchesName(p.topic, p.tags, t.name),
  ).length;

  const computed = fromLogs + standaloneProblems;
  return t.completedProblems != null ? Math.max(computed, t.completedProblems) : computed;
}

export function topicMinutesSpent(data: AppData, t: Topic): number {
  const fromLogs = data.logs
    .filter(
      (l) =>
        l.topic.trim().toLowerCase() === t.name.trim().toLowerCase() ||
        (l.day >= t.startDay && l.day <= t.endDay && !l.topic.trim()),
    )
    .reduce((a, l) => a + l.minutes, 0);

  const standaloneMinutes = data.problems
    .filter((p) => !p.logId && topicMatchesName(p.topic, p.tags, t.name))
    .reduce((a, p) => a + (p.minutes ?? 0), 0);

  const computed = fromLogs + standaloneMinutes;
  return t.actualMinutes != null ? Math.max(computed, t.actualMinutes) : computed;
}

/**
 * Dynamic topic status based strictly on explicit user status and actual recorded activity.
 * Never marks a topic in-progress or completed merely because its scheduled date has passed.
 */
export function effectiveTopicStatus(data: AppData, t: Topic): TopicStatus {
  if (t.status === "completed") return "completed";
  if (t.status === "in_progress") return "in_progress";
  const solved = topicSolved(data, t);
  const mins = topicMinutesSpent(data, t);
  if (t.targetProblems > 0 && solved >= t.targetProblems) return "completed";
  if (solved > 0 || mins > 0) return "in_progress";
  return "not_started";
}

export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

export interface HeatmapCell {
  day: number;
  date: string;
  minutes: number;
  solved: number;
  attempted: number;
  completed: boolean;
  intensity: 0 | 1 | 2 | 3 | 4;
  topic: string;
  isToday: boolean;
  isFuture: boolean;
}

export function heatmapDays(data: AppData, today: string): HeatmapCell[] {
  const s = data.settings;
  const logByDate = new Map(data.logs.map((l) => [l.date, l]));
  const problemsByDate = new Map<string, number>();
  for (const p of data.problems) {
    if (!p.logId && isSolved(p)) {
      problemsByDate.set(p.date, (problemsByDate.get(p.date) ?? 0) + 1);
    }
  }

  const cells: HeatmapCell[] = [];

  for (let i = 0; i < s.duration; i++) {
    const day = i + 1;
    const date = addDays(s.startDate, i);
    const log = logByDate.get(date);
    const standaloneOnDate = problemsByDate.get(date) ?? 0;
    const minutes = log?.minutes ?? 0;
    const solved = (log ? solvedOf(log) : 0) + standaloneOnDate;
    const attempted = Math.max(solved, log?.attempted ?? 0);
    const completed = log ? isComplete(log, s) : s.dailyProblems > 0 && solved >= s.dailyProblems;
    const defaultTopic = topicForDay(data.topics, day)?.name ?? "";
    const topic = log?.topic || defaultTopic;

    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (solved > s.dailyProblems || (completed && minutes >= s.dailyMinutes)) {
      intensity = 4;
    } else if (completed || (s.dailyProblems > 0 && solved >= s.dailyProblems)) {
      intensity = 3;
    } else if (solved >= 2 || minutes >= 90) {
      intensity = 2;
    } else if (solved >= 1 || minutes > 0) {
      intensity = 1;
    }

    cells.push({
      day,
      date,
      minutes,
      solved,
      attempted,
      completed,
      intensity,
      topic,
      isToday: date === today,
      isFuture: date > today,
    });
  }

  return cells;
}

export interface RatingPoint {
  date: string;
  rating: number;
  label: string;
  delta: number;
}

/**
 * Returns real rating progression points from recorded/synced contests.
 * Never fabricates chart points when no contest rating history exists.
 */
export function ratingHistory(data: AppData): RatingPoint[] {
  const s = data.settings;
  const sortedContests = [...data.contests]
    .filter((c) => c.newRating != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sortedContests.length === 0) {
    return [];
  }

  const points: RatingPoint[] = [];
  const firstContest = sortedContests[0]!;
  const initialRating =
    firstContest.oldRating != null && firstContest.oldRating > 0
      ? firstContest.oldRating
      : s.startRating > 0
        ? s.startRating
        : firstContest.newRating!;

  if (firstContest.oldRating != null && firstContest.oldRating > 0) {
    points.push({
      date: addDays(firstContest.date, -1),
      rating: firstContest.oldRating,
      label: "Pre-contest baseline",
      delta: 0,
    });
  }

  let prev = initialRating;
  for (const c of sortedContests) {
    const r = c.newRating!;
    points.push({
      date: c.date,
      rating: r,
      label: c.name,
      delta: r - (c.oldRating ?? prev),
    });
    prev = r;
  }

  // If the user manually updated currentRating after the last contest, reflect that point
  if (s.currentRating > 0 && points.at(-1)?.rating !== s.currentRating) {
    const lastDate = points.at(-1)!.date;
    points.push({
      date: addDays(lastDate, 1),
      rating: s.currentRating,
      label: "Current rating",
      delta: s.currentRating - prev,
    });
  }

  return points;
}

export interface UpcomingTopicItem {
  topic: Topic;
  startDate: string;
  endDate: string;
  solvedCount: number;
  status: TopicStatus;
}

export function upcomingTopics(data: AppData, _currentDay: number, count = 3): UpcomingTopicItem[] {
  const s = data.settings;
  const incomplete = [...data.topics]
    .filter((t) => effectiveTopicStatus(data, t) !== "completed")
    .sort((a, b) => a.startDay - b.startDay);

  return incomplete.slice(0, count).map((topic) => ({
    topic,
    startDate: topic.plannedDate || addDays(s.startDate, topic.startDay - 1),
    endDate: addDays(s.startDate, topic.endDay - 1),
    solvedCount: topicSolved(data, topic),
    status: effectiveTopicStatus(data, topic),
  }));
}

export interface TopicStat {
  topic: string;
  solved: number;
  minutes: number;
  independent: number;
  pct: number;
}

export function topicDistribution(data: AppData): TopicStat[] {
  const map = new Map<string, { solved: number; minutes: number; independent: number }>();

  for (const l of data.logs) {
    const key = (l.topic || "General Practice").trim();
    const linkedProblems = data.problems.filter((p) => p.logId === l.id && isSolved(p));
    const unlinkedSolved = Math.max(0, solvedOf(l) - linkedProblems.length);
    const unlinkedIndep = Math.max(
      0,
      l.independent - linkedProblems.filter((p) => p.status === "independent").length,
    );
    if (unlinkedSolved === 0 && l.minutes === 0) continue;
    const prev = map.get(key) ?? { solved: 0, minutes: 0, independent: 0 };
    map.set(key, {
      solved: prev.solved + unlinkedSolved,
      minutes: prev.minutes + l.minutes,
      independent: prev.independent + unlinkedIndep,
    });
  }

  for (const p of data.problems) {
    if (!isSolved(p)) continue;
    const key = (p.topic || p.tags?.[0] || "General Practice").trim();
    const prev = map.get(key) ?? { solved: 0, minutes: 0, independent: 0 };
    map.set(key, {
      solved: prev.solved + 1,
      minutes: prev.minutes + (p.logId ? 0 : (p.minutes ?? 0)),
      independent: prev.independent + (p.status === "independent" ? 1 : 0),
    });
  }

  const rawTotal = [...map.values()].reduce((acc, v) => acc + v.solved, 0);
  const totalSolved = Math.max(1, rawTotal);

  return [...map.entries()]
    .filter(([, v]) => v.solved > 0 || v.minutes > 0)
    .map(([topic, v]) => ({
      topic,
      solved: v.solved,
      minutes: v.minutes,
      independent: v.independent,
      pct: rawTotal > 0 ? Math.round((v.solved / totalSolved) * 100) : 0,
    }))
    .sort((a, b) => b.solved - a.solved || b.minutes - a.minutes);
}

export interface WeekConsistency {
  week: number;
  label: string;
  startDay: number;
  endDay: number;
  activeDays: number;
  completedDays: number;
  totalDays: number;
  solved: number;
  minutes: number;
  pct: number;
}

export function weeklyConsistency(data: AppData): WeekConsistency[] {
  const s = data.settings;
  const totalWeeks = Math.ceil(s.duration / 7);
  const weeks: WeekConsistency[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const startDay = w * 7 + 1;
    const endDay = Math.min(s.duration, (w + 1) * 7);
    const totalDays = endDay - startDay + 1;
    const startISO = addDays(s.startDate, startDay - 1);
    const endISO = addDays(s.startDate, endDay - 1);

    const weekLogs = data.logs.filter((l) => l.day >= startDay && l.day <= endDay);
    const standaloneWeekProblems = data.problems.filter(
      (p) => !p.logId && isSolved(p) && p.date >= startISO && p.date <= endISO,
    );

    const activeDates = new Set<string>();
    for (const l of weekLogs) {
      if (l.minutes > 0 || solvedOf(l) > 0) activeDates.add(l.date);
    }
    for (const p of standaloneWeekProblems) {
      activeDates.add(p.date);
    }

    const activeDays = activeDates.size;
    const completedDays = weekLogs.filter((l) => isComplete(l, s)).length;
    const solved = weekLogs.reduce((a, l) => a + solvedOf(l), 0) + standaloneWeekProblems.length;
    const minutes = weekLogs.reduce((a, l) => a + l.minutes, 0);

    weeks.push({
      week: w + 1,
      label: `W${w + 1}`,
      startDay,
      endDay,
      activeDays,
      completedDays,
      totalDays,
      solved,
      minutes,
      pct: Math.round((activeDays / totalDays) * 100),
    });
  }

  return weeks;
}

export function summary(data: AppData, today: string) {
  const s = data.settings;
  const logs = data.logs;
  const solvedProblems = data.problems.filter(isSolved);

  // Deduplicate between problem records and aggregate daily log counts:
  // Any problem in `data.problems` is counted once; if a daily log has aggregate counts
  // higher than the problems linked to that log, include the unlinked remainder.
  let unlinkedLogSolved = 0;
  let unlinkedLogIndependent = 0;
  let unlinkedLogHinted = 0;
  let unlinkedLogEditorial = 0;
  let unlinkedLogUpsolved = 0;

  for (const l of logs) {
    const linked = solvedProblems.filter((p) => p.logId === l.id);
    const linkedIndep = linked.filter((p) => p.status === "independent").length;
    const linkedHint = linked.filter((p) => p.status === "hint").length;
    const linkedEdit = linked.filter((p) => p.status === "editorial").length;
    const linkedUp = linked.filter((p) => p.status === "resolved").length;

    const remIndep = Math.max(0, l.independent - linkedIndep);
    const remHint = Math.max(0, l.hinted - linkedHint);
    const remEdit = Math.max(0, (l.editorial ?? 0) - linkedEdit);
    const remUp = Math.max(0, l.upsolved - linkedUp);

    unlinkedLogIndependent += remIndep;
    unlinkedLogHinted += remHint;
    unlinkedLogEditorial += remEdit;
    unlinkedLogUpsolved += remUp;
    unlinkedLogSolved += remIndep + remHint + remEdit + remUp;
  }

  const totalSolved = solvedProblems.length + unlinkedLogSolved;

  const standaloneMinutes = data.problems
    .filter((p) => !p.logId)
    .reduce((a, p) => a + (p.minutes ?? 0), 0);
  const totalMinutes = logs.reduce((a, l) => a + l.minutes, 0) + standaloneMinutes;

  const independent =
    solvedProblems.filter((p) => p.status === "independent").length + unlinkedLogIndependent;
  const hinted = solvedProblems.filter((p) => p.status === "hint").length + unlinkedLogHinted;
  const editorial =
    solvedProblems.filter((p) => p.status === "editorial").length + unlinkedLogEditorial;
  const upsolved =
    solvedProblems.filter((p) => p.status === "resolved").length + unlinkedLogUpsolved;
  const unclassified = solvedProblems.filter((p) => p.status === "unclassified").length;

  // Exclude unclassified imported problems from the independent solve percentage denominator!
  const classifiedSolvedCount = independent + hinted + editorial + upsolved;
  const independentPct =
    classifiedSolvedCount > 0 ? Math.round((independent / classifiedSolvedCount) * 100) : 0;

  const completedDays = logs.filter(
    (l) => isComplete(l, s) && l.day >= 1 && l.day <= s.duration,
  ).length;
  const day = challengeDay(s, today);
  const practiceDays = logs.filter((l) => l.minutes > 0 || solvedOf(l) > 0).length;
  const elapsedDays = Math.min(s.duration, Math.max(1, day));
  const consistencyPct =
    practiceDays > 0 ? Math.min(100, Math.round((practiceDays / elapsedDays) * 100)) : 0;

  const completedTopics = data.topics.filter(
    (t) => effectiveTopicStatus(data, t) === "completed",
  ).length;
  const roadmapPct =
    data.topics.length > 0 ? Math.round((completedTopics / data.topics.length) * 100) : 0;

  return {
    day,
    totalSolved,
    totalMinutes,
    independent,
    hinted: hinted + editorial,
    hintOnly: hinted,
    editorial,
    editorialOnly: editorial,
    upsolved,
    unclassified,
    unclassifiedCount: unclassified,
    classifiedSolvedCount,
    independentPct,
    completedDays,
    progressPct: Math.min(100, Math.round((completedDays / Math.max(1, s.duration)) * 100)),
    remainingDays: Math.max(0, s.duration - Math.max(0, day - 1)),
    practiceDays,
    consistencyPct,
    avgPerDay: practiceDays ? totalSolved / practiceDays : 0,
    avgMinutesPerDay: practiceDays ? Math.round(totalMinutes / practiceDays) : 0,
    completedTopics,
    roadmapPct,
    ...streaks(logs, s, today),
  };
}
