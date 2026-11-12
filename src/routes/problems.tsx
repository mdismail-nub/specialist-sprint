import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { actions, uid, useData } from "@/lib/cp/store";
import { isClassifiedSolved, isSolved, RATING_BUCKETS, ratingBucket } from "@/lib/cp/stats";
import { formatDate, todayISO } from "@/lib/cp/dates";
import type { Problem, ProblemPlatform, ProblemStatus } from "@/lib/cp/types";
import {
  BentoCard,
  Confirm,
  Empty,
  Field,
  PageHeader,
  selectCls,
  StatusIndicator,
  STATUS_LABEL,
} from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/problems")({
  head: () => ({
    meta: [
      { title: "Problems — CP Tracker" },
      {
        name: "description",
        content:
          "Developer-focused competitive programming problem archive, filters and status tracker.",
      },
      { property: "og:title", content: "Problems — CP Tracker" },
      {
        property: "og:description",
        content:
          "Developer-focused competitive programming problem archive, filters and status tracker.",
      },
    ],
  }),
  component: ProblemsPage,
});

const STATUS_FILTERS: { value: ProblemStatus | "all"; label: string }[] = [
  { value: "all", label: "All problems" },
  { value: "independent", label: "Independent" },
  { value: "hint", label: "With hint" },
  { value: "editorial", label: "After editorial" },
  { value: "unclassified", label: "Imported · Classify" },
  { value: "resolved", label: "Re-solved" },
  { value: "unsolved", label: "Unsolved" },
];

interface ProblemDraft {
  id: string;
  title: string;
  url: string;
  platform: ProblemPlatform;
  rating: string;
  topic: string;
  tagsText: string;
  date: string;
  status: ProblemStatus;
  minutes: string;
  notes: string;
  contestId?: string | undefined;
  logId?: string | undefined;
}

function emptyDraft(today: string): ProblemDraft {
  return {
    id: uid(),
    title: "",
    url: "",
    platform: "Codeforces",
    rating: "",
    topic: "",
    tagsText: "",
    date: today,
    status: "independent",
    minutes: "",
    notes: "",
  };
}

function ProblemsPage() {
  const data = useData();
  const today = todayISO();
  const s = data.settings;

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProblemStatus | "all">("all");
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [editing, setEditing] = useState<ProblemDraft | null>(null);
  const [formError, setFormError] = useState<string>("");

  const allTopicsAndTags = useMemo(() => {
    const set = new Set<string>();
    data.problems.forEach((p) => {
      if (p.topic?.trim()) set.add(p.topic.trim());
      p.tags?.forEach((t) => {
        if (t.trim()) set.add(t.trim());
      });
    });
    return [...set].sort();
  }, [data.problems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...data.problems]
      .filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (bucketFilter !== "all" && ratingBucket(p.rating) !== bucketFilter) return false;
        if (platformFilter !== "all" && (p.platform ?? "Codeforces") !== platformFilter) {
          return false;
        }
        if (dateFilter && p.date !== dateFilter) return false;
        if (topicFilter !== "all") {
          const matchesPrimary = p.topic.trim().toLowerCase() === topicFilter.toLowerCase();
          const matchesTag = (p.tags ?? []).some(
            (t) => t.trim().toLowerCase() === topicFilter.toLowerCase(),
          );
          if (!matchesPrimary && !matchesTag) return false;
        }
        if (q) {
          const inTitle = p.title.toLowerCase().includes(q);
          const inTopic = p.topic.toLowerCase().includes(q);
          const inTags = (p.tags ?? []).some((t) => t.toLowerCase().includes(q));
          const inRating = String(p.rating ?? "").includes(q);
          const inContest = String(p.contestId ?? "")
            .toLowerCase()
            .includes(q);
          const inNotes = (p.notes ?? "").toLowerCase().includes(q);
          if (!inTitle && !inTopic && !inTags && !inRating && !inContest && !inNotes) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.rating ?? 0) - (a.rating ?? 0));
  }, [data.problems, query, statusFilter, bucketFilter, topicFilter, platformFilter, dateFilter]);

  const solvedCount = data.problems.filter(isSolved).length;
  const classifiedSolvedCount = data.problems.filter(isClassifiedSolved).length;
  const independentCount = data.problems.filter((p) => p.status === "independent").length;
  const assistedCount = data.problems.filter(
    (p) => p.status === "hint" || p.status === "editorial" || p.status === "resolved",
  ).length;
  const unclassifiedCount = data.problems.filter((p) => p.status === "unclassified").length;
  const unsolvedCount = data.problems.filter((p) => p.status === "unsolved").length;

  const openNew = () => {
    setFormError("");
    setEditing(emptyDraft(today));
  };

  const openEdit = (p: Problem) => {
    setFormError("");
    setEditing({
      id: p.id,
      title: p.title,
      url: p.url,
      platform: p.platform ?? "Codeforces",
      rating: p.rating != null ? String(p.rating) : "",
      topic: p.topic,
      tagsText: (p.tags ?? []).join(", "),
      date: p.date,
      status: p.status,
      minutes: p.minutes != null ? String(p.minutes) : "",
      notes: p.notes ?? "",
      contestId: p.contestId,
      logId: p.logId,
    });
  };

  const saveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim()) {
      setFormError("Problem name is required.");
      return;
    }
    if (editing.url && !/^https?:\/\/\S+$/.test(editing.url.trim())) {
      setFormError("Problem URL must start with http:// or https://");
      return;
    }
    const r = editing.rating.trim() ? Number(editing.rating.trim()) : null;
    if (r != null && (!Number.isInteger(r) || r < 0 || r > 4000)) {
      setFormError("Rating must be an integer between 0 and 4000.");
      return;
    }
    const mins = editing.minutes.trim() ? Number(editing.minutes.trim()) : null;
    const parsedTags = editing.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const primaryTopic = editing.topic.trim() || parsedTags[0] || "General";
    const allTags = Array.from(new Set([primaryTopic, ...parsedTags]));

    const payload: Problem = {
      id: editing.id,
      title: editing.title.trim(),
      url: editing.url.trim(),
      platform: editing.platform,
      rating: r,
      topic: primaryTopic,
      tags: allTags,
      date: editing.date || today,
      status: editing.status,
      minutes: mins,
      notes: editing.notes.trim(),
      ...(editing.contestId ? { contestId: editing.contestId } : {}),
      ...(editing.logId ? { logId: editing.logId } : {}),
    };
    actions.saveProblem(payload);
    setEditing(null);
    toast.success("Problem saved");
  };

  const quickStatusChange = (p: Problem, nextStatus: ProblemStatus) => {
    actions.saveProblem({ ...p, status: nextStatus });
    toast.success(`${p.title} classified as ${STATUS_LABEL[nextStatus]}`);
  };

  const handleSyncCF = async () => {
    try {
      const res = await actions.syncCodeforces();
      toast.success(
        `Synced ${res.profile.uniqueSolvedCount} solved problems from @${res.profile.handle}`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="DEVELOPER PROBLEM ARCHIVE"
        title="Problem Tracker"
        subtitle="Combine accepted Codeforces submissions with manually tracked problems across Codeforces, AtCoder, CSES, and other judges."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {s.cfHandle && (
              <Button
                type="button"
                variant="outline"
                disabled={data.cfSync.status === "syncing"}
                onClick={() => void handleSyncCF()}
                className="rounded-full bg-surface-white"
              >
                {data.cfSync.status === "syncing" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" /> Sync @{s.cfHandle}
                  </>
                )}
              </Button>
            )}
            <Button onClick={openNew} className="rounded-full px-5">
              <Plus className="h-4 w-4" /> Log Problem
            </Button>
          </div>
        }
      />

      {/* Compact Bento Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-charcoal/10 bg-ivory p-4">
          <div className="text-[11px] font-mono uppercase text-muted-foreground">Unique Solved</div>
          <div className="num font-heading mt-1 text-3xl font-bold">{solvedCount}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {data.problems.length} total tracked
          </div>
        </div>
        <div className="rounded-2xl border border-charcoal/15 bg-lime p-4 text-charcoal">
          <div className="text-[11px] font-mono uppercase text-charcoal/75">Independent</div>
          <div className="num font-heading mt-1 text-3xl font-bold">{independentCount}</div>
          <div className="num mt-0.5 text-xs text-charcoal/80">
            {classifiedSolvedCount
              ? `${Math.round((independentCount / classifiedSolvedCount) * 100)}% of classified`
              : "0% of classified"}
          </div>
        </div>
        <div className="rounded-2xl border border-charcoal/10 bg-sage/60 p-4 text-charcoal">
          <div className="text-[11px] font-mono uppercase text-charcoal/75">
            Assisted / Unclassified
          </div>
          <div className="num font-heading mt-1 text-3xl font-bold">
            {assistedCount}{" "}
            {unclassifiedCount > 0 && (
              <span className="font-mono text-sm font-normal text-charcoal/75">
                (+{unclassifiedCount} CF)
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-charcoal/80">
            {unclassifiedCount > 0
              ? `${unclassifiedCount} imported awaiting classification`
              : "Hint, editorial & upsolved"}
          </div>
        </div>
        <div className="rounded-2xl border border-charcoal bg-charcoal p-4 text-ivory">
          <div className="text-[11px] font-mono uppercase text-ivory/70">Unsolved Queue</div>
          <div className="num font-heading mt-1 text-3xl font-bold text-coral">{unsolvedCount}</div>
          <div className="mt-0.5 text-xs text-ivory/70">Ready for upsolving</div>
        </div>
      </div>

      {/* Add / Edit Problem Panel */}
      {editing && (
        <BentoCard
          surface="white"
          kicker="PROBLEM RECORD"
          title={data.problems.some((x) => x.id === editing.id) ? "Edit Problem" : "Add Problem"}
          action={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close problem form"
              onClick={() => setEditing(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          }
        >
          <form onSubmit={saveDraft} className="space-y-4">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Field label="Problem Name" className="sm:col-span-2">
                <Input
                  autoFocus
                  placeholder="e.g. 520B — Two Buttons"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </Field>
              <Field label="Online Judge / Platform">
                <select
                  aria-label="Online Judge Platform"
                  className={selectCls}
                  value={editing.platform}
                  onChange={(e) =>
                    setEditing({ ...editing, platform: e.target.value as ProblemPlatform })
                  }
                >
                  <option value="Codeforces">Codeforces</option>
                  <option value="AtCoder">AtCoder</option>
                  <option value="CSES">CSES</option>
                  <option value="Other">Other Online Judge</option>
                </select>
              </Field>
              <Field label="Problem URL" className="sm:col-span-2">
                <Input
                  placeholder="https://codeforces.com/problemset/problem/520/B"
                  value={editing.url}
                  onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                />
              </Field>
              <Field label="Rating (Optional)">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 1400"
                  value={editing.rating}
                  onChange={(e) =>
                    setEditing({ ...editing, rating: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Primary Topic">
                <Input
                  list="problem-topics"
                  placeholder="e.g. BFS, Greedy, DP"
                  value={editing.topic}
                  onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
                />
                <datalist id="problem-topics">
                  {data.topics.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Tags (Comma-separated)" className="sm:col-span-2">
                <Input
                  placeholder="e.g. graphs, dfs and similar, shortest paths"
                  value={editing.tagsText}
                  onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })}
                />
              </Field>
              <Field label="Solving Method / Status">
                <select
                  aria-label="Solving method"
                  className={selectCls}
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as ProblemStatus })
                  }
                >
                  <option value="independent">Independent</option>
                  <option value="hint">Hint-assisted</option>
                  <option value="editorial">Editorial-assisted</option>
                  <option value="unclassified">Imported · Unclassified</option>
                  <option value="resolved">Re-solved / Upsolved</option>
                  <option value="unsolved">Unsolved</option>
                </select>
              </Field>
              <Field label="Date Solved">
                <Input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </Field>
              <Field label="Time Taken (Minutes)">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 25"
                  value={editing.minutes}
                  onChange={(e) =>
                    setEditing({ ...editing, minutes: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Notes & Key Observations" className="sm:col-span-3">
                <Textarea
                  rows={2}
                  placeholder="Key trick, time complexity, or edge case to remember..."
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </Field>
            </div>
            {formError && <p className="text-xs font-medium text-coral">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-6">
                Save Problem
              </Button>
            </div>
          </form>
        </BentoCard>
      )}

      {/* Filter & Search Bar */}
      <BentoCard surface="ivory" className="p-4 sm:p-5">
        <div className="space-y-3">
          {/* Status Segmented Controls */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((sf) => {
              const active = statusFilter === sf.value;
              return (
                <button
                  key={sf.value}
                  type="button"
                  onClick={() => setStatusFilter(sf.value)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0",
                    active
                      ? "bg-charcoal text-lime"
                      : "bg-surface-white text-muted-foreground hover:text-foreground border border-charcoal/10",
                  )}
                >
                  {sf.label}
                </button>
              );
            })}
          </div>

          {/* Search, Rating Band, Tag/Topic, Platform & Date Filters */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
            <div className="relative sm:col-span-4">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search problems"
                placeholder="Search title, contest ID, tag, notes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 rounded-xl bg-surface-white pl-9"
              />
            </div>
            <div className="sm:col-span-2">
              <select
                aria-label="Filter by platform"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className={selectCls}
              >
                <option value="all">All platforms</option>
                <option value="Codeforces">Codeforces</option>
                <option value="AtCoder">AtCoder</option>
                <option value="CSES">CSES</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <select
                aria-label="Filter by rating band"
                value={bucketFilter}
                onChange={(e) => setBucketFilter(e.target.value)}
                className={selectCls}
              >
                <option value="all">All ratings</option>
                {RATING_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    Rating: {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <select
                aria-label="Filter by topic or tag"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className={selectCls}
              >
                <option value="all">All tags / topics</option>
                {allTopicsAndTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Input
                type="date"
                aria-label="Filter by date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-10 rounded-xl bg-surface-white text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </BentoCard>

      {/* Problem Rows (Desktop Table + Mobile Compact Stacked Items) */}
      {data.problems.length === 0 ? (
        <Empty title="You haven't tracked any problems yet.">
          <p className="max-w-md mx-auto">
            Add your first problem manually from Codeforces, AtCoder, or CSES, or connect your
            Codeforces handle to automatically import your unique solved submissions.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={openNew} className="rounded-full px-5">
              <Plus className="h-4 w-4" /> Add your first problem
            </Button>
            {!s.cfHandle && (
              <Link
                to="/settings"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-charcoal/20 bg-surface-white px-4 text-xs font-semibold text-foreground hover:bg-ivory"
              >
                <span>Connect Codeforces</span>
              </Link>
            )}
          </div>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty title="No matching problems found">
          Try clearing a filter or log a new problem above.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-[26px] border border-charcoal/12 bg-surface-white">
          {/* Desktop Clean Rows with Subtle Separators */}
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-ivory/80 font-mono text-[11px] uppercase text-muted-foreground">
                  <th className="py-3 pl-6 pr-3 font-semibold">Problem</th>
                  <th className="px-3 py-3 font-semibold">Platform &amp; Tags</th>
                  <th className="px-3 py-3 font-semibold text-right">Rating</th>
                  <th className="px-3 py-3 font-semibold">Solving Method</th>
                  <th className="px-3 py-3 font-semibold text-right">Time</th>
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="py-3 pl-3 pr-6 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/8">
                {filtered.map((p) => (
                  <tr key={p.id} className="group transition-colors hover:bg-ivory/70">
                    <td className="py-3.5 pl-6 pr-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{p.title}</span>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${p.title}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      {p.notes && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {p.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-xs text-muted-foreground">
                      <span className="font-mono text-[10px] font-semibold uppercase text-foreground/80 mr-1.5">
                        {p.platform ?? "Codeforces"}
                      </span>
                      <span>· {p.topic || "General"}</span>
                    </td>
                    <td className="num px-3 py-3.5 text-right font-mono text-xs font-bold">
                      {p.rating ?? "—"}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusIndicator status={p.status} />
                        {p.status === "unclassified" && (
                          <div className="inline-flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={() => quickStatusChange(p, "independent")}
                              className="rounded-md bg-lime px-2 py-0.5 font-mono text-[10px] font-bold text-charcoal border border-charcoal/20 hover:bg-lime/80"
                            >
                              Indep
                            </button>
                            <button
                              type="button"
                              onClick={() => quickStatusChange(p, "hint")}
                              className="rounded-md bg-ivory px-2 py-0.5 font-mono text-[10px] font-semibold text-charcoal border border-charcoal/15 hover:bg-sage/40"
                            >
                              Hint
                            </button>
                            <button
                              type="button"
                              onClick={() => quickStatusChange(p, "editorial")}
                              className="rounded-md bg-ivory px-2 py-0.5 font-mono text-[10px] font-semibold text-charcoal border border-charcoal/15 hover:bg-sage/40"
                            >
                              Editorial
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="num px-3 py-3.5 text-right font-mono text-xs text-muted-foreground">
                      {p.minutes != null ? `${p.minutes}m` : "—"}
                    </td>
                    <td className="num px-3 py-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(p.date, { month: "short", day: "numeric" })}
                    </td>
                    <td className="py-3.5 pl-3 pr-6 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        {p.status === "unsolved" && (
                          <button
                            type="button"
                            onClick={() => quickStatusChange(p, "resolved")}
                            className="mr-1 rounded-full bg-lime px-2.5 py-1 font-mono text-[10px] font-bold text-charcoal border border-charcoal/20 hover:bg-lime/80"
                          >
                            Mark Upsolved
                          </button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${p.title}`}
                          onClick={() => openEdit(p)}
                          className="h-8 w-8 rounded-full"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Confirm
                          title={`Delete "${p.title}"?`}
                          description="This problem will be removed from your tracker."
                          onConfirm={() => {
                            actions.deleteProblem(p.id);
                            toast.success("Problem removed");
                          }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${p.title}`}
                              className="h-8 w-8 rounded-full text-muted-foreground hover:text-coral"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Compact Stacked Problem Items */}
          <div className="divide-y divide-charcoal/10 md:hidden">
            {filtered.map((p) => (
              <div key={p.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading text-sm font-bold text-foreground truncate">
                        {p.title}
                      </span>
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${p.title}`}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-mono text-[10px] uppercase">
                        {p.platform ?? "Codeforces"}
                      </span>
                      <span>·</span>
                      <span>{p.topic || "General"}</span>
                      <span>·</span>
                      <span className="num font-mono font-semibold text-foreground">
                        {p.rating ? `Rating ${p.rating}` : "Unrated"}
                      </span>
                      <span>·</span>
                      <span className="num font-mono">
                        {formatDate(p.date, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${p.title}`}
                      onClick={() => openEdit(p)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Confirm
                      title={`Delete "${p.title}"?`}
                      description="This problem will be removed from your tracker."
                      onConfirm={() => {
                        actions.deleteProblem(p.id);
                        toast.success("Problem removed");
                      }}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${p.title}`}
                          className="h-8 w-8 text-muted-foreground hover:text-coral"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <StatusIndicator status={p.status} />
                  {p.status === "unclassified" && (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => quickStatusChange(p, "independent")}
                        className="rounded-md bg-lime px-2 py-0.5 font-mono text-[10px] font-bold text-charcoal border border-charcoal/20"
                      >
                        Indep
                      </button>
                      <button
                        type="button"
                        onClick={() => quickStatusChange(p, "hint")}
                        className="rounded-md bg-ivory px-2 py-0.5 font-mono text-[10px] font-semibold text-charcoal border border-charcoal/15"
                      >
                        Hint
                      </button>
                      <button
                        type="button"
                        onClick={() => quickStatusChange(p, "editorial")}
                        className="rounded-md bg-ivory px-2 py-0.5 font-mono text-[10px] font-semibold text-charcoal border border-charcoal/15"
                      >
                        Editorial
                      </button>
                    </div>
                  )}
                  {p.status === "unsolved" ? (
                    <button
                      type="button"
                      onClick={() => quickStatusChange(p, "resolved")}
                      className="rounded-full bg-lime px-2.5 py-1 font-mono text-[10px] font-bold text-charcoal border border-charcoal/20"
                    >
                      Mark Upsolved
                    </button>
                  ) : (
                    p.minutes != null && (
                      <span className="num font-mono text-xs text-muted-foreground">
                        {p.minutes} min
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
