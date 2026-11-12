import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Calendar, Check, Clock, FileText, Pencil, Plus, X } from "lucide-react";
import { actions, uid, useData } from "@/lib/cp/store";
import {
  challengeDay,
  effectiveTopicStatus,
  formatDuration,
  phaseFor,
  topicMinutesSpent,
  topicSolved,
} from "@/lib/cp/stats";
import { PHASES } from "@/lib/cp/roadmap";
import { addDays, formatDate, todayISO } from "@/lib/cp/dates";
import type { Topic, TopicStatus } from "@/lib/cp/types";
import {
  BentoCard,
  EditorialLabel,
  Field,
  PageHeader,
  selectCls,
  WavyDivider,
} from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap — CP Tracker" },
      {
        name: "description",
        content: "Four-phase structured 60-day curriculum to reach Codeforces Specialist.",
      },
      { property: "og:title", content: "Roadmap — CP Tracker" },
      {
        property: "og:description",
        content: "Four-phase structured 60-day curriculum to reach Codeforces Specialist.",
      },
    ],
  }),
  component: RoadmapPage,
});

const STATUS_OPTIONS: { value: TopicStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

interface TopicDraft {
  id: string;
  phase: 1 | 2 | 3 | 4;
  name: string;
  startDay: string;
  endDay: string;
  plannedDate: string;
  targetProblems: string;
  description: string;
  objectivesText: string;
  status: TopicStatus;
  notes: string;
}

function RoadmapPage() {
  const data = useData();
  const today = todayISO();
  const s = data.settings;
  const rawDay = challengeDay(s, today);
  const day = Math.min(Math.max(rawDay, 1), s.duration);
  const currentPhase = phaseFor(day)!;

  const [selectedPhase, setSelectedPhase] = useState<number | "all">("all");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingTopic, setEditingTopic] = useState<TopicDraft | null>(null);
  const [topicError, setTopicError] = useState("");

  const totalTopics = data.topics.length;
  const completedTopics = data.topics.filter(
    (t) => effectiveTopicStatus(data, t) === "completed",
  ).length;
  const inProgressTopics = data.topics.filter(
    (t) => effectiveTopicStatus(data, t) === "in_progress",
  ).length;

  const openNotes = (t: Topic) => {
    setEditingNotesId(t.id);
    setNotesDraft(t.notes);
  };

  const saveNotes = (t: Topic) => {
    actions.saveTopic({ ...t, notes: notesDraft.trim() });
    setEditingNotesId(null);
    toast.success(`Saved notes for "${t.name}"`);
  };

  const updateStatus = (t: Topic, status: TopicStatus) => {
    actions.saveTopic({ ...t, status });
    toast.success(`${t.name} marked ${status.replace("_", " ")}`);
  };

  const openEditTopic = (t: Topic) => {
    setTopicError("");
    setEditingTopic({
      id: t.id,
      phase: t.phase,
      name: t.name,
      startDay: String(t.startDay),
      endDay: String(t.endDay),
      plannedDate: t.plannedDate || addDays(s.startDate, t.startDay - 1),
      targetProblems: String(t.targetProblems),
      description: t.description,
      objectivesText: t.objectives.join(", "),
      status: t.status,
      notes: t.notes,
    });
  };

  const openNewTopic = () => {
    setTopicError("");
    setEditingTopic({
      id: `t-${uid()}`,
      phase: currentPhase.id,
      name: "",
      startDay: String(day),
      endDay: String(Math.min(s.duration, day + 3)),
      plannedDate: today,
      targetProblems: "12",
      description: "",
      objectivesText: "",
      status: "not_started",
      notes: "",
    });
  };

  const submitTopicDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic) return;
    if (!editingTopic.name.trim()) {
      setTopicError("Topic name is required.");
      return;
    }
    const startD = Math.max(1, Number(editingTopic.startDay) || 1);
    const endD = Math.max(startD, Number(editingTopic.endDay) || startD);
    const targetP = Math.max(1, Number(editingTopic.targetProblems) || 10);
    const objectives = editingTopic.objectivesText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    actions.saveTopic({
      id: editingTopic.id,
      phase: editingTopic.phase,
      name: editingTopic.name.trim(),
      startDay: startD,
      endDay: endD,
      plannedDate: editingTopic.plannedDate || addDays(s.startDate, startD - 1),
      targetProblems: targetP,
      description: editingTopic.description.trim() || "Custom training topic.",
      objectives: objectives.length > 0 ? objectives : ["Core pattern mastery"],
      status: editingTopic.status,
      notes: editingTopic.notes.trim(),
    });
    setEditingTopic(null);
    toast.success("Roadmap topic saved");
  };

  const visiblePhases =
    selectedPhase === "all" ? PHASES : PHASES.filter((p) => p.id === selectedPhase);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="THE 60-DAY CURRICULUM"
        title="Specialist Training Roadmap"
        subtitle="Four progressive phases driven by your real solved problems and study sessions. Customize or reschedule any topic as your training evolves."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-2xl border border-charcoal/12 bg-ivory px-4 py-2 text-right">
              <div className="text-[11px] font-mono uppercase text-muted-foreground">
                Curriculum Mastery
              </div>
              <div className="num font-heading text-base font-bold text-foreground">
                {completedTopics} / {totalTopics} topics{" "}
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  ({inProgressTopics} active)
                </span>
              </div>
            </div>
            <Button onClick={openNewTopic} className="rounded-full px-4">
              <Plus className="h-4 w-4" /> Add Topic
            </Button>
          </div>
        }
      />

      {/* Topic Edit / Reschedule Form */}
      {editingTopic && (
        <BentoCard
          surface="white"
          kicker="CUSTOMIZE ROADMAP"
          title={
            data.topics.some((t) => t.id === editingTopic.id)
              ? "Edit / Reschedule Topic"
              : "Add Custom Roadmap Topic"
          }
          action={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close topic editor"
              onClick={() => setEditingTopic(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          }
        >
          <form onSubmit={submitTopicDraft} className="space-y-4">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Field label="Topic Name" className="sm:col-span-2">
                <Input
                  autoFocus
                  placeholder="e.g. Two Pointers & Sliding Window"
                  value={editingTopic.name}
                  onChange={(e) => setEditingTopic({ ...editingTopic, name: e.target.value })}
                />
              </Field>
              <Field label="Phase">
                <select
                  aria-label="Phase"
                  className={selectCls}
                  value={editingTopic.phase}
                  onChange={(e) =>
                    setEditingTopic({
                      ...editingTopic,
                      phase: Number(e.target.value) as 1 | 2 | 3 | 4,
                    })
                  }
                >
                  {PHASES.map((p) => (
                    <option key={p.id} value={p.id}>
                      Phase 0{p.id} — {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start Day">
                <Input
                  inputMode="numeric"
                  value={editingTopic.startDay}
                  onChange={(e) =>
                    setEditingTopic({
                      ...editingTopic,
                      startDay: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="End Day">
                <Input
                  inputMode="numeric"
                  value={editingTopic.endDay}
                  onChange={(e) =>
                    setEditingTopic({
                      ...editingTopic,
                      endDay: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Planned Start Date">
                <Input
                  type="date"
                  value={editingTopic.plannedDate}
                  onChange={(e) =>
                    setEditingTopic({ ...editingTopic, plannedDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Target Problems">
                <Input
                  inputMode="numeric"
                  value={editingTopic.targetProblems}
                  onChange={(e) =>
                    setEditingTopic({
                      ...editingTopic,
                      targetProblems: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Status">
                <select
                  aria-label="Topic status"
                  className={selectCls}
                  value={editingTopic.status}
                  onChange={(e) =>
                    setEditingTopic({ ...editingTopic, status: e.target.value as TopicStatus })
                  }
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Key Objectives (Comma-separated)">
                <Input
                  placeholder="e.g. Monotonic window, Subarray sum, Two-sum variants"
                  value={editingTopic.objectivesText}
                  onChange={(e) =>
                    setEditingTopic({ ...editingTopic, objectivesText: e.target.value })
                  }
                />
              </Field>
              <Field label="Description" className="sm:col-span-3">
                <Input
                  placeholder="Core training goal for this module..."
                  value={editingTopic.description}
                  onChange={(e) =>
                    setEditingTopic({ ...editingTopic, description: e.target.value })
                  }
                />
              </Field>
            </div>
            {topicError && <p className="text-xs font-medium text-coral">{topicError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingTopic(null)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-6">
                Save Topic Schedule
              </Button>
            </div>
          </form>
        </BentoCard>
      )}

      {/* Horizontal Phase Selector Strip (Horizontally scrollable on mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedPhase("all")}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0",
            selectedPhase === "all"
              ? "bg-charcoal text-ivory"
              : "bg-ivory text-foreground border border-charcoal/12 hover:bg-sage/40",
          )}
        >
          All 4 Phases ({totalTopics})
        </button>
        {PHASES.map((p) => {
          const isCurrent = p.id === currentPhase.id;
          const activeFilter = selectedPhase === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPhase(p.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border",
                activeFilter
                  ? "bg-charcoal text-lime border-charcoal"
                  : isCurrent
                    ? "bg-lime text-charcoal border-charcoal/30"
                    : "bg-ivory text-foreground border-charcoal/12 hover:bg-sage/35",
              )}
            >
              <span className="font-mono">0{p.id}</span>
              <span>— {p.name}</span>
              <span className="font-mono text-[11px] opacity-75">({p.target})</span>
            </button>
          );
        })}
      </div>

      {/* Structured 4-Phase Timeline */}
      <div className="space-y-8">
        {visiblePhases.map((phase, idx) => {
          const isCurrentPhase = phase.id === currentPhase.id;
          const phaseTopics = data.topics.filter((t) => t.phase === phase.id);
          const phaseCompletedCount = phaseTopics.filter(
            (t) => effectiveTopicStatus(data, t) === "completed",
          ).length;
          const phaseSolvedTotal = phaseTopics.reduce((acc, t) => acc + topicSolved(data, t), 0);
          const phaseTargetTotal = phaseTopics.reduce((acc, t) => acc + t.targetProblems, 0);

          return (
            <div key={phase.id} className="space-y-4">
              {idx > 0 && <WavyDivider />}

              <section
                className={cn(
                  "rounded-[28px] border p-5 sm:p-7 transition-colors",
                  isCurrentPhase ? "border-charcoal/25 bg-sage/55" : "border-charcoal/10 bg-ivory",
                )}
              >
                {/* Phase Header Banner */}
                <div className="flex flex-col justify-between gap-4 border-b border-charcoal/12 pb-5 lg:flex-row lg:items-end">
                  <div className="flex items-start gap-4 sm:gap-5">
                    {/* Oversized Editorial Phase Number */}
                    <div
                      className={cn(
                        "num font-heading flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-3xl text-2xl sm:text-4xl font-bold tracking-tight border",
                        isCurrentPhase
                          ? "bg-lime text-charcoal border-charcoal/30 shadow-xs"
                          : "bg-charcoal text-ivory border-charcoal",
                      )}
                    >
                      0{phase.id}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <EditorialLabel tone={isCurrentPhase ? "lime" : "default"}>
                          DAYS {phase.start}–{phase.end} · TARGET RATING {phase.target}
                        </EditorialLabel>
                        {isCurrentPhase && (
                          <span className="rounded-md bg-lime px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-charcoal border border-charcoal/25">
                            Current Window
                          </span>
                        )}
                      </div>
                      <h2 className="font-heading mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                        0{phase.id} — {phase.name}
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                        Scheduled{" "}
                        {formatDate(addDays(s.startDate, phase.start - 1), {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        to{" "}
                        {formatDate(addDays(s.startDate, phase.end - 1), {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Phase Progress Summary */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 rounded-2xl bg-surface-white/85 px-4 py-3 border border-charcoal/10">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">
                        Topics Done
                      </div>
                      <div className="num font-heading text-lg font-bold">
                        {phaseCompletedCount} / {phaseTopics.length}
                      </div>
                    </div>
                    <div className="h-7 w-px bg-charcoal/10" />
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">
                        Problems Solved
                      </div>
                      <div className="num font-heading text-lg font-bold">
                        {phaseSolvedTotal} / {phaseTargetTotal}
                      </div>
                    </div>
                    <div className="h-7 w-px bg-charcoal/10" />
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">
                        Rating Band
                      </div>
                      <div className="num font-mono text-sm font-bold">{phase.target}</div>
                    </div>
                  </div>
                </div>

                {/* Compact Topic List */}
                <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  {phaseTopics.map((t) => {
                    const actualSolved = topicSolved(data, t);
                    const actualMinutes = topicMinutesSpent(data, t);
                    const effStatus = effectiveTopicStatus(data, t);
                    const isScheduledWindow = day >= t.startDay && day <= t.endDay;
                    const plannedStartISO = t.plannedDate || addDays(s.startDate, t.startDay - 1);
                    const pct = Math.min(
                      100,
                      Math.round((actualSolved / Math.max(1, t.targetProblems)) * 100),
                    );
                    const isEditingNote = editingNotesId === t.id;

                    return (
                      <article
                        key={t.id}
                        className={cn(
                          "flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all",
                          isScheduledWindow
                            ? "border-charcoal bg-surface-white ring-2 ring-lime"
                            : effStatus === "completed"
                              ? "border-charcoal/15 bg-surface-white/95"
                              : "border-charcoal/10 bg-surface-white/75 hover:bg-surface-white",
                        )}
                      >
                        <div>
                          {/* Top metadata & status selector */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                                <span className="num font-semibold text-foreground">
                                  Days {t.startDay}–{t.endDay}
                                </span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(plannedStartISO, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                                {isScheduledWindow && (
                                  <>
                                    <span>·</span>
                                    <span className="font-bold text-charcoal bg-lime px-1.5 py-0.2 rounded">
                                      Scheduled Window
                                    </span>
                                  </>
                                )}
                              </div>
                              <h3 className="font-heading mt-1 text-base font-bold text-foreground sm:text-lg">
                                {t.name}
                              </h3>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`Edit or reschedule ${t.name}`}
                                onClick={() => openEditTopic(t)}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-charcoal/12 bg-ivory text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <select
                                aria-label={`Status for ${t.name}`}
                                value={effStatus}
                                onChange={(e) => updateStatus(t, e.target.value as TopicStatus)}
                                className={cn(
                                  "h-8 rounded-full border px-2.5 text-xs font-semibold focus:outline-none",
                                  effStatus === "completed"
                                    ? "border-charcoal/30 bg-lime text-charcoal"
                                    : effStatus === "in_progress"
                                      ? "border-charcoal/20 bg-warm-yellow/60 text-charcoal"
                                      : "border-charcoal/15 bg-cream text-muted-foreground",
                                )}
                              >
                                {STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <p className="mt-1.5 text-xs text-muted-foreground">{t.description}</p>

                          {/* Learning Objectives */}
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/85">
                            {t.objectives.map((obj) => (
                              <span key={obj} className="inline-flex items-center gap-1.5">
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 rounded-[2px] bg-sage-deep"
                                />
                                <span>{obj}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Bottom Problem Progress, Actual Time & Notes */}
                        <div className="mt-4 space-y-3 border-t border-charcoal/10 pt-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-muted-foreground">
                                Problems:{" "}
                                <strong className="num font-mono text-foreground">
                                  {actualSolved} / {t.targetProblems}
                                </strong>
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span className="num">{formatDuration(actualMinutes)}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  isEditingNote ? setEditingNotesId(null) : openNotes(t)
                                }
                                className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-muted-foreground hover:text-foreground"
                              >
                                <FileText className="h-3 w-3" />
                                <span>{t.notes ? "Edit note" : "Add note"}</span>
                              </button>
                              <Link
                                to="/log"
                                search={{ date: plannedStartISO }}
                                className="inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold text-foreground hover:underline"
                              >
                                <span>Log</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal/10">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                effStatus === "completed" ? "bg-lime" : "bg-charcoal",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {/* Existing Note Display or Inline Editor */}
                          {isEditingNote ? (
                            <div className="space-y-2 pt-1">
                              <Textarea
                                rows={2}
                                value={notesDraft}
                                onChange={(e) => setNotesDraft(e.target.value)}
                                placeholder="Key templates, tricky edge cases, or takeaways for this topic..."
                                className="bg-ivory text-xs"
                              />
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingNotesId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button type="button" size="sm" onClick={() => saveNotes(t)}>
                                  <Check className="h-3.5 w-3.5" /> Save note
                                </Button>
                              </div>
                            </div>
                          ) : (
                            t.notes && (
                              <div
                                onClick={() => openNotes(t)}
                                className="cursor-pointer rounded-xl bg-ivory px-3 py-2 text-xs text-foreground/85 border border-charcoal/8"
                              >
                                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                                  Topic Notes
                                </span>
                                {t.notes}
                              </div>
                            )
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          );
        })}
      </div>
    </div>
  );
}
