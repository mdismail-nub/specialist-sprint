import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { BarChart3, BookOpen, Home, ListChecks, Map, Settings, Swords, Trophy } from "lucide-react";
import { useData } from "@/lib/cp/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/log", label: "Daily Log", icon: BookOpen },
  { to: "/roadmap", label: "Roadmap", icon: Map },
  { to: "/problems", label: "Problems", icon: ListChecks },
  { to: "/contests", label: "Contests", icon: Trophy },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
const MOBILE_BOTTOM = ["/", "/log", "/roadmap", "/analytics"];
const MOBILE_TOP = ["/problems", "/contests", "/settings"];

function useTheme() {
  const { theme } = useData().settings;
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

export function AppShell({ children }: { children: ReactNode }) {
  useTheme();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const data = useData();
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Swords className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">CP Tracker</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive(to) ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive(to) && "text-primary")} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <div className="num">
            {data.settings.currentRating} → {data.settings.targetRating}
          </div>
          <div>Codeforces rating</div>
        </div>
      </aside>

      <div className="md:pl-56">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <Swords className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight">CP Tracker</span>
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">
            {NAV.find((n) => isActive(n.to))?.label}
          </div>
          <div className="flex items-center gap-1">
            {data.isSample && (
              <Link to="/settings" className="mr-1 rounded-md border border-warning/40 px-2 py-0.5 text-xs text-warning">
                Sample data
              </Link>
            )}
            {NAV.filter((n) => MOBILE_TOP.includes(n.to)).map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={cn("rounded-md p-2 md:hidden", isActive(to) ? "bg-accent text-primary" : "text-muted-foreground")}
              >
                <Icon className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((n) => MOBILE_BOTTOM.includes(n.to)).map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", isActive(to) ? "font-medium text-primary" : "text-muted-foreground")}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
