import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useData } from "@/lib/cp/store";
import {
  formatDuration,
  heatmapDays,
  isSolved,
  platformBreakdownStats,
  platformRatingHistory,
  RATING_BUCKETS,
  ratingBucket,
  solvedOf,
  summary,
  topicDistribution,
  weeklyConsistency,
} from "@/lib/cp/stats";
import { addDays, todayISO } from "@/lib/cp/dates";
import type { PrimaryPlatformId } from "@/integrations/types";
import { PLATFORM_DISPLAY_NAME, PRIMARY_PLATFORM_IDS } from "@/integrations/registry";
import { BentoCard, PageHeader, WavyDivider } from "@/components/cp/ui";
import { ActivityHeatmap60, RatingProgressionChart } from "@/components/cp/BentoWidgets";
import { MultiPlatformRatingComparison, PlatformLogoBadge } from "@/components/cp/PlatformWidgets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CP Tracker" },
      {
        name: "description",
        content:
          "Global multi-platform competitive programming analytics, rating progression, difficulty breakdown, and topic distribution.",
      },
      { property: "og:title", content: "Analytics — CP Tracker" },
      {
        property: "og:description",
        content:
          "Global multi-platform competitive programming analytics, rating progression, difficulty breakdown, and topic distribution.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const PLATFORM_FILTER_OPTIONS: { value: PrimaryPlatformId | "all"; label: string }[] = [
  { value: "all", label: "All platforms" },
  { value: "codeforces", label: "Codeforces only" },
  { value: "codechef", label: "CodeChef only" },
  { value: "atcoder", label: "AtCoder only" },
  { value: "leetcode", label: "LeetCode only" },
];

const DATE_FILTER_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: "all", label: "All time", days: null },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "60d", label: "Last 60 days", days: 60 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

function AnalyticsPage() {
  const data = useData();
  const today = todayISO();
  const s = data.settings;

  const [platformFilter, setPlatformFilter] = useState<PrimaryPlatformId | "all">("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const minDateISO = useMemo(() => {
    const opt = DATE_FILTER_OPTIONS.find((o) => o.value === dateFilter);
    if (!opt || opt.days == null) return undefined;
    return addDays(today, -(opt.days - 1));
  }, [dateFilter, today]);

  const sum = summary(data, today);
  const heatmap = heatmapDays(data, today);
  const breakdown = platformBreakdownStats(data);
  const topics = topicDistribution(data, platformFilter, minDateISO);
  const weeks = weeklyConsistency(data);

  // Filter problems and contests according to active Platform Filter and Date Filter
  const targetPlatformDisplay =
    platformFilter === "all" ? null : PLATFORM_DISPLAY_NAME[platformFilter].toLowerCase();

  const filteredSolvedProblems = useMemo(() => {
    return data.problems.filter((p) => {
      if (!isSolved(p)) return false;
      if (minDateISO && p.date < minDateISO) return false;
      if (
        targetPlatformDisplay &&
        (p.platform ?? "Codeforces").toLowerCase() !== targetPlatformDisplay
      ) {
        return false;
      }
      return true;
    });
  }, [data.problems, minDateISO, targetPlatformDisplay]);

  const filteredContests = useMemo(() => {
    return data.contests.filter((c) => {
      if (minDateISO && c.date < minDateISO) return false;
      if (targetPlatformDisplay && c.platform.toLowerCase() !== targetPlatformDisplay) {
        return false;
      }
      return true;
    });
  }, [data.contests, minDateISO, targetPlatformDisplay]);

  const filteredLogs = useMemo(() => {
    return data.logs.filter((l) => {
      if (minDateISO && l.date < minDateISO) return false;
      return true;
    });
  }, [data.logs, minDateISO]);

  // Compute filtered solved volume
  const displayedSolvedTotal = useMemo(() => {
    if (platformFilter === "all" && !minDateISO) {
      return sum.totalSolved;
    }
    if (platformFilter !== "all" && !minDateISO) {
      const item = breakdown.items.find((x) => x.platformId === platformFilter);
      return item?.effectiveSolved ?? filteredSolvedProblems.length;
    }
    if (platformFilter === "all" && minDateISO) {
      const unlinkedFromLogs = filteredLogs.reduce((acc, l) => {
        const linked = filteredSolvedProblems.filter((p) => p.logId === l.id).length;
        return acc + Math.max(0, solvedOf(l) - linked);
      }, 0);
      return filteredSolvedProblems.length + unlinkedFromLogs;
    }
    return filteredSolvedProblems.length;
  }, [
    platformFilter,
    minDateISO,
    sum.totalSolved,
    breakdown.items,
    filteredSolvedProblems,
    filteredLogs,
  ]);

  const displayedMinutes = useMemo(() => {
    if (!minDateISO && platformFilter === "all") return sum.totalMinutes;
    const standaloneMins = filteredSolvedProblems
      .filter((p) => !p.logId)
      .reduce((a, p) => a + (p.minutes ?? 0), 0);
    const logMins =
      platformFilter === "all" || platformFilter === "codeforces"
        ? filteredLogs.reduce((a, l) => a + l.minutes, 0)
        : 0;
    return logMins + standaloneMins;
  }, [minDateISO, platformFilter, sum.totalMinutes, filteredSolvedProblems, filteredLogs]);

  // Rating bucket breakdown
  const bucketCounts = RATING_BUCKETS.map((bucket) => {
    const count = filteredSolvedProblems.filter((p) => ratingBucket(p.rating) === bucket).length;
    const pct = filteredSolvedProblems.length
      ? Math.round((count / filteredSolvedProblems.length) * 100)
      : 0;
    return { bucket, count, pct };
  });

  // LeetCode / Tier difficulty breakdown (Easy / Medium / Hard)
  const lcAccount = data.platforms.leetcode;
  const easyCount =
    !minDateISO && (platformFilter === "all" || platformFilter === "leetcode")
      ? Math.max(
          lcAccount.extraMetrics.easySolved ?? 0,
          filteredSolvedProblems.filter((p) => p.difficultyLabel === "Easy").length,
        )
      : filteredSolvedProblems.filter((p) => p.difficultyLabel === "Easy").length;

  const mediumCount =
    !minDateISO && (platformFilter === "all" || platformFilter === "leetcode")
      ? Math.max(
          lcAccount.extraMetrics.mediumSolved ?? 0,
          filteredSolvedProblems.filter((p) => p.difficultyLabel === "Medium").length,
        )
      : filteredSolvedProblems.filter((p) => p.difficultyLabel === "Medium").length;

  const hardCount =
    !minDateISO && (platformFilter === "all" || platformFilter === "leetcode")
      ? Math.max(
          lcAccount.extraMetrics.hardSolved ?? 0,
          filteredSolvedProblems.filter((p) => p.difficultyLabel === "Hard").length,
        )
      : filteredSolvedProblems.filter((p) => p.difficultyLabel === "Hard").length;

  const selectedPlatformPoints =
    platformFilter === "all"
      ? platformRatingHistory(data, "codeforces")
      : platformRatingHistory(data, platformFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="GLOBAL MULTI-PLATFORM TELEMETRY"
        title="Global Training Analytics"
        subtitle="Unified competitive programming analytics across Codeforces, CodeChef, AtCoder, LeetCode, and your daily training logs."
      />

      {/* Interactive Platform Filter & Date Filter Bar */}
      <BentoCard surface="ivory" className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
              Platform Filter
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PLATFORM_FILTER_OPTIONS.map((opt) => {
                const active = platformFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlatformFilter(opt.value)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-charcoal text-lime"
                        : "bg-surface-white text-muted-foreground hover:text-foreground border border-charcoal/10",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
              Date Range Filter
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_FILTER_OPTIONS.map((opt) => {
                const active = dateFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDateFilter(opt.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 font-mono text-xs font-semibold transition-colors",
                      active
                        ? "bg-charcoal text-lime"
                        : "bg-surface-white text-muted-foreground hover:text-foreground border border-charcoal/10",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </BentoCard>

      {/* TOP 4 ASYMMETRIC KPI BENTO MODULES (Charcoal, Lime, Sage, Ivory) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        {/* 1. Total Problems Solved */}
        <BentoCard
          surface="charcoal"
          kicker="SOLVED VOLUME"
          title={
            platformFilter === "all"
              ? "Total Problems Solved"
              : `${PLATFORM_DISPLAY_NAME[platformFilter]} Solved`
          }
          className="lg:col-span-3"
        >
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="num font-heading text-5xl font-bold text-lime">
              {displayedSolvedTotal}
            </div>
            <div className="font-mono text-xs text-ivory/75 num">
              {filteredSolvedProblems.length} verified records · {filteredContests.length} contests
            </div>
          </div>
        </BentoCard>

        {/* 2. Total Training Hours */}
        <BentoCard
          surface="sage"
          kicker="TIME INVESTED"
          title="Total Practice Hours"
          className="lg:col-span-3"
        >
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="num font-heading text-4xl sm:text-5xl font-bold text-charcoal">
              {formatDuration(displayedMinutes)}
            </div>
            <div className="font-mono text-xs text-charcoal/80 num">
              {sum.practiceDays} practice days · avg {formatDuration(sum.avgMinutesPerDay)}/day
            </div>
          </div>
        </BentoCard>

        {/* 3. Independent Solve Percentage */}
        <BentoCard
          surface="lime"
          kicker="AUTONOMY RATE"
          title="Independent Solve %"
          className="lg:col-span-3"
        >
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="num font-heading text-5xl font-bold text-charcoal">
              {sum.independentPct}%
            </div>
            <div className="font-mono text-xs text-charcoal/80 num">
              {sum.independent} indep · {sum.hintOnly} hint · {sum.editorial} editorial
              {sum.unclassifiedCount > 0 ? ` · ${sum.unclassifiedCount} unclassified` : ""}
            </div>
          </div>
        </BentoCard>

        {/* 4. Weekly Consistency & Streaks Summary */}
        <BentoCard
          surface="ivory"
          kicker="CADENCE & STREAKS"
          title="Active Consistency"
          className="lg:col-span-3"
        >
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="num font-heading text-5xl font-bold text-foreground">
              {sum.consistencyPct}%
            </div>
            <div className="font-mono text-xs text-muted-foreground num">
              Current streak: {sum.current} days · Longest: {sum.longest} days
            </div>
          </div>
        </BentoCard>
      </div>

      {/* CROSS-PLATFORM BREAKDOWN: PROBLEMS SOLVED PER PLATFORM + CONTEST PARTICIPATION BY PLATFORM */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-stretch">
        <BentoCard
          surface="ivory"
          kicker="CROSS-PLATFORM VOLUME"
          title="Problems Solved per Platform"
          className="lg:col-span-7"
          action={
            <Link
              to="/platforms"
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-foreground underline underline-offset-4"
            >
              <span>Manage platforms</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="space-y-3">
            {breakdown.items.map((item) => {
              const maxSolved = Math.max(1, breakdown.totalAcrossConnectedPlatforms);
              const pct = Math.round((item.effectiveSolved / maxSolved) * 100);
              return (
                <div
                  key={item.platformName}
                  className="rounded-2xl border border-charcoal/10 bg-surface-white p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <PlatformLogoBadge platform={item.platformName} size="md" />
                      <div>
                        <div className="font-heading text-sm font-bold text-foreground">
                          {item.platformName}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {item.trackedSolved} verified in problem tracker
                          {item.accountReportedSolved != null
                            ? ` · ${item.accountReportedSolved} reported by platform`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num font-heading text-xl font-bold text-foreground">
                        {item.effectiveSolved}
                      </div>
                      <div className="num font-mono text-[10px] text-muted-foreground">
                        {pct}% of total
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-charcoal/10">
                    <div
                      className="h-full rounded-full bg-charcoal"
                      style={{ width: `${item.effectiveSolved > 0 ? Math.max(6, pct) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </BentoCard>

        <BentoCard
          surface="white"
          kicker="RATED ARENA BREAKDOWN"
          title="Contest Participation by Platform"
          className="lg:col-span-5"
          action={
            <Link
              to="/contests"
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-foreground underline underline-offset-4"
            >
              <span>Contest log</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="flex h-full flex-col justify-between gap-3">
            <div className="space-y-2.5">
              {PRIMARY_PLATFORM_IDS.map((pid) => {
                const acc = data.platforms[pid];
                const display = PLATFORM_DISPLAY_NAME[pid];
                const contestCount =
                  acc.totalContests ??
                  data.contests.filter((c) => c.platform.toLowerCase() === display.toLowerCase())
                    .length;
                return (
                  <div
                    key={pid}
                    className="flex items-center justify-between rounded-2xl border border-charcoal/10 bg-ivory/70 px-3.5 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <PlatformLogoBadge platform={pid} size="sm" />
                      <div>
                        <div className="font-heading text-xs font-bold text-foreground">
                          {display}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {acc.currentRating != null
                            ? `Rating ${acc.currentRating} (${acc.rankTitle || "Rated"})`
                            : acc.username
                              ? `@${acc.username}`
                              : "Not connected"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="num font-heading text-lg font-bold text-foreground">
                        {contestCount}
                      </span>
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                        contests
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl bg-charcoal px-4 py-3 text-xs text-ivory font-mono flex items-center justify-between">
              <span>TOTAL RATED CONTESTS</span>
              <span className="num font-bold text-lime">{data.contests.length}</span>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* PLATFORM-WISE RATING PROGRESSION */}
      {platformFilter === "all" ? (
        <MultiPlatformRatingComparison data={data} />
      ) : (
        <BentoCard
          surface="white"
          kicker="NATIVE PLATFORM RATING TRAJECTORY"
          title={`${PLATFORM_DISPLAY_NAME[platformFilter]} Rating Progression`}
        >
          <RatingProgressionChart
            points={selectedPlatformPoints}
            targetRating={
              platformFilter === "codeforces"
                ? s.targetRating
                : (data.platforms[platformFilter].highestRating ?? 1600)
            }
            height={230}
          />
        </BentoCard>
      )}

      <WavyDivider />

      {/* ROW 3: TOPIC-WISE DISTRIBUTION (7 cols) + DIFFICULTY / RATING SPECTRUM (5 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-stretch">
        <BentoCard
          surface="ivory"
          kicker="CURRICULUM & TAG COVERAGE"
          title="Topic Distribution Across Platforms"
          className="lg:col-span-7"
        >
          {topics.length === 0 ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal/15 bg-surface-white/75 p-6 text-center">
              <div className="font-heading text-sm font-bold text-foreground">
                No topic distribution data yet for this filter.
              </div>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Log daily study sessions, connect Codeforces or LeetCode, or tag problems in your
                Problem Tracker to see how your practice is distributed across topics.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.slice(0, 10).map((t, idx) => (
                <div
                  key={t.topic}
                  className="rounded-2xl border border-charcoal/10 bg-surface-white p-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="num font-mono text-xs text-muted-foreground">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="font-bold text-foreground truncate">{t.topic}</span>
                    </div>
                    <div className="num flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span>
                        <strong className="text-foreground">{t.solved}</strong> solved
                      </span>
                      {t.minutes > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatDuration(t.minutes)}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="font-semibold text-foreground">{t.pct}%</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-charcoal/10">
                    <div
                      className={cn("h-full rounded-full", idx === 0 ? "bg-lime" : "bg-charcoal")}
                      style={{ width: `${Math.max(6, t.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </BentoCard>

        <BentoCard
          surface="white"
          kicker="DIFFICULTY SPECTRUM"
          title="Problems Solved by Difficulty"
          className="lg:col-span-5"
        >
          <div className="flex h-full flex-col justify-between gap-4">
            {/* LeetCode / Tier Breakdown (Easy / Medium / Hard) */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-charcoal/10 bg-ivory p-3 text-center">
              <div>
                <div className="font-mono text-[10px] uppercase text-sage-deep">Easy</div>
                <div className="num font-heading mt-0.5 text-xl font-bold text-foreground">
                  {easyCount}
                </div>
              </div>
              <div className="border-x border-charcoal/10">
                <div className="font-mono text-[10px] uppercase text-charcoal">Medium</div>
                <div className="num font-heading mt-0.5 text-xl font-bold text-foreground">
                  {mediumCount}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase text-coral">Hard</div>
                <div className="num font-heading mt-0.5 text-xl font-bold text-foreground">
                  {hardCount}
                </div>
              </div>
            </div>

            {filteredSolvedProblems.length === 0 ? (
              <div className="flex h-full min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal/15 bg-ivory/70 p-6 text-center">
                <div className="font-heading text-sm font-bold text-foreground">
                  No rated problem records in this view yet.
                </div>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Add problems in the Problem Tracker or sync your connected accounts to analyze
                  numeric rating bands.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bucketCounts.map((b) => (
                  <div key={b.bucket} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-semibold text-foreground">{b.bucket}</span>
                      <span className="num text-muted-foreground">
                        {b.count} problems ({b.pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-charcoal/10">
                      <div
                        className="h-full rounded-full bg-sage-deep"
                        style={{ width: `${b.count > 0 ? Math.max(6, b.pct) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl bg-ivory p-3.5 text-xs text-muted-foreground border border-charcoal/8">
              Based on{" "}
              <strong className="num text-foreground">{filteredSolvedProblems.length}</strong>{" "}
              verified solved problems in the selected filter window.
            </div>
          </div>
        </BentoCard>
      </div>

      {/* ROW 4: WEEKLY CONSISTENCY + 60-DAY ACTIVITY HEATMAP */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-stretch">
        <BentoCard
          surface="ivory"
          kicker="60-DAY CADENCE"
          title="60-Day Activity Heatmap"
          className="lg:col-span-7"
          action={
            <span className="num font-mono text-xs text-muted-foreground">
              {sum.completedDays} / {s.duration} target days met
            </span>
          }
        >
          <ActivityHeatmap60 cells={heatmap} />
        </BentoCard>

        <BentoCard
          surface="white"
          kicker="WEEK-BY-WEEK"
          title="Weekly Consistency & Volume"
          className="lg:col-span-5"
        >
          <div className="space-y-2.5">
            {weeks.map((w) => (
              <div
                key={w.week}
                className="rounded-2xl border border-charcoal/8 bg-ivory/70 px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{w.label}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Days {w.startDay}–{w.endDay}
                    </span>
                  </div>
                  <div className="num font-mono text-xs">
                    <strong className="text-foreground">
                      {w.activeDays}/{w.totalDays}d
                    </strong>{" "}
                    <span className="text-muted-foreground">
                      · {w.solved}p · {formatDuration(w.minutes)}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-charcoal/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      w.pct >= 70 ? "bg-lime" : w.pct > 0 ? "bg-sage-deep" : "bg-transparent",
                    )}
                    style={{ width: `${w.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
