let hydratedOnClient = false;

export function markDatesClientHydrated(): void {
  hydratedOnClient = true;
}

export function isDatesClientHydrated(): boolean {
  return hydratedOnClient;
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toUTCISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ssrTodayISO(): string {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-ssr-today");
    if (attr && /^\d{4}-\d{2}-\d{2}$/.test(attr)) {
      return attr;
    }
  }
  return toUTCISO(new Date());
}

export function fromISO(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  if (typeof window === "undefined" || !hydratedOnClient) {
    return ssrTodayISO();
  }
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000);
}

export function formatDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
) {
  return fromISO(iso).toLocaleDateString("en-US", opts);
}
