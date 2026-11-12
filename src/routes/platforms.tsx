import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Edit3,
  ExternalLink,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
} from "lucide-react";
import { actions, useData } from "@/lib/cp/store";
import { platformBreakdownStats } from "@/lib/cp/stats";
import {
  PLATFORM_DISPLAY_NAME,
  PLATFORM_INTEGRATIONS,
  PRIMARY_PLATFORM_IDS,
} from "@/integrations/registry";
import type { PrimaryPlatformId } from "@/integrations/types";
import {
  BentoCard,
  Confirm,
  EditorialLabel,
  Field,
  PageHeader,
  WavyDivider,
} from "@/components/cp/ui";
import {
  DataSourceBadge,
  formatSyncTimestamp,
  MultiPlatformRatingComparison,
  PlatformConnectionBadge,
  PlatformLogoBadge,
} from "@/components/cp/PlatformWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/platforms")({
  component: PlatformsPage,
});

const EXTENSIBLE_PLATFORMS = [
  {
    id: "cses",
    name: "CSES Problem Set",
    short: "CSES",
    description: "Classic algorithmic problem set (Sorting, DP, Graphs, Trees, Mathematics).",
    url: "https://cses.fi/problemset/",
  },
  {
    id: "hackerrank",
    name: "HackerRank",
    short: "HR",
    description: "Algorithms, data structures, and domain preparation tracks.",
    url: "https://www.hackerrank.com/domains/algorithms",
  },
  {
    id: "geeksforgeeks",
    name: "GeeksforGeeks",
    short: "GFG",
    description: "DSA practice problems, interview preparation, and POTD challenges.",
    url: "https://www.geeksforgeeks.org/",
  },
  {
    id: "other",
    name: "Other Online Judges",
    short: "OJ",
    description: "SPOJ, USACO, Kattis, Library Checker, Timus, Luogu, or custom contests.",
    url: "",
  },
] as const;

function PlatformsPage() {
  const data = useData();
  const [handles, setHandles] = useState<Record<PrimaryPlatformId, string>>({
    codeforces: data.platforms.codeforces.username,
    codechef: data.platforms.codechef.username,
    atcoder: data.platforms.atcoder.username,
    leetcode: data.platforms.leetcode.username,
  });
  const [editingPlatform, setEditingPlatform] = useState<PrimaryPlatformId | null>(null);
  const [manualFormPlatform, setManualFormPlatform] = useState<PrimaryPlatformId | null>(null);
  const [manualRating, setManualRating] = useState<string>("");
  const [manualHighest, setManualHighest] = useState<string>("");
  const [manualSolved, setManualSolved] = useState<string>("");
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    setHandles({
      codeforces: data.platforms.codeforces.username,
      codechef: data.platforms.codechef.username,
      atcoder: data.platforms.atcoder.username,
      leetcode: data.platforms.leetcode.username,
    });
  }, [
    data.platforms.codeforces.username,
    data.platforms.codechef.username,
    data.platforms.atcoder.username,
    data.platforms.leetcode.username,
  ]);

  const breakdown = platformBreakdownStats(data);
  const breakdownById = new Map(breakdown.items.map((i) => [i.platformId, i]));

  const connectedCount = PRIMARY_PLATFORM_IDS.filter(
    (pid) => data.platforms[pid].username.trim().length > 0,
  ).length;

  const handleConnectOrSync = async (pid: PrimaryPlatformId) => {
    const rawHandle = handles[pid]?.trim() || data.platforms[pid].username.trim();
    const integration = PLATFORM_INTEGRATIONS[pid];
    const validation = integration.validateUsername(rawHandle);
    if (!validation.valid) {
      toast.error(validation.error || `Please enter a valid ${integration.name} username.`);
      return;
    }

    const res = await actions.syncPlatform(pid, validation.cleaned);
    if (res.ok) {
      setEditingPlatform(null);
      setManualFormPlatform(null);
      toast.success(`Synchronized ${integration.name} (@${res.result.account.username}).`);
    } else {
      toast.error(res.error);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    const { synced, failed } = await actions.syncAllConnectedPlatforms();
    setSyncingAll(false);
    if (synced.length > 0 && failed.length === 0) {
      toast.success(`Synchronized ${synced.length} connected platform(s).`);
    } else if (synced.length > 0 && failed.length > 0) {
      toast.warning(
        `Synchronized ${synced.length} platform(s). ${failed.length} failed temporarily; your saved data is safe.`,
      );
    } else if (failed.length > 0) {
      toast.error(failed[0]!.error);
    }
  };

  const openManualConfig = (pid: PrimaryPlatformId) => {
    const acc = data.platforms[pid];
    setManualFormPlatform(pid);
    setManualRating(acc.currentRating != null ? String(acc.currentRating) : "");
    setManualHighest(acc.highestRating != null ? String(acc.highestRating) : "");
    setManualSolved(acc.totalSolved != null ? String(acc.totalSolved) : "");
  };

  const saveManualConfig = (pid: PrimaryPlatformId) => {
    const username = (handles[pid] || data.platforms[pid].username).trim();
    if (!username) {
      toast.error("Please enter a username first.");
      return;
    }
    actions.setPlatformManualMode(pid, username, {
      currentRating: manualRating.trim() ? Number(manualRating) : null,
      highestRating: manualHighest.trim() ? Number(manualHighest) : null,
      totalSolved: manualSolved.trim() ? Number(manualSolved) : null,
    });
    setManualFormPlatform(null);
    setEditingPlatform(null);
    toast.success(`${PLATFORM_DISPLAY_NAME[pid]} set to Manual Tracking Only mode.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="MULTI-PLATFORM INTEGRATION SYSTEM"
        title="Connected Competitive Programming Platforms"
        subtitle="Connect Codeforces, CodeChef, AtCoder, and LeetCode simultaneously. Each platform synchronizes independently on its own native rating scale while keeping your local problem classifications and training history safe."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {connectedCount > 0 && (
              <Button
                type="button"
                onClick={() => void handleSyncAll()}
                disabled={syncingAll}
                className="rounded-full bg-charcoal text-lime hover:bg-charcoal/90 font-semibold"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", syncingAll && "animate-spin")} />
                <span>{syncingAll ? "Syncing All Platforms..." : "Sync All Connected"}</span>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-full bg-surface-white">
              <Link to="/problems">
                <span>Unified Problems</span>
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        }
      />

      {/* Summary Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BentoCard surface="charcoal" kicker="CONNECTED ACCOUNTS">
          <div className="num font-heading text-3xl font-bold text-lime">
            {connectedCount}{" "}
            <span className="text-base font-normal text-ivory/70">/ 4 primary judges</span>
          </div>
          <p className="mt-1.5 text-xs text-ivory/75">
            Independent modular sync with automatic 5-minute server caching and offline fallback.
          </p>
        </BentoCard>

        <BentoCard surface="ivory" kicker="TOTAL SOLVED ACROSS JUDGES">
          <div className="num font-heading text-3xl font-bold text-foreground">
            {breakdown.totalAcrossConnectedPlatforms}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {breakdown.totalVerifiedTrackedProblems} verified individual problem records in tracker.
          </p>
        </BentoCard>

        <BentoCard surface="white" kicker="CONTESTS RECORDED">
          <div className="num font-heading text-3xl font-bold text-foreground">
            {data.contests.length}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Unified rated contest participations across Codeforces, CodeChef, AtCoder, and LeetCode.
          </p>
        </BentoCard>

        <BentoCard surface="sage" kicker="DATA INTEGRITY">
          <div className="font-heading text-lg font-bold text-charcoal">Non-Destructive Sync</div>
          <p className="mt-1 text-xs text-charcoal/80">
            Manual problem classifications, notes, and historical records are never overwritten.
          </p>
        </BentoCard>
      </div>

      {/* 4 Primary Platform Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {PRIMARY_PLATFORM_IDS.map((pid) => {
          const acc = data.platforms[pid];
          const integration = PLATFORM_INTEGRATIONS[pid];
          const stat = breakdownById.get(pid);
          const isConnected = acc.username.trim().length > 0;
          const isSyncing = acc.connectionStatus === "syncing";
          const isEditing = !isConnected || editingPlatform === pid;
          const isManualForm = manualFormPlatform === pid;

          return (
            <BentoCard
              key={pid}
              surface="ivory"
              className="border-charcoal/15"
              kicker={integration.ratingSystemLabel}
              title={
                <span className="flex flex-wrap items-center gap-2.5">
                  <PlatformLogoBadge platform={pid} size="md" />
                  <span>{integration.name}</span>
                  <PlatformConnectionBadge state={acc.connectionStatus} />
                </span>
              }
              action={<DataSourceBadge source={acc.dataSource} />}
            >
              <div className="space-y-4">
                {/* Connection / Edit Form */}
                {isEditing ? (
                  <div className="rounded-2xl border border-charcoal/12 bg-surface-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <EditorialLabel>
                        {isConnected
                          ? `Update ${integration.name} Handle`
                          : `Connect ${integration.name}`}
                      </EditorialLabel>
                      {isConnected && (
                        <button
                          type="button"
                          onClick={() => setEditingPlatform(null)}
                          className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleConnectOrSync(pid);
                      }}
                      className="flex flex-col gap-2.5 sm:flex-row sm:items-end"
                    >
                      <Field label={`${integration.name} Username / Handle`} className="flex-1">
                        <Input
                          value={handles[pid] ?? ""}
                          onChange={(e) =>
                            setHandles((prev) => ({ ...prev, [pid]: e.target.value }))
                          }
                          placeholder={
                            pid === "codeforces"
                              ? "e.g. tourist"
                              : pid === "codechef"
                                ? "e.g. gennady.korotkevich"
                                : pid === "atcoder"
                                  ? "e.g. tourist"
                                  : "e.g. neal_wu"
                          }
                          className="rounded-xl bg-ivory/60 font-mono"
                          disabled={isSyncing}
                        />
                      </Field>
                      <div className="flex items-center gap-2">
                        <Button
                          type="submit"
                          disabled={isSyncing}
                          className="rounded-full bg-charcoal text-lime hover:bg-charcoal/90 font-semibold"
                        >
                          <RefreshCw
                            className={cn("mr-1.5 h-3.5 w-3.5", isSyncing && "animate-spin")}
                          />
                          <span>
                            {isSyncing
                              ? "Syncing..."
                              : isConnected
                                ? "Save & Sync"
                                : "Connect & Sync"}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openManualConfig(pid)}
                          className="rounded-full bg-surface-white text-xs"
                        >
                          <Wrench className="mr-1 h-3.5 w-3.5" />
                          <span>Manual Mode</span>
                        </Button>
                      </div>
                    </form>
                    {!isConnected && (
                      <p className="text-xs text-muted-foreground">
                        Connect your account to start tracking. Read-only public profile integration
                        — CP Tracker never asks for your password, session cookies, or private
                        tokens.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-charcoal/10 bg-surface-white px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          @{acc.username}
                        </span>
                        <a
                          href={acc.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-ivory px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground hover:text-foreground border border-charcoal/10"
                        >
                          <span>Public Profile</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        Last synchronized: {formatSyncTimestamp(acc.lastSyncedAt)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleConnectOrSync(pid)}
                        disabled={isSyncing}
                        className="h-8 rounded-full bg-charcoal text-lime hover:bg-charcoal/90 text-xs font-semibold"
                      >
                        <RefreshCw className={cn("mr-1.5 h-3 w-3", isSyncing && "animate-spin")} />
                        <span>{isSyncing ? "Syncing..." : "Refresh"}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPlatform(pid)}
                        className="h-8 rounded-full bg-ivory text-xs"
                      >
                        <Edit3 className="mr-1 h-3 w-3" />
                        <span>Edit Handle</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openManualConfig(pid)}
                        className="h-8 rounded-full bg-ivory text-xs"
                      >
                        <Wrench className="mr-1 h-3 w-3" />
                        <span>Manual</span>
                      </Button>
                      <Confirm
                        title={`Disconnect ${integration.name} (@${acc.username})?`}
                        description={`This disconnects @${acc.username} from automatic ${integration.name} synchronization. All previously synchronized problems, contest history, and daily training logs will be safely preserved in your tracker.`}
                        confirmLabel="Disconnect Account"
                        onConfirm={() => {
                          actions.disconnectPlatform(pid);
                          toast.success(
                            `Disconnected ${integration.name}. Historical records preserved.`,
                          );
                        }}
                        trigger={
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full border-coral/30 text-coral hover:bg-coral/10 text-xs"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Manual Tracking Mode Override Drawer */}
                {isManualForm && (
                  <div className="rounded-2xl border border-charcoal/20 bg-ivory p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <EditorialLabel>
                        Manual Tracking Only Mode · {integration.name}
                      </EditorialLabel>
                      <button
                        type="button"
                        onClick={() => setManualFormPlatform(null)}
                        className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Close
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use Manual Tracking Mode if you prefer to maintain your {integration.name}{" "}
                      metrics and solved problems manually without automatic background fetches.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                      <Field label="Username">
                        <Input
                          value={handles[pid] ?? ""}
                          onChange={(e) =>
                            setHandles((prev) => ({ ...prev, [pid]: e.target.value }))
                          }
                          placeholder="username"
                          className="rounded-xl bg-surface-white font-mono text-xs"
                        />
                      </Field>
                      <Field label="Current Rating">
                        <Input
                          type="number"
                          value={manualRating}
                          onChange={(e) => setManualRating(e.target.value)}
                          placeholder="e.g. 1450"
                          className="rounded-xl bg-surface-white font-mono text-xs"
                        />
                      </Field>
                      <Field label="Highest Rating">
                        <Input
                          type="number"
                          value={manualHighest}
                          onChange={(e) => setManualHighest(e.target.value)}
                          placeholder="e.g. 1520"
                          className="rounded-xl bg-surface-white font-mono text-xs"
                        />
                      </Field>
                      <Field label="Total Solved">
                        <Input
                          type="number"
                          value={manualSolved}
                          onChange={(e) => setManualSolved(e.target.value)}
                          placeholder="e.g. 240"
                          className="rounded-xl bg-surface-white font-mono text-xs"
                        />
                      </Field>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveManualConfig(pid)}
                        className="rounded-full bg-charcoal text-lime hover:bg-charcoal/90 text-xs font-semibold"
                      >
                        Save Manual Metrics
                      </Button>
                    </div>
                  </div>
                )}

                {/* Non-Destructive Error Alert */}
                {acc.lastError && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-coral/35 bg-coral/10 p-3.5 text-xs text-foreground">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-coral shrink-0" />
                    <div className="space-y-1">
                      <div className="font-semibold text-coral">Synchronization Notice</div>
                      <p className="text-muted-foreground">{acc.lastError}</p>
                    </div>
                  </div>
                )}

                {/* Platform Metrics Grid */}
                {isConnected ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="rounded-2xl border border-charcoal/10 bg-surface-white p-3">
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">
                        {pid === "leetcode" ? "Contest Rating" : "Current Rating"}
                      </div>
                      <div className="num font-heading mt-1 text-xl font-bold text-foreground">
                        {acc.currentRating != null ? acc.currentRating : "Unrated"}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {acc.rankTitle || "No rank title"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-charcoal/10 bg-surface-white p-3">
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">
                        Highest Rating
                      </div>
                      <div className="num font-heading mt-1 text-xl font-bold text-foreground">
                        {acc.highestRating != null ? acc.highestRating : "Not available"}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {pid === "codechef" && acc.extraMetrics.stars
                          ? `Tier: ${acc.extraMetrics.stars}`
                          : pid === "atcoder" && acc.extraMetrics.colorTier
                            ? `Color: ${acc.extraMetrics.colorTier}`
                            : "Peak achieved"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-charcoal/10 bg-surface-white p-3">
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">
                        Contests
                      </div>
                      <div className="num font-heading mt-1 text-xl font-bold text-foreground">
                        {acc.totalContests != null ? acc.totalContests : 0}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {acc.extraMetrics.globalRank != null
                          ? `Global #${acc.extraMetrics.globalRank}`
                          : "Rated participations"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-charcoal/10 bg-surface-white p-3">
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">
                        Problems Solved
                      </div>
                      <div className="num font-heading mt-1 text-xl font-bold text-foreground">
                        {stat?.effectiveSolved ?? acc.totalSolved ?? 0}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {stat?.trackedSolved ?? 0} in problem tracker
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-charcoal/15 bg-surface-white/60 p-4 text-center">
                    <div className="font-heading text-sm font-bold text-foreground">
                      Connect your account to start tracking.
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter your {integration.name} handle above to synchronize ratings, contest
                      history, and solved problems.
                    </p>
                  </div>
                )}

                {/* Platform-Specific Extra Breakdown (LeetCode Easy/Med/Hard, CodeChef Ranks, AtCoder AC) */}
                {isConnected && pid === "leetcode" && acc.extraMetrics.easySolved != null && (
                  <div className="grid grid-cols-3 gap-2 rounded-2xl border border-charcoal/10 bg-surface-white p-3 text-center">
                    <div>
                      <div className="font-mono text-[10px] uppercase text-sage-deep">
                        Easy Solved
                      </div>
                      <div className="num font-heading text-lg font-bold text-foreground">
                        {acc.extraMetrics.easySolved}
                      </div>
                    </div>
                    <div className="border-x border-charcoal/10">
                      <div className="font-mono text-[10px] uppercase text-charcoal">
                        Medium Solved
                      </div>
                      <div className="num font-heading text-lg font-bold text-foreground">
                        {acc.extraMetrics.mediumSolved ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase text-coral">Hard Solved</div>
                      <div className="num font-heading text-lg font-bold text-foreground">
                        {acc.extraMetrics.hardSolved ?? 0}
                      </div>
                    </div>
                  </div>
                )}

                {isConnected && pid === "codechef" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-charcoal/10 bg-surface-white px-3.5 py-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>
                        <strong className="font-semibold">Stars:</strong>{" "}
                        {acc.extraMetrics.stars || "Unrated"}
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="font-semibold">Global Rank:</strong>{" "}
                        {acc.extraMetrics.globalRank
                          ? `#${acc.extraMetrics.globalRank}`
                          : "Not available"}
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="font-semibold">Country Rank:</strong>{" "}
                        {acc.extraMetrics.countryRank
                          ? `#${acc.extraMetrics.countryRank}`
                          : "Not available"}
                      </span>
                    </div>
                    <Link
                      to="/problems"
                      className="font-mono text-[11px] font-semibold underline underline-offset-4"
                    >
                      + Log CodeChef Problem
                    </Link>
                  </div>
                )}

                {/* Honest Data Source & Metric Availability Notice */}
                <div className="rounded-2xl border border-charcoal/8 bg-cream/60 px-3.5 py-2.5 text-[11px] text-muted-foreground space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-foreground/85">
                      {acc.dataSourceLabel}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                      {acc.availableMetrics.rating && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-surface-white px-1.5 py-0.5 text-foreground border border-charcoal/10">
                          <Check className="h-2.5 w-2.5 text-sage-deep" /> Rating
                        </span>
                      )}
                      {acc.availableMetrics.contests && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-surface-white px-1.5 py-0.5 text-foreground border border-charcoal/10">
                          <Check className="h-2.5 w-2.5 text-sage-deep" /> Contests
                        </span>
                      )}
                      {acc.availableMetrics.solvedCount && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-surface-white px-1.5 py-0.5 text-foreground border border-charcoal/10">
                          <Check className="h-2.5 w-2.5 text-sage-deep" /> Solved Count
                        </span>
                      )}
                      {acc.availableMetrics.problemList ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-surface-white px-1.5 py-0.5 text-foreground border border-charcoal/10">
                          <Check className="h-2.5 w-2.5 text-sage-deep" /> Problem List
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded bg-ivory px-1.5 py-0.5 text-muted-foreground border border-charcoal/10">
                          <Info className="h-2.5 w-2.5" /> Manual Problem List
                        </span>
                      )}
                    </div>
                  </div>
                  {!acc.availableMetrics.problemList && (
                    <p className="text-[11px] text-muted-foreground">
                      Individual solved problem list: This information is not available through the
                      current integration. Total solved count and full contest rating history are
                      automatically extracted; individual CodeChef problems can be logged manually
                      in Problems or Daily Log.
                    </p>
                  )}
                </div>
              </div>
            </BentoCard>
          );
        })}
      </div>

      <WavyDivider />

      {/* Native-Scale Multi-Platform Rating Comparison */}
      <MultiPlatformRatingComparison data={data} />

      {/* Extensible Online Judges Section (CSES, HackerRank, GeeksforGeeks, Other) */}
      <BentoCard
        surface="ivory"
        kicker="EXTENSIBLE ARCHITECTURE · MANUAL & HYBRID TRACKING"
        title="Additional Supported Online Judges"
        action={
          <Link
            to="/problems"
            className="inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1 font-mono text-[11px] font-semibold text-lime hover:bg-charcoal/90"
          >
            <Plus className="h-3 w-3" />
            <span>Log Problem from Any Judge</span>
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXTENSIBLE_PLATFORMS.map((ext) => {
            const count = data.problems.filter(
              (p) =>
                p.status !== "unsolved" &&
                (p.platform ?? "").toLowerCase() === ext.id.toLowerCase(),
            ).length;
            return (
              <div
                key={ext.id}
                className="flex flex-col justify-between rounded-2xl border border-charcoal/12 bg-surface-white p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PlatformLogoBadge platform={ext.id} size="md" />
                      <div className="font-heading text-sm font-bold text-foreground">
                        {ext.name}
                      </div>
                    </div>
                    <PlatformConnectionBadge state="manual_only" compact />
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground">{ext.description}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-charcoal/8 pt-2.5 text-xs">
                  <span className="num font-mono font-semibold text-foreground">
                    {count} {count === 1 ? "problem" : "problems"} tracked
                  </span>
                  {ext.url ? (
                    <a
                      href={ext.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <span>Open Judge</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : (
                    <Link
                      to="/problems"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-foreground hover:underline"
                    >
                      <span>Add Problem</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </BentoCard>
    </div>
  );
}
