import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { HeatmapCell, RatingPoint } from "@/lib/cp/stats";
import { formatDuration } from "@/lib/cp/stats";
import { formatDate, todayISO } from "@/lib/cp/dates";
import { cn } from "@/lib/utils";

const INTENSITY_BG: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-warm-gray/80 border-charcoal/8 text-muted-foreground",
  1: "bg-sage-soft border-charcoal/15 text-charcoal",
  2: "bg-sage border-charcoal/20 text-charcoal",
  3: "bg-sage-deep border-charcoal/25 text-ivory",
  4: "bg-lime border-charcoal/35 text-charcoal font-bold shadow-[0_1px_0_rgba(37,35,30,0.2)]",
};

export function ActivityHeatmap60({
  cells,
  compact = false,
}: {
  cells: HeatmapCell[];
  compact?: boolean;
}) {
  const defaultCell =
    cells.find((c) => c.isToday) ??
    [...cells].reverse().find((c) => c.solved > 0 || c.minutes > 0) ??
    cells[0];
  const [active, setActive] = useState<HeatmapCell | undefined>(defaultCell);

  const selected = active ?? defaultCell;
  const activeCount = cells.filter((c) => c.solved > 0 || c.minutes > 0).length;
  const completedCount = cells.filter((c) => c.completed).length;
  const today = todayISO();

  return (
    <div className="space-y-4">
      {activeCount === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-charcoal/20 bg-surface-white/80 px-4 py-3 text-xs">
          <div>
            <span className="font-heading font-bold text-foreground">
              Your training journey starts here.
            </span>{" "}
            <span className="text-muted-foreground">
              Log your first practice session or sync your Codeforces submissions to light up your
              60-day grid.
            </span>
          </div>
          <Link
            to="/log"
            search={{ date: today }}
            className="inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1.5 font-mono text-[11px] font-semibold text-lime hover:bg-charcoal/90"
          >
            <span>Start today&apos;s session</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Grid of 60 days — 15 columns on desktop (4 rows of 15 = 60), 10 on tablet/mobile */}
      <div
        className={cn(
          "grid gap-1.5 sm:gap-2",
          compact ? "grid-cols-10 sm:grid-cols-15" : "grid-cols-10 sm:grid-cols-12 md:grid-cols-15",
        )}
      >
        {cells.map((cell) => {
          const isSelected = selected?.day === cell.day;
          return (
            <button
              key={cell.day}
              type="button"
              onMouseEnter={() => setActive(cell)}
              onFocus={() => setActive(cell)}
              onClick={() => setActive(cell)}
              aria-label={`Day ${cell.day}, ${formatDate(cell.date)}: ${cell.solved} problems solved, ${formatDuration(cell.minutes)}`}
              className={cn(
                "group relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[10px] font-mono transition-transform duration-150 focus:outline-none",
                INTENSITY_BG[cell.intensity],
                cell.isToday &&
                  "ring-2 ring-charcoal dark:ring-lime ring-offset-1 ring-offset-ivory",
                isSelected && "scale-105 z-10 ring-2 ring-charcoal",
              )}
            >
              <span className="num leading-none opacity-85">{cell.day}</span>
              {cell.completed && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 h-1 w-1 rounded-full",
                    cell.intensity === 3 ? "bg-lime" : "bg-charcoal",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Interactive Day Inspector & Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream/70 dark:bg-charcoal/50 px-3.5 py-2.5 text-xs border border-charcoal/8">
        {selected ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono font-semibold text-foreground">
              Day {String(selected.day).padStart(2, "0")}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="text-muted-foreground">
              {formatDate(selected.date, { month: "short", day: "numeric" })}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="num font-semibold text-foreground">
              {selected.solved} {selected.solved === 1 ? "problem" : "problems"}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="num font-mono text-muted-foreground">
              {formatDuration(selected.minutes)}
            </span>
            {selected.topic && (
              <>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <span className="font-medium text-foreground/85 truncate max-w-[180px] sm:max-w-[240px]">
                  {selected.topic}
                </span>
              </>
            )}
            <Link
              to="/log"
              search={{ date: selected.date }}
              className="ml-1 font-mono text-[11px] font-semibold text-foreground underline underline-offset-4 hover:text-charcoal/70"
            >
              {selected.solved > 0 || selected.minutes > 0 ? "View log" : "Log day"}
            </Link>
          </div>
        ) : (
          <span className="text-muted-foreground">Hover or tap any day to inspect activity</span>
        )}

        <div className="flex items-center gap-3 ml-auto">
          <span className="hidden sm:inline text-[11px] text-muted-foreground num">
            {activeCount} active · {completedCount} target met
          </span>
          <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <span>Less</span>
            <span className="h-3 w-3 rounded-[4px] bg-warm-gray border border-charcoal/10" />
            <span className="h-3 w-3 rounded-[4px] bg-sage-soft border border-charcoal/15" />
            <span className="h-3 w-3 rounded-[4px] bg-sage border border-charcoal/20" />
            <span className="h-3 w-3 rounded-[4px] bg-sage-deep border border-charcoal/25" />
            <span className="h-3 w-3 rounded-[4px] bg-lime border border-charcoal/35" />
            <span>Peak</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RatingProgressionChart({
  points,
  targetRating,
  height = 220,
}: {
  points: RatingPoint[];
  targetRating: number;
  height?: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number>(Math.max(0, points.length - 1));

  if (points.length === 0) {
    return (
      <div
        style={{ minHeight: height }}
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal/20 bg-ivory/65 px-5 py-8 text-center"
      >
        <div className="font-heading text-sm font-bold text-foreground">
          No rating history available yet.
        </div>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Connect your Codeforces account to see your rating journey, or log a rated contest
          manually.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-3.5 py-1.5 font-mono text-[11px] font-semibold text-lime hover:bg-charcoal/90"
          >
            <span>Connect Codeforces</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <Link
            to="/contests"
            className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-surface-white px-3.5 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:bg-ivory"
          >
            <span>Log Contest</span>
          </Link>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(activeIndex, Math.max(0, points.length - 1));
  const activePoint = points[safeIndex] ?? points.at(-1);

  const ratings = points.map((p) => p.rating);
  const minR = Math.min(...ratings, 500);
  const maxR = Math.max(...ratings, targetRating);
  const yMin = Math.max(0, Math.floor((minR - 60) / 100) * 100);
  const yMax = Math.ceil((maxR + 80) / 100) * 100;
  const range = Math.max(100, yMax - yMin);

  const W = 560;
  const H = 190;
  const padL = 42;
  const padR = 20;
  const padT = 26;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const toX = (i: number) =>
    points.length <= 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW;
  const toY = (r: number) => padT + plotH - ((r - yMin) / range) * plotH;

  const coords = points.map((p, i) => ({
    ...p,
    x: toX(i),
    y: toY(p.rating),
    shortDate: formatDate(p.date, { month: "short", day: "numeric" }),
  }));

  const linePath = coords.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = arr[i - 1]!;
    const cx1 = prev.x + (pt.x - prev.x) * 0.45;
    const cx2 = prev.x + (pt.x - prev.x) * 0.55;
    return `${acc} C ${cx1.toFixed(1)} ${prev.y.toFixed(1)}, ${cx2.toFixed(1)} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const baselineY = padT + plotH;
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords.at(-1)!.x.toFixed(1)} ${baselineY.toFixed(1)} L ${coords[0]!.x.toFixed(1)} ${baselineY.toFixed(1)} Z`
      : "";

  const yTicks = [
    yMin,
    Math.round((yMin + (yMax - yMin) * 0.35) / 50) * 50,
    Math.round((yMin + (yMax - yMin) * 0.7) / 50) * 50,
    targetRating,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const targetY = toY(targetRating);

  return (
    <div className="space-y-2.5">
      <div
        style={{ height }}
        className="relative w-full rounded-2xl border border-charcoal/8 bg-ivory/65 p-2"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label="Rating progression chart"
        >
          <defs>
            <linearGradient id="cpAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D9F45A" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#D9F45A" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => {
            const y = toY(tick);
            const isGoal = tick === targetRating;
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke={isGoal ? "#7E947C" : "rgba(37,35,30,0.09)"}
                  strokeWidth={isGoal ? 1.5 : 1}
                  strokeDasharray={isGoal ? "5 4" : "3 3"}
                />
                <text
                  x={padL - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-[10px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <text
            x={W - padR - 4}
            y={targetY - 5}
            textAnchor="end"
            className="fill-sage-deep font-mono text-[9px] font-semibold uppercase"
          >
            Specialist {targetRating}
          </text>

          {areaPath && <path d={areaPath} fill="url(#cpAreaGrad)" />}

          {coords.map((pt, i) => (
            <line
              key={`drop-${pt.date}-${i}`}
              x1={pt.x}
              y1={pt.y}
              x2={pt.x}
              y2={baselineY}
              stroke="rgba(37,35,30,0.14)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          ))}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#25231E"
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {coords.map((pt, i) => {
            const isSelected = i === safeIndex;
            const calloutX = Math.min(Math.max(pt.x, padL + 36), W - padR - 36);
            const calloutY = Math.max(pt.y - 22, 14);
            return (
              <g
                key={`${pt.date}-${i}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => setActiveIndex(i)}
              >
                <text
                  x={pt.x}
                  y={H - 5}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono text-[10px]"
                >
                  {pt.shortDate}
                </text>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6.5 : 4.5}
                  fill={isSelected ? "#25231E" : "#D9F45A"}
                  stroke="#25231E"
                  strokeWidth={2.25}
                />
                {isSelected && <circle cx={pt.x} cy={pt.y} r={2.5} fill="#D9F45A" />}
                {isSelected && (
                  <g transform={`translate(${calloutX}, ${calloutY})`}>
                    <rect x={-34} y={-11} width={68} height={20} rx={10} fill="#25231E" />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor="middle"
                      className="fill-lime font-mono text-[10px] font-bold"
                    >
                      {pt.rating} {pt.delta > 0 ? `+${pt.delta}` : pt.delta < 0 ? pt.delta : ""}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-[2px] bg-lime border border-charcoal/30" />
            <span className="font-medium text-foreground">{activePoint.label}</span>
            <span>·</span>
            <span className="font-mono">
              {formatDate(activePoint.date, { month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="num font-mono font-semibold text-foreground">
            Rating {activePoint.rating}{" "}
            {activePoint.delta !== 0 && (
              <span className={activePoint.delta > 0 ? "text-sage-deep" : "text-coral"}>
                ({activePoint.delta > 0 ? `+${activePoint.delta}` : activePoint.delta})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
