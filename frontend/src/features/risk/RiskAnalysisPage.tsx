import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Gauge,
  GitBranch,
  LoaderCircle,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { ShapBars } from "@/components/charts/ShapBars";
import { ProvenanceBadge } from "@/components/data/ProvenanceBadge";
import { RiskBadge } from "@/components/data/RiskBadge";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Hint, Input, Label, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAnalyzeMutation, useProfiles } from "@/hooks/queries";
import { addPendingReview } from "@/store/pendingReviews";
import { useAuth } from "@/services/auth/AuthContext";
import { canAnalyze } from "@/services/auth/session";
import { cn, formatDateTime, formatPercent } from "@/lib/utils";
import type { AccessEventFormValues } from "@/types/forms";
import type { AccessEventInput, AnalyzeResponse } from "@/types/api";

function toInput(values: AccessEventFormValues): AccessEventInput {
  return {
    user_id: values.user_id,
    country: values.country,
    hour: Number(values.hour),
    failed_attempts: Number(values.failed_attempts || 0),
    new_device: values.new_device ? 1 : 0,
    ip_risk_score: Number(values.ip_risk_score || 0),
    impossible_travel: values.impossible_travel ? 1 : 0,
  };
}

function actionMeta(action: string) {
  if (action === "NO_ESCALATION") {
    return { tone: "success" as const, label: "No escalation", icon: ShieldCheck };
  }
  if (action === "HUMAN_REVIEW_REQUIRED") {
    return { tone: "warning" as const, label: "Human review required", icon: Clock3 };
  }
  if (action === "ESCALATE_AS_SUSPICIOUS") {
    return { tone: "danger" as const, label: "Escalate as suspicious", icon: ShieldAlert };
  }
  return { tone: "success" as const, label: "Close as legitimate", icon: CheckCircle2 };
}

function ResultPanel({
  result,
  onReset,
}: {
  result: AnalyzeResponse;
  onReset: () => void;
}) {
  const action = actionMeta(result.recommended_action);
  const ActionIcon = action.icon;
  const awaiting = result.status === "awaiting_human_review";
  const probability = result.ml_analysis.suspect_probability;
  const threshold = result.ml_analysis.decision_threshold;

  return (
    <div className="space-y-4">
      <Card strong className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <RiskGauge value={result.risk_score} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={action.tone} dot>
                {action.label}
              </Badge>
              <Badge tone={result.ml_analysis.prediction === "SUSPECT" ? "danger" : "success"}>
                ML {result.ml_analysis.prediction}
              </Badge>
              {awaiting ? <Badge tone="warning">Workflow paused</Badge> : null}
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold tracking-[-0.03em] text-cloud">
              {result.risk_level} rule risk for {result.user_id}
            </h2>
            <p className="mt-1 text-[11px] text-mist">
              Evaluated {formatDateTime(result.evaluated_at)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ActionIcon
                className={cn(
                  "size-4",
                  action.tone === "danger"
                    ? "text-danger"
                    : action.tone === "warning"
                      ? "text-warning"
                      : "text-success",
                )}
              />
              <span className="text-xs text-mist">
                Recommended action{" "}
                <span className="font-mono text-cloud">{result.recommended_action}</span>
              </span>
            </div>
            {result.analysis_id ? (
              <p className="mt-3 break-all rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 font-mono text-[10px] text-mist">
                analysis_id {result.analysis_id}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onReset} className="self-start">
            New analysis
          </Button>
        </div>
        {awaiting ? (
          <div className="flex flex-col gap-3 border-t border-warning/15 bg-warning/[0.035] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-[11px] leading-5 text-warning/90">
                The LangGraph workflow stopped for human review. The analysis is
                stored in your local session queue and still requires a reviewer
                decision on the backend.
              </p>
            </div>
            <Link to="/incidents" className={buttonStyles("secondary", "sm")}>
              Open incident review
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Rule evidence"
            subtitle="Deterministic signals from the project rule engine."
            icon={<GitBranch className="size-4" />}
          />
          <div className="space-y-2.5 p-4">
            {result.reasons.map((reason) => (
              <div
                key={reason}
                className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                <p className="text-[11px] leading-5 text-mist">{reason}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Model decision"
            subtitle="Logistic regression probability compared with the configured threshold."
            icon={<Gauge className="size-4" />}
            action={
              <Badge
                tone={result.ml_analysis.prediction === "SUSPECT" ? "danger" : "success"}
              >
                {result.ml_analysis.prediction}
              </Badge>
            }
          />
          <div className="space-y-5 p-5">
            <div>
              <div className="flex items-end justify-between gap-3">
                <span className="font-display text-3xl font-semibold tracking-[-0.05em] text-cloud">
                  {formatPercent(probability, 1)}
                </span>
                <span className="text-[10px] text-mist">
                  threshold {formatPercent(threshold, 0)}
                </span>
              </div>
              <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    probability >= threshold
                      ? "bg-gradient-to-r from-warning to-danger"
                      : "bg-gradient-to-r from-success to-shield-teal",
                  )}
                  style={{ width: `${probability * 100}%` }}
                />
                <span
                  className="absolute inset-y-0 w-px bg-cloud/70"
                  style={{ left: `${threshold * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] leading-4 text-mist/70">
                A probability is not a certainty. Human review routing uses the
                rule-based HIGH level, not the ML prediction alone.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-3 text-[10px]">
                <span className="text-mist">Decision threshold</span>
                <span className="font-mono text-cloud">
                  {result.ml_analysis.decision_threshold.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
                <span className="text-mist">Model</span>
                <span className="font-mono text-cloud">LogisticRegression</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="SHAP contributions"
          subtitle="Feature effects on the model output. SHAP values are not probabilities."
          icon={<Sparkles className="size-4" />}
          action={
            <Badge tone="muted">
              {result.ml_analysis.explanations.length} factors
            </Badge>
          }
        />
        <div className="p-5">
          <ShapBars explanations={result.ml_analysis.explanations} />
        </div>
      </Card>

      <div className="rounded-xl border border-warning/15 bg-warning/[0.035] px-4 py-3 text-[10px] leading-5 text-warning/85">
        {result.disclaimer}
      </div>
    </div>
  );
}

export function RiskAnalysisPage() {
  const [searchParams] = useSearchParams();
  const profiles = useProfiles();
  const mutation = useAnalyzeMutation();
  const { session } = useAuth();
  const allowed = canAnalyze(session?.user.role);

  const [values, setValues] = useState<AccessEventFormValues>(() => ({
    user_id: searchParams.get("user") ?? "",
    country: searchParams.get("country") ?? "",
    hour: searchParams.get("hour") ?? "",
    failed_attempts: searchParams.get("failed") ?? "0",
    new_device: searchParams.get("new_device") === "1",
    ip_risk_score: searchParams.get("ip") ?? "0",
    impossible_travel: searchParams.get("travel") === "1",
  }));
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const profileEntries = useMemo(
    () => Object.entries(profiles.data?.profiles ?? {}),
    [profiles.data],
  );
  const selectedProfile = profiles.data?.profiles[values.user_id];

  useEffect(() => {
    if (!profileEntries.length) return;
    setValues((current) => {
      if (current.user_id && profiles.data?.profiles[current.user_id]) {
        if (current.country && current.hour) return current;
        const profile = profiles.data.profiles[current.user_id];
        return {
          ...current,
          country: current.country || profile.home_country,
          hour: current.hour || String(profile.usual_hour),
        };
      }
      const [firstId, firstProfile] = profileEntries[0];
      return {
        ...current,
        user_id: firstId,
        country: current.country || firstProfile.home_country,
        hour: current.hour || String(firstProfile.usual_hour),
      };
    });
  }, [profileEntries, profiles.data]);

  const update = <K extends keyof AccessEventFormValues>(
    key: K,
    value: AccessEventFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const onUserChange = (userId: string) => {
    const profile = profiles.data?.profiles[userId];
    setValues((current) => ({
      ...current,
      user_id: userId,
      country: profile?.home_country ?? current.country,
      hour: profile ? String(profile.usual_hour) : current.hour,
    }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!allowed) return;
    const input = toInput(values);
    mutation.mutate(input, {
      onSuccess: (data) => {
        setResult(data);
        if (data.status === "awaiting_human_review" && data.analysis_id) {
          addPendingReview({
            analysisId: data.analysis_id,
            createdAt: new Date().toISOString(),
            result: data,
            event: input,
          });
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Explainable analysis
            </Badge>
            <ProvenanceBadge />
          </>
        }
        title="Trace a risk score from signal to decision."
        description="Run an access event through the deterministic rule engine, Logistic Regression model and SHAP explainer. High rule risk pauses the LangGraph workflow for human review."
        actions={
          <Link to="/incidents" className={buttonStyles("secondary", "md")}>
            <ShieldAlert className="size-4" /> Review queue
          </Link>
        }
      />

      {!allowed ? (
        <div className="rounded-xl border border-warning/15 bg-warning/[0.04] px-4 py-3 text-[11px] leading-5 text-warning/90">
          Your role is read-only. Viewers can inspect identities and analytics but
          cannot submit analyses or review decisions.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader
            title="Access event"
            subtitle="Fields map directly to the existing /analyze request contract."
            icon={<ScanSearch className="size-4" />}
          />
          <form onSubmit={onSubmit} className="space-y-4 p-5">
            <div>
              <Label htmlFor="risk-user">Identity</Label>
              <Select
                id="risk-user"
                value={values.user_id}
                onChange={(event) => onUserChange(event.target.value)}
                disabled={!allowed || profiles.isLoading}
                required
              >
                {!profileEntries.length ? (
                  <option value="">Loading profiles…</option>
                ) : null}
                {profileEntries.map(([userId]) => (
                  <option key={userId} value={userId}>
                    {userId}
                  </option>
                ))}
              </Select>
              <Hint>
                {selectedProfile
                  ? `Home ${selectedProfile.home_country} · usual hour ${selectedProfile.usual_hour}:00`
                  : "Synthetic identity profile"}
              </Hint>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="risk-country">Connection country</Label>
                <Input
                  id="risk-country"
                  value={values.country}
                  onChange={(event) => update("country", event.target.value)}
                  disabled={!allowed}
                  required
                />
              </div>
              <div>
                <Label htmlFor="risk-hour">Connection hour</Label>
                <Input
                  id="risk-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={values.hour}
                  onChange={(event) => update("hour", event.target.value)}
                  disabled={!allowed}
                  required
                />
              </div>
              <div>
                <Label htmlFor="risk-failed">Failed attempts</Label>
                <Input
                  id="risk-failed"
                  type="number"
                  min={0}
                  max={100}
                  value={values.failed_attempts}
                  onChange={(event) => update("failed_attempts", event.target.value)}
                  disabled={!allowed}
                />
              </div>
              <div>
                <Label htmlFor="risk-ip">IP risk score</Label>
                <Input
                  id="risk-ip"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={values.ip_risk_score}
                  onChange={(event) => update("ip_risk_score", event.target.value)}
                  disabled={!allowed}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
                <span className="inline-flex items-center gap-2 text-[11px] text-mist">
                  <Fingerprint className="size-3.5" /> New device
                </span>
                <input
                  type="checkbox"
                  checked={values.new_device}
                  onChange={(event) => update("new_device", event.target.checked)}
                  disabled={!allowed}
                  className="size-4 accent-[#00d9ff]"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
                <span className="inline-flex items-center gap-2 text-[11px] text-mist">
                  <GitBranch className="size-3.5" /> Impossible travel
                </span>
                <input
                  type="checkbox"
                  checked={values.impossible_travel}
                  onChange={(event) =>
                    update("impossible_travel", event.target.checked)
                  }
                  disabled={!allowed}
                  className="size-4 accent-[#00d9ff]"
                />
              </label>
            </div>

            <Button
              type="submit"
              className="w-full"
              loading={mutation.isPending}
              disabled={!allowed || !values.user_id || !values.country || !values.hour}
              leftIcon={<ScanSearch className="size-4" />}
            >
              Run identity risk analysis
            </Button>
            <p className="text-center text-[10px] leading-4 text-mist/65">
              Requests execute on the FastAPI backend. No client-side risk score is
              fabricated.
            </p>
          </form>
        </Card>

        <div className="xl:col-span-7">
          {mutation.isPending ? (
            <Card className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
              <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl border border-shield-cyan/20 bg-shield-cyan/[0.05]">
                <LoaderCircle className="size-7 animate-spin text-shield-cyan" />
                <span className="absolute inset-0 rounded-2xl border border-shield-cyan/20 pulse-dot" />
              </div>
              <h3 className="font-display text-sm font-semibold text-cloud">
                Running the backend workflow
              </h3>
              <p className="mt-2 max-w-sm text-xs leading-5 text-mist">
                Rule evaluation, ML prediction, SHAP explanation and LangGraph
                routing execute in one request. The visual state reflects the
                actual pending request.
              </p>
              <div className="mt-6 flex items-center gap-2 text-[10px] text-mist/60">
                <span className="size-1.5 rounded-full bg-shield-cyan pulse-dot" />
                Waiting for /analyze
              </div>
            </Card>
          ) : mutation.isError ? (
            <ErrorState
              title="Analysis failed"
              message={
                mutation.error instanceof Error
                  ? mutation.error.message
                  : "The /analyze request did not complete."
              }
              onRetry={() => mutation.reset()}
            />
          ) : result ? (
            <ResultPanel result={result} onReset={() => { setResult(null); mutation.reset(); }} />
          ) : (
            <Card className="min-h-[420px]">
              <CardHeader
                title="Analysis output"
                subtitle="The explainable result appears here after a real backend response."
                icon={<Gauge className="size-4" />}
              />
              <div className="p-5">
                <EmptyState
                  icon={<ScanSearch className="size-5" />}
                  title="No analysis yet"
                  description="Choose a synthetic identity, describe the access event and run the analysis. The result will show rule reasons, model probability, SHAP contributions and the human-review outcome."
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: ShieldAlert, title: "Rule engine", text: "Score 0–100 and classification" },
                    { icon: Sparkles, title: "ML + SHAP", text: "Probability and feature effects" },
                    { icon: UserRound, title: "Human review", text: "Workflow pause for HIGH risk" },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <item.icon className="size-4 text-shield-cyan" />
                      <p className="mt-2 text-[11px] font-medium text-cloud">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-mist">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {profiles.isError ? (
        <ErrorState
          title="Profiles unavailable"
          message={
            profiles.error instanceof Error
              ? profiles.error.message
              : "Unable to load synthetic profiles."
          }
          onRetry={() => profiles.refetch()}
        />
      ) : null}

      {profiles.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-16 w-full" />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-[10px] text-mist/60">
        <RiskBadge level="LOW" />
        <span>0–29</span>
        <RiskBadge level="MEDIUM" />
        <span>30–69</span>
        <RiskBadge level="HIGH" />
        <span>70–100 · triggers human review</span>
      </div>
    </div>
  );
}
