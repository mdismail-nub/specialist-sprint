import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "cp-tracker:pwa-install-dismissed:v1";

// Module-level singleton capture so beforeinstallprompt is never missed
// even if fired before a component mounts or before the user navigates to Settings.
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let waitingServiceWorker: ServiceWorker | null = null;
let swRegistered = false;
const pwaSubscribers = new Set<() => void>();

function notifySubscribers() {
  pwaSubscribers.forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notifySubscribers();
  });
}

export function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneDisplay = window.matchMedia("(display-mode: standalone)").matches;
  const isIOSStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return isStandaloneDisplay || isIOSStandalone;
}

export function detectIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIPhoneIPad = /iphone|ipad|ipod/.test(ua);
  const isTouchMac =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isIPhoneIPad || isTouchMac;
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || swRegistered) {
    return;
  }
  swRegistered = true;

  const init = async () => {
    try {
      // Purge any legacy v1 caches that may hold stale Vite dev modules
      if ("caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(
          keys.filter((k) => k.endsWith("-v1")).map((k) => window.caches.delete(k)),
        );
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });

      void registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            waitingServiceWorker = newWorker;
            newWorker.postMessage({ type: "SKIP_WAITING" });
            notifySubscribers();
          }
        });
      });
    } catch {
      // Service worker registration can fail in restricted private browsing modes
    }
  };

  if (document.readyState === "complete") {
    void init();
  } else {
    window.addEventListener("load", () => void init(), { once: true });
  }
}

export function useOnlineStatus(): boolean {
  // Always initialize to true for SSR + first client hydration pass, then sync in useEffect
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export function usePWA() {
  // Initialize deterministically for SSR + hydration parity, then sync client capabilities in useEffect
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [installDismissed, setInstallDismissed] = useState<boolean>(false);
  const [swReady, setSwReady] = useState<boolean>(false);

  useEffect(() => {
    registerServiceWorker();
    setIsInstalled(detectStandalone());
    setIsIOS(detectIOS());
    setIsInstallable(Boolean(deferredInstallPrompt));
    setUpdateAvailable(Boolean(waitingServiceWorker));

    try {
      setInstallDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setInstallDismissed(false);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => setSwReady(true)).catch(() => {});
    }

    const sync = () => {
      setIsInstalled(detectStandalone());
      setIsInstallable(Boolean(deferredInstallPrompt));
      setUpdateAvailable(Boolean(waitingServiceWorker));
    };

    pwaSubscribers.add(sync);
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", sync);

    return () => {
      pwaSubscribers.delete(sync);
      mq.removeEventListener("change", sync);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredInstallPrompt) return "unavailable";
    try {
      await deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === "accepted") {
        deferredInstallPrompt = null;
        setIsInstalled(true);
        notifySubscribers();
      }
      return outcome;
    } catch {
      return "unavailable";
    }
  }, []);

  const dismissInstall = useCallback(() => {
    setInstallDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const resetInstallDismissed = useCallback(() => {
    setInstallDismissed(false);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingServiceWorker) return;
    const handleControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange, {
      once: true,
    });
    waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    waitingServiceWorker = null;
    notifySubscribers();
  }, []);

  return {
    isInstalled,
    isIOS,
    isInstallable,
    installDismissed,
    updateAvailable,
    swReady,
    promptInstall,
    dismissInstall,
    resetInstallDismissed,
    applyUpdate,
  };
}
