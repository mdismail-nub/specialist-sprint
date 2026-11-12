import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2, Trophy, X } from "lucide-react";
import { actions, uid, useData } from "@/lib/cp/store";
import { formatDate, todayISO } from "@/lib/cp/dates";
import type { Contest } from "@/lib/cp/types";
import { ALL_PROBLEM_PLATFORMS, PRIMARY_PLATFORM_IDS } from "@/integrations/registry";
import { BentoCard, Confirm, Empty, Field, PageHeader, selectCls } from "@/components/cp/ui";
import { MultiPlatformRatingComparison, PlatformLogoBadge } from "@/components/cp/PlatformWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contests")({
  head: () => ({
    meta: [
      { title: "Contests — CP Tracker" },
      {
        name: "description",
        content:
          "Track rated contests across Codeforces, CodeChef, AtCoder, and LeetCode, including rating deltas, ranks, performance, and post-contest notes.",
      },
      { property: "og:title", content: "Contests — CP Tracker" },
      {
        property: "og:description",
        content:
          "Track rated contests across Codeforces, CodeChef, AtCoder, and LeetCode, including rating deltas, ranks, performance, and post-contest notes.",
      },
    ],
  }),
  component: ContestsPage,
});

interface ContestDraft {
  id: string;
  name: string;
  date: string;
  platform: string;
  oldRating: string;
  newRating: string;
  solved: string;
  rank: string;
  performance: string;
  notes: string;
}

const CONTEST_PLATFORM_FILTERS = [
  "all",
  "Codeforces",
  "CodeChef",
  "AtCoder",
  "LeetCode",
  "Other",
] as const;

function ContestsPage() {
  const data = useData();
  const today = todayISO();
  const s = data.settings;

  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [editing, setEditing] = useState<ContestDraft | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const connectedPlatformsCount = PRIMARY_PLATFORM_IDS.filter(
    (pid) => data.platforms[pid]?.username.trim().length > 0,
  ).length;

  const filteredContests = useMemo(() => {
    return [...data.contests]
      .filter((c) => {
        if (platformFilter === "all") return true;
        if (platformFilter === "Other") {
          const p = c.platform.toLowerCase();
          return p !== "codeforces" && p !== "codechef" && p !== "atcoder" && p !== "leetcode";
        }
        return c.platform.toLowerCase() === platformFilter.toLowerCase();
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.contests, platformFilter]);

  const handleSyncAllContests = async () => {
    setSyncing(true);
    const { synced, failed } = await actions.syncAllConnectedPlatforms();
    setSyncing(false);
    if (synced.length > 0 && failed.length === 0) {
      toast.success(`Synchronized contest history across ${synced.length} platform(s).`);
    } else if (synced.length > 0 && failed.length > 0) {
      toast.warning(
        `Synchronized ${synced.length} platform(s). ${failed.length} failed temporarily; your saved data is safe.`,
      );
    } else if (failed.length > 0) {
      toast.error(failed[0]!.error);
    }
  };

  const openNew = () => {
    setError("");
    setEditing({
      id: uid(),
      name: "",
      date: today,
      platform: "Codeforces",
      oldRating: s.currentRating > 0 ? String(s.currentRating) : "",
      newRating: "",
      solved: "",
      rank: "",
      performance: "",
      notes: "",
    });
  };

  const openEdit = (c: Contest) => {
    setError("");
    setEditing({
      id: c.id,
      name: c.name,
      date: c.date,
      platform: c.platform,
      oldRating: c.oldRating != null ? String(c.oldRating) : "",
      newRating: c.newRating != null ? String(c.newRating) : "",
      solved: c.solved != null ? String(c.solved) : "",
      rank: c.rank != null ? String(c.rank) : "",
      performance: c.performance != null ? String(c.performance) : "",
      notes: c.notes,
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("Contest name is required.");
      return;
    }
    const oldR = editing.oldRating.trim() ? Number(editing.oldRating) : null;
    const newR = editing.newRating.trim() ? Number(editing.newRating) : null;
    if (newR != null && (newR < 0 || newR > 5000)) {
      setError("New rating must be between 0 and 5000.");
      return;
    }

    actions.saveContest({
      id: editing.id,
      name: editing.name.trim(),
      date: editing.date || today,
      platform: editing.platform.trim() || "Codeforces",
      oldRating: oldR,
      newRating: newR,
      solved: editing.solved.trim() ? Number(editing.solved) : null,
      rank: editing.rank.trim() ? Number(editing.rank) : null,
      performance: editing.performance.trim() ? Number(editing.performance) : null,
      notes: editing.notes.trim(),
    });
    setEditing(null);
    toast.success("Contest saved");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="UNIFIED RATED ARENA"
        title="Unified Contest Log"
        subtitle="Track official rated rounds and virtual contests across Codeforces, CodeChef, AtCoder, and LeetCode. Missing platform fields are honestly displayed as 'Not available'."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {connectedPlatformsCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSyncAllContests()}
                disabled={syncing}
                className="rounded-full bg-ivory"
              >
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                <span>{syncing ? "Syncing..." : "Sync All Platforms"}</span>
              </Button>
            ) : (
              <Button asChild variant="outline" className="rounded-full bg-ivory">
                <Link to="/platforms">Connect Platforms</Link>
              </Button>
            )}
            <Button onClick={openNew} className="rounded-full px-5">
              <Plus className="h-4 w-4" /> Log Contest
            </Button>
          </div>
        }
      />

      {/* Add / Edit Contest Panel */}
      {editing && (
        <BentoCard
          surface="white"
          kicker="CONTEST ENTRY"
          title={data.contests.some((c) => c.id === editing.id) ? "Edit Contest" : "Record Contest"}
          action={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close contest form"
              onClick={() => setEditing(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          }
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Field label="Contest Name" className="sm:col-span-2">
                <Input
                  autoFocus
                  placeholder="e.g. Codeforces Round 992 (Div. 3), Starters 165, ABC 380, Weekly Contest 425"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Platform">
                <select
                  aria-label="Contest Platform"
                  className={selectCls}
                  value={editing.platform}
                  onChange={(e) => setEditing({ ...editing, platform: e.target.value })}
                >
                  {ALL_PROBLEM_PLATFORMS.map((plat) => (
                    <option key={plat} value={plat}>
                      {plat}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <Input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </Field>
              <Field label="Rating Before (Optional)">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 1240"
                  value={editing.oldRating}
                  onChange={(e) =>
                    setEditing({ ...editing, oldRating: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Rating After (Optional)">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 1315"
                  value={editing.newRating}
                  onChange={(e) =>
                    setEditing({ ...editing, newRating: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Problems Solved (Optional)">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 4"
                  value={editing.solved}
                  onChange={(e) =>
                    setEditing({ ...editing, solved: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Rank (Optional)">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 1420"
                  value={editing.rank}
                  onChange={(e) =>
                    setEditing({ ...editing, rank: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Performance (Optional, e.g. AtCoder)">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 1600"
                  value={editing.performance}
                  onChange={(e) =>
                    setEditing({ ...editing, performance: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Post-Contest Notes" className="sm:col-span-3">
                <Textarea
                  rows={2}
                  placeholder="What went well? Which problem stalled your momentum?"
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </Field>
            </div>
            {error && <p className="text-xs font-medium text-coral">{error}</p>}
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
                Save Contest
              </Button>
            </div>
          </form>
        </BentoCard>
      )}

      {/* Multi-Platform Rating Comparison */}
      <MultiPlatformRatingComparison data={data} />

      {/* Platform Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-charcoal/10 bg-ivory p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {CONTEST_PLATFORM_FILTERS.map((pf) => {
            const active = platformFilter === pf;
            const count =
              pf === "all"
                ? data.contests.length
                : pf === "Other"
                  ? data.contests.filter((c) => {
                      const p = c.platform.toLowerCase();
                      return (
                        p !== "codeforces" &&
                        p !== "codechef" &&
                        p !== "atcoder" &&
                        p !== "leetcode"
                      );
                    }).length
                  : data.contests.filter((c) => c.platform.toLowerCase() === pf.toLowerCase())
                      .length;
            return (
              <button
                key={pf}
                type="button"
                onClick={() => setPlatformFilter(pf)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-charcoal text-lime"
                    : "bg-surface-white text-muted-foreground hover:text-foreground border border-charcoal/10",
                )}
              >
                <span>{pf === "all" ? "All Platforms" : pf}</span>
                <span className="num font-mono text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
        <span className="font-mono text-xs text-muted-foreground num">
          Showing {filteredContests.length} of {data.contests.length} contests
        </span>
      </div>

      {/* Contest List */}
      {data.contests.length === 0 ? (
        <Empty title="Your contest history will appear here.">
          <p className="max-w-md mx-auto">
            Connect Codeforces, CodeChef, AtCoder, or LeetCode on the Platforms page to import
            official rated rounds automatically, or log a contest manually.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {connectedPlatformsCount === 0 && (
              <Button asChild variant="outline" size="sm" className="rounded-full bg-ivory">
                <Link to="/platforms">Connect Platforms</Link>
              </Button>
            )}
            <Button type="button" size="sm" onClick={openNew} className="rounded-full">
              <Plus className="h-3.5 w-3.5" /> Log First Contest
            </Button>
          </div>
        </Empty>
      ) : filteredContests.length === 0 ? (
        <Empty title={`No ${platformFilter} contests recorded yet.`}>
          Try switching the platform filter above or connect your {platformFilter} account on the
          Platforms page.
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredContests.map((c) => {
            const delta =
              c.newRating != null && c.oldRating != null ? c.newRating - c.oldRating : null;
            return (
              <BentoCard key={c.id} surface="ivory">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <PlatformLogoBadge platform={c.platform || "Codeforces"} size="lg" />
                    <div>
                      <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{c.platform}</span>
                        <span>·</span>
                        <span>{formatDate(c.date)}</span>
                      </div>
                      <h3 className="font-heading text-base font-bold text-foreground">{c.name}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => openEdit(c)}
                      className="h-8 w-8 rounded-full"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Confirm
                      title={`Delete "${c.name}"?`}
                      description="This contest record will be removed."
                      onConfirm={() => {
                        actions.deleteContest(c.id);
                        toast.success("Contest deleted");
                      }}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${c.name}`}
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-coral"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 rounded-2xl bg-surface-white p-3 border border-charcoal/8">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Rating Before → After
                    </div>
                    <div className="num font-heading mt-0.5 text-sm font-bold">
                      {c.oldRating != null ? c.oldRating : "Not available"} →{" "}
                      {c.newRating != null ? c.newRating : "Not available"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Rating Change
                    </div>
                    <div
                      className={cn(
                        "num font-heading mt-0.5 text-sm font-bold",
                        delta != null && delta >= 0
                          ? "text-sage-deep"
                          : delta != null
                            ? "text-coral"
                            : "text-muted-foreground",
                      )}
                    >
                      {delta != null ? (delta >= 0 ? `+${delta}` : delta) : "Not available"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Rank / Solved
                    </div>
                    <div className="num font-heading mt-0.5 text-sm font-bold">
                      {c.rank != null ? `#${c.rank}` : "Not available"}
                      {" · "}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {c.solved != null ? `${c.solved}p` : "Not available"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Performance
                    </div>
                    <div className="num font-heading mt-0.5 text-sm font-bold">
                      {c.performance != null ? c.performance : "Not available"}
                    </div>
                  </div>
                </div>

                {c.notes && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    <strong className="font-mono text-[10px] uppercase text-foreground mr-1.5">
                      Notes:
                    </strong>
                    {c.notes}
                  </p>
                )}
              </BentoCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
