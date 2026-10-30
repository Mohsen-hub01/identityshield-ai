import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Fingerprint,
  Globe2,
  Laptop,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { RiskTimeline } from "@/components/charts/RiskTimeline";
import { ProvenanceBadge } from "@/components/data/ProvenanceBadge";
import { RiskBadge, StatusBadge } from "@/components/data/RiskBadge";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIdentity } from "@/hooks/queries";
import { formatNumber } from "@/lib/utils";
import type { EventRecord } from "@/types/api";

function analysisHref(event: EventRecord) {
  const params = new URLSearchParams({
    user: event.user_id,
    country: event.country,
    hour: String(event.hour),
    failed: String(event.failed_attempts),
    ip: String(event.ip_risk_score),
    new_device: String(event.new_device),
    travel: String(event.impossible_travel),
  });
  return `/risk?${params.toString()}`;
}

export function IdentityDetailPage() {
  const { userId } = useParams();
  const query = useIdentity(userId);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <Link
          to="/identities"
          className="inline-flex items-center gap-1.5 text-xs text-mist transition-colors hover:text-cloud"
        >
          <ArrowLeft className="size-3.5" /> Back to identities
        </Link>
        <ErrorState
          title="Identity unavailable"
          message={
            query.error instanceof Error
              ? query.error.message
              : "This identity could not be loaded."
          }
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  const { identity, recent_events: events, dataset } = query.data;
  const latest = events[0];
  const copilotQuestion = `Explain the risk posture for ${identity.user_id}. Their home country is ${identity.home_country} and their recent maximum rule score is ${identity.risk_score}.`;

  return (
    <div className="space-y-6">
      <Link
        to="/identities"
        className="inline-flex items-center gap-1.5 text-xs text-mist transition-colors hover:text-cloud"
      >
        <ArrowLeft className="size-3.5" /> Back to identities
      </Link>

      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Identity profile
            </Badge>
            <StatusBadge status={identity.status} />
            <ProvenanceBadge dataset={dataset} />
          </>
        }
        title={identity.user_id}
        description={`Synthetic identity profile. Home country ${identity.home_country}, usual access hour ${identity.usual_hour}:00. Posture reflects the most recent 12 records.`}
        actions={
          <>
            <Link
              to={`/copilot?q=${encodeURIComponent(copilotQuestion)}`}
              className={buttonStyles("secondary", "md")}
            >
              <Sparkles className="size-4" /> Ask Copilot
            </Link>
            {latest ? (
              <Link to={analysisHref(latest)} className={buttonStyles("primary", "md")}>
                <ScanSearch className="size-4" /> Analyze latest event
              </Link>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Recent max risk",
            value: identity.risk_score,
            icon: ShieldAlert,
            tone: identity.risk_score >= 70 ? "danger" : identity.risk_score >= 30 ? "warning" : "success",
            hint: `${identity.recent_high_risk_count} high-risk records in the recent window`,
          },
          {
            label: "Recorded events",
            value: identity.event_count,
            icon: Fingerprint,
            tone: "cyan",
            hint: `${formatNumber(identity.suspicious_count)} labeled suspicious`,
          },
          {
            label: "New devices",
            value: identity.new_device_count,
            icon: Laptop,
            tone: "blue",
            hint: "Events flagged with a new device indicator",
          },
          {
            label: "Impossible travel",
            value: identity.impossible_travel_count,
            icon: Globe2,
            tone: "warning",
            hint: "Events carrying an impossible-travel flag",
          },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
                  {item.label}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-cloud">
                  {formatNumber(item.value)}
                </p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                <item.icon className="size-4 text-shield-cyan" />
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-mist">{item.hint}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader
            title="Risk trend"
            subtitle="Rule risk score across the most recent recorded events."
            icon={<TriangleAlert className="size-4" />}
            action={<Badge tone="muted">{identity.risk_series.length} points</Badge>}
          />
          <div className="px-2 pb-4 pt-4">
            <RiskTimeline values={identity.risk_series} height={220} />
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader
            title="Profile facts"
            subtitle="Data available in the synthetic profile and event set."
            icon={<Fingerprint className="size-4" />}
          />
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[11px] text-mist">
                <Globe2 className="size-3.5" /> Home country
              </span>
              <span className="text-xs font-medium text-cloud">
                {identity.home_country}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[11px] text-mist">
                <Clock className="size-3.5" /> Usual hour
              </span>
              <span className="font-mono text-xs text-cloud">
                {identity.usual_hour}:00
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[11px] text-mist">
                <TriangleAlert className="size-3.5" /> Average failures
              </span>
              <span className="font-mono text-xs text-cloud">
                {identity.average_failed_attempts.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[11px] text-mist">
                <ShieldAlert className="size-3.5" /> Historical max
              </span>
              <span className="font-mono text-xs text-cloud">
                {identity.historical_max_risk_score}
              </span>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <Progress
                value={identity.risk_score}
                tone={
                  identity.risk_score >= 70
                    ? "danger"
                    : identity.risk_score >= 30
                      ? "warning"
                      : "success"
                }
                label="Recent max risk score"
              />
            </div>
            <p className="text-[10px] leading-4 text-mist/70">
              A single HIGH historical event does not automatically make an
              identity critical. Posture is based on the recent window.
            </p>
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Recent authentication records"
          subtitle="Each record can be re-run through the rule engine, ML model and SHAP explainer."
          icon={<ScanSearch className="size-4" />}
          action={
            <span className="text-[10px] text-mist">
              Newest first · {events.length} shown
            </span>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.16em] text-mist">
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-3 py-3 font-semibold">Location</th>
                <th className="px-3 py-3 font-semibold">Hour</th>
                <th className="px-3 py-3 font-semibold">Failures</th>
                <th className="px-3 py-3 font-semibold">IP risk</th>
                <th className="px-3 py-3 font-semibold">Signals</th>
                <th className="px-3 py-3 font-semibold">Risk</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.event_id}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3 font-mono text-[10px] text-mist">
                    {event.event_id}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-cloud">
                    {event.country}
                    {event.country_unusual ? (
                      <span className="ml-1.5 text-warning">foreign</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-mist">
                    {event.hour}:00
                    {event.hour_unusual ? (
                      <span className="ml-1 text-warning">unusual</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-mist">
                    {event.failed_attempts}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-mist">
                    {event.ip_risk_score.toFixed(0)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {event.new_device ? <Badge tone="muted">New device</Badge> : null}
                      {event.impossible_travel ? (
                        <Badge tone="danger">Travel</Badge>
                      ) : null}
                      {!event.new_device && !event.impossible_travel ? (
                        <span className="text-[10px] text-mist/60">None</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-cloud">
                        {event.risk_score}
                      </span>
                      <RiskBadge level={event.risk_level} />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={analysisHref(event)}
                      className={buttonStyles("outline", "sm")}
                    >
                      Analyze
                      <ArrowUpRight className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
