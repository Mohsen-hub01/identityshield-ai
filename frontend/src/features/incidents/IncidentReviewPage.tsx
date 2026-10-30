import {
  CheckCircle2,
  ClipboardCheck,
  History,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShapBars } from "@/components/charts/ShapBars";
import { RiskBadge } from "@/components/data/RiskBadge";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useReviewAudit, useReviewMutation } from "@/hooks/queries";
import { useAuth } from "@/services/auth/AuthContext";
import { canAnalyze } from "@/services/auth/session";
import {
  removePendingReview,
  usePendingReviews,
} from "@/store/pendingReviews";
import {
  cn,
  formatDateTime,
  formatPercent,
} from "@/lib/utils";
import type { PendingReview, ReviewResponse } from "@/types/api";

type Decision = "confirm_suspicious" | "mark_legitimate";

function decisionLabel(decision: Decision) {
  return decision === "confirm_suspicious"
    ? "Confirm suspicious"
    : "Mark legitimate";
}

export function IncidentReviewPage() {
  const { session } = useAuth();
  const allowed = canAnalyze(session?.user.role);
  const pending = usePendingReviews();
  const audit = useReviewAudit(allowed);
  const mutation = useReviewMutation();
  const [tab, setTab] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastResult, setLastResult] = useState<ReviewResponse | null>(null);

  useEffect(() => {
    if (!pending.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !pending.some((item) => item.analysisId === selectedId)) {
      setSelectedId(pending[0].analysisId);
    }
  }, [pending, selectedId]);

  const selected = useMemo(
    () => pending.find((item) => item.analysisId === selectedId) ?? null,
    [pending, selectedId],
  );
  const history = audit.data?.items ?? [];

  const openDecision = (value: Decision) => {
    setDecision(value);
    setComment("");
    mutation.reset();
    setDialogOpen(true);
  };

  const confirmDecision = () => {
    if (!selected || !decision) return;
    mutation.mutate(
      {
        analysisId: selected.analysisId,
        decision,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: (response) => {
          removePendingReview(selected.analysisId);
          setLastResult(response);
          setDialogOpen(false);
          setDecision(null);
          setComment("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Human-in-the-loop
            </Badge>
            <Badge tone="muted">Analyst decision required</Badge>
          </>
        }
        title="Review the evidence before the workflow moves."
        description="HIGH-risk analyses pause the LangGraph workflow. Decisions submitted here resume the real backend process and write to the local review audit log."
        actions={
          <Link to="/risk" className={buttonStyles("secondary", "md")}>
            <ShieldAlert className="size-4" /> New analysis
          </Link>
        }
      />

      {!allowed ? (
        <div className="rounded-xl border border-warning/15 bg-warning/[0.04] px-4 py-3 text-[11px] leading-5 text-warning/90">
          Review decisions and the audit log require an analyst or administrator
          role. You can still inspect the interface in read-only mode.
        </div>
      ) : null}

      {lastResult ? (
        <div className="flex flex-col gap-3 rounded-xl border border-success/20 bg-success/[0.045] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            <div>
              <p className="text-xs font-medium text-cloud">
                Review submitted for {lastResult.user_id}
              </p>
              <p className="mt-1 text-[10px] text-mist">
                {decisionLabel(lastResult.review_decision)} ·{" "}
                {lastResult.recommended_action} · reviewed by{" "}
                {lastResult.reviewed_by}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLastResult(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            value: "pending",
            label: "Pending review",
            count: pending.length,
            icon: <ClipboardCheck className="size-3.5" />,
          },
          {
            value: "history",
            label: "Decision history",
            count: history.length,
            icon: <History className="size-3.5" />,
          },
        ]}
      />

      {tab === "pending" ? (
        pending.length ? (
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="space-y-2 xl:col-span-4">
              {pending.map((item) => (
                <button
                  key={item.analysisId}
                  type="button"
                  onClick={() => setSelectedId(item.analysisId)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    item.analysisId === selectedId
                      ? "border-shield-cyan/25 bg-shield-cyan/[0.055]"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-cloud">
                      {item.result.user_id}
                    </span>
                    <RiskBadge level={item.result.risk_level} />
                  </div>
                  <p className="mt-1.5 font-mono text-[9px] text-mist">
                    {item.result.analysis_id}
                  </p>
                  <p className="mt-1 text-[9px] text-mist/70">
                    Queued {formatDateTime(item.createdAt)}
                  </p>
                </button>
              ))}
            </div>
            {selected ? (
              <PendingDetail
                item={selected}
                allowed={allowed}
                onDecision={openDecision}
              />
            ) : null}
          </div>
        ) : (
          <Card className="p-5">
            <EmptyState
              icon={<ShieldCheck className="size-5" />}
              title="No pending reviews"
              description="Run a HIGH-risk analysis from Risk Analysis. If the backend pauses the workflow, the analysis appears in this local session queue."
              action={
                <Link to="/risk" className={buttonStyles("primary", "sm")}>
                  Run a risk analysis
                </Link>
              }
            />
          </Card>
        )
      ) : allowed ? (
        <Card>
          <CardHeader
            title="Decision history"
            subtitle="Audit records written by the backend to reports/human_review_audit.jsonl."
            icon={<History className="size-4" />}
            action={
              <Badge tone="muted">{history.length} records</Badge>
            }
          />
          {audit.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : audit.isError ? (
            <div className="p-4">
              <ErrorState
                message={
                  audit.error instanceof Error
                    ? audit.error.message
                    : "Unable to load the review audit."
                }
                onRetry={() => audit.refetch()}
              />
            </div>
          ) : history.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.16em] text-mist">
                    <th className="px-5 py-3 font-semibold">Timestamp</th>
                    <th className="px-3 py-3 font-semibold">Identity</th>
                    <th className="px-3 py-3 font-semibold">Risk</th>
                    <th className="px-3 py-3 font-semibold">Decision</th>
                    <th className="px-3 py-3 font-semibold">Action</th>
                    <th className="px-3 py-3 font-semibold">Reviewer</th>
                    <th className="px-5 py-3 font-semibold">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr
                      key={`${record.analysis_id}-${record.timestamp}`}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3 text-[10px] text-mist">
                        {formatDateTime(record.timestamp)}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-cloud">
                        {record.user_id}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-cloud">
                            {record.risk_score}
                          </span>
                          <RiskBadge level={record.risk_level} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          tone={
                            record.review_decision === "confirm_suspicious"
                              ? "danger"
                              : "success"
                          }
                        >
                          {record.review_decision === "confirm_suspicious"
                            ? "Suspicious"
                            : "Legitimate"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-mono text-[10px] text-mist">
                        {record.recommended_action}
                      </td>
                      <td className="px-3 py-3 text-[10px] text-mist">
                        {record.reviewer ?? "Not recorded"}
                      </td>
                      <td className="max-w-[240px] truncate px-5 py-3 text-[10px] text-mist">
                        {record.comment || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<History className="size-5" />}
                title="No decisions recorded"
                description="The audit log is empty. Complete a pending review to create the first record."
              />
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <EmptyState
            icon={<UserRound className="size-5" />}
            title="Audit access is restricted"
            description="The review audit is available to analysts and administrators. Ask an administrator to adjust your role if you need access."
          />
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (mutation.isPending) return;
          setDialogOpen(false);
        }}
        title={
          decision === "confirm_suspicious"
            ? "Confirm suspicious activity"
            : "Mark event as legitimate"
        }
        description={
          selected
            ? `${selected.result.user_id} · rule score ${selected.result.risk_score} · ${selected.result.risk_level}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={decision === "confirm_suspicious" ? "danger" : "primary"}
              loading={mutation.isPending}
              onClick={confirmDecision}
              leftIcon={
                decision === "confirm_suspicious" ? (
                  <ShieldAlert className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )
              }
            >
              {decision ? decisionLabel(decision) : "Submit decision"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-warning/15 bg-warning/[0.035] px-3 py-2.5 text-[10px] leading-5 text-warning/85">
            This decision resumes the real LangGraph workflow and writes an audit
            record. It does not directly block an account or revoke a session.
          </div>
          <div>
            <label
              htmlFor="review-comment"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-mist"
            >
              Reviewer comment (optional)
            </label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              placeholder="Record the rationale, supporting evidence and remaining uncertainty…"
            />
            <p className="mt-1.5 text-[10px] text-mist/65">
              Sent to the backend review endpoint and stored in the local audit log.
            </p>
          </div>
          {mutation.isError ? (
            <ErrorState
              title="Decision not submitted"
              message={
                mutation.error instanceof Error
                  ? mutation.error.message
                  : "The /review request failed."
              }
            />
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}

function PendingDetail({
  item,
  allowed,
  onDecision,
}: {
  item: PendingReview;
  allowed: boolean;
  onDecision: (decision: Decision) => void;
}) {
  const { result, event } = item;
  const topFactors = result.ml_analysis.explanations.slice(0, 4);

  return (
    <Card strong className="xl:col-span-8">
      <CardHeader
        title={`${result.user_id} · human review`}
        subtitle="The workflow is paused. Inspect rule evidence, model output and SHAP contributions before deciding."
        icon={<ClipboardCheck className="size-4" />}
        action={<RiskBadge level={result.risk_level} />}
      />
      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Rule score", value: result.risk_score },
            {
              label: "ML probability",
              value: formatPercent(result.ml_analysis.suspect_probability, 1),
            },
            {
              label: "Threshold",
              value: result.ml_analysis.decision_threshold.toFixed(2),
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mist">
                {metric.label}
              </p>
              <p className="mt-1.5 font-display text-xl font-semibold tracking-[-0.03em] text-cloud">
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">
            Event context
          </h3>
          <div className="grid gap-2 text-[11px] text-mist sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span>Country</span>
              <span className="text-cloud">{event.country}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span>Hour</span>
              <span className="font-mono text-cloud">{event.hour}:00</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span>Failed attempts</span>
              <span className="font-mono text-cloud">{event.failed_attempts}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span>IP risk</span>
              <span className="font-mono text-cloud">{event.ip_risk_score}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">
            Rule evidence
          </h3>
          <div className="space-y-1.5">
            {result.reasons.map((reason) => (
              <p
                key={reason}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-5 text-mist"
              >
                {reason}
              </p>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">
            Top SHAP factors
          </h3>
          <ShapBars explanations={topFactors} limit={4} />
        </div>

        {allowed ? (
          <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="secondary"
              leftIcon={<ShieldCheck className="size-4" />}
              onClick={() => onDecision("mark_legitimate")}
            >
              Mark legitimate
            </Button>
            <Button
              variant="danger"
              leftIcon={<ShieldAlert className="size-4" />}
              onClick={() => onDecision("confirm_suspicious")}
            >
              Confirm suspicious
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-warning/15 bg-warning/[0.035] px-3 py-2 text-[10px] text-warning/90">
            Read-only role. Review decisions require analyst or administrator access.
          </p>
        )}
      </div>
    </Card>
  );
}
