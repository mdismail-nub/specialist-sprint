import { describe, expect, it } from "vitest";
import { emptyData } from "./seed";
import { validateBackupJSON } from "./store";
import { parseCodeforcesData } from "./codeforces";
import {
  effectiveTopicStatus,
  formatDuration,
  heatmapDays,
  isComplete,
  phaseFor,
  ratingHistory,
  streaks,
  summary,
  topicDistribution,
  upcomingTopics,
  weeklyConsistency,
} from "./stats";
import type { DailyLog } from "./types";

const log = (date: string, day: number, solved: number): DailyLog => ({
  id: date,
  date,
  day,
  topic: "Greedy algorithms",
  minutes: 60,
  attempted: solved,
  independent: solved,
  hinted: 0,
  editorial: 0,
  upsolved: 0,
  maxRating: null,
  contest: "",
  notes: "",
  lessons: "",
  checklist: { studied: false, solvedNew: false, upsolved: false, reviewed: false, notes: false },
});

describe("stats", () => {
  it("defaults start with zero mock records and onboarded=false", () => {
    const d = emptyData("2026-11-12");
    expect(d.onboarded).toBe(false);
    expect(d.settings.startRating).toBe(0);
    expect(d.settings.currentRating).toBe(0);
    expect(d.settings.targetRating).toBe(1400);
    expect(d.settings.startDate).toBe("2026-11-12");
    expect(d.settings.duration).toBe(60);
    expect(d.logs).toHaveLength(0);
    expect(d.problems).toHaveLength(0);
    expect(d.contests).toHaveLength(0);
    expect(d.topics.at(-1)?.endDay).toBe(60);
  });

  it("day is complete when daily problem target (3) is met", () => {
    const s = emptyData().settings;
    expect(isComplete(log("2026-11-12", 1, 3), s)).toBe(true);
    expect(isComplete(log("2026-11-12", 1, 2), s)).toBe(false);
  });

  it("counts current and longest streaks", () => {
    const s = emptyData("2026-11-12").settings;
    const logs = [
      log("2026-11-12", 1, 3),
      log("2026-11-13", 2, 3),
      log("2026-11-15", 4, 3),
      log("2026-11-16", 5, 4),
      log("2026-11-17", 6, 3),
    ];
    expect(streaks(logs, s, "2026-11-17")).toEqual({ current: 3, longest: 3 });
  });

  it("phases map to spec day ranges", () => {
    expect(phaseFor(14)?.id).toBe(1);
    expect(phaseFor(15)?.id).toBe(2);
    expect(phaseFor(43)?.id).toBe(4);
  });

  it("summary derives solved total from logs and problems without mock fallbacks", () => {
    const d = emptyData("2026-11-12");
    expect(summary(d, "2026-11-12").totalSolved).toBe(0);
    expect(ratingHistory(d)).toHaveLength(0);

    d.logs = [log("2026-11-12", 1, 3), log("2026-11-13", 2, 2)];
    expect(summary(d, "2026-11-13").totalSolved).toBe(5);
    expect(summary(d, "2026-11-13").completedDays).toBe(1);
    expect(formatDuration(200)).toBe("03h 20m");
    expect(heatmapDays(d, "2026-11-13")).toHaveLength(60);
    expect(upcomingTopics(d, 1, 3)).toHaveLength(3);
    expect(topicDistribution(d)).toHaveLength(1);
    expect(weeklyConsistency(d)).toHaveLength(9);
  });

  it("does not mark roadmap topics in_progress merely because date has passed", () => {
    const d = emptyData("2026-10-01");
    expect(effectiveTopicStatus(d, d.topics[0]!)).toBe("not_started");
  });

  it("deduplicates accepted Codeforces submissions and marks them unclassified", () => {
    const parsed = parseCodeforcesData(
      { handle: "tourist", rating: 3800, maxRating: 3900 },
      [],
      [
        {
          id: 1,
          contestId: 1000,
          creationTimeSeconds: 1700000000,
          verdict: "OK",
          problem: { contestId: 1000, index: "A", name: "Problem A", rating: 800, tags: ["math"] },
        },
        {
          id: 2,
          contestId: 1000,
          creationTimeSeconds: 1700000500,
          verdict: "OK",
          problem: { contestId: 1000, index: "A", name: "Problem A", rating: 800, tags: ["math"] },
        },
      ],
    );
    expect(parsed.problems).toHaveLength(1);
    expect(parsed.problems[0]?.status).toBe("unclassified");
    expect(parsed.profile.uniqueSolvedCount).toBe(1);
  });

  it("validates backup JSON exports and rejects invalid payloads", () => {
    const d = emptyData("2026-11-12");
    d.logs = [log("2026-11-12", 1, 3)];
    const res = validateBackupJSON(JSON.stringify(d));
    expect(res.summary.logsCount).toBe(1);
    expect(() => validateBackupJSON("{invalid")).toThrow(/Invalid JSON format/);
  });

  it("keeps problems with identical names on different platforms distinct", async () => {
    const { getProblemDedupKey } = await import("@/integrations/registry");
    const cfKey = getProblemDedupKey({
      id: "1",
      title: "Two Sum",
      url: "https://codeforces.com/problemset/problem/1/A",
      platform: "Codeforces",
      rating: 800,
      topic: "Math",
      date: "2026-11-12",
      status: "independent",
      minutes: 10,
    });
    const lcKey = getProblemDedupKey({
      id: "2",
      title: "Two Sum",
      url: "https://leetcode.com/problems/two-sum/",
      platform: "LeetCode",
      rating: null,
      topic: "Array",
      date: "2026-11-12",
      status: "independent",
      minutes: 10,
    });
    expect(cfKey).not.toBe(lcKey);
  });
});
