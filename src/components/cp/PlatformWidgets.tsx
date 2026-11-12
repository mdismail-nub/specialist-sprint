import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  RefreshCw,
  Wrench,
} from "lucide-react";
import type {
  DataSourceType,
  PlatformAccount,
  PlatformConnectionState,
  PrimaryPlatformId,
} from "@/integrations/types";
import {
  PLATFORM_DISPLAY_NAME,
  PLATFORM_INTEGRATIONS,
  PRIMARY_PLATFORM_IDS,
} from "@/integrations/registry";
import type { AppData, ProblemPlatform } from "@/lib/cp/types";
import { platformBreakdownStats, platformRatingHistory } from "@/lib/cp/stats";
import { actions } from "@/lib/cp/store";
import { BentoCard, EditorialLabel } from "@/components/cp/ui";
import { RatingProgressionChart } from "@/components/cp/BentoWidgets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PLATFORM_BADGE_META: Record<string, { short: string; tone: string; label: string }> = {
  codeforces: {
    short: "CF",
    tone: "bg-charcoal text-lime border-charcoal",
    label: "Codeforces",
  },
  codechef: {
    short: "CC",
    tone: "bg-warm-yellow/90 text-charcoal border-charcoal/25",
    label: "CodeChef",
  },
  atcoder: {
    short: "AC",
    tone: "bg-sage-deep text-ivory border-charcoal/25",
    label: "AtCoder",
  },
  leetcode: {
    short: "LC",
    tone: "bg-lime text-charcoal border-charcoal/30",
    label: "LeetCode",
  },
  cses: {
    short: "CS",
    tone: "bg-sage text-charcoal border-charcoal/20",
    label: "CSES",
  },
  hackerrank: {
    short: "HR",
    tone: "bg-ivory text-charcoal border-charcoal/20",
    label: "HackerRank",
  },
  geeksforgeeks: {
    short: "GFG",
    tone: "bg-sage-soft text-charcoal border-charcoal/20",
    label: "GeeksforGeeks",
  },
  other: {
    short: "OJ",
    tone: "bg-surface-white text-charcoal border-charcoal/20",
    label: "Other",
  },
};

export function PlatformLogoBadge({
  platform,
  size = "md",
  showName = false,
}: {
  platform: PrimaryPlatformId | ProblemPlatform | string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}) {
  const key = platform.toLowerCase();
  const meta = PLATFORM_BADGE_META[key] ?? {
    short: platform.slice(0, 2).toUpperCase(),
    tone: "bg-surface-white text-charcoal border-charcoal/20",
    label: platform,
  };

  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-lg border font-mono font-bold tracking-tight shrink-0",
          meta.tone,
          size === "sm" && "h-5 w-6 text-[10px]",
          size === "md" && "h-7 w-8 text-xs",
          size === "lg" && "h-9 w-10 text-sm",
        )}
      >
        {meta.short}
      </span>
      {showName && <span className="font-heading text-xs font-bold">{meta.label}</span>}
    </span>
  );
}

export function PlatformConnectionBadge({
  state,
  compact = false,
}: {
  state: PlatformConnectionState;
  compact?: boolean;
}) {
  if (state === "syncing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/20 bg-warm-yellow/40 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-charcoal">
        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
        <span>Syncing</span>
      </span>
    );
  }
  if (state === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/20 bg-lime px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-charcoal">
        <CheckCircle2 className="h-2.5 w-2.5" />
        <span>Connected</span>
      </span>
    );
  }
  if (state === "partially_supported") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/20 bg-sage px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-charcoal">
        <CheckCircle2 className="h-2.5 w-2.5" />
        <span>{compact ? "Connected · Partial" : "Partially supported"}</span>
      </span>
    );
  }
  if (state === "manual_only") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/20 bg-surface-white px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-charcoal">
        <Wrench className="h-2.5 w-2.5" />
        <span>{compact ? "Manual" : "Manual tracking only"}</span>
      </span>
    );
  }
  if (state === "sync_failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-coral/40 bg-coral/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-coral">
        <AlertCircle className="h-2.5 w-2.5" />
        <span>Sync failed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-ivory px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
      <span>Not connected</span>
    </span>
  );
}

const DATA_SOURCE_TEXT: Record<DataSourceType, string> = {
  official_api: "Official API",
  public_profile: "Public profile integration",
  third_party_provider: "Third-party data provider",
  manual: "Manual data",
};

export function DataSourceBadge({ source }: { source: DataSourceType }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-charcoal/12 bg-surface-white/90 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
      <span>Source: {DATA_SOURCE_TEXT[source]}</span>
    </span>
  );
}

export function formatSyncTimestamp(iso: string | null): string {
  if (!iso) return "Never synchronized";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently";
  }
}

export function ConnectedPlatformsOverview({ data }: { data: AppData }) {
  const [syncingAll, setSyncingAll] = useState(false);
  const breakdown = platformBreakdownStats(data);
  const byId = new Map(breakdown.items.map((item) => [item.platformId, item]));

  const connectedCount = PRIMARY_PLATFORM_IDS.filter(
    (pid) => data.platforms[pid]?.username.trim().length > 0,
  ).length;

  const handleSyncAll = async () => {
    setSyncingAll(true);
    const { synced, failed } = await actions.syncAllConnectedPlatforms();
    setSyncingAll(false);
    if (synced.length > 0 && failed.length === 0) {
      toast.success(`Synchronized ${synced.length} connected platform(s).`);
    } else if (synced.length > 0 && failed.length > 0) {
      toast.warning(
        `Synchronized ${synced.length} platform(s). ${failed.length} had a temporary issue; your saved data is safe.`,
      );
    } else if (failed.length > 0) {
      toast.error(failed[0]!.error);
    }
  };

  return (
    <BentoCard
      surface="ivory"
      kicker="MULTI-PLATFORM ECOSYSTEM"
      title="Connected Platforms Overview"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {connectedCount > 0 && (
            <button
              type="button"
              disabled={syncingAll}
              onClick={() => void handleSyncAll()}
              className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-surface-white px-3 py-1 font-mono text-[11px] font-semibold text-foreground hover:bg-ivory disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3 w-3", syncingAll && "animate-spin")} />
              <span>{syncingAll ? "Syncing..." : "Sync All"}</span>
            </button>
          )}
          <Link
            to="/platforms"
            className="inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1 font-mono text-[11px] font-semibold text-lime hover:bg-charcoal/90"
          >
            <Layers className="h-3 w-3" />
            <span>Manage Platforms</span>
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRIMARY_PLATFORM_IDS.map((pid) => {
          const acc: PlatformAccount = data.platforms[pid];
          const stat = byId.get(pid);
          const isConnected = acc.username.trim().length > 0;
          const solvedCount = stat?.effectiveSolved ?? acc.totalSolved ?? 0;

          return (
            <div
              key={pid}
              className={cn(
                "flex flex-col justify-between rounded-2xl border p-4 transition-colors",
                isConnected
                  ? "border-charcoal/15 bg-surface-white"
                  : "border-dashed border-charcoal/15 bg-surface-white/60",
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlatformLogoBadge platform={pid} size="md" />
                    <div className="min-w-0">
                      <div className="font-heading text-sm font-bold text-foreground truncate">
                        {acc.platformName}
                      </div>
                      {isConnected ? (
                        <a
                          href={acc.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground truncate max-w-[140px]"
                        >
                          <span className="truncate">@{acc.username}</span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Not connected
                        </span>
                      )}
                    </div>
                  </div>
                  <PlatformConnectionBadge state={acc.connectionStatus} compact />
                </div>

                {isConnected ? (
                  <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl bg-ivory/80 p-2.5 border border-charcoal/8">
                    <div>
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">
                        {pid === "leetcode" ? "Contest" : "Rating"}
                      </div>
                      <div className="num font-heading mt-0.5 text-base font-bold text-foreground">
                        {acc.currentRating != null ? acc.currentRating : "Unrated"}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">
                        {acc.rankTitle || (pid === "codechef" ? acc.extraMetrics.stars : "—")}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">
                        Peak
                      </div>
                      <div className="num font-heading mt-0.5 text-base font-bold text-foreground">
                        {acc.highestRating != null ? acc.highestRating : "—"}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">
                        {acc.totalContests != null ? `${acc.totalContests} contests` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">
                        Solved
                      </div>
                      <div className="num font-heading mt-0.5 text-base font-bold text-foreground">
                        {solvedCount}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">
                        {pid === "leetcode" && acc.extraMetrics.easySolved != null
                          ? `${acc.extraMetrics.easySolved}E/${acc.extraMetrics.mediumSolved ?? 0}M/${acc.extraMetrics.hardSolved ?? 0}H`
                          : stat && stat.trackedSolved > 0
                            ? `${stat.trackedSolved} logged`
                            : "Total AC"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3.5 rounded-xl border border-dashed border-charcoal/12 bg-ivory/50 px-3 py-3 text-xs text-muted-foreground">
                    Connect your account to start tracking {acc.platformName} ratings, contests, and
                    solved problems.
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-charcoal/8 text-[11px]">
                <span className="font-mono text-[10px] text-muted-foreground truncate">
                  {isConnected
                    ? `Synced: ${formatSyncTimestamp(acc.lastSyncedAt)}`
                    : acc.dataSourceLabel}
                </span>
                <Link
                  to="/platforms"
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-foreground hover:underline shrink-0"
                >
                  <span>{isConnected ? "Details" : "Connect"}</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}

/**
 * Multi-Platform Rating Comparison Section
 * Displays rating histories on their own native scales without ever combining or adding
 * ratings across different platforms.
 */
export function MultiPlatformRatingComparison({ data }: { data: AppData }) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<PrimaryPlatformId[]>([
    "codeforces",
    "codechef",
    "atcoder",
    "leetcode",
  ]);

  const togglePlatform = (pid: PrimaryPlatformId) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(pid)) {
        return prev.length > 1 ? prev.filter((x) => x !== pid) : prev;
      }
      return [...prev, pid];
    });
  };

  // Determine which platforms have either a connected account or contest rating points
  const activePlatforms = PRIMARY_PLATFORM_IDS.filter((pid) => selectedPlatforms.includes(pid));

  return (
    <BentoCard
      surface="white"
      kicker="NATIVE RATING SCALES · NEVER COMBINED"
      title="Multi-Platform Rating Progression"
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          {PRIMARY_PLATFORM_IDS.map((pid) => {
            const active = selectedPlatforms.includes(pid);
            const points = platformRatingHistory(data, pid);
            const acc = data.platforms[pid];
            return (
              <button
                key={pid}
                type="button"
                onClick={() => togglePlatform(pid)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors",
                  active
                    ? "border-charcoal bg-charcoal text-lime"
                    : "border-charcoal/15 bg-ivory text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{PLATFORM_DISPLAY_NAME[pid]}</span>
                <span
                  className={cn(
                    "num rounded-full px-1.5 py-0.2 text-[10px]",
                    active ? "bg-ivory/15 text-ivory" : "bg-charcoal/10 text-foreground",
                  )}
                >
                  {acc?.currentRating ?? (points.length > 0 ? points.at(-1)!.rating : "—")}
                </span>
              </button>
            );
          })}
        </div>
      }
    >
      <p className="mb-4 text-xs text-muted-foreground">
        Each platform uses its own native rating algorithm and tier system (Codeforces Elo, CodeChef
        Star Divisions, AtCoder Kyu/Dan Color Tiers, and LeetCode Contest Rating). Toggle platforms
        above to compare trajectories side by side on their native scales.
      </p>

      <div
        className={cn("grid grid-cols-1 gap-4", activePlatforms.length >= 2 && "lg:grid-cols-2")}
      >
        {activePlatforms.map((pid) => {
          const integration = PLATFORM_INTEGRATIONS[pid];
          const acc = data.platforms[pid];
          const points = platformRatingHistory(data, pid);
          const defaultTarget =
            pid === "codeforces"
              ? data.settings.targetRating
              : pid === "codechef"
                ? 1800
                : pid === "atcoder"
                  ? 1200
                  : 1850;
          const targetRating = Math.max(
            defaultTarget,
            acc.highestRating ? Math.ceil((acc.highestRating + 100) / 100) * 100 : defaultTarget,
          );

          return (
            <div
              key={pid}
              className="flex flex-col justify-between rounded-2xl border border-charcoal/12 bg-ivory/60 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <PlatformLogoBadge platform={pid} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-bold text-foreground">
                        {integration.name}
                      </span>
                      {acc.username && (
                        <span className="font-mono text-xs text-muted-foreground">
                          @{acc.username}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {integration.ratingSystemLabel}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="num font-heading text-lg font-bold text-foreground">
                    {acc.currentRating != null
                      ? acc.currentRating
                      : points.length > 0
                        ? points.at(-1)!.rating
                        : "Unrated"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {acc.rankTitle
                      ? acc.rankTitle
                      : points.length > 0
                        ? `${points.length} rated contests`
                        : "0 rated contests"}
                  </div>
                </div>
              </div>

              {points.length > 0 ? (
                <RatingProgressionChart points={points} targetRating={targetRating} height={190} />
              ) : (
                <div className="flex min-h-[170px] flex-col items-center justify-center rounded-xl border border-dashed border-charcoal/15 bg-surface-white/75 p-4 text-center">
                  <EditorialLabel className="mb-1.5">{integration.name}</EditorialLabel>
                  <div className="font-heading text-xs font-bold text-foreground">
                    {acc.username
                      ? `No rated ${integration.name} contest history available yet.`
                      : "Connect your account to start tracking."}
                  </div>
                  <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">
                    {acc.username
                      ? `Connected as @${acc.username}. Participate in a rated ${integration.name} contest or log one manually.`
                      : `Link your ${integration.name} handle on the Platforms page to import your contest rating timeline.`}
                  </p>
                  <Link
                    to="/platforms"
                    className="mt-3 inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1 font-mono text-[10px] font-semibold text-lime hover:bg-charcoal/90"
                  >
                    <span>{acc.username ? "Manage Account" : `Connect ${integration.name}`}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
