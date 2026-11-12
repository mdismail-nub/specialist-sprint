import { useSyncExternalStore } from "react";
import type { AppData, Contest, DailyLog, Problem, Settings, Topic } from "./types";
import { emptyData, sampleData } from "./seed";

/**
 * Centralized data layer. All reads/writes go through here so the storage
 * backend (localStorage now) can be swapped for a remote API later.
 */
const KEY = "cp-tracker:v1";
let state: AppData | null = null;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT = emptyData();

function load(): AppData {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? (JSON.parse(raw) as AppData) : sampleData();
  } catch {
    state = sampleData();
  }
  return state;
}

function commit(next: AppData) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable */
  }
  listeners.forEach((l) => l());
}

function update(fn: (d: AppData) => AppData) {
  commit(fn(load()));
}

export function useData(): AppData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    load,
    () => SERVER_SNAPSHOT,
  );
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const actions = {
  updateSettings(patch: Partial<Settings>) {
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  },
  saveLog(log: DailyLog, problems: Problem[]) {
    update((d) => {
      const dup = d.logs.find((l) => l.date === log.date && l.id !== log.id);
      if (dup) throw new Error("A log already exists for this date.");
      const logs = d.logs.some((l) => l.id === log.id)
        ? d.logs.map((l) => (l.id === log.id ? log : l))
        : [...d.logs, log];
      const others = d.problems.filter((p) => p.logId !== log.id);
      return { ...d, logs, problems: [...others, ...problems.map((p) => ({ ...p, logId: log.id, date: log.date }))] };
    });
  },
  deleteLog(id: string) {
    update((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id), problems: d.problems.filter((p) => p.logId !== id) }));
  },
  saveProblem(p: Problem) {
    update((d) => ({
      ...d,
      problems: d.problems.some((x) => x.id === p.id) ? d.problems.map((x) => (x.id === p.id ? p : x)) : [...d.problems, p],
    }));
  },
  deleteProblem(id: string) {
    update((d) => ({ ...d, problems: d.problems.filter((p) => p.id !== id) }));
  },
  saveTopic(t: Topic) {
    update((d) => ({ ...d, topics: d.topics.map((x) => (x.id === t.id ? t : x)) }));
  },
  saveContest(c: Contest) {
    update((d) => {
      const contests = d.contests.some((x) => x.id === c.id) ? d.contests.map((x) => (x.id === c.id ? c : x)) : [...d.contests, c];
      const latest = [...contests].filter((x) => x.newRating != null).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
      return { ...d, contests, settings: latest?.newRating != null ? { ...d.settings, currentRating: latest.newRating } : d.settings };
    });
  },
  deleteContest(id: string) {
    update((d) => ({ ...d, contests: d.contests.filter((c) => c.id !== id) }));
  },
  exportJSON(): string {
    return JSON.stringify(load(), null, 2);
  },
  importJSON(text: string) {
    const parsed = JSON.parse(text) as AppData;
    if (!parsed || parsed.version !== 1 || !parsed.settings || !Array.isArray(parsed.logs) || !Array.isArray(parsed.topics)) {
      throw new Error("This file is not a valid CP Tracker export.");
    }
    commit({ ...emptyData(), ...parsed });
  },
  /** Clears all data and starts the real challenge, keeping the user's name. */
  reset() {
    const name = load().settings.name;
    const fresh = emptyData();
    fresh.settings.name = name === "Ismail" && load().isSample ? "" : name;
    commit(fresh);
  },
  loadSample() {
    commit(sampleData());
  },
};
