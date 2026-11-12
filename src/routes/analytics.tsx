import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useData } from "@/lib/cp/store";
import {
  formatDuration,
  heatmapDays,
  isSolved,
  RATING_BUCKETS,
  ratingBucket,
  ratingHistory,
  summary,
  topicDistribution,
  weeklyConsistency,
} from "@/lib/cp/stats";
import { todayISO } from "@/lib/cp/dates";
import { BentoCard, PageHeader, WavyDivider } from "@/components/cp/ui";
import { ActivityHeatmap60, RatingProgressionChart } from "@/components/cp/BentoWidgets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CP Tracker" },
      {
        name: "description",
        content:
          "Performance analytics, weekly consistency, topic distribution and rating trajectory.",
      },
      { property: "og:title", content: "Analytics — CP Tracker" },
      {
        property: "og:description",
        content:
          "Performance analytics, weekly consistency, topic distribution and rating trajectory.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const data = useData();
  const today = todayISO();
  const s = data.settings;
  const sum = summary(data, today);
  const heatmap = heatmapDays(data, today);
  const ratings = ratingHistory(data);
  const topics = topicDistribution(data);
  const weeks = weeklyConsistency(data);

  // Rating bucket breakdown from real logged problems
  const solvedProblems = data.problems.filter(isSolved);
  const bucketCounts = RATING_BUCKETS.map((bucket) => {
    const count = solvedProblems.filter((p) => ratingBucket(p.rating) === bucket).length;
    const pct = solvedProblems.length ? Math.round((count / solvedProblems.length) * 100) : 0;
    return { bucket, count, pct };
  });

  const ratingDelta = s.currentRating - s.startRating;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="PERFORMANCE TELEMETRY"
        title="Training Analytics"
        subtitle="Real metrics derived from your daily practice logs, problem archive, and recorded contests."
      />

      {/* TOP 4 ASYMMETRIC KPI BENTO MODULES (Charcoal, Lime, Sage, Ivory) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        {/* 1. Total Problems Solved */}
        <BentoCard
          surface="charcoal"
          kicker="SOLVED VOLUME"
          title="Total Unique Solved"
          className="lg:col-span-3"
        >
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="num font-heading text-5xl font-bold text-lime">{sum.totalSolved}</div>
            <div className="font-mono text-xs text-ivory/75 num">
              {sum.avgPerDay.toFixed(1)} avg / active day · {sum.upsolved} upsolved
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
              {formatDuration(sum.totalMinutes)}
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

      {/* ROW 2: RATING PROGRESSION (7 cols) + WEEKLY CONSISTENCY (5 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-stretch">
        <BentoCard
          surface="white"
          kicker="CONTEST TRAJECTORY"
          title="Rating Progression"
          className="lg:col-span-7"
          action={
            <Link
              to="/contests"
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-foreground underline underline-offset-4"
            >
              <span>Manage contests</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2.5">
                <span className="num font-heading text-3xl font-bold">{s.currentRating}</span>
                <span
                  className={cn(
                    "num font-mono text-xs font-semibold",
                    ratingDelta >= 0 ? "text-sage-deep" : "text-coral",
                  )}
                >
                  {ratingDelta >= 0 ? `+${ratingDelta}` : ratingDelta} since start ({s.startRating})
                </span>
              </div>
              <span className="num font-mono text-xs text-muted-foreground">
                Target: {s.targetRating}
              </span>
            </div>
            <RatingProgressionChart points={ratings} targetRating={s.targetRating} height={240} />
          </div>
        </BentoCard>

        {/* Weekly Consistency Breakdown */}
        <BentoCard
          surface="ivory"
          kicker="WEEK-BY-WEEK"
          title="Weekly Problem-Solving Performance"
          className="lg:col-span-5"
        >
          <div className="space-y-2.5">
            {sum.practiceDays === 0 && sum.totalSolved === 0 && (
              <div className="rounded-2xl border border-dashed border-charcoal/20 bg-surface-white px-3.5 py-2.5 text-xs text-muted-foreground">
                Log daily study sessions or solve problems to populate weekly consistency bars.
              </div>
            )}
            {weeks.map((w) => (
              <div
                key={w.week}
                className="rounded-2xl border border-charcoal/8 bg-surface-white px-3.5 py-2.5"
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

      <WavyDivider />

      {/* ROW 3: TOPIC-WISE DISTRIBUTION (7 cols) + RATING BAND DISTRIBUTION (5 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-stretch">
        <BentoCard
          surface="ivory"
          kicker="CURRICULUM COVERAGE"
          title="Topic-Wise Problem Distribution"
          className="lg:col-span-7"
        >
          {topics.length === 0 ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal/15 bg-surface-white/75 p-6 text-center">
              <div className="font-heading text-sm font-bold text-foreground">
                No topic distribution data yet.
              </div>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Log daily study sessions or tag problems in your Problem Tracker to see how your
                practice is distributed across topics.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((t, idx) => (
                <div
                  key={t.topic}
                  className="rounded-2xl border border-charcoal/10 bg-surface-white p-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="num font-mono text-xs text-muted-foreground">
                        0{idx + 1}
                      </span>
                      <span className="font-bold text-foreground truncate">{t.topic}</span>
                    </div>
                    <div className="num flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span>
                        <strong className="text-foreground">{t.solved}</strong> solved
                      </span>
                      <span>·</span>
                      <span>{formatDuration(t.minutes)}</span>
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
          title="Rating-Wise Problem Distribution"
          className="lg:col-span-5"
        >
          <div className="flex h-full flex-col justify-between gap-4">
            {solvedProblems.length === 0 ? (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal/15 bg-ivory/70 p-6 text-center">
                <div className="font-heading text-sm font-bold text-foreground">
                  No rated problems solved yet.
                </div>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Add problems in the Problem Tracker or sync your Codeforces account to analyze
                  your difficulty spectrum.
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
              Based on <strong className="num text-foreground">{solvedProblems.length}</strong>{" "}
              unique solved problems recorded in your Problem Tracker.
            </div>
          </div>
        </BentoCard>
      </div>

      {/* ROW 4: FULL-WIDTH 60-DAY ACTIVITY HEATMAP */}
      <BentoCard
        surface="ivory"
        kicker="60-DAY CADENCE"
        title="60-Day Activity Heatmap"
        action={
          <span className="num font-mono text-xs text-muted-foreground">
            {sum.completedDays} / {s.duration} target days met
          </span>
        }
      >
        <ActivityHeatmap60 cells={heatmap} />
      </BentoCard>
    </div>
  );
}
