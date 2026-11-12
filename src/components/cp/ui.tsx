import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EditorialLabel({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "dark" | "lime";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.12em] uppercase",
        tone === "dark"
          ? "text-ivory/75"
          : tone === "lime"
            ? "text-charcoal"
            : "text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-2 w-2 rounded-[3px]",
          tone === "lime" ? "bg-charcoal" : "bg-lime border border-charcoal/20",
        )}
      />
      <span>{children}</span>
    </div>
  );
}

export function WavyDivider({ className }: { className?: string }) {
  return (
    <div className={cn("my-6 overflow-hidden py-1 select-none", className)} aria-hidden="true">
      <svg
        viewBox="0 0 1200 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-full text-charcoal/20 dark:text-ivory/20"
        preserveAspectRatio="none"
      >
        <path
          d="M0 12C20 2 40 2 60 12C80 22 100 22 120 12C140 2 160 2 180 12C200 22 220 22 240 12C260 2 280 2 300 12C320 22 340 22 360 12C380 2 400 2 420 12C440 22 460 22 480 12C500 2 520 2 540 12C560 22 580 22 600 12C620 2 640 2 660 12C680 22 700 22 720 12C740 2 760 2 780 12C800 22 820 22 840 12C860 2 880 2 900 12C920 22 940 22 960 12C980 2 1000 2 1020 12C1040 22 1060 22 1080 12C1100 2 1120 2 1140 12C1160 22 1180 22 1200 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export type BentoSurface = "ivory" | "white" | "sage" | "charcoal" | "lime";

const SURFACE_STYLES: Record<BentoSurface, string> = {
  ivory: "bg-ivory text-foreground border border-charcoal/10",
  white: "bg-surface-white text-foreground border border-charcoal/10",
  sage: "bg-sage text-charcoal border border-charcoal/10 dark:text-foreground",
  charcoal: "bg-charcoal text-ivory border border-charcoal",
  lime: "bg-lime text-charcoal border border-charcoal/15",
};

export function BentoCard({
  surface = "ivory",
  kicker,
  title,
  action,
  children,
  className,
  contentClassName,
}: {
  surface?: BentoSurface;
  kicker?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const labelTone = surface === "charcoal" ? "dark" : surface === "lime" ? "lime" : "default";
  return (
    <section
      className={cn(
        "relative flex flex-col justify-between rounded-[26px] p-5 sm:p-6 transition-colors",
        SURFACE_STYLES[surface],
        className,
      )}
    >
      {(kicker || title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {kicker && <EditorialLabel tone={labelTone}>{kicker}</EditorialLabel>}
            {title && (
              <h2
                className={cn(
                  "font-heading text-lg font-bold tracking-tight sm:text-xl",
                  kicker && "mt-1",
                )}
              >
                {title}
              </h2>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("flex-1", contentClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker?: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-charcoal/10 pb-5">
      <div className="max-w-2xl">
        {kicker && <EditorialLabel className="mb-2">{kicker}</EditorialLabel>}
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-4xl text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm sm:text-base text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

export function Section({
  title,
  kicker,
  action,
  surface = "ivory",
  children,
  className,
}: {
  title?: string;
  kicker?: string;
  action?: ReactNode;
  surface?: BentoSurface;
  children: ReactNode;
  className?: string;
}) {
  return (
    <BentoCard
      surface={surface}
      kicker={kicker}
      title={title}
      action={action}
      className={className}
    >
      {children}
    </BentoCard>
  );
}

export function Stat({
  label,
  value,
  hint,
  surface = "ivory",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  surface?: BentoSurface;
}) {
  return (
    <div className={cn("rounded-2xl p-4", SURFACE_STYLES[surface])}>
      <div
        className={cn(
          "text-xs font-medium",
          surface === "charcoal" ? "text-ivory/70" : "text-muted-foreground",
        )}
      >
        {label}
      </div>
      <div className="num font-heading mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            "mt-1 text-xs",
            surface === "charcoal" ? "text-ivory/60" : "text-muted-foreground",
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

export function Progress({
  value,
  tone = "lime",
  className,
}: {
  value: number;
  tone?: "primary" | "success" | "lime" | "charcoal";
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-3 w-full overflow-hidden rounded-full bg-charcoal/10 p-0.5", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          tone === "lime"
            ? "bg-lime"
            : tone === "charcoal"
              ? "bg-charcoal"
              : tone === "success"
                ? "bg-sage-deep"
                : "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-charcoal/20 bg-ivory/60 px-6 py-12 text-center">
      <div className="font-heading text-base font-bold">{title}</div>
      {children && <div className="mt-1.5 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-foreground/80">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-coral">{error}</span>}
    </label>
  );
}

export function Confirm({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-3xl bg-ivory border-charcoal/15">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }), "rounded-full")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const STATUS_LABEL = {
  independent: "Independent",
  hint: "With hint",
  editorial: "After editorial",
  unclassified: "Imported · Classify",
  unsolved: "Unsolved",
  resolved: "Re-solved",
} as const;

export function StatusIndicator({ status }: { status: keyof typeof STATUS_LABEL }) {
  const dotTone =
    status === "independent"
      ? "bg-lime border-charcoal/30"
      : status === "resolved"
        ? "bg-sage-deep border-charcoal/20"
        : status === "unsolved"
          ? "bg-coral border-charcoal/20"
          : status === "unclassified"
            ? "bg-sage border-charcoal/30"
            : "bg-warm-yellow border-charcoal/20";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-foreground">
      <span className={cn("h-2.5 w-2.5 rounded-[3px] border shrink-0", dotTone)} />
      <span>{STATUS_LABEL[status]}</span>
    </span>
  );
}

export const StatusBadge = StatusIndicator;

export const selectCls =
  "h-10 w-full rounded-xl border border-charcoal/15 bg-surface-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-charcoal/30 dark:bg-card";
