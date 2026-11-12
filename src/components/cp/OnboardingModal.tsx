import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { actions, useData, useHydrated } from "@/lib/cp/store";
import { fetchCodeforcesAccount, type CodeforcesSyncPayload } from "@/lib/cp/codeforces";
import { todayISO } from "@/lib/cp/dates";
import { EditorialLabel, Field } from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OnboardingModal() {
  const hydrated = useHydrated({ isShell: true });
  const data = useData({ isShell: true });
  const today = todayISO();

  const [cfHandle, setCfHandle] = useState(data.settings.cfHandle || "");
  const [name, setName] = useState(data.settings.name || "");
  const [startRating, setStartRating] = useState(
    data.settings.startRating > 0 ? String(data.settings.startRating) : "",
  );
  const [targetRating, setTargetRating] = useState(String(data.settings.targetRating || 1400));
  const [startDate, setStartDate] = useState(data.settings.startDate || today);
  const [duration, setDuration] = useState(String(data.settings.duration || 60));
  const [dailyMinutes, setDailyMinutes] = useState(String(data.settings.dailyMinutes || 180));
  const [dailyProblems, setDailyProblems] = useState(String(data.settings.dailyProblems || 3));

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedPayload, setVerifiedPayload] = useState<CodeforcesSyncPayload | null>(null);

  useEffect(() => {
    if (hydrated && !data.onboarded) {
      setStartDate(todayISO());
    }
  }, [hydrated, data.onboarded]);

  if (!hydrated || data.onboarded) {
    return null;
  }

  const verifyHandle = async () => {
    const clean = cfHandle.trim();
    if (!clean) {
      setVerifyError("Enter your Codeforces handle first, or skip to use manual tracking.");
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const payload = await fetchCodeforcesAccount(clean);
      setVerifiedPayload(payload);
      setCfHandle(payload.profile.handle);
      if (!name.trim()) {
        setName(payload.profile.handle);
      }
      setStartRating(String(payload.profile.rating));
      toast.success(
        `Connected @${payload.profile.handle} (${payload.profile.uniqueSolvedCount} solved problems, ${payload.profile.contestsCount} contests)`,
      );
    } catch (err) {
      setVerifiedPayload(null);
      setVerifyError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  const finishOnboarding = async (skipCF = false) => {
    const parsedStartRating = startRating.trim() ? Number(startRating.trim()) : 0;
    const parsedTarget = Number(targetRating) || 1400;
    const parsedDuration = Math.min(365, Math.max(7, Number(duration) || 60));
    const parsedMinutes = Math.min(1440, Math.max(15, Number(dailyMinutes) || 180));
    const parsedProblems = Math.min(30, Math.max(1, Number(dailyProblems) || 3));

    if (parsedStartRating < 0 || parsedStartRating > 4000) {
      toast.error("Starting rating must be between 0 and 4000.");
      return;
    }

    let payloadToUse = skipCF ? undefined : (verifiedPayload ?? undefined);
    const trimmedHandle = skipCF ? "" : cfHandle.trim();

    if (!skipCF && trimmedHandle && !payloadToUse) {
      setVerifying(true);
      setVerifyError(null);
      try {
        payloadToUse = await fetchCodeforcesAccount(trimmedHandle);
      } catch (err) {
        setVerifying(false);
        setVerifyError(
          `${(err as Error).message} You can fix the handle or click "Skip Codeforces & Use Manual Tracking".`,
        );
        return;
      }
      setVerifying(false);
    }

    const effectiveCurrentRating = payloadToUse ? payloadToUse.profile.rating : parsedStartRating;
    const effectiveStartRating =
      parsedStartRating > 0 ? parsedStartRating : payloadToUse ? payloadToUse.profile.rating : 0;

    actions.completeOnboarding(
      {
        name: name.trim() || trimmedHandle || "",
        cfHandle: payloadToUse ? payloadToUse.profile.handle : trimmedHandle,
        startRating: effectiveStartRating,
        currentRating: effectiveCurrentRating,
        targetRating: parsedTarget,
        startDate: startDate || today,
        duration: parsedDuration,
        dailyMinutes: parsedMinutes,
        dailyProblems: parsedProblems,
      },
      payloadToUse,
    );

    toast.success("Your CP Tracker workspace is ready!");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-charcoal/70 p-4 backdrop-blur-sm"
    >
      <div className="my-auto w-full max-w-2xl overflow-hidden rounded-[30px] border border-charcoal/20 bg-ivory shadow-2xl">
        {/* Top Editorial Banner */}
        <div className="border-b border-charcoal/10 bg-sage/55 px-6 py-6 sm:px-8">
          <EditorialLabel>FIRST-TIME WORKSPACE SETUP</EditorialLabel>
          <h1
            id="onboarding-title"
            className="font-heading mt-2 text-2xl font-bold tracking-tight text-charcoal sm:text-3xl"
          >
            Configure your{" "}
            <span className="font-serif-editorial italic font-normal">
              personal training ground.
            </span>
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-charcoal/80">
            Connect your Codeforces handle to import your real rating history and solved problems,
            or start with a clean manual tracker.
          </p>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void finishOnboarding(false);
          }}
          className="space-y-5 p-6 sm:p-8"
        >
          {/* Step 1: Codeforces Handle Integration */}
          <div className="rounded-2xl border border-charcoal/12 bg-surface-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
                  01 · CODEFORCES API INTEGRATION (OPTIONAL)
                </div>
                <div className="font-heading text-sm font-bold text-foreground">
                  Connect your Codeforces Handle
                </div>
              </div>
              {verifiedPayload && (
                <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-0.5 font-mono text-[11px] font-bold text-charcoal border border-charcoal/20">
                  <CheckCircle2 className="h-3 w-3" /> Verified @{verifiedPayload.profile.handle}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="e.g. tourist, Benq, or your Codeforces handle"
                value={cfHandle}
                onChange={(e) => {
                  setCfHandle(e.target.value);
                  setVerifiedPayload(null);
                  setVerifyError(null);
                }}
                className="bg-ivory/60 font-mono"
              />
              <Button
                type="button"
                variant="outline"
                disabled={verifying}
                onClick={() => void verifyHandle()}
                className="rounded-xl shrink-0 bg-charcoal text-ivory hover:bg-charcoal/90 hover:text-lime border-charcoal"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" /> Fetch from Codeforces
                  </>
                )}
              </Button>
            </div>

            {verifyError && (
              <p className="mt-2 rounded-xl border border-coral/35 bg-coral/10 px-3 py-2 text-xs font-medium text-charcoal">
                {verifyError}
              </p>
            )}

            {verifiedPayload && (
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-ivory p-3 font-mono text-xs sm:grid-cols-4 border border-charcoal/10">
                <div>
                  <span className="block text-[10px] text-muted-foreground">CURRENT RATING</span>
                  <span className="font-bold text-foreground">
                    {verifiedPayload.profile.rating} ({verifiedPayload.profile.rank})
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">MAX RATING</span>
                  <span className="font-bold text-foreground">
                    {verifiedPayload.profile.maxRating}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">CONTESTS</span>
                  <span className="font-bold text-foreground">
                    {verifiedPayload.profile.contestsCount} rated
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">UNIQUE SOLVED</span>
                  <span className="font-bold text-foreground">
                    {verifiedPayload.profile.uniqueSolvedCount} problems
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Challenge Parameters */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Starting Codeforces Rating">
              <Input
                inputMode="numeric"
                placeholder="Enter rating (e.g. 0 or 800)"
                value={startRating}
                onChange={(e) => setStartRating(e.target.value.replace(/\D/g, ""))}
                className="bg-surface-white num font-mono"
              />
            </Field>
            <Field label="Target Rating (Default 1400)">
              <Input
                inputMode="numeric"
                value={targetRating}
                onChange={(e) => setTargetRating(e.target.value.replace(/\D/g, ""))}
                className="bg-surface-white num font-mono"
              />
            </Field>
            <Field label="Challenge Start Date">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-surface-white font-mono"
              />
            </Field>
            <Field label="Duration (Days)">
              <Input
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
                className="bg-surface-white num font-mono"
              />
            </Field>
            <Field label="Daily Study Goal (Minutes)">
              <Input
                inputMode="numeric"
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(e.target.value.replace(/\D/g, ""))}
                className="bg-surface-white num font-mono"
              />
            </Field>
            <Field label="Daily Problem Target">
              <Input
                inputMode="numeric"
                value={dailyProblems}
                onChange={(e) => setDailyProblems(e.target.value.replace(/\D/g, ""))}
                className="bg-surface-white num font-mono"
              />
            </Field>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-charcoal/10 pt-4 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={verifying}
              onClick={() => void finishOnboarding(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-charcoal/20 bg-surface-white px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-cream"
            >
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Skip Codeforces &amp; Use Manual Tracking</span>
            </button>

            <Button
              type="submit"
              disabled={verifying}
              className="rounded-full bg-charcoal px-6 py-2.5 text-xs font-semibold text-ivory hover:bg-charcoal/90"
            >
              <span>Start My Training Challenge</span>
              <ArrowRight className="h-3.5 w-3.5 text-lime" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
