import { useState } from "react";
import { toast } from "sonner";
import { Check, Minus, Plus, Sparkles, X } from "lucide-react";
import type {
  ChecklistKey,
  DailyLog,
  Problem,
  ProblemPlatform,
  ProblemStatus,
} from "@/lib/cp/types";
import { actions, uid, useData } from "@/lib/cp/store";
import { challengeDay, formatDuration, topicForDay } from "@/lib/cp/stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BentoCard, Field, selectCls } from "./ui";
import { cn } from "@/lib/utils";

export const CHECKLIST: [ChecklistKey, string][] = [
  ["studied", "Studied today's topic"],
  ["solvedNew", "Solved new problems"],
  ["upsolved", "Upsolved difficult problems"],
  ["reviewed", "Reviewed previous mistakes"],
  ["notes", "Recorded learning notes"],
];

function Stepper({
  label,
  sublabel,
  value,
  onChange,
  highlight = false,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onChange: (n: number) => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5 transition-colors",
        highlight ? "border-charcoal/25 bg-lime/45" : "border-charcoal/12 bg-surface-white",
      )}
    >
      <div className="text-xs font-bold text-foreground">{label}</div>
      {sublabel && <div className="text-[11px] text-muted-foreground">{sublabel}</div>}
      <div className="mt-2.5 flex h-10 items-center justify-between rounded-xl border border-charcoal/15 bg-ivory px-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/75 hover:bg-charcoal hover:text-ivory transition-colors"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          inputMode="numeric"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))}
          className="num font-heading h-full w-14 min-w-0 bg-transparent text-center text-lg font-bold focus:outline-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/75 hover:bg-charcoal hover:text-ivory transition-colors"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

type Draft = Omit<Problem, "rating" | "minutes"> & { rating: string; minutes: string };

export function LogForm({
  initial,
  date,
  onDone,
}: {
  initial?: DailyLog | undefined;
  date: string;
  onDone: () => void;
}) {
  const data = useData();
  const s = data.settings;
  const day0 = challengeDay(s, initial?.date ?? date);
  const [log, setLog] = useState<DailyLog>(() =>
    initial
      ? { ...initial, editorial: initial.editorial ?? 0 }
      : {
          id: uid(),
          date,
          day: day0,
          topic: topicForDay(data.topics, day0)?.name ?? "",
          minutes: 0,
          attempted: 0,
          independent: 0,
          hinted: 0,
          editorial: 0,
          upsolved: 0,
          maxRating: null,
          contest: "",
          notes: "",
          lessons: "",
          checklist: {
            studied: false,
            solvedNew: false,
            upsolved: false,
            reviewed: false,
            notes: false,
          },
        },
  );
  const [problems, setProblems] = useState<Draft[]>(() =>
    data.problems
      .filter((p) => initial && p.logId === initial.id)
      .map((p) => ({
        ...p,
        platform: p.platform ?? "Codeforces",
        rating: p.rating?.toString() ?? "",
        minutes: p.minutes?.toString() ?? "",
      })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof DailyLog>(k: K, v: DailyLog[K]) => setLog((l) => ({ ...l, [k]: v }));

  const onDate = (d: string) => {
    const day = challengeDay(s, d);
    setLog((l) => ({
      ...l,
      date: d,
      day,
      topic: l.topic || topicForDay(data.topics, day)?.name || "",
    }));
  };

  const addProblem = () =>
    setProblems((p) => [
      ...p,
      {
        id: uid(),
        title: "",
        url: "",
        platform: "Codeforces",
        rating: "",
        topic: log.topic,
        tags: log.topic ? [log.topic] : [],
        date: log.date,
        status: "independent",
        minutes: "",
        notes: "",
      },
    ]);

  const fillFromProblems = () => {
    const c = (st: ProblemStatus) => problems.filter((p) => p.status === st).length;
    const ratings = problems
      .filter((p) => p.status !== "unsolved")
      .map((p) => Number(p.rating))
      .filter(Boolean);
    setLog((l) => ({
      ...l,
      attempted: problems.length,
      independent: c("independent"),
      hinted: c("hint"),
      editorial: c("editorial"),
      upsolved: c("resolved"),
      maxRating: ratings.length ? Math.max(...ratings) : l.maxRating,
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const editorialCount = log.editorial ?? 0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(log.date)) err["date"] = "Pick a valid date.";
    if (log.minutes > 1440) err["minutes"] = "Can't exceed 24 hours.";
    if (log.independent + log.hinted + editorialCount > log.attempted)
      err["attempted"] =
        "Solved new problems (independent + hint + editorial) can't exceed attempted.";
    if (log.maxRating != null && (log.maxRating < 0 || log.maxRating > 4000))
      err["maxRating"] = "Rating must be 0–4000.";
    if (data.logs.some((l) => l.date === log.date && l.id !== log.id))
      err["date"] = "A log already exists for this date — edit it instead.";
    problems.forEach((p, i) => {
      if (!p.title.trim()) err[`p${i}`] = "Problem name is required.";
      else if (p.url && !/^https?:\/\/\S+$/.test(p.url))
        err[`p${i}`] = "URL must start with http(s)://";
      else if (p.rating && (!/^\d+$/.test(p.rating) || +p.rating < 0 || +p.rating > 4000))
        err[`p${i}`] = "Rating must be 0–4000.";
    });
    setErrors(err);
    if (Object.keys(err).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    try {
      actions.saveLog(
        log,
        problems.map((p) => ({
          ...p,
          title: p.title.trim(),
          platform: p.platform ?? "Codeforces",
          rating: p.rating ? +p.rating : null,
          minutes: p.minutes ? +p.minutes : null,
          tags: p.topic ? [p.topic.trim()] : [],
        })),
      );
      toast.success(initial ? "Journal entry updated" : "Journal entry saved");
      onDone();
    } catch (x) {
      toast.error((x as Error).message);
    }
  };

  const totalSolved = log.independent + log.hinted + (log.editorial ?? 0) + log.upsolved;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Session Details & Topic */}
        <BentoCard
          surface="ivory"
          kicker="SESSION CONTEXT"
          title="Date, Topic & Time Spent"
          className="lg:col-span-7"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Session Date" error={errors["date"]}>
              <Input
                type="date"
                value={log.date}
                onChange={(e) => onDate(e.target.value)}
                className="bg-surface-white"
              />
            </Field>
            <Field label="Challenge Day">
              <Input
                value={
                  log.day >= 1 && log.day <= s.duration
                    ? `Day ${String(log.day).padStart(2, "0")} of ${s.duration}`
                    : "Outside challenge window"
                }
                disabled
                className="font-mono bg-cream/60"
              />
            </Field>
            <Field label={`Time Spent (${formatDuration(log.minutes)})`} error={errors["minutes"]}>
              <Input
                inputMode="numeric"
                value={log.minutes || ""}
                placeholder="Minutes (e.g. 180)"
                onChange={(e) => set("minutes", Number(e.target.value.replace(/\D/g, "")) || 0)}
                className="bg-surface-white num font-mono"
              />
            </Field>
            <Field label="Topics Studied" className="sm:col-span-3">
              <Input
                list="topics"
                value={log.topic}
                onChange={(e) => set("topic", e.target.value)}
                placeholder="e.g. Prefix sums, Binary search on answer..."
                className="bg-surface-white"
              />
              <datalist id="topics">
                {data.topics.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Highest Rating Solved" error={errors["maxRating"]}>
              <Input
                inputMode="numeric"
                value={log.maxRating ?? ""}
                placeholder="e.g. 1200"
                onChange={(e) =>
                  set(
                    "maxRating",
                    e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null,
                  )
                }
                className="bg-surface-white num font-mono"
              />
            </Field>
            <Field label="Contest Participated (Optional)" className="sm:col-span-2">
              <Input
                value={log.contest}
                onChange={(e) => set("contest", e.target.value)}
                placeholder="e.g. Codeforces Round 990 (Div. 3)"
                className="bg-surface-white"
              />
            </Field>
          </div>
        </BentoCard>

        {/* Daily Checklist Module */}
        <BentoCard
          surface="sage"
          kicker="DAILY HABITS"
          title="Daily Checklist"
          className="lg:col-span-5"
        >
          <div className="space-y-2">
            {CHECKLIST.map(([k, label]) => {
              const checked = log.checklist[k];
              return (
                <label
                  key={k}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition-all",
                    checked
                      ? "border-charcoal bg-lime text-charcoal shadow-2xs"
                      : "border-charcoal/12 bg-ivory/85 text-charcoal hover:bg-ivory",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) =>
                        set("checklist", { ...log.checklist, [k]: e.target.checked })
                      }
                    />
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border",
                        checked
                          ? "border-charcoal bg-charcoal text-lime"
                          : "border-charcoal/30 bg-surface-white",
                      )}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span>{label}</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase opacity-70">
                    {checked ? "Done" : "Todo"}
                  </span>
                </label>
              );
            })}
          </div>
        </BentoCard>
      </div>

      {/* Problem Solving Counters */}
      <BentoCard
        surface="white"
        kicker="SOLVING BREAKDOWN"
        title={`Problem Counts (${totalSolved} total solved)`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stepper
            label="Attempted"
            sublabel="Total problems tried"
            value={log.attempted}
            onChange={(n) => set("attempted", n)}
          />
          <Stepper
            label="Independent"
            sublabel="Solved without hints"
            value={log.independent}
            onChange={(n) => {
              const nextAttempted = Math.max(log.attempted, n + log.hinted + (log.editorial ?? 0));
              setLog((l) => ({ ...l, independent: n, attempted: nextAttempted }));
            }}
            highlight
          />
          <Stepper
            label="Hint-assisted"
            sublabel="Solved using hints"
            value={log.hinted}
            onChange={(n) => {
              const nextAttempted = Math.max(
                log.attempted,
                log.independent + n + (log.editorial ?? 0),
              );
              setLog((l) => ({ ...l, hinted: n, attempted: nextAttempted }));
            }}
          />
          <Stepper
            label="Editorial"
            sublabel="After reading editorial"
            value={log.editorial ?? 0}
            onChange={(n) => {
              const nextAttempted = Math.max(log.attempted, log.independent + log.hinted + n);
              setLog((l) => ({ ...l, editorial: n, attempted: nextAttempted }));
            }}
          />
          <Stepper
            label="Upsolved"
            sublabel="Post-contest / re-solved"
            value={log.upsolved}
            onChange={(n) => set("upsolved", n)}
          />
        </div>
        {errors["attempted"] && (
          <p className="mt-2 text-xs font-medium text-coral">{errors["attempted"]}</p>
        )}
      </BentoCard>

      {/* Logged Problems List */}
      <BentoCard
        surface="ivory"
        kicker="PROBLEM LOG"
        title={`Recorded Problems (${problems.length})`}
        action={
          <div className="flex flex-wrap gap-1.5">
            {problems.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillFromProblems}
                className="rounded-full text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" /> Sync counts from list
              </Button>
            )}
            <Button type="button" size="sm" onClick={addProblem} className="rounded-full text-xs">
              <Plus className="h-3.5 w-3.5" /> Add problem
            </Button>
          </div>
        }
      >
        {problems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-charcoal/15 bg-surface-white/60 px-4 py-6 text-center text-xs text-muted-foreground">
            Optional: Add specific problems from today&apos;s session to track them in your Problem
            Tracker.
          </div>
        ) : (
          <div className="space-y-2.5">
            {problems.map((p, i) => {
              const up = (patch: Partial<Draft>) =>
                setProblems((ps) => ps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-charcoal/12 bg-surface-white p-3.5"
                >
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6">
                    <Input
                      className="col-span-2"
                      placeholder="Problem title (e.g. Two Buttons)"
                      value={p.title}
                      onChange={(e) => up({ title: e.target.value })}
                    />
                    <select
                      aria-label="Platform"
                      className={selectCls}
                      value={p.platform ?? "Codeforces"}
                      onChange={(e) => up({ platform: e.target.value as ProblemPlatform })}
                    >
                      <option value="Codeforces">Codeforces</option>
                      <option value="AtCoder">AtCoder</option>
                      <option value="CSES">CSES</option>
                      <option value="Other">Other Judge</option>
                    </select>
                    <Input
                      className="col-span-2 sm:col-span-3"
                      placeholder="https://codeforces.com/problemset/problem/..."
                      value={p.url}
                      onChange={(e) => up({ url: e.target.value.trim() })}
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="Rating (e.g. 1200)"
                      value={p.rating}
                      onChange={(e) => up({ rating: e.target.value.replace(/\D/g, "") })}
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="Minutes"
                      value={p.minutes}
                      onChange={(e) => up({ minutes: e.target.value.replace(/\D/g, "") })}
                    />
                    <Input
                      className="col-span-2"
                      placeholder="Topic / Tag"
                      value={p.topic}
                      onChange={(e) => up({ topic: e.target.value })}
                    />
                    <div className="col-span-2 flex gap-2">
                      <select
                        aria-label="Solving method"
                        className={selectCls}
                        value={p.status}
                        onChange={(e) => up({ status: e.target.value as ProblemStatus })}
                      >
                        <option value="independent">Independent</option>
                        <option value="hint">With hint</option>
                        <option value="editorial">After editorial</option>
                        <option value="resolved">Upsolved / Re-solved</option>
                        <option value="unsolved">Unsolved</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove problem"
                        onClick={() => setProblems((ps) => ps.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {errors[`p${i}`] && (
                    <p className="mt-1.5 text-xs font-medium text-coral">{errors[`p${i}`]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </BentoCard>

      {/* Personal Reflection & Notes */}
      <BentoCard surface="white" kicker="REFLECTION" title="Personal Notes & Takeaways">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Learning Notes & Approach">
            <Textarea
              rows={4}
              placeholder="What patterns clicked today? Which problem felt most rewarding?"
              value={log.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="bg-ivory/60"
            />
          </Field>
          <Field label="Mistakes & Lessons Learned">
            <Textarea
              rows={4}
              placeholder="Off-by-one errors, integer overflow, wrong greedy assumption..."
              value={log.lessons}
              onChange={(e) => set("lessons", e.target.value)}
              className="bg-ivory/60"
            />
          </Field>
        </div>
      </BentoCard>

      <div className="sticky bottom-14 z-20 flex items-center justify-end gap-2.5 rounded-2xl border border-charcoal/15 bg-ivory/95 px-4 py-3 backdrop-blur-md md:bottom-4">
        <Button type="button" variant="outline" onClick={onDone} className="rounded-full px-5">
          Cancel
        </Button>
        <Button type="submit" className="rounded-full px-6">
          {initial ? "Save Journal Changes" : "Save Daily Log"}
        </Button>
      </div>
    </form>
  );
}
