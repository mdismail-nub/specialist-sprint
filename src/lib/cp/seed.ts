import type { AppData, Settings } from "./types";
import { buildRoadmap } from "./roadmap";
import { addDays, todayISO } from "./dates";

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  startRating: 632,
  currentRating: 632,
  targetRating: 1400,
  startDate: "2026-11-12",
  duration: 60,
  dailyMinutes: 180,
  dailyProblems: 3,
  theme: "light",
};

export function emptyData(): AppData {
  return {
    version: 1,
    isSample: false,
    settings: { ...DEFAULT_SETTINGS },
    topics: buildRoadmap(),
    logs: [],
    problems: [],
    contests: [],
  };
}

/** Sample data: a challenge that started 9 days ago, so the preview has history. */
export function sampleData(): AppData {
  const today = todayISO();
  const start = addDays(today, -9);
  const data = emptyData();
  data.isSample = true;
  data.settings = { ...data.settings, name: "Ismail", startDate: start, currentRating: 742 };
  const plan: [number, number, number, number, number, string][] = [
    // minutes, attempted, independent, hinted, upsolved, topic
    [190, 4, 3, 1, 0, "Implementation and simulation"],
    [150, 4, 2, 1, 1, "Implementation and simulation"],
    [200, 5, 3, 1, 0, "Time and space complexity"],
    [0, 0, 0, 0, 0, ""],
    [180, 4, 2, 2, 0, "Brute force"],
    [210, 5, 4, 0, 1, "Brute force"],
    [120, 3, 1, 1, 0, "Sorting and searching"],
    [185, 4, 3, 0, 1, "Sorting and searching"],
    [195, 4, 3, 1, 0, "Basic mathematics"],
  ];
  const titles = [
    ["Watermelon", "4/A", 800], ["Way Too Long Words", "71/A", 800], ["Team", "231/A", 800],
    ["Domino piling", "50/A", 800], ["Bit++", "282/A", 800], ["Petya and Strings", "112/A", 800],
    ["Helpful Maths", "339/A", 800], ["Word Capitalization", "281/A", 800], ["Stones on the Table", "266/A", 800],
    ["Boy or Girl", "236/A", 800], ["Young Physicist", "69/A", 1000], ["Beautiful Matrix", "263/A", 800],
    ["Queue at the School", "266/B", 800], ["Soldier and Bananas", "546/A", 800], ["Elephant", "617/A", 800],
    ["Twins", "160/A", 900], ["Sereja and Dima", "381/A", 800], ["Dubstep", "208/A", 900],
    ["Vanya and Fence", "677/A", 800], ["Anton and Danik", "734/A", 800], ["Sum of Round Numbers", "1352/A", 800],
    ["Gravity Flip", "405/A", 900], ["Kefa and First Steps", "580/A", 900], ["Ultra-Fast Mathematician", "61/A", 800],
    ["Odd Divisor", "1475/A", 900], ["Two Arrays And Swaps", "1353/B", 800], ["Even Odds", "318/A", 900],
    ["Hulk", "705/A", 800],
  ] as const;
  let pi = 0;
  plan.forEach(([minutes, attempted, independent, hinted, upsolved, topic], i) => {
    if (!minutes) return;
    const date = addDays(start, i);
    const id = `log-${i + 1}`;
    const solved = independent + hinted + upsolved;
    const checklist = { studied: true, solvedNew: solved > 0, upsolved: upsolved > 0, reviewed: i % 2 === 0, notes: i % 3 !== 1 };
    let maxRating = 0;
    for (let k = 0; k < Math.min(solved, 3) && pi < titles.length; k++, pi++) {
      const [title, code, rating] = titles[pi];
      maxRating = Math.max(maxRating, rating);
      const [contest, idx] = code.split("/");
      data.problems.push({
        id: `p-${pi}`,
        title,
        url: `https://codeforces.com/problemset/problem/${contest}/${idx}`,
        rating,
        topic,
        date,
        status: k < independent ? "independent" : k < independent + hinted ? "hint" : "editorial",
        minutes: 15 + ((pi * 7) % 30),
        logId: id,
      });
    }
    data.logs.push({
      id, date, day: i + 1, topic, minutes, attempted, independent, hinted, upsolved,
      maxRating: maxRating || null,
      contest: i === 5 ? "Codeforces Round (Div. 3)" : "",
      notes: "Worked through the topic notes and solved practice problems.",
      lessons: i % 2 ? "Read constraints before choosing an approach." : "Check for integer overflow with long long.",
      checklist,
    });
  });
  data.problems.push({ id: "p-u1", title: "Two Buttons", url: "https://codeforces.com/problemset/problem/520/B", rating: 1400, topic: "BFS", date: addDays(start, 7), status: "unsolved", minutes: 40 });
  data.contests = [
    { id: "c1", name: "Codeforces Round (Div. 4)", date: addDays(start, -12), platform: "Codeforces", oldRating: 560, newRating: 632, solved: 3, rank: 9120, notes: "Slow on B." },
    { id: "c2", name: "Codeforces Round (Div. 3)", date: addDays(start, 5), platform: "Codeforces", oldRating: 632, newRating: 701, solved: 3, rank: 7210, notes: "Solved A–C, stuck on D." },
    { id: "c3", name: "Educational Round", date: addDays(start, 8), platform: "Codeforces", oldRating: 701, newRating: 742, solved: 3, rank: 6544, notes: "Cleaner implementation." },
  ];
  data.topics = data.topics.map((t) =>
    t.endDay <= 8 ? { ...t, status: "completed" } : t.startDay <= 10 ? { ...t, status: "in_progress" } : t,
  );
  return data;
}
