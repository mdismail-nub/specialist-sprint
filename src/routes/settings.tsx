import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  Link2,
  RefreshCw,
  RotateCcw,
  Share,
  Smartphone,
  Trash2,
  Unlink,
  Upload,
  Wifi,
  WifiOff,
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
import { BentoCard, Confirm, Field, PageHeader, selectCls } from "@/components/cp/ui";
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
          "Configure your 60-day challenge goals, Codeforces sync, ratings, theme, PWA installation, and local data backups.",
      },
      { property: "og:title", content: "Settings — CP Tracker" },
      {
        property: "og:description",
        content:
          "Configure your 60-day challenge goals, Codeforces sync, ratings, theme, PWA installation, and local data backups.",
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
  const [cfHandleInput, setCfHandleInput] = useState(data.settings.cfHandle);
  const [cfSyncing, setCfSyncing] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [stagedSummary, setStagedSummary] = useState<BackupSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm(data.settings);
    setCfHandleInput(data.settings.cfHandle);
  }, [data.settings]);

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

  const handleConnectAndSyncCF = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = cfHandleInput.trim();
    if (!cleaned) {
      toast.error("Enter a Codeforces handle to sync.");
      return;
    }
    setCfSyncing(true);
    const res = await actions.syncCodeforces(cleaned);
    setCfSyncing(false);
    if (res.ok) {
      toast.success(`Synced Codeforces account @${cleaned}`);
    } else {
      toast.error(res.error);
    }
  };

  const handleDisconnectCF = () => {
    actions.disconnectCodeforces();
    setCfHandleInput("");
    toast.success("Disconnected Codeforces handle (your saved records are preserved)");
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

  const profile = data.cfSync.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="CONFIGURATION, CODEFORCES SYNC & BACKUP"
        title="Challenge Settings"
        subtitle="Configure your Specialist training goals, connect your live Codeforces account, install the PWA, and manage offline backups."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Challenge Parameters Form + Codeforces Live Sync */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Codeforces Live Account Synchronization */}
          <BentoCard
            surface="white"
            kicker="LIVE API INTEGRATION"
            title="Codeforces Synchronization"
            action={
              data.settings.cfHandle ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 font-mono text-[11px] font-bold text-charcoal">
                  <Link2 className="h-3 w-3" /> Connected: @{data.settings.cfHandle}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-charcoal/8 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  Not connected
                </span>
              )
            }
          >
            <div className="space-y-4">
              <form onSubmit={(e) => void handleConnectAndSyncCF(e)} className="flex gap-2">
                <Input
                  placeholder="Enter your Codeforces handle (e.g. tourist)"
                  value={cfHandleInput}
                  onChange={(e) => setCfHandleInput(e.target.value)}
                  className="bg-ivory font-mono"
                />
                <Button
                  type="submit"
                  disabled={cfSyncing || data.cfSync.syncing}
                  className="rounded-full px-5 shrink-0"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      (cfSyncing || data.cfSync.syncing) && "animate-spin",
                    )}
                  />
                  <span>{data.settings.cfHandle ? "Sync Now" : "Connect & Sync"}</span>
                </Button>
                {data.settings.cfHandle && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDisconnectCF}
                    className="rounded-full shrink-0"
                    aria-label="Disconnect Codeforces handle"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </form>

              {data.cfSync.error && (
                <div className="rounded-2xl border border-coral/40 bg-coral/10 px-3.5 py-2.5 text-xs font-medium text-charcoal">
                  {data.cfSync.error}
                </div>
              )}

              {profile ? (
                <div className="rounded-2xl border border-charcoal/12 bg-ivory p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-heading text-base font-bold text-foreground">
                        @{profile.handle}{" "}
                        <span className="font-mono text-xs font-semibold uppercase text-sage-deep">
                          ({profile.rank})
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        Last synced:{" "}
                        {data.cfSync.lastSyncedAt
                          ? new Date(data.cfSync.lastSyncedAt).toLocaleString()
                          : "Just now"}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 font-mono text-xs">
                    <div className="rounded-xl bg-surface-white p-2.5 border border-charcoal/8">
                      <span className="block text-[10px] text-muted-foreground">RATING</span>
                      <span className="num font-heading text-base font-bold">{profile.rating}</span>
                    </div>
                    <div className="rounded-xl bg-surface-white p-2.5 border border-charcoal/8">
                      <span className="block text-[10px] text-muted-foreground">MAX RATING</span>
                      <span className="num font-heading text-base font-bold">
                        {profile.maxRating}
                      </span>
                    </div>
                    <div className="rounded-xl bg-surface-white p-2.5 border border-charcoal/8">
                      <span className="block text-[10px] text-muted-foreground">CONTESTS</span>
                      <span className="num font-heading text-base font-bold">
                        {profile.contestsCount}
                      </span>
                    </div>
                    <div className="rounded-xl bg-surface-white p-2.5 border border-charcoal/8">
                      <span className="block text-[10px] text-muted-foreground">UNIQUE AC</span>
                      <span className="num font-heading text-base font-bold">
                        {profile.uniqueSolvedCount}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Connecting your Codeforces handle imports your official rating, rated contest
                  history, and deduplicated accepted problems. Imported problems are marked{" "}
                  <strong>Imported · Classify</strong> until you classify whether they were solved
                  independently, with a hint, or with an editorial.
                </p>
              )}
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
