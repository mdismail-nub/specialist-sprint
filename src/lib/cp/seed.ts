import type { AppData, CodeforcesSyncState, Settings } from "./types";
import { buildRoadmap } from "./roadmap";
import { todayISO } from "./dates";

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  cfHandle: "",
  startRating: 0,
  currentRating: 0,
  targetRating: 1400,
  startDate: todayISO(),
  duration: 60,
  dailyMinutes: 180,
  dailyProblems: 3,
  theme: "light",
};

export const DEFAULT_CF_SYNC: CodeforcesSyncState = {
  handle: "",
  status: "idle",
  lastSyncedAt: null,
  error: null,
  profile: null,
};

/**
 * Clean, zero-record initial state. No mock problems, no fake contests,
 * no hardcoded 632 rating, and no demo logs.
 */
export function emptyData(): AppData {
  const startDate = todayISO();
  return {
    version: 1,
    onboarded: false,
    isSample: false,
    settings: {
      ...DEFAULT_SETTINGS,
      startDate,
    },
    cfSync: { ...DEFAULT_CF_SYNC },
    topics: buildRoadmap(),
    logs: [],
    problems: [],
    contests: [],
  };
}

/**
 * Legacy alias preserved only so imports do not break; returns a clean zero-record state.
 */
export function sampleData(): AppData {
  return emptyData();
}
