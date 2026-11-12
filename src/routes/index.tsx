import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Flame,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useData, actions } from "@/lib/cp/store";
import {
  effectiveTopicStatus,
  formatDuration,
  heatmapDays,
  isComplete,
  phaseFor,
  ratingHistory,
  solvedOf,
  summary,
  topicForDay,
  upcomingTopics,
} from "@/lib/cp/stats";
import { PHASES } from "@/lib/cp/roadmap";
import { addDays, formatDate, todayISO } from "@/lib/cp/dates";
import { BentoCard, EditorialLabel, WavyDivider } from "@/components/cp/ui";
import { ActivityHeatmap60, RatingProgressionChart } from "@/components/cp/BentoWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — CP Tracker" },
      {
        name: "description",
        content: "Your daily view of the 60-day Codeforces Specialist challenge.",
      },
      { property: "og:title", content: "Overview — CP Tracker" },
      {
        property: "og:description",
        content: "Your daily view of the 60-day Codeforces Specialist challenge.",
      },
    ],
  }),
  component: Overview,
});

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Not synced yet";
  try {
    const d = new Date(iso);
    return `Synced ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "Synced";
  }
}

function Overview() {
  const data = useData();
  const today = todayISO();
  const s = data.settings;
  const sum = summary(data, today);
  const day = Math.min(Math.max(sum.day, 1), s.duration);
  const started = sum.day >= 1;
  const phase = phaseFor(day)!;
  const topic = topicForDay(data.topics, day);
  const todayLog = data.logs.find((l) => l.date === today);
  const todaySolved = todayLog ? solvedOf(todayLog) : 0;
  const todayDone = todayLog ? isComplete(todayLog, s) : false;

  const heatmap = heatmapDays(data, today);
  const ratings = ratingHistory(data);
  const nextTopics = upcomingTopics(data, day, 3);

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState("");

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const PULL_THRESHOLD = 68;

  const triggerRefresh = async () => {
    if (refreshing || data.cfSync.status === "syncing") return;
    setRefreshing(true);
    try {
      const res = await actions.refreshDashboard();
      if (res.syncedCF) {
        toast.success(`Synchronized @${s.cfHandle} with Codeforces`);
      } else {
        toast.success("Dashboard data refreshed");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5 && !refreshing) {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    } else {
      touchStartY.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || refreshing) return;
    const currentY = e.touches[0]?.clientY ?? touchStartY.current;
    const delta = currentY - touchStartY.current;
    if (delta > 0 && window.scrollY <= 5) {
      setPullDistance(Math.min(110, delta * 0.55));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;
    if (pullDistance >= PULL_THRESHOLD) {
      void triggerRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const saveRating = () => {
    const n = Number(rating);
    if (!Number.isInteger(n) || n < 0 || n > 4000) {
      toast.error("Enter a rating between 0 and 4000.");
      return;
    }
    actions.updateSettings({ currentRating: n });
    setEditing(false);
    toast.success("Rating updated");
  };

  // Recent 6 days for the pill strip in Practice Streak module (inspired by Ref 1)
  const recentStrip = Array.from({ length: 6 }, (_, idx) => {
    const d = addDays(today, idx - 4);
    const dt = new Date(d + "T00:00:00");
    const dayNum = dt.getDate();
    const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
    const l = data.logs.find((x) => x.date === d);
    const done = l ? isComplete(l, s) : false;
    const isTodayDate = d === today;
    return { date: d, dayNum, weekday, done, isTodayDate };
  });

  const ratingDelta = s.currentRating - s.startRating;
  const ratingProgressPct =
    s.targetRating > s.startRating && s.currentRating > s.startRating
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((s.currentRating - s.startRating) / Math.max(1, s.targetRating - s.startRating)) *
                100,
            ),
          ),
        )
      : 0;

  const isSyncing = refreshing || data.cfSync.status === "syncing";

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="space-y-6"
    >
      {/* Pull-to-Refresh Indicator */}
      {(pullDistance > 8 || isSyncing) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            height: isSyncing ? 44 : Math.max(36, Math.round(pullDistance)),
          }}
          className="flex items-center justify-center overflow-hidden rounded-2xl border border-charcoal/12 bg-ivory px-4 text-xs font-mono font-semibold text-charcoal transition-all"
        >
          {isSyncing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-charcoal" />
              <span>
                {s.cfHandle
                  ? `Synchronizing @${s.cfHandle} with Codeforces...`
                  : "Refreshing dashboard data..."}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ArrowDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  pullDistance >= PULL_THRESHOLD && "rotate-180 text-sage-deep",
                )}
              />
              <span>
                {pullDistance >= PULL_THRESHOLD
                  ? "Release to refresh & sync"
                  : "Pull down to refresh dashboard"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* MAIN EDITORIAL INTRODUCTION */}
      <section className="relative overflow-hidden rounded-[28px] border border-charcoal/10 bg-ivory px-5 py-6 sm:px-8 sm:py-8 bg-dot-grid">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <EditorialLabel>60-DAY SPECIALIST TRAINING GROUND</EditorialLabel>
            <h1 className="font-heading mt-2.5 text-3xl font-bold tracking-tight text-foreground sm:text-5xl text-balance leading-[1.08]">
              Small steps.{" "}
              <span className="font-serif-editorial italic font-normal">Stronger solutions.</span>
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-muted-foreground max-w-xl">
              Your personal training ground for the next {s.duration} days. Deliberate practice,
              structured problem sets, and honest reflection.
            </p>
          </div>

          {/* Compact Day, Phase, Date & Live Sync Indicator */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-end">
            {/* Codeforces Connection & Refresh Pill */}
            <div className="flex items-center gap-1.5 rounded-full border border-charcoal/12 bg-surface-white px-3 py-1.5 text-xs">
              {s.cfHandle ? (
                <>
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      data.cfSync.status === "error"
                        ? "bg-coral"
                        : data.cfSync.status === "syncing"
                          ? "bg-warm-yellow animate-pulse"
                          : "bg-lime border border-charcoal/30",
                    )}
                  />
                  <span className="font-mono font-bold text-foreground">@{s.cfHandle}</span>
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">
                    · {formatSyncTime(data.cfSync.lastSyncedAt)}
                  </span>
                </>
              ) : (
                <Link
                  to="/settings"
                  className="font-mono text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Connect Codeforces
                </Link>
              )}
              <button
                type="button"
                onClick={() => void triggerRefresh()}
                disabled={isSyncing}
                aria-label="Refresh dashboard data"
                title="Refresh data & synchronize Codeforces"
                className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-charcoal text-lime transition-transform hover:scale-105 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-charcoal/12 bg-surface-white px-4 py-2">
              <span className="num flex h-9 w-9 items-center justify-center rounded-full bg-charcoal font-mono text-sm font-bold text-lime">
                {String(day).padStart(2, "0")}
              </span>
              <div className="pr-1">
                <div className="text-xs font-semibold text-foreground whitespace-nowrap">
                  {started
                    ? `Day ${sum.day > s.duration ? `${s.duration} (Done)` : sum.day} of ${s.duration}`
                    : `Starts in ${1 - sum.day}d`}{" "}
                  · Phase 0{phase.id}
                </div>
                <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {formatDate(today, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Non-destructive Codeforces API Error Notice */}
        {data.cfSync.status === "error" && data.cfSync.error && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-coral/35 bg-coral/10 px-4 py-2.5 text-xs text-charcoal">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-coral shrink-0" />
              <span>
                <strong>Codeforces sync failed:</strong> {data.cfSync.error} (Showing previously
                saved data)
              </span>
            </div>
            <button
              type="button"
              onClick={() => void triggerRefresh()}
              className="font-mono text-[11px] font-semibold underline underline-offset-4"
            >
              Retry sync
            </button>
          </div>
        )}
      </section>

      {/* ASYMMETRIC BENTO GRID — ROW 1: MODULE A (7 cols) + MODULE B (5 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-stretch">
        {/* MODULE A — CHALLENGE PROGRESS (Largest & Most Important Module) */}
        <BentoCard
          surface="sage"
          kicker="YOUR PROGRESS"
          title="60-Day Specialist Challenge"
          className="lg:col-span-7"
          action={
            <Link
              to="/roadmap"
              aria-label="Open full roadmap"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal text-ivory transition-transform hover:scale-105"
            >
              <ArrowUpRight className="h-4 w-4 text-lime" />
            </Link>
          }
        >
          <div className="flex h-full flex-col justify-between gap-6">
            {/* Key Rating & Completion Numbers */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Starting Rating */}
              <div className="rounded-2xl bg-ivory/80 p-3.5 border border-charcoal/10">
                <div className="text-[11px] font-mono uppercase text-charcoal/70">Start Rating</div>
                <div className="num font-heading mt-1 text-2xl font-bold text-charcoal sm:text-3xl">
                  {s.startRating > 0 ? s.startRating : "—"}
                </div>
                <div className="mt-0.5 text-[11px] text-charcoal/65">
                  {s.startRating > 0 ? "Baseline" : "Unrated start"}
                </div>
              </div>

              {/* Current Rating (Editable inline) */}
              <div className="rounded-2xl bg-ivory p-3.5 border border-charcoal/15">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase text-charcoal/70">
                  <span>Current</span>
                  {!editing && (
                    <button
                      type="button"
                      aria-label="Edit current rating"
                      onClick={() => {
                        setRating(String(s.currentRating));
                        setEditing(true);
                      }}
                      className="rounded p-0.5 text-charcoal/70 hover:bg-charcoal/10 hover:text-charcoal"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {editing ? (
                  <form
                    className="mt-1 flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveRating();
                    }}
                  >
                    <Input
                      autoFocus
                      inputMode="numeric"
                      aria-label="Current rating value"
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      className="h-7 px-2 text-xs bg-surface-white text-charcoal"
                    />
                    <Button size="sm" type="submit" className="h-7 px-2 text-xs">
                      Save
                    </Button>
                  </form>
                ) : (
                  <div className="num font-heading mt-1 text-2xl font-bold text-charcoal sm:text-3xl">
                    {s.currentRating > 0 ? s.currentRating : "Unrated"}
                  </div>
                )}
                <div className="num mt-0.5 text-[11px] font-medium text-charcoal/75">
                  {s.currentRating > 0
                    ? `${ratingDelta >= 0 ? `+${ratingDelta}` : ratingDelta} since start (${ratingProgressPct}%)`
                    : s.cfHandle
                      ? `Synced @${s.cfHandle}`
                      : "Set rating or connect CF"}
                </div>
              </div>

              {/* Target Rating */}
              <div className="rounded-2xl bg-ivory/80 p-3.5 border border-charcoal/10">
                <div className="text-[11px] font-mono uppercase text-charcoal/70">
                  Target Rating
                </div>
                <div className="num font-heading mt-1 text-2xl font-bold text-charcoal sm:text-3xl">
                  {s.targetRating}
                </div>
                <div className="num mt-0.5 text-[11px] text-charcoal/65">
                  {Math.max(0, s.targetRating - s.currentRating)} pts to go
                </div>
              </div>

              {/* Days Completed / Remaining */}
              <div className="rounded-2xl bg-charcoal p-3.5 text-ivory">
                <div className="text-[11px] font-mono uppercase text-ivory/70">Days Logged</div>
                <div className="num font-heading mt-1 text-2xl font-bold text-lime sm:text-3xl">
                  {sum.completedDays}{" "}
                  <span className="text-base font-normal text-ivory/60">/ {s.duration}</span>
                </div>
                <div className="num mt-0.5 text-[11px] text-ivory/70">
                  {sum.remainingDays} days remaining
                </div>
              </div>
            </div>

            {/* Horizontal Progress Visualization using Electric Lime */}
            <div className="rounded-2xl bg-ivory/90 p-4 border border-charcoal/10">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold uppercase font-mono text-charcoal/70">
                    Challenge Completion
                  </span>
                  <div className="text-xs text-charcoal/75 mt-0.5">
                    {sum.completedDays} completed days · Roadmap mastery {sum.roadmapPct}% (
                    {sum.completedTopics}/{data.topics.length} topics)
                  </div>
                </div>
                <div className="num font-heading text-3xl font-bold tracking-tight text-charcoal sm:text-4xl">
                  {sum.progressPct}%
                </div>
              </div>

              {/* Segmented Lime Progress Track */}
              <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-charcoal/12 p-0.5 bg-hatch-pattern">
                <div
                  className="h-full rounded-full bg-lime border border-charcoal/30 transition-all duration-500"
                  style={{ width: `${Math.max(sum.progressPct, sum.completedDays > 0 ? 6 : 0)}%` }}
                />
              </div>

              {/* Four Phases Horizontal Journey Indicator */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[11px] font-mono text-charcoal/70">
                  <span>PHASE JOURNEY</span>
                  <span>Target: {phase.target}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PHASES.map((p) => {
                    const isCurrent = p.id === phase.id;
                    const phaseTopics = data.topics.filter((t) => t.phase === p.id);
                    const allDone =
                      phaseTopics.length > 0 &&
                      phaseTopics.every((t) => effectiveTopicStatus(data, t) === "completed");
                    return (
                      <Link
                        key={p.id}
                        to="/roadmap"
                        className={cn(
                          "group flex flex-col justify-between rounded-xl border px-3 py-2 text-left transition-all",
                          isCurrent
                            ? "border-charcoal bg-lime text-charcoal shadow-xs"
                            : allDone
                              ? "border-charcoal/20 bg-charcoal text-ivory"
                              : "border-charcoal/10 bg-surface-white/70 text-charcoal/75 hover:bg-surface-white",
                        )}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span>0{p.id}</span>
                          <span>
                            D{p.start}–{p.end}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs font-bold">{p.name}</div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* MODULE B — TODAY'S SESSION (Most Actionable Module) */}
        <BentoCard
          surface="white"
          kicker="TODAY'S FOCUS"
          title={topic ? topic.name : "Free Practice & Upsolving"}
          className="lg:col-span-5"
          action={
            <span className="num font-mono text-xs font-semibold text-muted-foreground">
              Day {String(day).padStart(2, "0")}
            </span>
          }
        >
          <div className="flex h-full flex-col justify-between gap-5">
            <div>
              <p className="text-sm text-muted-foreground">
                {topic
                  ? topic.description
                  : "Focus on upsolving recent contest problems and reviewing weak topics."}
              </p>

              {/* Learning Objectives */}
              {topic && topic.objectives.length > 0 && (
                <div className="mt-4 rounded-2xl bg-ivory p-3.5 border border-charcoal/8">
                  <div className="text-[11px] font-mono font-semibold uppercase text-muted-foreground">
                    Learning Objectives
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {topic.objectives.map((obj) => (
                      <li key={obj} className="flex items-center gap-2.5 text-foreground">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-[2px] bg-lime border border-charcoal/30 shrink-0"
                        />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Today's Session Metrics & Action */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-charcoal/10 bg-cream/60 px-3.5 py-3">
                  <div className="text-[11px] font-mono uppercase text-muted-foreground">
                    Problems
                  </div>
                  <div className="num font-heading mt-1 text-2xl font-bold text-foreground">
                    {todaySolved}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {s.dailyProblems} target
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-charcoal/10 bg-cream/60 px-3.5 py-3">
                  <div className="text-[11px] font-mono uppercase text-muted-foreground">
                    Study Duration
                  </div>
                  <div className="num font-heading mt-1 text-2xl font-bold text-foreground">
                    {formatDuration(todayLog?.minutes ?? 0)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-xs text-muted-foreground">
                  {todayDone ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-lime text-charcoal">
                        <Check className="h-3 w-3" />
                      </span>
                      Daily target complete
                    </span>
                  ) : (
                    <span>
                      {Math.max(0, s.dailyProblems - todaySolved)} more{" "}
                      {Math.max(0, s.dailyProblems - todaySolved) === 1 ? "problem" : "problems"} to
                      hit target
                    </span>
                  )}
                </div>

                <Link
                  to="/log"
                  search={{ date: today }}
                  className="inline-flex items-center gap-2 rounded-full bg-charcoal px-5 py-2.5 text-xs font-semibold text-ivory transition-transform hover:scale-[1.02] active:scale-95 dark:bg-lime dark:text-charcoal whitespace-nowrap shrink-0"
                >
                  <span>{todayLog ? "Continue Session" : "Start Session"}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-lime dark:text-charcoal" />
                </Link>
              </div>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* ASYMMETRIC BENTO GRID — ROW 2: MODULE C (4 cols) + MODULE D (4 cols) + MODULE G (4 cols) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-12 lg:gap-5 items-stretch">
        {/* MODULE C — PROBLEMS SOLVED (Compact Charcoal Module) */}
        <BentoCard
          surface="charcoal"
          kicker="VOLUME & AUTONOMY"
          title="Problems Solved"
          className="lg:col-span-4"
          action={
            <Link
              to="/problems"
              aria-label="View all problems"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ivory/10 text-ivory transition-colors hover:bg-lime hover:text-charcoal"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          <div className="flex h-full flex-col justify-between gap-5">
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="num font-heading text-5xl font-bold tracking-tight text-lime sm:text-6xl">
                  {sum.totalSolved}
                </span>
                <span className="font-mono text-sm text-ivory/70">problems</span>
              </div>
              <p className="mt-2 text-xs text-ivory/70">
                {sum.totalSolved === 0
                  ? "No problems tracked yet. Add a problem or sync Codeforces."
                  : `Unique problems solved across ${sum.practiceDays} logged days.`}
              </p>
            </div>

            <div className="space-y-3 border-t border-ivory/12 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ivory/75">Independent solve rate</span>
                <span className="num font-mono font-bold text-lime">{sum.independentPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ivory/12">
                <div
                  className="h-full rounded-full bg-lime"
                  style={{ width: `${sum.independentPct}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1 font-mono text-[11px] text-ivory/65 num">
                <span>
                  {sum.independent} independent
                  {sum.unclassified > 0 ? ` · ${sum.unclassified} unclassified` : ""}
                </span>
                <span>·</span>
                <span>
                  {sum.totalMinutes === 0 ? "0h" : formatDuration(sum.totalMinutes)} practice
                </span>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* MODULE D — PRACTICE STREAK (Electric Lime Module with Ref 1 Day Capsules) */}
        <BentoCard
          surface="lime"
          kicker="DAILY MOMENTUM"
          title="Practice Streak"
          className="lg:col-span-4"
          action={
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-lime">
              <Flame className="h-4 w-4" />
            </span>
          }
        >
          <div className="flex h-full flex-col justify-between gap-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="num font-heading text-5xl font-bold tracking-tight text-charcoal sm:text-6xl">
                    {sum.current}
                  </span>
                  <span className="font-mono text-sm font-semibold text-charcoal/80">days</span>
                </div>
                <div className="num mt-1 text-xs font-medium text-charcoal/75">
                  Longest streak: <strong className="font-bold">{sum.longest} days</strong>
                </div>
              </div>

              <div className="rounded-xl bg-charcoal px-3 py-1.5 text-right text-ivory">
                <div className="text-[10px] font-mono uppercase text-ivory/70">Today</div>
                <div className="text-xs font-bold text-lime">
                  {todayDone ? "Completed" : "Pending"}
                </div>
              </div>
            </div>

            {/* Ref 1 Inspired Pill Calendar Strip */}
            <div className="grid grid-cols-6 gap-1.5 pt-2">
              {recentStrip.map((item) => (
                <Link
                  key={item.date}
                  to="/log"
                  search={{ date: item.date }}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-2xl py-2.5 text-center transition-transform hover:scale-105",
                    item.isTodayDate
                      ? "bg-charcoal text-ivory shadow-xs"
                      : item.done
                        ? "bg-ivory text-charcoal border border-charcoal/20"
                        : "bg-ivory/55 text-charcoal/65",
                  )}
                >
                  <span className="num font-heading text-sm font-bold leading-none">
                    {item.dayNum}
                  </span>
                  <span className="mt-1 text-[10px] font-mono uppercase opacity-80">
                    {item.weekday}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </BentoCard>

        {/* MODULE G — UPCOMING ROADMAP (Compact Module with Next 3 Incomplete Learning Topics) */}
        <BentoCard
          surface="ivory"
          kicker="THE JOURNEY"
          title="Upcoming Roadmap"
          className="lg:col-span-4"
          action={
            <Link
              to="/roadmap"
              className="text-xs font-mono font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground whitespace-nowrap"
            >
              All 4 phases
            </Link>
          }
        >
          <div className="flex h-full flex-col justify-between gap-3">
            {nextTopics.length > 0 ? (
              <div className="space-y-2.5">
                {nextTopics.map(({ topic: t, startDate, solvedCount }) => (
                  <Link
                    key={t.id}
                    to="/roadmap"
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-charcoal/10 bg-surface-white px-3.5 py-2.5 transition-colors hover:border-charcoal/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                        <span>
                          Days {t.startDay}–{t.endDay}
                        </span>
                        <span>·</span>
                        <span>{formatDate(startDate, { month: "short", day: "numeric" })}</span>
                      </div>
                      <div className="mt-0.5 truncate text-sm font-bold text-foreground">
                        {t.name}
                      </div>
                    </div>
                    <span className="num shrink-0 font-mono text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                      {solvedCount}/{t.targetProblems}p
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-surface-white p-4 text-sm text-muted-foreground">
                All roadmap topics completed! Keep pushing toward {s.targetRating}.
              </div>
            )}

            <div className="flex items-center justify-between border-t border-charcoal/10 pt-2.5 text-xs text-muted-foreground">
              <span>Current phase target</span>
              <span className="num font-mono font-bold text-foreground">{phase.target}</span>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Subtle Editorial Wavy Divider */}
      <WavyDivider />

      {/* ASYMMETRIC BENTO GRID — ROW 3: MODULE E (7 cols) + MODULE F (5 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-stretch">
        {/* MODULE E — 60-DAY ACTIVITY HEATMAP */}
        <BentoCard
          surface="ivory"
          kicker="TRAINING CADENCE"
          title="60-Day Activity Heatmap"
          className="lg:col-span-7"
          action={
            <span className="num font-mono text-xs text-muted-foreground">
              {sum.practiceDays} / {s.duration} active days
            </span>
          }
        >
          <ActivityHeatmap60 cells={heatmap} />
        </BentoCard>

        {/* MODULE F — RATING PROGRESSION */}
        <BentoCard
          surface="white"
          kicker="ACTUAL RATING HISTORY"
          title="Rating Progression"
          className="lg:col-span-5"
          action={
            <Link
              to="/contests"
              className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground whitespace-nowrap"
            >
              <span>Log contest</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="num font-heading text-3xl font-bold text-foreground">
                  {s.currentRating > 0 ? s.currentRating : "Unrated"}
                </span>
                {s.currentRating > 0 && (
                  <span
                    className={cn(
                      "num font-mono text-xs font-semibold",
                      ratingDelta >= 0 ? "text-sage-deep" : "text-coral",
                    )}
                  >
                    {ratingDelta >= 0 ? `+${ratingDelta}` : ratingDelta} net
                  </span>
                )}
              </div>
              <div className="num font-mono text-xs text-muted-foreground">
                Start {s.startRating > 0 ? s.startRating : "0"} → Goal {s.targetRating}
              </div>
            </div>

            <RatingProgressionChart points={ratings} targetRating={s.targetRating} height={210} />
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
