import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Download,
  Home,
  Layers,
  ListChecks,
  Map,
  RefreshCw,
  Settings,
  Trophy,
  WifiOff,
  X,
} from "lucide-react";
import { actions, useData, useHydrated } from "@/lib/cp/store";
import { todayISO } from "@/lib/cp/dates";
import { useOnlineStatus, usePWA } from "@/lib/cp/pwa";
import { OnboardingModal } from "@/components/cp/OnboardingModal";
import { PRIMARY_PLATFORM_IDS } from "@/integrations/registry";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/platforms", label: "Platforms", icon: Layers },
  { to: "/log", label: "Daily Log", icon: BookOpen },
  { to: "/roadmap", label: "Roadmap", icon: Map },
  { to: "/problems", label: "Problems", icon: ListChecks },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/contests", label: "Contests", icon: Trophy },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const MOBILE_BOTTOM = ["/", "/platforms", "/log", "/problems", "/analytics"];
const MOBILE_TOP = ["/roadmap", "/contests", "/settings"];
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function useTheme() {
  const { theme } = useData({ isShell: true }).settings;
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

function useAutoMultiPlatformSync(isOnline: boolean) {
  const hydrated = useHydrated({ isShell: true });
  const data = useData({ isShell: true });
  const lastAttemptRef = useRef<number>(0);

  useEffect(() => {
    if (!hydrated || !isOnline || !data.onboarded) return;
    const connectedIds = PRIMARY_PLATFORM_IDS.filter((pid) => {
      const acc = data.platforms[pid];
      return acc && acc.username.trim().length > 0 && acc.connectionStatus !== "manual_only";
    });
    if (connectedIds.length === 0) return;

    const anySyncing = connectedIds.some(
      (pid) => data.platforms[pid].connectionStatus === "syncing",
    );
    if (anySyncing) return;

    const checkAndSync = () => {
      const now = Date.now();
      if (now - lastAttemptRef.current < 60_000) return;
      const needsSync = connectedIds.some((pid) => {
        const lastSyncMs = data.platforms[pid].lastSyncedAt
          ? new Date(data.platforms[pid].lastSyncedAt!).getTime()
          : 0;
        return !lastSyncMs || now - lastSyncMs >= AUTO_SYNC_INTERVAL_MS;
      });
      if (needsSync) {
        lastAttemptRef.current = now;
        void actions.syncAllConnectedPlatforms().catch(() => {
          // Non-destructive background sync
        });
      }
    };

    checkAndSync();
    const timer = window.setInterval(checkAndSync, AUTO_SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hydrated, isOnline, data.onboarded, data.platforms]);
}

export function AppShell({ children }: { children: ReactNode }) {
  useTheme();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const today = todayISO();
  const isOnline = useOnlineStatus();
  useAutoMultiPlatformSync(isOnline);

  const {
    isInstalled,
    isIOS,
    isInstallable,
    installDismissed,
    updateAvailable,
    promptInstall,
    dismissInstall,
    applyUpdate,
  } = usePWA();

  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
  const showInstallSuggestion = !isInstalled && !installDismissed && (isInstallable || isIOS);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-lime selection:text-charcoal">
      {/* First-Time Onboarding Modal */}
      <OnboardingModal />

      {/* Top Navigation Header — 3-Zone Editorial Contract */}
      <header className="sticky top-0 z-30 border-b border-charcoal/10 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6 lg:h-16 lg:px-10">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            className="font-heading flex items-center gap-2.5 text-lg font-bold tracking-tight whitespace-nowrap text-foreground shrink-0"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-charcoal text-xs font-mono font-semibold text-lime">
              CP
            </span>
            <span>CP Tracker</span>
          </Link>

          {/* Zone 2: Desktop Navigation Links */}
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 lg:gap-2">
            {NAV.map(({ to, label }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "relative px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 rounded-full",
                    active
                      ? "bg-charcoal text-ivory dark:bg-lime dark:text-charcoal font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-charcoal/5",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Mobile Secondary Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/log"
              search={{ date: today }}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-charcoal px-4 py-2 text-xs font-semibold text-ivory transition-transform active:scale-95 hover:bg-charcoal/90 dark:bg-lime dark:text-charcoal whitespace-nowrap shrink-0"
            >
              <span>Log Session</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-lime dark:text-charcoal" />
            </Link>

            {/* Mobile Secondary Utility Icons */}
            <div className="flex items-center gap-1 md:hidden">
              {NAV.filter((n) => MOBILE_TOP.includes(n.to)).map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                    isActive(to)
                      ? "bg-charcoal text-lime"
                      : "text-muted-foreground hover:bg-charcoal/5 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Automatic Offline Status Indicator */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-charcoal/15 bg-charcoal text-ivory"
        >
          <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6 lg:px-10">
            <div className="flex items-center gap-2 font-medium">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-lime text-charcoal shrink-0">
                <WifiOff className="h-3 w-3" />
              </span>
              <span>You&apos;re offline — your progress is saved locally.</span>
            </div>
            <span className="hidden font-mono text-[11px] text-lime sm:inline">
              LOCAL STORAGE + INDEXEDDB ACTIVE
            </span>
          </div>
        </div>
      )}

      {/* Non-intrusive Service Worker Update Notification */}
      {updateAvailable && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-charcoal/15 bg-lime text-charcoal"
        >
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6 lg:px-10">
            <div className="flex items-center gap-2 font-medium">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span>
                {path.startsWith("/log")
                  ? "A new version of CP Tracker is ready. Save your log first, then update."
                  : "A new version of CP Tracker is ready."}
              </span>
            </div>
            <button
              type="button"
              onClick={applyUpdate}
              className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-ivory transition-colors hover:bg-charcoal/90"
            >
              <span>Update now</span>
            </button>
          </div>
        </div>
      )}

      {/* Dismissible PWA Installation Suggestion */}
      {showInstallSuggestion && (
        <div className="border-b border-charcoal/10 bg-ivory/90 text-charcoal">
          <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6 lg:px-10">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-charcoal text-[10px] font-mono font-bold text-lime shrink-0">
                CP
              </span>
              <span className="text-charcoal/85">
                {isIOS
                  ? "Install CP Tracker on your Home Screen for full-screen offline training."
                  : "Install CP Tracker as a standalone app for instant offline access."}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isInstallable ? (
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className="inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-lime transition-colors hover:bg-charcoal/90"
                >
                  <Download className="h-3 w-3" />
                  <span>Install App</span>
                </button>
              ) : (
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-lime transition-colors hover:bg-charcoal/90"
                >
                  <span>How to Install</span>
                </Link>
              )}
              <button
                type="button"
                onClick={dismissInstall}
                aria-label="Dismiss install suggestion"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-charcoal/60 transition-colors hover:bg-charcoal/10 hover:text-charcoal"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-[1360px] px-4 pt-5 pb-24 sm:px-6 md:pt-8 md:pb-16 lg:px-10">
        {children}
      </main>

      {/* Dedicated Mobile Bottom Navigation (<= 56px height to respect 15% sticky cap) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid h-14 grid-cols-5 border-t border-charcoal/10 bg-ivory/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.filter((n) => MOBILE_BOTTOM.includes(n.to)).map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors whitespace-nowrap",
                active ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-10 items-center justify-center rounded-full transition-colors",
                  active ? "bg-lime text-charcoal" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
