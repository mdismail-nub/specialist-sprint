import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { actions, useData } from "@/lib/cp/store";
import { isComplete, solvedOf } from "@/lib/cp/stats";
import { formatDate, todayISO } from "@/lib/cp/dates";
import { LogForm, CHECKLIST } from "@/components/cp/LogForm";
import { Confirm, Empty, PageHeader } from "@/components/cp/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/log")({
  validateSearch: (s: Record<string, unknown>): { date?: string | undefined } => ({
    date: typeof s["date"] === "string" ? s["date"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Daily Log — CP Tracker" },
      { name: "description", content: "Record daily practice, problems solved and lessons learned." },
      { property: "og:title", content: "Daily Log — CP Tracker" },
      { property: "og:description", content: "Record daily practice, problems solved and lessons learned." },
    ],
  }),
  component: LogPage,
});

function LogPage() {
  const data = useData();
  const { date } = Route.useSearch();
  const navigate = useNavigate({ from: "/log" });
  const [newOpen, setNewOpen] = useState(false);
  const today = todayISO();
  const editing = date ? data.logs.find((l) => l.date === date) : undefined;
  const formOpen = newOpen || !!date;
  const close = () => { setNewOpen(false); navigate({ search: {} }); };
  const logs = [...data.logs].sort((a, b) => b.date.localeCompare(a.date));

  if (formOpen) {
    return (
      <div>
        <PageHeader title={editing ? "Edit log" : "New log"} subtitle={formatDate(editing?.date ?? date ?? today, { weekday: "long", month: "long", day: "numeric" })} />
        <LogForm key={editing?.id ?? date ?? "new"} initial={editing} date={date ?? (data.logs.some((l) => l.date === today) ? "" : today)} onDone={close} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Daily Log"
        subtitle={`${data.logs.length} entries`}
        action={
          <Button onClick={() => (data.logs.some((l) => l.date === today) ? setNewOpen(true) : navigate({ search: { date: today } }))}>
            <Plus className="h-4 w-4" /> New log
          </Button>
        }
      />
      {logs.length === 0 ? (
        <Empty title="No logs yet">Log your first training day to start your streak.</Empty>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {logs.map((l) => {
            const done = isComplete(l, data.settings);
            const checks = CHECKLIST.filter(([k]) => l.checklist[k]).length;
            return (
              <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${done ? "bg-success" : "bg-warning"}`} aria-label={done ? "Complete" : "Incomplete"} />
                <button className="min-w-0 flex-1 text-left" onClick={() => navigate({ search: { date: l.date } })}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{formatDate(l.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                    <span className="text-xs text-muted-foreground">Day {l.day}</span>
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{l.topic || "No topic"}</div>
                  <div className="num mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span><b className="font-medium text-foreground">{solvedOf(l)}</b> solved</span>
                    <span>{l.independent} indep.</span>
                    <span>{l.minutes} min</span>
                    <span>{checks}/5 checklist</span>
                    {l.maxRating && <span>max {l.maxRating}</span>}
                  </div>
                </button>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Edit log" onClick={() => navigate({ search: { date: l.date } })}><Pencil className="h-4 w-4" /></Button>
                  <Confirm
                    title="Delete this log?"
                    description={`The log for ${formatDate(l.date)} and its recorded problems will be removed.`}
                    onConfirm={() => { actions.deleteLog(l.id); toast.success("Log deleted"); }}
                    trigger={<Button variant="ghost" size="icon" aria-label="Delete log"><Trash2 className="h-4 w-4" /></Button>}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
