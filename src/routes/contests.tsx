import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2, Trophy, X } from "lucide-react";
import { actions, uid, useData } from "@/lib/cp/store";
import { ratingHistory } from "@/lib/cp/stats";
import { formatDate, todayISO } from "@/lib/cp/dates";
import type { Contest } from "@/lib/cp/types";
import { BentoCard, Confirm, Empty, Field, PageHeader } from "@/components/cp/ui";
import { RatingProgressionChart } from "@/components/cp/BentoWidgets";
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
        content: "Track rated Codeforces contests, rating deltas, ranks and post-contest notes.",
      },
      { property: "og:title", content: "Contests — CP Tracker" },
      {
        property: "og:description",
        content: "Track rated Codeforces contests, rating deltas, ranks and post-contest notes.",
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
  notes: string;
}

function ContestsPage() {
  const data = useData();
  const today = todayISO();
  const s = data.settings;
  const ratings = ratingHistory(data);
  const contests = [...data.contests].sort((a, b) => b.date.localeCompare(a.date));

  const [editing, setEditing] = useState<ContestDraft | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const handleSyncContests = async () => {
    if (!s.cfHandle) return;
    setSyncing(true);
    const res = await actions.syncCodeforces(s.cfHandle);
    setSyncing(false);
    if (res.ok) {
      toast.success(`Synced contest history for @${s.cfHandle}`);
    } else {
      toast.error(res.error);
    }
  };

  const openNew = () => {
    setError("");
    setEditing({
      id: uid(),
      name: "",
      date: today,
      platform: "Codeforces",
      oldRating: String(s.currentRating),
      newRating: "",
      solved: "3",
      rank: "",
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
      solved: String(c.solved),
      rank: c.rank != null ? String(c.rank) : "",
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
    if (newR != null && (newR < 0 || newR > 4000)) {
      setError("New rating must be between 0 and 4000.");
      return;
    }

    actions.saveContest({
      id: editing.id,
      name: editing.name.trim(),
      date: editing.date || today,
      platform: editing.platform.trim() || "Codeforces",
      oldRating: oldR,
      newRating: newR,
      solved: Number(editing.solved) || 0,
      rank: editing.rank.trim() ? Number(editing.rank) : null,
      notes: editing.notes.trim(),
    });
    setEditing(null);
    toast.success("Contest saved & current rating synced");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="RATED ARENA"
        title="Contest Log"
        subtitle="Official Codeforces contests and manual virtual rounds. Saving or syncing a rated contest updates your rating progression."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {s.cfHandle ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSyncContests()}
                disabled={syncing || data.cfSync.syncing}
                className="rounded-full bg-ivory"
              >
                <RefreshCw
                  className={cn("h-4 w-4", (syncing || data.cfSync.syncing) && "animate-spin")}
                />
                <span>Sync @{s.cfHandle}</span>
              </Button>
            ) : (
              <Button asChild variant="outline" className="rounded-full bg-ivory">
                <Link to="/settings">Connect Codeforces</Link>
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
                  placeholder="e.g. Codeforces Round 992 (Div. 3)"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Date">
                <Input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </Field>
              <Field label="Old Rating">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 742"
                  value={editing.oldRating}
                  onChange={(e) =>
                    setEditing({ ...editing, oldRating: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="New Rating">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 815"
                  value={editing.newRating}
                  onChange={(e) =>
                    setEditing({ ...editing, newRating: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Problems Solved">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 3"
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
                  placeholder="e.g. 5420"
                  value={editing.rank}
                  onChange={(e) =>
                    setEditing({ ...editing, rank: e.target.value.replace(/\D/g, "") })
                  }
                  className="num font-mono"
                />
              </Field>
              <Field label="Platform" className="sm:col-span-2">
                <Input
                  placeholder="Codeforces"
                  value={editing.platform}
                  onChange={(e) => setEditing({ ...editing, platform: e.target.value })}
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

      {/* Rating Trajectory Chart */}
      <BentoCard
        surface="white"
        kicker="RATING PROGRESSION"
        title={`Current Rating: ${s.currentRating} (Goal ${s.targetRating})`}
      >
        <RatingProgressionChart points={ratings} targetRating={s.targetRating} height={220} />
      </BentoCard>

      {/* Contest List */}
      {contests.length === 0 ? (
        <Empty
          title="Your contest history will appear here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {!s.cfHandle && (
                <Button asChild variant="outline" size="sm" className="rounded-full bg-ivory">
                  <Link to="/settings">Connect Codeforces</Link>
                </Button>
              )}
              <Button type="button" size="sm" onClick={openNew} className="rounded-full">
                <Plus className="h-3.5 w-3.5" /> Log First Contest
              </Button>
            </div>
          }
        >
          Connect your Codeforces handle to import official rated rounds automatically, or log a
          contest manually.
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {contests.map((c) => {
            const delta =
              c.newRating != null && c.oldRating != null ? c.newRating - c.oldRating : null;
            return (
              <BentoCard key={c.id} surface="ivory">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-charcoal text-lime">
                      <Trophy className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {c.platform} · {formatDate(c.date)}
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

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-white p-3 border border-charcoal/8">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Rating Change
                    </div>
                    <div className="num font-heading mt-0.5 text-base font-bold">
                      {c.oldRating ?? "—"} → {c.newRating ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Delta
                    </div>
                    <div
                      className={cn(
                        "num font-heading mt-0.5 text-base font-bold",
                        delta != null && delta >= 0 ? "text-sage-deep" : "text-coral",
                      )}
                    >
                      {delta != null ? (delta >= 0 ? `+${delta}` : delta) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Solved / Rank
                    </div>
                    <div className="num font-heading mt-0.5 text-base font-bold">
                      {c.solved}p{" "}
                      {c.rank != null && (
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          (#{c.rank})
                        </span>
                      )}
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
