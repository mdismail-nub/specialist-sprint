import { describe, expect, it } from "vitest";
import { emptyData } from "./seed";
import { isComplete, streaks, summary, phaseFor } from "./stats";
import type { DailyLog } from "./types";

const log = (date: string, day: number, solved: number): DailyLog => ({
  id: date, date, day, topic: "", minutes: 60, attempted: solved, independent: solved, hinted: 0, upsolved: 0,
  maxRating: null, contest: "", notes: "", lessons: "",
  checklist: { studied: false, solvedNew: false, upsolved: false, reviewed: false, notes: false },
});

describe("stats", () => {
  it("defaults match the challenge spec", () => {
    const d = emptyData();
    expect(d.settings.startRating).toBe(632);
    expect(d.settings.targetRating).toBe(1400);
    expect(d.settings.startDate).toBe("2026-11-12");
    expect(d.settings.duration).toBe(60);
    expect(d.topics.at(-1)?.endDay).toBe(60);
  });
  it("day is complete when daily problem target (3) is met", () => {
    const s = emptyData().settings;
    expect(isComplete(log("2026-11-12", 1, 3), s)).toBe(true);
    expect(isComplete(log("2026-11-12", 1, 2), s)).toBe(false);
  });
  it("counts current and longest streaks", () => {
    const s = emptyData().settings;
    const logs = [log("2026-11-12", 1, 3), log("2026-11-13", 2, 3), log("2026-11-15", 4, 3), log("2026-11-16", 5, 4), log("2026-11-17", 6, 3)];
    expect(streaks(logs, s, "2026-11-17")).toEqual({ current: 3, longest: 3 });
  });
  it("phases map to spec day ranges", () => {
    expect(phaseFor(14).id).toBe(1);
    expect(phaseFor(15).id).toBe(2);
    expect(phaseFor(43).id).toBe(4);
  });
  it("summary derives solved total from logs", () => {
    const d = emptyData();
    d.logs = [log("2026-11-12", 1, 3), log("2026-11-13", 2, 2)];
    expect(summary(d, "2026-11-13").totalSolved).toBe(5);
    expect(summary(d, "2026-11-13").completedDays).toBe(1);
  });
});
