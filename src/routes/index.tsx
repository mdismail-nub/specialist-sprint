import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { useData, actions } from "@/lib/cp/store";
import { phaseFor, solvedOf, summary, topicForDay, isComplete } from "@/lib/cp/stats";
import { PHASES } from "@/lib/cp/roadmap";
import { formatDate, todayISO } from "@/lib/cp/dates";
import { Progress, Section, Stat } from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — CP Tracker" },
      { name: "description", content: "Your daily view of the 60-day Codeforces Specialist challenge." },
      { property: "og:title", content: "Overview — CP Tracker" },
      { property: "og:description", content: "Your daily view of the 60-day Codeforces Specialist challenge." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const data = useData();
  const today = todayISO();
  const s = data.settings;
  const sum = summary(data, today);
  const day = Math.min(Math.max(sum.day, 1), s.duration);
  const started = sum.day >= 1;
  const phase = phaseFor(day);
  const topic = topicForDay(data.topics, day);
  const todayLog = data.logs.find((l) => l.date === today);
  const nextTopic = data.topics.find((t) => t.startDay > day);
  const nextPhase = PHASES.find((p) => p.start > day);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState("");

  const saveRating = () => {
    const n = Number(rating);
    if (!Number.isInteger(n) || n < 0 || n > 4000) return toast.error("Enter a rating between 0 and 4000.");
    actions.updateSettings({ currentRating: n });
    setEditing(false);
    toast.success("Rating updated");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Keep showing up.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your journey to Codeforces Specialist.</p>
        <p className="num mt-2 text-xs text-muted-foreground">
          {started ? `Day ${sum.day > s.duration ? `${s.duration} (finished)` : sum.day} of ${s.duration}` : `Starts in ${1 - sum.day} day${sum.day === 0 ? "" : "s"}`} · {formatDate(today, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            Current rating
            {!editing && (
              <button aria-label="Edit rating" onClick={() => { setRating(String(s.currentRating)); setEditing(true); }} className="rounded p-1 hover:bg-accent">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          {editing ? (
            <form className="mt-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); saveRating(); }}>
              <Input autoFocus inputMode="numeric" value={rating} onChange={(e) => setRating(e.target.value)} className="h-8 px-2" />
              <Button size="sm" type="submit">Save</Button>
            </form>
          ) : (
            <div className="num mt-1 text-2xl font-semibold tracking-tight">{s.currentRating}</div>
          )}
          <div className="num mt-0.5 text-xs text-muted-foreground">{s.currentRating - s.startRating >= 0 ? "+" : ""}{s.currentRating - s.startRating} since start</div>
        </div>
        <Stat label="Target rating" value={s.targetRating} hint={`${Math.max(0, s.targetRating - s.currentRating)} to go`} />
        <Stat label="Problems solved" value={sum.totalSolved} hint={`${sum.independentPct}% independent`} />
        <Stat label="Current streak" value={`${sum.current}d`} hint={`Longest ${sum.longest}d`} />
      </div>

      <Section title="60-Day Specialist Challenge">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="num text-3xl font-semibold tracking-tight">{sum.progressPct}%</div>
          <div className="num text-sm text-muted-foreground">{sum.completedDays} / {s.duration} days completed · {sum.remainingDays} remaining</div>
        </div>
        <div className="mt-3"><Progress value={sum.progressPct} /></div>
        <div className="mt-4 grid grid-cols-4 gap-1">
          {PHASES.map((p) => (
            <div key={p.id} className="min-w-0">
              <div className={`h-1 rounded-full ${p.id < phase.id ? "bg-primary" : p.id === phase.id ? "bg-primary/50" : "bg-muted"}`} />
              <div className={`mt-1.5 truncate text-[11px] ${p.id === phase.id ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {p.id}. {p.name}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Current phase: <span className="text-foreground">Phase {phase.id} — {phase.name}</span> · target {phase.target}
        </p>
      </Section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Today" action={<span className="num text-xs text-muted-foreground">{formatDate(today)}</span>}>
          {topic ? (
            <>
              <div className="text-xs text-muted-foreground">Day {day} · Phase {topic.phase}</div>
              <div className="mt-0.5 text-base font-medium">{topic.name}</div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {topic.objectives.map((o) => <li key={o} className="flex gap-2"><span className="text-primary">·</span>{o}</li>)}
              </ul>
            </>
          ) : <div className="text-sm text-muted-foreground">No roadmap topic for today.</div>}
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3">
            <div className="num text-sm">
              <span className="font-semibold">{todayLog ? solvedOf(todayLog) : 0}</span>
              <span className="text-muted-foreground"> / {s.dailyProblems} problems</span>
              {todayLog && isComplete(todayLog, s) && <span className="ml-2 text-xs text-success">Complete</span>}
            </div>
            <Button asChild size="sm">
              <Link to="/log" search={{ date: today }}>{todayLog ? "Edit today's log" : "Log today"}</Link>
            </Button>
          </div>
        </Section>

        <Section title="Upcoming">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Next topic</dt>
              <dd className="mt-0.5">{nextTopic ? <>{nextTopic.name} <span className="text-muted-foreground">· Day {nextTopic.startDay}</span></> : "Final topic in progress"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Next milestone</dt>
              <dd className="mt-0.5">{nextPhase ? `Phase ${nextPhase.id}: ${nextPhase.name}` : "Challenge complete"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Days until milestone</dt>
              <dd className="num mt-0.5">{nextPhase ? nextPhase.start - day : Math.max(0, s.duration - day)}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </div>
  );
}
