import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { actions, useData } from "@/lib/cp/store";
import { challengeDay, formatDuration, isComplete, solvedOf, summary } from "@/lib/cp/stats";
import { addDays, formatDate, todayISO } from "@/lib/cp/dates";
import { LogForm, CHECKLIST } from "@/components/cp/LogForm";
import { BentoCard, Confirm, Empty, PageHeader } from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/log")({
  validateSearch: (s: Record<string, unknown>): { date?: string | undefined } => ({
    date: typeof s["date"] === "string" ? s["date"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Daily Log — CP Tracker" },
      {
        name: "description",
        content: "Record daily practice, problems solved and lessons learned.",
      },
      { property: "og:title", content: "Daily Log — CP Tracker" },
      {
        property: "og:description",
        content: "Record daily practice, problems solved and lessons learned.",
      },
    ],
  }),
  component: LogPage,
});

function LogPage() {
  const data = useData();
  const { date } = Route.useSearch();
  const navigate = useNavigate({ from: "/log" });
  const [newOpen, setNewOpen] = useState(false);
  const [jumpDate, setJumpDate] = useState("");
  const today = todayISO();
  const sum = summary(data, today);

  const editing = date ? data.logs.find((l) => l.date === date) : undefined;
  const formOpen = newOpen || !!date;
  const close = () => {
    setNewOpen(false);
    navigate({ search: {} });
  };
  const logs = [...data.logs].sort((a, b) => b.date.localeCompare(a.date));

  // Last 10 days calendar strip for quick date selection
  const dateStrip = Array.from({ length: 10 }, (_, idx) => {
    const iso = addDays(today, idx - 8);
    const dt = new Date(iso + "T00:00:00");
    const dayNum = dt.getDate();
    const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
    const entry = data.logs.find((l) => l.date === iso);
    const done = entry ? isComplete(entry, data.settings) : false;
    return {
      iso,
      dayNum,
      weekday,
      hasEntry: !!entry,
      done,
      isToday: iso === today,
    };
  });

  if (formOpen) {
    const activeDate = editing?.date ?? date ?? today;
    const cDay = challengeDay(data.settings, activeDate);
    return (
      <div className="space-y-6">
        <PageHeader
          kicker={editing ? `EDITING DAY ${String(cDay).padStart(2, "0")}` : "NEW TRAINING ENTRY"}
          title={editing ? "Update Training Log" : "Record Today's Practice"}
          subtitle={formatDate(activeDate, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          action={
            <Button variant="outline" onClick={close} className="rounded-full">
              Back to journal
            </Button>
          }
        />
        <LogForm
          key={editing?.id ?? date ?? "new"}
          initial={editing}
          date={date ?? (data.logs.some((l) => l.date === today) ? "" : today)}
          onDone={close}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="PERSONAL TRAINING JOURNAL"
        title="Daily Practice Log"
        subtitle={`${data.logs.length} recorded sessions · ${formatDuration(sum.totalMinutes)} total study time`}
        action={
          <Button
            onClick={() =>
              data.logs.some((l) => l.date === today)
                ? setNewOpen(true)
                : navigate({ search: { date: today } })
            }
            className="rounded-full px-5"
          >
            <Plus className="h-4 w-4" /> Log Today&apos;s Session
          </Button>
        }
      />

      {/* Calendar Strip & Quick Date Selector */}
      <BentoCard
        surface="ivory"
        kicker="DATE SELECTOR"
        title="Recent Days & Calendar Jump"
        action={
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground hidden sm:inline" />
            <Input
              type="date"
              aria-label="Jump to date"
              value={jumpDate}
              onChange={(e) => {
                setJumpDate(e.target.value);
                if (e.target.value) {
                  navigate({ search: { date: e.target.value } });
                }
              }}
              className="h-9 w-40 rounded-full bg-surface-white text-xs font-mono"
            />
          </div>
        }
      >
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {dateStrip.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => navigate({ search: { date: d.iso } })}
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border py-3 transition-all hover:scale-105",
                d.isToday
                  ? "border-charcoal bg-charcoal text-ivory"
                  : d.done
                    ? "border-charcoal/25 bg-lime text-charcoal"
                    : d.hasEntry
                      ? "border-charcoal/15 bg-sage/60 text-charcoal"
                      : "border-charcoal/10 bg-surface-white text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-[10px] font-mono uppercase opacity-75">{d.weekday}</span>
              <span className="num font-heading mt-0.5 text-lg font-bold leading-none">
                {d.dayNum}
              </span>
              <span className="mt-1 text-[9px] font-mono">
                {d.done ? "Done" : d.hasEntry ? "Logged" : "Open"}
              </span>
            </button>
          ))}
        </div>
      </BentoCard>

      {/* Journal Entries List */}
      {logs.length === 0 ? (
        <Empty title="Your training journal is waiting for its first entry.">
          <p className="max-w-md mx-auto">
            Record today&apos;s practice session, study duration, problems solved, and key takeaways
            to build your training streak.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => navigate({ search: { date: today } })}
              className="rounded-full px-5"
            >
              <Plus className="h-4 w-4" /> Start today&apos;s session
            </Button>
          </div>
        </Empty>
      ) : (
        <div className="space-y-4">
          {logs.map((l) => {
            const done = isComplete(l, data.settings);
            const totalSolved = solvedOf(l);
            const checks = CHECKLIST.filter(([k]) => l.checklist[k]);

            return (
              <article
                key={l.id}
                className="group rounded-[26px] border border-charcoal/12 bg-ivory p-5 sm:p-6 transition-colors hover:border-charcoal/25"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-charcoal/10 pb-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={cn(
                        "num font-heading flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-center",
                        done
                          ? "border-charcoal/30 bg-lime text-charcoal"
                          : "border-charcoal/15 bg-surface-white text-foreground",
                      )}
                    >
                      <span className="text-[9px] font-mono uppercase leading-none opacity-75">
                        Day
                      </span>
                      <span className="text-base font-bold leading-tight">
                        {String(l.day).padStart(2, "0")}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-lg font-bold text-foreground">
                          {l.topic || "General Problem Solving"}
                        </h2>
                        <span className="font-mono text-xs text-muted-foreground">
                          ·{" "}
                          {formatDate(l.date, { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        {done && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-lime px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-charcoal border border-charcoal/20">
                            <Check className="h-3 w-3" /> Complete
                          </span>
                        )}
                      </div>
                      {l.contest && (
                        <div className="mt-0.5 text-xs font-medium text-muted-foreground">
                          Contest: {l.contest}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Edit log for ${l.date}`}
                      onClick={() => navigate({ search: { date: l.date } })}
                      className="rounded-full text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Confirm
                      title="Delete this journal entry?"
                      description={`The log for ${formatDate(l.date)} and its recorded problems will be removed.`}
                      onConfirm={() => {
                        actions.deleteLog(l.id);
                        toast.success("Log deleted");
                      }}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete log for ${l.date}`}
                          className="rounded-full text-muted-foreground hover:text-coral"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </div>

                {/* Metrics Strip */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-7">
                  <div className="rounded-xl bg-surface-white px-3 py-2 border border-charcoal/8">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Attempted
                    </div>
                    <div className="num font-heading text-lg font-bold">{l.attempted}</div>
                  </div>
                  <div className="rounded-xl bg-lime/40 px-3 py-2 border border-charcoal/15">
                    <div className="text-[10px] font-mono uppercase text-charcoal/80">
                      Independent
                    </div>
                    <div className="num font-heading text-lg font-bold text-charcoal">
                      {l.independent}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface-white px-3 py-2 border border-charcoal/8">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      With Hint
                    </div>
                    <div className="num font-heading text-lg font-bold">{l.hinted}</div>
                  </div>
                  <div className="rounded-xl bg-surface-white px-3 py-2 border border-charcoal/8">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Editorial
                    </div>
                    <div className="num font-heading text-lg font-bold">{l.editorial ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-surface-white px-3 py-2 border border-charcoal/8">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Upsolved
                    </div>
                    <div className="num font-heading text-lg font-bold">{l.upsolved}</div>
                  </div>
                  <div className="rounded-xl bg-surface-white px-3 py-2 border border-charcoal/8">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Time Spent
                    </div>
                    <div className="num font-mono text-sm font-bold mt-0.5">
                      {formatDuration(l.minutes)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-charcoal px-3 py-2 text-ivory col-span-2 sm:col-span-1">
                    <div className="text-[10px] font-mono uppercase text-ivory/70">
                      Total Solved
                    </div>
                    <div className="num font-heading text-lg font-bold text-lime">
                      {totalSolved}{" "}
                      {l.maxRating && (
                        <span className="font-mono text-[11px] font-normal text-ivory/75">
                          (max {l.maxRating})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes, Lessons & Checklist */}
                {(l.notes || l.lessons || checks.length > 0) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(l.notes || l.lessons) && (
                      <div className="space-y-1.5 rounded-2xl bg-surface-white/80 p-3.5 text-xs border border-charcoal/8">
                        {l.notes && (
                          <p className="text-foreground/90">
                            <strong className="font-mono text-[10px] uppercase text-muted-foreground mr-1.5">
                              Notes:
                            </strong>
                            {l.notes}
                          </p>
                        )}
                        {l.lessons && (
                          <p className="text-foreground/85">
                            <strong className="font-mono text-[10px] uppercase text-muted-foreground mr-1.5">
                              Takeaway:
                            </strong>
                            {l.lessons}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap content-start items-center gap-1.5 rounded-2xl bg-surface-white/80 p-3.5 text-xs border border-charcoal/8">
                      <span className="font-mono text-[10px] uppercase text-muted-foreground w-full mb-1">
                        Checklist ({checks.length}/5 completed)
                      </span>
                      {CHECKLIST.map(([k, label]) => {
                        const ok = l.checklist[k];
                        return (
                          <span
                            key={k}
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px]",
                              ok
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground/60 line-through",
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-[2px]",
                                ok ? "bg-lime border border-charcoal/30" : "bg-warm-gray",
                              )}
                            />
                            <span>{label}</span>
                            <span aria-hidden="true" className="mx-1 text-muted-foreground/40">
                              ·
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
