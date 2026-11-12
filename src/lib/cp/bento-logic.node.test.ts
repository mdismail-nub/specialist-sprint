import test from "node:test";
import assert from "node:assert/strict";
import { emptyData } from "./seed";
import { ssrTodayISO, todayISO, toUTCISO } from "./dates";
import { load, validateBackupJSON } from "./store";
import { mergeCodeforcesIntoAppData, parseCodeforcesData } from "./codeforces";
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

const makeLog = (
  date: string,
  day: number,
  solved: number,
  minutes = 120,
  topic = "Greedy algorithms",
): DailyLog => ({
  id: `log-${day}`,
  date,
  day,
  topic,
  minutes,
  attempted: solved,
  independent: solved,
  hinted: 0,
  editorial: 0,
  upsolved: 0,
  maxRating: 1000,
  contest: "",
  notes: "",
  lessons: "",
  checklist: {
    studied: true,
    solvedNew: solved > 0,
    upsolved: false,
    reviewed: false,
    notes: false,
  },
});

test("emptyData initializes with zero mock data and onboarded=false", () => {
  const d = emptyData("2026-11-12");
  assert.equal(d.onboarded, false);
  assert.equal(d.isSample, false);
  assert.equal(d.settings.startRating, 0);
  assert.equal(d.settings.currentRating, 0);
  assert.equal(d.settings.targetRating, 1400);
  assert.equal(d.logs.length, 0);
  assert.equal(d.problems.length, 0);
  assert.equal(d.contests.length, 0);

  const s = summary(d, "2026-11-12");
  assert.equal(s.totalSolved, 0);
  assert.equal(s.totalMinutes, 0);
  assert.equal(s.current, 0);
  assert.equal(s.roadmapPct, 0);
  assert.deepEqual(ratingHistory(d), []);
});

test("formatDuration formats hours and minutes with zero-padded tabular precision", () => {
  assert.equal(formatDuration(200), "03h 20m");
  assert.equal(formatDuration(45), "00h 45m");
  assert.equal(formatDuration(0), "00h 00m");
});

test("heatmapDays builds 60 days with accurate intensity levels", () => {
  const data = emptyData("2026-11-12");
  data.logs = [
    makeLog("2026-11-12", 1, 3, 180), // completed + target minutes -> intensity 4
    makeLog("2026-11-13", 2, 3, 90), // completed (< dailyMinutes) -> intensity 3
    makeLog("2026-11-14", 3, 2, 60), // 2 solved -> intensity 2
    makeLog("2026-11-15", 4, 1, 30), // 1 solved -> intensity 1
  ];
  const cells = heatmapDays(data, "2026-11-15");
  assert.equal(cells.length, 60);
  assert.equal(cells[0]?.intensity, 4);
  assert.equal(cells[1]?.intensity, 3);
  assert.equal(cells[2]?.intensity, 2);
  assert.equal(cells[3]?.intensity, 1);
  assert.equal(cells[3]?.isToday, true);
  assert.equal(cells[4]?.intensity, 0);
  assert.equal(cells[4]?.isFuture, true);
});

test("ratingHistory returns empty array when no contests exist and tracks real contest progression", () => {
  const data = emptyData("2026-11-12");
  assert.equal(ratingHistory(data).length, 0);

  data.settings.startRating = 800;
  data.settings.currentRating = 920;
  data.contests = [
    {
      id: "cf-contest-1900",
      name: "Codeforces Round 900",
      date: "2026-11-14",
      platform: "Codeforces",
      oldRating: 800,
      newRating: 920,
      solved: 3,
      rank: 2100,
      notes: "Official rated contest",
    },
  ];

  const history = ratingHistory(data);
  assert.equal(history.length, 2);
  assert.equal(history[0]?.rating, 800);
  assert.equal(history[1]?.rating, 920);
  assert.equal(history[1]?.delta, 120);
});

test("effectiveTopicStatus never marks topics in_progress or completed based on date alone", () => {
  const data = emptyData("2026-11-01");
  const topic = data.topics[0]!;
  // Even if 30 days have passed since startDate, with 0 problems solved and status 'not_started':
  assert.equal(effectiveTopicStatus(data, topic), "not_started");

  // Logging 1 problem in that topic transitions it to in_progress:
  data.logs = [makeLog("2026-11-02", 2, 2, 120, topic.name)];
  assert.equal(effectiveTopicStatus(data, topic), "in_progress");
});

test("parseCodeforcesData deduplicates accepted submissions and marks them unclassified", () => {
  const parsed = parseCodeforcesData(
    {
      handle: "cp_user",
      rating: 1180,
      maxRating: 1210,
      rank: "pupil",
      maxRank: "pupil",
    },
    [
      {
        contestId: 1950,
        contestName: "Codeforces Round 937 (Div. 4)",
        handle: "cp_user",
        rank: 1540,
        ratingUpdateTimeSeconds: 1711645200,
        oldRating: 1050,
        newRating: 1180,
      },
    ],
    [
      {
        id: 101,
        contestId: 1950,
        creationTimeSeconds: 1711640000,
        verdict: "OK",
        problem: {
          contestId: 1950,
          index: "A",
          name: "Stair, Peak, or Neither?",
          rating: 800,
          tags: ["implementation"],
        },
      },
      // Duplicate accepted submission to the exact same problem 1950A
      {
        id: 102,
        contestId: 1950,
        creationTimeSeconds: 1711641000,
        verdict: "OK",
        problem: {
          contestId: 1950,
          index: "A",
          name: "Stair, Peak, or Neither?",
          rating: 800,
          tags: ["implementation"],
        },
      },
      // Rejected submission to 1950B
      {
        id: 103,
        contestId: 1950,
        creationTimeSeconds: 1711642000,
        verdict: "WRONG_ANSWER",
        problem: {
          contestId: 1950,
          index: "B",
          name: "Upscaling",
          rating: 800,
          tags: ["implementation"],
        },
      },
    ],
  );

  assert.equal(parsed.profile.uniqueSolvedCount, 1);
  assert.equal(parsed.profile.acceptedSubmissions, 2);
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0]?.status, "unclassified");
  assert.equal(parsed.contests.length, 1);
  assert.equal(parsed.contests[0]?.solved, 1);

  // Merging preserves user classifications on subsequent syncs
  const base = emptyData("2026-11-12");
  const firstSync = mergeCodeforcesIntoAppData(base, parsed);
  assert.equal(firstSync.problems.length, 1);
  assert.equal(firstSync.problems[0]?.status, "unclassified");

  // User classifies 1950A as "independent"
  firstSync.problems[0] = { ...firstSync.problems[0]!, status: "independent", notes: "Easy" };
  const secondSync = mergeCodeforcesIntoAppData(firstSync, parsed);
  assert.equal(secondSync.problems[0]?.status, "independent");
  assert.equal(secondSync.problems[0]?.notes, "Easy");
});

test("summary excludes unclassified imported problems from independentPct denominator", () => {
  const d = emptyData("2026-11-12");
  d.problems = [
    {
      id: "cf-1",
      date: "2026-11-12",
      title: "1950A",
      platform: "Codeforces",
      url: "",
      rating: 800,
      topic: "Implementation",
      tags: ["implementation"],
      status: "unclassified",
      minutes: null,
      notes: "",
      source: "codeforces",
    },
    {
      id: "cf-2",
      date: "2026-11-12",
      title: "1950B",
      platform: "Codeforces",
      url: "",
      rating: 900,
      topic: "Greedy algorithms",
      tags: ["greedy"],
      status: "independent",
      minutes: 15,
      notes: "",
      source: "codeforces",
    },
    {
      id: "cf-3",
      date: "2026-11-12",
      title: "1950C",
      platform: "Codeforces",
      url: "",
      rating: 1000,
      topic: "Greedy algorithms",
      tags: ["greedy"],
      status: "editorial",
      minutes: 35,
      notes: "",
      source: "codeforces",
    },
  ];

  const s = summary(d, "2026-11-12");
  assert.equal(s.totalSolved, 3);
  assert.equal(s.unclassifiedCount, 1);
  // 1 independent out of 2 classified (1 independent + 1 editorial) -> 50%
  assert.equal(s.independentPct, 50);
});

test("upcomingTopics, topicDistribution, weeklyConsistency, and validateBackupJSON work on real user records", () => {
  const data = emptyData("2026-11-12");
  data.settings.name = "tourist";
  data.logs = [makeLog("2026-11-12", 1, 3), makeLog("2026-11-13", 2, 3)];

  const nextThree = upcomingTopics(data, 1, 3);
  assert.equal(nextThree.length, 3);

  const dist = topicDistribution(data);
  assert.equal(dist.length, 1);
  assert.equal(dist[0]?.solved, 6);

  const weeks = weeklyConsistency(data);
  assert.equal(weeks.length, 9);
  assert.equal(weeks[0]?.activeDays, 2);

  const s = summary(data, "2026-11-13");
  assert.equal(s.totalSolved, 6);
  assert.equal(s.completedDays, 2);
  assert.equal(s.current, 2);
  assert.equal(phaseFor(1)?.name, "Foundation");
  assert.equal(isComplete(data.logs[0]!, data.settings), true);
  assert.deepEqual(streaks(data.logs, data.settings, "2026-11-13"), { current: 2, longest: 2 });

  const parsed = validateBackupJSON(JSON.stringify(data));
  assert.equal(parsed.summary.name, "tourist");
  assert.equal(parsed.summary.logsCount, 2);
  assert.throws(() => validateBackupJSON(""), /Please provide a JSON backup/);
  assert.throws(() => validateBackupJSON("{not-valid-json"), /Invalid JSON format/);
});

test("multi-platform parsers and platform-scoped deduplication keep same-named problems across judges distinct", async () => {
  const { normalizeCodeChefPayload, parseCodeChefProfileHtml } =
    await import("../../integrations/codechef");
  const { parseAtCoderPayload } = await import("../../integrations/atcoder");
  const { parseLeetCodeGraphQLPayload } = await import("../../integrations/leetcode");
  const { getProblemDedupKey, mergePlatformSyncIntoAppData } =
    await import("../../integrations/registry");
  const { platformBreakdownStats, platformRatingHistory } = await import("./stats");

  // 1. Platform-scoped deduplication: Codeforces "Two Sum" and LeetCode "Two Sum" must never collide
  const cfProblem = {
    id: "cf-1",
    title: "Two Sum",
    url: "https://codeforces.com/problemset/problem/1/A",
    platform: "Codeforces" as const,
    rating: 1000,
    topic: "Math",
    date: "2026-11-12",
    status: "independent" as const,
    minutes: 15,
  };
  const lcProblem = {
    id: "lc-1",
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum/",
    platform: "LeetCode" as const,
    rating: null,
    difficultyLabel: "Easy" as const,
    topic: "Array",
    date: "2026-11-12",
    status: "independent" as const,
    minutes: 10,
  };
  assert.notEqual(getProblemDedupKey(cfProblem), getProblemDedupKey(lcProblem));

  // 2. CodeChef HTML parser extracts rating, highest rating, stars, ranks, contests, and total solved
  const sampleCCHtml = `
    <html>
      <body>
        <div class="rating-number">2145</div>
        <span class="rating">6★</span>
        <small>(Highest Rating 2210)</small>
        <ul class="inline-list">
          <li><a href="/ratings/all"><strong>120</strong></a> Global Rank</li>
          <li><a href="/ratings/all?filterBy=Country%3DIndia"><strong>45</strong></a> Country Rank</li>
        </ul>
        <h3>Total Problems Solved: 342</h3>
        <script>
          var all_rating = [{"code":"START160A","getyear":"2026","getmonth":"10","getday":"15","rating":"2145","rank":"18","name":"Starters 160 Division 1"}];
        </script>
      </body>
    </html>
  `;
  const ccRaw = parseCodeChefProfileHtml("cc_coder", sampleCCHtml);
  const ccSync = normalizeCodeChefPayload(ccRaw, "2026-11-12T10:00:00Z");
  assert.equal(ccSync.account.currentRating, 2145);
  assert.equal(ccSync.account.highestRating, 2210);
  assert.equal(ccSync.account.extraMetrics.stars, "5★");
  assert.equal(ccSync.account.extraMetrics.globalRank, 120);
  assert.equal(ccSync.account.extraMetrics.countryRank, 45);
  assert.equal(ccSync.account.totalSolved, 342);
  assert.equal(ccSync.contests.length, 1);
  assert.equal(ccSync.contests[0]?.newRating, 2145);

  // 3. AtCoder parser extracts rating, color tier, performance, and unique AC problems
  const acSync = parseAtCoderPayload(
    "ac_coder",
    [
      {
        IsRated: true,
        Place: 250,
        OldRating: 1120,
        NewRating: 1245,
        Performance: 1580,
        ContestName: "AtCoder Beginner Contest 380",
        ContestScreenName: "abc380.contest.atcoder.jp",
        EndTime: "2026-11-10T14:00:00+09:00",
      },
    ],
    185,
    4200,
    [
      {
        id: 9001,
        epoch_second: 1731240000,
        problem_id: "abc380_a",
        contest_id: "abc380",
        user_id: "ac_coder",
        language: "C++",
        point: 100,
        result: "AC",
      },
    ],
    "2026-11-12T10:00:00Z",
  );
  assert.equal(acSync.account.currentRating, 1245);
  assert.equal(acSync.account.rankTitle, "Cyan (1 Kyu)");
  assert.equal(acSync.account.totalSolved, 185);
  assert.equal(acSync.contests[0]?.performance, 1580);
  assert.equal(acSync.problems.length, 1);

  // 4. LeetCode GraphQL parser extracts Easy/Medium/Hard solved, contest rating, and recent AC
  const lcSync = parseLeetCodeGraphQLPayload(
    {
      matchedUser: {
        username: "lc_coder",
        profile: { ranking: 5120 },
        submitStatsGlobal: {
          acSubmissionNum: [
            { difficulty: "All", count: 410, submissions: 600 },
            { difficulty: "Easy", count: 150, submissions: 200 },
            { difficulty: "Medium", count: 200, submissions: 300 },
            { difficulty: "Hard", count: 60, submissions: 100 },
          ],
        },
        tagProblemCounts: {
          fundamental: [{ tagName: "Array", problemsSolved: 120 }],
          intermediate: [{ tagName: "Dynamic Programming", problemsSolved: 85 }],
        },
      },
      userContestRanking: {
        attendedContestsCount: 12,
        rating: 1945.4,
        globalRanking: 3100,
        topPercentage: 3.5,
      },
      userContestRankingHistory: [
        {
          attended: true,
          rating: 1945.4,
          ranking: 410,
          problemsSolved: 3,
          totalProblems: 4,
          contest: { title: "Weekly Contest 420", startTime: 1731100000 },
        },
      ],
      recentAcSubmissionList: [
        { id: "1", title: "Two Sum", titleSlug: "two-sum", timestamp: "1731100500" },
      ],
    },
    "2026-11-12T10:00:00Z",
  );
  assert.equal(lcSync.account.currentRating, 1945);
  assert.equal(lcSync.account.totalSolved, 410);
  assert.equal(lcSync.account.extraMetrics.easySolved, 150);
  assert.equal(lcSync.account.extraMetrics.mediumSolved, 200);
  assert.equal(lcSync.account.extraMetrics.hardSolved, 60);
  assert.equal(lcSync.contests.length, 1);
  assert.equal(lcSync.problems.length, 1);

  // 5. Merging multiple platforms preserves independent rating scales and problem records
  let app = emptyData("2026-11-12");
  app.problems.push(cfProblem);
  app = mergePlatformSyncIntoAppData(app, "codechef", ccSync);
  app = mergePlatformSyncIntoAppData(app, "atcoder", acSync);
  app = mergePlatformSyncIntoAppData(app, "leetcode", lcSync);

  assert.equal(app.platforms.codechef.currentRating, 2145);
  assert.equal(app.platforms.atcoder.currentRating, 1245);
  assert.equal(app.platforms.leetcode.currentRating, 1945);
  assert.equal(platformRatingHistory(app, "codechef")[0]?.rating, 2145);
  assert.equal(platformRatingHistory(app, "atcoder")[0]?.rating, 1245);
  assert.equal(platformRatingHistory(app, "leetcode")[0]?.rating, 1945);

  // Both Codeforces "Two Sum" and LeetCode "Two Sum" remain in app.problems!
  const twoSums = app.problems.filter((p) => p.title === "Two Sum");
  assert.equal(twoSums.length, 2);

  const stats = platformBreakdownStats(app);
  assert.equal(stats.totalVerifiedTrackedProblems, 3); // CF Two Sum + AC abc380_a + LC Two Sum
  assert.equal(stats.totalAcrossConnectedPlatforms, 1 + 342 + 185 + 410);
});

test("SSR and pre-hydration todayISO and load() snapshot match UTC date regardless of client timezone", () => {
  const expectedUtc = toUTCISO(new Date());
  assert.equal(ssrTodayISO(), expectedUtc);
  assert.equal(todayISO(), expectedUtc);
  const ssrData = load();
  assert.equal(ssrData.settings.startDate, expectedUtc);
});
