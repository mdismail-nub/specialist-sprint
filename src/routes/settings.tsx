import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Layers,
  RefreshCw,
  RotateCcw,
  Share,
  Smartphone,
  Trash2,
  Unlink,
  Upload,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import {
  actions,
  STORAGE_KEY,
  useData,
  validateBackupJSON,
  type BackupSummary,
} from "@/lib/cp/store";
import { DEFAULT_SETTINGS } from "@/lib/cp/seed";
import { formatDate, todayISO } from "@/lib/cp/dates";
import { useOnlineStatus, usePWA } from "@/lib/cp/pwa";
import type { Settings, Theme } from "@/lib/cp/types";
import type { PrimaryPlatformId } from "@/integrations/types";
import { PLATFORM_INTEGRATIONS, PRIMARY_PLATFORM_IDS } from "@/integrations/registry";
import { BentoCard, Confirm, Field, PageHeader, selectCls } from "@/components/cp/ui";
import {
  DataSourceBadge,
  formatSyncTimestamp,
  PlatformConnectionBadge,
  PlatformLogoBadge,
} from "@/components/cp/PlatformWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CP Tracker" },
      {
        name: "description",
        content:
          "Configure your 60-day challenge goals, multi-platform account sync, ratings, theme, PWA installation, and local data backups.",
      },
      { property: "og:title", content: "Settings — CP Tracker" },
      {
        property: "og:description",
        content:
          "Configure your 60-day challenge goals, multi-platform account sync, ratings, theme, PWA installation, and local data backups.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const data = useData();
  const isOnline = useOnlineStatus();
  const {
    isInstalled,
    isIOS,
    isInstallable,
    swReady,
    updateAvailable,
    promptInstall,
    applyUpdate,
  } = usePWA();

  const [form, setForm] = useState<Settings>(data.settings);
  const [handles, setHandles] = useState<Record<PrimaryPlatformId, string>>({
    codeforces: data.platforms.codeforces.username || data.settings.cfHandle,
    codechef: data.platforms.codechef.username,
    atcoder: data.platforms.atcoder.username,
    leetcode: data.platforms.leetcode.username,
  });
  const [syncingAll, setSyncingAll] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [stagedSummary, setStagedSummary] = useState<BackupSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm(data.settings);
    setHandles({
      codeforces: data.platforms.codeforces.username || data.settings.cfHandle,
      codechef: data.platforms.codechef.username,
      atcoder: data.platforms.atcoder.username,
      leetcode: data.platforms.leetcode.username,
    });
  }, [
    data.settings,
    data.platforms.codeforces.username,
    data.platforms.codechef.username,
    data.platforms.atcoder.username,
    data.platforms.leetcode.username,
  ]);

  const connectedPlatformsCount = PRIMARY_PLATFORM_IDS.filter(
    (pid) => data.platforms[pid].username.trim().length > 0,
  ).length;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.duration < 7 || form.duration > 365) {
      toast.error("Challenge duration must be between 7 and 365 days.");
      return;
    }
    if (form.dailyProblems < 1 || form.dailyProblems > 30) {
      toast.error("Daily problem target must be between 1 and 30.");
      return;
    }
    actions.updateSettings(form);
    toast.success("Challenge settings saved");
  };

  const handleSyncPlatform = async (pid: PrimaryPlatformId) => {
    const cleaned = (handles[pid] || data.platforms[pid].username).trim();
    const integration = PLATFORM_INTEGRATIONS[pid];
    if (!cleaned) {
      toast.error(`Enter your ${integration.name} username first.`);
      return;
    }
    const res = await actions.syncPlatform(pid, cleaned);
    if (res.ok) {
      toast.success(`Synchronized ${integration.name} (@${res.result.account.username})`);
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

  const downloadBackup = () => {
    const json = actions.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cp-tracker-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup JSON file downloaded");
  };

  const copyBackupJSON = async () => {
    try {
      const json = actions.exportJSON();
      await navigator.clipboard.writeText(json);
      toast.success("Backup JSON copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard — use Download Backup instead.");
    }
  };

  const handleImportCandidate = (rawText: string) => {
    setImportText(rawText);
    if (!rawText.trim()) {
      setStagedSummary(null);
      setImportError(null);
      return;
    }
    try {
      const { summary } = validateBackupJSON(rawText);
      setStagedSummary(summary);
      setImportError(null);
    } catch (e) {
      setStagedSummary(null);
      setImportError((e as Error).message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setShowImport(true);
      handleImportCandidate(content);
      toast.success(`Loaded "${file.name}" — review and confirm below to restore`);
    };
    reader.onerror = () => {
      toast.error("Failed to read backup file.");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const executeRestore = () => {
    try {
      actions.importJSON(importText);
      setForm(readSnapshotSettings());
      setImportText("");
      setStagedSummary(null);
      setImportError(null);
      setShowImport(false);
      toast.success("Backup restored and saved to local + IndexedDB storage");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleInstallAction = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        toast.success("CP Tracker installed!");
      }
      return;
    }
    setShowInstallGuide((prev) => !prev);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="CONFIGURATION, MULTI-PLATFORM SYNC & BACKUP"
        title="Challenge Settings & Connected Platforms"
        subtitle="Configure your Specialist training goals, manage connected competitive programming accounts, install the PWA, and manage offline backups."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Connected Platforms Management + Challenge Parameters Form */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Connected Platforms Management */}
          <BentoCard
            surface="white"
            kicker="MULTI-PLATFORM ACCOUNT SYNC"
            title="Connected Platforms Management"
            action={
              <div className="flex items-center gap-2">
                {connectedPlatformsCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={syncingAll}
                    onClick={() => void handleSyncAll()}
                    className="h-8 rounded-full bg-ivory text-xs"
                  >
                    <RefreshCw className={cn("mr-1 h-3 w-3", syncingAll && "animate-spin")} />
                    <span>{syncingAll ? "Syncing..." : "Sync All"}</span>
                  </Button>
                )}
                <Link
                  to="/platforms"
                  className="inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1 font-mono text-[11px] font-semibold text-lime hover:bg-charcoal/90"
                >
                  <Layers className="h-3 w-3" />
                  <span>Full Hub</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            }
          >
            <div className="space-y-3.5">
              <p className="text-xs text-muted-foreground">
                Connect your accounts across Codeforces, CodeChef, AtCoder, and LeetCode.
                Synchronization is non-destructive and never asks for passwords or session cookies.
              </p>

              {PRIMARY_PLATFORM_IDS.map((pid) => {
                const acc = data.platforms[pid];
                const integration = PLATFORM_INTEGRATIONS[pid];
                const isConnected = acc.username.trim().length > 0;
                const isSyncing = acc.connectionStatus === "syncing";

                return (
                  <div
                    key={pid}
                    className="rounded-2xl border border-charcoal/12 bg-ivory/75 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <PlatformLogoBadge platform={pid} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-sm font-bold text-foreground">
                              {integration.name}
                            </span>
                            <PlatformConnectionBadge state={acc.connectionStatus} compact />
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {isConnected
                              ? `Last synced: ${formatSyncTimestamp(acc.lastSyncedAt)}`
                              : "Connect your account to start tracking."}
                          </div>
                        </div>
                      </div>
                      <DataSourceBadge source={acc.dataSource} />
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSyncPlatform(pid);
                      }}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Input
                        placeholder={`Enter ${integration.name} username`}
                        value={handles[pid] ?? ""}
                        onChange={(e) => setHandles((prev) => ({ ...prev, [pid]: e.target.value }))}
                        className="h-9 flex-1 min-w-[180px] rounded-xl bg-surface-white font-mono text-xs"
                        disabled={isSyncing}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSyncing}
                        className="h-9 rounded-full px-4 shrink-0 text-xs font-semibold"
                      >
                        <RefreshCw
                          className={cn("mr-1.5 h-3.5 w-3.5", isSyncing && "animate-spin")}
                        />
                        <span>{isConnected ? "Sync Now" : "Connect & Sync"}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const h = (handles[pid] || acc.username).trim();
                          if (!h) {
                            toast.error(`Enter a ${integration.name} username first.`);
                            return;
                          }
                          actions.setPlatformManualMode(pid, h);
                          toast.success(`${integration.name} set to Manual Tracking Only mode.`);
                        }}
                        className="h-9 rounded-full bg-surface-white text-xs shrink-0"
                        title="Switch to Manual Tracking Mode"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                      </Button>
                      {isConnected && (
                        <Confirm
                          title={`Disconnect ${integration.name} (@${acc.username})?`}
                          description={`This disconnects @${acc.username} from automatic ${integration.name} synchronization. Your previously saved problems, contests, and training logs will be safely preserved.`}
                          confirmLabel="Disconnect Account"
                          onConfirm={() => {
                            actions.disconnectPlatform(pid);
                            setHandles((prev) => ({ ...prev, [pid]: "" }));
                            toast.success(
                              `Disconnected ${integration.name} (your saved records are preserved)`,
                            );
                          }}
                          trigger={
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-full bg-surface-white shrink-0"
                              aria-label={`Disconnect ${integration.name} handle`}
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      )}
                    </form>

                    {acc.lastError && (
                      <div className="rounded-xl border border-coral/35 bg-coral/10 px-3 py-2 text-xs text-charcoal">
                        {acc.lastError}
                      </div>
                    )}

                    {isConnected && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-charcoal/8 pt-2.5 font-mono text-[11px] text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-3">
                          <span>
                            Rating:{" "}
                            <strong className="text-foreground">
                              {acc.currentRating ?? "Unrated"}
                            </strong>
                          </span>
                          <span>
                            Peak:{" "}
                            <strong className="text-foreground">{acc.highestRating ?? "—"}</strong>
                          </span>
                          <span>
                            Contests:{" "}
                            <strong className="text-foreground">{acc.totalContests ?? 0}</strong>
                          </span>
                          <span>
                            Solved:{" "}
                            <strong className="text-foreground">{acc.totalSolved ?? 0}</strong>
                          </span>
                        </div>
                        <a
                          href={acc.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-foreground hover:underline"
                        >
                          <span>@{acc.username}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </BentoCard>

          {/* Challenge Parameters Form */}
          <BentoCard surface="ivory" kicker="TRAINING PARAMETERS" title="Profile & Challenge Goals">
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Display Name / Handle">
                  <Input
                    value={form.name}
                    placeholder="e.g. tourist"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="bg-surface-white"
                  />
                </Field>
                <Field label="Appearance Theme">
                  <select
                    aria-label="Appearance Theme"
                    className={selectCls}
                    value={form.theme}
                    onChange={(e) => {
                      const nextTheme = e.target.value as Theme;
                      setForm({ ...form, theme: nextTheme });
                      actions.updateSettings({ theme: nextTheme });
                    }}
                  >
                    <option value="light">Warm Cream Editorial (Light)</option>
                    <option value="dark">Deep Charcoal (Dark)</option>
                    <option value="system">System Preference</option>
                  </select>
                </Field>
                <Field label="Starting Rating">
                  <Input
                    inputMode="numeric"
                    value={form.startRating}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        startRating: Number(e.target.value.replace(/\D/g, "")) || 0,
                      })
                    }
                    className="bg-surface-white num font-mono"
                  />
                </Field>
                <Field label="Current Rating">
                  <Input
                    inputMode="numeric"
                    value={form.currentRating}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        currentRating: Number(e.target.value.replace(/\D/g, "")) || 0,
                      })
                    }
                    className="bg-surface-white num font-mono"
                  />
                </Field>
                <Field label="Target Rating (Specialist = 1400)">
                  <Input
                    inputMode="numeric"
                    value={form.targetRating}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetRating: Number(e.target.value.replace(/\D/g, "")) || 0,
                      })
                    }
                    className="bg-surface-white num font-mono"
                  />
                </Field>
                <Field label="Challenge Start Date">
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="bg-surface-white"
                  />
                </Field>
                <Field label="Duration (Days)">
                  <Input
                    inputMode="numeric"
                    value={form.duration}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        duration: Number(e.target.value.replace(/\D/g, "")) || 60,
                      })
                    }
                    className="bg-surface-white num font-mono"
                  />
                </Field>
                <Field label="Daily Problems Target">
                  <Input
                    inputMode="numeric"
                    value={form.dailyProblems}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        dailyProblems: Number(e.target.value.replace(/\D/g, "")) || 3,
                      })
                    }
                    className="bg-surface-white num font-mono"
                  />
                </Field>
                <Field label="Daily Study Target (Minutes)" className="sm:col-span-2">
                  <Input
                    inputMode="numeric"
                    value={form.dailyMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        dailyMinutes: Number(e.target.value.replace(/\D/g, "")) || 180,
                      })
                    }
                    className="bg-surface-white num font-mono"
                  />
                </Field>
              </div>
              <div className="pt-2">
                <Button type="submit" className="rounded-full px-6">
                  Save Settings
                </Button>
              </div>
            </form>
          </BentoCard>
        </div>

        {/* Right Column: Install App (PWA) + Data Management & Portability */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* Progressive Web App Installation Card */}
          <BentoCard
            surface="charcoal"
            kicker="PROGRESSIVE WEB APP"
            title="Install CP Tracker"
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ivory/10 px-2.5 py-1 font-mono text-[11px] font-medium text-lime">
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3" /> Online
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" /> Offline Mode
                  </>
                )}
              </span>
            }
          >
            <div className="space-y-3 text-xs text-ivory/80">
              <p>
                Install CP Tracker on your phone or desktop for a standalone window, home-screen
                icon, and instant offline access to all 60 days of your training log.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {isInstalled ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-lime px-3.5 py-1.5 text-xs font-semibold text-charcoal">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Installed · Running in Standalone Mode</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleInstallAction()}
                    className="rounded-full bg-lime text-charcoal hover:bg-lime/90 font-semibold"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>
                      {isInstallable
                        ? "Install App Now"
                        : isIOS
                          ? "Install on iPhone / iPad"
                          : "Install App"}
                    </span>
                  </Button>
                )}

                {updateAvailable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={applyUpdate}
                    className="rounded-full border-ivory/25 bg-ivory/10 text-ivory hover:bg-ivory/20"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Update App Version
                  </Button>
                )}
              </div>

              {/* iOS or Browser Installation Instructions */}
              {(isIOS || showInstallGuide) && !isInstalled && (
                <div className="mt-2 rounded-2xl border border-ivory/15 bg-ivory/5 p-3.5 text-ivory/90 space-y-2">
                  <div className="flex items-center gap-2 font-heading text-xs font-bold text-lime">
                    <Share className="h-3.5 w-3.5" />
                    <span>
                      {isIOS
                        ? "How to install on iPhone or iPad (Safari)"
                        : "How to install CP Tracker from your browser"}
                    </span>
                  </div>
                  {isIOS ? (
                    <ol className="list-decimal space-y-1 pl-4 text-xs text-ivory/85">
                      <li>
                        Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                      </li>
                      <li>
                        Scroll down and tap <strong>Add to Home Screen</strong>.
                      </li>
                      <li>
                        Tap <strong>Add</strong> in the top-right corner to launch CP Tracker as a
                        full-screen standalone app.
                      </li>
                    </ol>
                  ) : (
                    <ol className="list-decimal space-y-1 pl-4 text-xs text-ivory/85">
                      <li>
                        On <strong>Chrome / Edge / Brave</strong> (Desktop or Android), click the{" "}
                        <strong>Install CP Tracker</strong> icon in the address bar or open the
                        browser menu (⋮) and select <strong>Install app</strong> /{" "}
                        <strong>Add to Home screen</strong>.
                      </li>
                      <li>
                        On <strong>iOS Safari</strong>, tap <strong>Share</strong> →{" "}
                        <strong>Add to Home Screen</strong> → <strong>Add</strong>.
                      </li>
                    </ol>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-ivory/10 pt-2.5 font-mono text-[11px] text-ivory/65">
                <span>Offline Service Worker</span>
                <span className="text-lime">
                  {swReady ? "READY · CACHED FOR OFFLINE" : "ACTIVE"}
                </span>
              </div>
            </div>
          </BentoCard>

          {/* Data Management & Portability */}
          <BentoCard
            surface="sage"
            kicker="DATA PORTABILITY & BACKUP"
            title="Backups & Reset Controls"
          >
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="rounded-2xl bg-ivory/90 p-4 border border-charcoal/10">
                  <h3 className="font-heading text-sm font-bold text-charcoal">
                    Export / Restore Backup JSON
                  </h3>
                  <p className="mt-1 text-xs text-charcoal/75">
                    Every change is automatically saved to both{" "}
                    <code className="font-mono">localStorage</code> and{" "}
                    <code className="font-mono">IndexedDB</code>. Download a portable JSON backup
                    file or restore from a previous snapshot anytime.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                    aria-label="Upload JSON backup file"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={downloadBackup}
                      className="rounded-full"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Backup
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void copyBackupJSON()}
                      className="rounded-full bg-surface-white"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy JSON
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full bg-surface-white"
                    >
                      <FileJson className="h-3.5 w-3.5" /> Upload Backup File
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowImport(!showImport)}
                      className="rounded-full bg-surface-white"
                    >
                      <Upload className="h-3.5 w-3.5" /> Paste JSON
                    </Button>
                  </div>

                  {showImport && (
                    <div className="mt-3 space-y-2.5">
                      <Textarea
                        rows={4}
                        placeholder="Paste exported CP Tracker JSON here or use 'Upload Backup File' above..."
                        value={importText}
                        onChange={(e) => handleImportCandidate(e.target.value)}
                        className="bg-surface-white font-mono text-xs"
                      />

                      {importError && (
                        <div className="rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-xs font-medium text-charcoal">
                          {importError}
                        </div>
                      )}

                      {stagedSummary && (
                        <div className="rounded-xl border border-charcoal/15 bg-surface-white p-3 text-xs space-y-2">
                          <div className="flex items-center justify-between font-heading font-bold text-charcoal">
                            <span>Verified Backup Snapshot ({stagedSummary.name})</span>
                            <span className="font-mono text-charcoal/70">
                              Rating {stagedSummary.currentRating} → {stagedSummary.targetRating}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-charcoal/80">
                            <div className="rounded-lg bg-ivory px-2.5 py-1.5">
                              <span className="block text-[10px] text-charcoal/60">LOGS</span>
                              <span className="font-bold">{stagedSummary.logsCount} days</span>
                            </div>
                            <div className="rounded-lg bg-ivory px-2.5 py-1.5">
                              <span className="block text-[10px] text-charcoal/60">PROBLEMS</span>
                              <span className="font-bold">{stagedSummary.problemsCount} items</span>
                            </div>
                            <div className="rounded-lg bg-ivory px-2.5 py-1.5">
                              <span className="block text-[10px] text-charcoal/60">CONTESTS</span>
                              <span className="font-bold">
                                {stagedSummary.contestsCount} logged
                              </span>
                            </div>
                          </div>

                          <Confirm
                            title="Restore backup and replace current records?"
                            description={`This will replace your current local records with the backup for ${stagedSummary.name} (${stagedSummary.logsCount} daily logs, ${stagedSummary.problemsCount} problems, ${stagedSummary.contestsCount} contests).`}
                            confirmLabel="Confirm & Restore Backup"
                            onConfirm={executeRestore}
                            trigger={
                              <Button type="button" size="sm" className="w-full rounded-full">
                                Restore Verified Backup
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Separate Reset Challenge Configuration vs Clear All Data */}
                <div className="rounded-2xl bg-ivory/90 p-4 border border-charcoal/10">
                  <h3 className="font-heading text-sm font-bold text-charcoal">
                    Challenge Configuration & Data Reset
                  </h3>
                  <p className="mt-1 text-xs text-charcoal/75">
                    Resetting challenge configuration lets you re-run onboarding and adjust dates or
                    targets while keeping all logged problems, daily logs, and contests. Clearing
                    all data permanently deletes every record.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Confirm
                      title="Reset challenge configuration?"
                      description="This will re-open the setup wizard and reset your challenge start date to today without deleting any of your logged problems, daily logs, or contests."
                      confirmLabel="Reset Configuration"
                      onConfirm={() => {
                        actions.resetChallengeConfig();
                        setForm(readSnapshotSettings());
                        toast.success(
                          "Challenge configuration reset — your training records were preserved",
                        );
                      }}
                      trigger={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full bg-surface-white"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reset Challenge Configuration
                        </Button>
                      }
                    />

                    <Confirm
                      title="Clear all training data?"
                      description="This will permanently delete all daily logs, tracked problems, contests, and settings from this device."
                      confirmLabel="Clear All Data"
                      onConfirm={() => {
                        actions.reset();
                        setForm(readSnapshotSettings());
                        toast.success("All data cleared");
                      }}
                      trigger={
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="rounded-full"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Clear All Data
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-charcoal px-4 py-3 text-xs text-ivory/80 font-mono">
                Storage key: <span className="text-lime">{STORAGE_KEY}</span> ·{" "}
                <span>Started {formatDate(data.settings.startDate)}</span>
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}

function readSnapshotSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as { settings: Settings }).settings;
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS, startDate: todayISO() };
}
