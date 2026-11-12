import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, X } from "lucide-react";
import type { ChecklistKey, DailyLog, Problem, ProblemStatus } from "@/lib/cp/types";
import { actions, uid, useData } from "@/lib/cp/store";
import { challengeDay, topicForDay } from "@/lib/cp/stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, selectCls } from "./ui";
import { cn } from "@/lib/utils";

export const CHECKLIST: [ChecklistKey, string][] = [
  ["studied", "Studied today's topic"],
  ["solvedNew", "Solved new problems"],
  ["upsolved", "Upsolved difficult problems"],
  ["reviewed", "Reviewed previous mistakes"],
  ["notes", "Updated learning notes"],
];

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex h-10 items-center rounded-md border border-input">
        <button type="button" aria-label={`Decrease ${label}`} className="flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground" onClick={() => onChange(Math.max(0, value - 1))}><Minus className="h-4 w-4" /></button>
        <input inputMode="numeric" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))} className="num h-full w-full min-w-0 bg-transparent text-center text-sm font-medium focus:outline-none" />
        <button type="button" aria-label={`Increase ${label}`} className="flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground" onClick={() => onChange(value + 1)}><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

type Draft = Omit<Problem, "rating" | "minutes"> & { rating: string; minutes: string };

export function LogForm({ initial, date, onDone }: { initial?: DailyLog | undefined; date: string; onDone: () => void }) {
  const data = useData();
  const s = data.settings;
  const day0 = challengeDay(s, initial?.date ?? date);
  const [log, setLog] = useState<DailyLog>(
    initial ?? {
      id: uid(), date, day: day0, topic: topicForDay(data.topics, day0)?.name ?? "", minutes: 0, attempted: 0,
      independent: 0, hinted: 0, upsolved: 0, maxRating: null, contest: "", notes: "", lessons: "",
      checklist: { studied: false, solvedNew: false, upsolved: false, reviewed: false, notes: false },
    },
  );
  const [problems, setProblems] = useState<Draft[]>(() =>
    data.problems.filter((p) => initial && p.logId === initial.id).map((p) => ({ ...p, rating: p.rating?.toString() ?? "", minutes: p.minutes?.toString() ?? "" })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof DailyLog>(k: K, v: DailyLog[K]) => setLog((l) => ({ ...l, [k]: v }));

  const onDate = (d: string) => {
    const day = challengeDay(s, d);
    setLog((l) => ({ ...l, date: d, day, topic: l.topic || topicForDay(data.topics, day)?.name || "" }));
  };

  const addProblem = () =>
    setProblems((p) => [...p, { id: uid(), title: "", url: "", rating: "", topic: log.topic, date: log.date, status: "independent", minutes: "" }]);

  const fillFromProblems = () => {
    const c = (st: ProblemStatus) => problems.filter((p) => p.status === st).length;
    const ratings = problems.filter((p) => p.status !== "unsolved").map((p) => Number(p.rating)).filter(Boolean);
    setLog((l) => ({ ...l, attempted: problems.length, independent: c("independent"), hinted: c("hint") + c("editorial"), upsolved: c("resolved"), maxRating: ratings.length ? Math.max(...ratings) : l.maxRating }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(log.date)) err['date'] = "Pick a valid date.";
    if (log.minutes > 1440) err['minutes'] = "Can't exceed 24 hours.";
    if (log.independent + log.hinted > log.attempted) err['attempted'] = "Solved new problems can't exceed attempted.";
    if (log.maxRating != null && (log.maxRating < 800 || log.maxRating > 3500)) err['maxRating'] = "Rating must be 800–3500.";
    if (data.logs.some((l) => l.date === log.date && l.id !== log.id)) err['date'] = "A log already exists for this date — edit it instead.";
    problems.forEach((p, i) => {
      if (!p.title.trim()) err[`p${i}`] = "Problem name is required.";
      else if (p.url && !/^https?:\/\/\S+$/.test(p.url)) err[`p${i}`] = "URL must start with http(s)://";
      else if (p.rating && (!/^\d+$/.test(p.rating) || +p.rating < 800 || +p.rating > 3500)) err[`p${i}`] = "Rating must be 800–3500.";
    });
    setErrors(err);
    if (Object.keys(err).length) { toast.error("Please fix the highlighted fields."); return; }
    try {
      actions.saveLog(
        log,
        problems.map((p) => ({ ...p, title: p.title.trim(), rating: p.rating ? +p.rating : null, minutes: p.minutes ? +p.minutes : null })),
      );
      toast.success(initial ? "Log updated" : "Log saved");
      onDone();
    } catch (x) {
      toast.error((x as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Date" error={errors['date']} className="col-span-2 sm:col-span-1">
          <Input type="date" value={log.date} onChange={(e) => onDate(e.target.value)} />
        </Field>
        <Field label="Roadmap day">
          <Input value={log.day >= 1 && log.day <= s.duration ? `Day ${log.day}` : "Outside challenge"} disabled />
        </Field>
        <Field label="Minutes" error={errors['minutes']}>
          <Input inputMode="numeric" value={log.minutes || ""} placeholder="0" onChange={(e) => set("minutes", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </Field>
        <Field label="Topic studied" className="col-span-2 sm:col-span-4">
          <Input list="topics" value={log.topic} onChange={(e) => set("topic", e.target.value)} placeholder="e.g. Prefix sums" />
          <datalist id="topics">{data.topics.map((t) => <option key={t.id} value={t.name} />)}</datalist>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stepper label="Attempted" value={log.attempted} onChange={(n) => set("attempted", n)} />
        <Stepper label="Independent" value={log.independent} onChange={(n) => set("independent", n)} />
        <Stepper label="Hint / editorial" value={log.hinted} onChange={(n) => set("hinted", n)} />
        <Stepper label="Upsolved" value={log.upsolved} onChange={(n) => set("upsolved", n)} />
      </div>
      {errors['attempted'] && <p className="-mt-3 text-xs text-destructive">{errors['attempted']}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Highest rating solved" error={errors['maxRating']}>
          <Input inputMode="numeric" value={log.maxRating ?? ""} placeholder="e.g. 1000" onChange={(e) => set("maxRating", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} />
        </Field>
        <Field label="Contest (optional)">
          <Input value={log.contest} onChange={(e) => set("contest", e.target.value)} placeholder="e.g. Codeforces Round 990 (Div. 3)" />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-muted-foreground">Checklist</div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CHECKLIST.map(([k, label]) => (
            <label key={k} className={cn("flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm", log.checklist[k] ? "border-primary/40 bg-primary/5" : "border-border")}>
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={log.checklist[k]} onChange={(e) => set("checklist", { ...log.checklist, [k]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Problems ({problems.length})</span>
          <div className="flex gap-1">
            {problems.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={fillFromProblems}>Fill counts</Button>}
            <Button type="button" variant="outline" size="sm" onClick={addProblem}><Plus className="h-3.5 w-3.5" /> Add problem</Button>
          </div>
        </div>
        <div className="space-y-2">
          {problems.map((p, i) => {
            const up = (patch: Partial<Draft>) => setProblems((ps) => ps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={p.id} className="rounded-md border border-border p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <Input className="col-span-2" placeholder="Problem name" value={p.title} onChange={(e) => up({ title: e.target.value })} />
                  <Input className="col-span-2 sm:col-span-4" placeholder="https://codeforces.com/problemset/problem/…" value={p.url} onChange={(e) => up({ url: e.target.value.trim() })} />
                  <Input inputMode="numeric" placeholder="Rating" value={p.rating} onChange={(e) => up({ rating: e.target.value.replace(/\D/g, "") })} />
                  <Input inputMode="numeric" placeholder="Minutes" value={p.minutes} onChange={(e) => up({ minutes: e.target.value.replace(/\D/g, "") })} />
                  <Input className="col-span-2" placeholder="Tag" value={p.topic} onChange={(e) => up({ topic: e.target.value })} />
                  <div className="col-span-2 flex gap-2">
                    <select className={selectCls} value={p.status} onChange={(e) => up({ status: e.target.value as ProblemStatus })}>
                      <option value="independent">Independent</option>
                      <option value="hint">Hint</option>
                      <option value="editorial">Editorial</option>
                      <option value="unsolved">Unsolved</option>
                    </select>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove problem" onClick={() => setProblems((ps) => ps.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
                {errors[`p${i}`] && <p className="mt-1 text-xs text-destructive">{errors[`p${i}`]}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Notes"><Textarea rows={3} value={log.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <Field label="Mistakes & lessons"><Textarea rows={3} value={log.lessons} onChange={(e) => set("lessons", e.target.value)} /></Field>
      </div>

      <div className="sticky bottom-16 flex gap-2 border-t border-border bg-background py-3 md:bottom-0">
        <Button type="submit" className="flex-1 sm:flex-none">{initial ? "Save changes" : "Save log"}</Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

