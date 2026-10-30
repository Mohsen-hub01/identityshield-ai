import {
  Activity,
  ArrowUpRight,
  Database,
  Fingerprint,
  Info,
  Radar,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ActivityArea } from "@/components/charts/ActivityArea";
import { CountryBars } from "@/components/charts/CountryBars";
import { RiskDonut } from "@/components/charts/RiskDonut";
import { MetricCard } from "@/components/data/MetricCard";
import { ProvenanceBadge } from "@/components/data/ProvenanceBadge";
import { RiskBadge, StatusBadge } from "@/components/data/RiskBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useOverview } from "@/hooks/queries";
import {
  cn,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatTime,
} from "@/lib/utils";

const insightStyles = {
  critical: {
    icon: Siren,
    className: "border-danger/15 bg-danger/[0.035]",
    iconClass: "text-danger",
  },
  warning: {
    icon: TriangleAlert,
    className: "border-warning/15 bg-warning/[0.03]",
    iconClass: "text-warning",
  },
  info: {
    icon: Info,
    className: "border-shield-cyan/12 bg-shield-cyan/[0.025]",
    iconClass: "text-shield-cyan",
  },
  success: {
    icon: ShieldCheck,
    className: "border-success/15 bg-success/[0.03]",
    iconClass: "text-success",
  },
};

export function DashboardPage() {
  const overview = useOverview();

  if (overview.isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="shimmer h-3 w-40 rounded" />
          <div className="shimmer h-9 w-72 rounded-lg" />
          <div className="shimmer h-3 w-[28rem] max-w-full rounded" />
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <SkeletonCard key={item} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-12">
          <SkeletonCard className="xl:col-span-5" />
          <SkeletonCard className="xl:col-span-7" />
        </div>
      </div>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <ErrorState
        message={
          overview.error instanceof Error
            ? overview.error.message
            : "The overview endpoint did not return data."
        }
        onRetry={() => overview.refetch()}
      />
    );
  }

  const data = overview.data;
  const counts = data.counts;
  const posturePercent = data.posture.low_risk_share * 100;
  const model = data.model;
  const recall = model.recall ?? 0;
  const precision = model.precision ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Security command center
            </Badge>
            <ProvenanceBadge dataset={data.dataset} />
          </>
        }
        title="Identity risk, in one operational view."
        description="A snapshot of synthetic authentication records, rule-based risk posture, model behavior and investigations that may need human review."
        meta={
          <span className="inline-flex items-center gap-2 text-[10px] text-mist">
            <span className="size-1.5 rounded-full bg-success" />
            Snapshot generated {formatDateTime(data.generated_at)}
          </span>
        }
        actions={
          <>
            <Link
              to="/copilot"
              className={buttonStyles("secondary", "md")}
            >
              <Sparkles className="size-4" />
              Ask Copilot
            </Link>
            <Link to="/risk" className={buttonStyles("primary", "md")}>
              <ScanSearch className="size-4" />
              Run analysis
            </Link>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-12">
        <Card strong className="relative overflow-hidden xl:col-span-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,217,255,0.11),transparent_55%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-shield-cyan/80">
                  Current posture
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <span className="font-display text-6xl font-semibold leading-none tracking-[-0.06em] text-cloud">
                    {posturePercent.toFixed(0)}
                    <span className="ml-1 text-2xl text-mist">%</span>
                  </span>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-cloud">
                      {data.posture.label}
                    </p>
                    <p className="mt-1 max-w-xs text-[11px] leading-5 text-mist">
                      {data.posture.note}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex size-12 items-center justify-center rounded-2xl border border-shield-cyan/20 bg-shield-cyan/[0.055] text-shield-cyan ring-glow">
                <Radar className="size-6" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Identities",
                  value: formatNumber(counts.identities),
                  hint: "Synthetic profiles",
                },
                {
                  label: "Events",
                  value: formatNumber(counts.events),
                  hint: "Analyzed records",
                },
                {
                  label: "High risk",
                  value: formatNumber(counts.high_risk_events),
                  hint: "Rule engine",
                },
                {
                  label: "Critical",
                  value: formatNumber(counts.critical_identities),
                  hint: "Recent window",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/[0.07] bg-ink-950/35 p-3"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-mist">
                    {item.label}
                  </p>
                  <p className="mt-1.5 font-display text-xl font-semibold tracking-[-0.03em] text-cloud">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[9px] text-mist/70">{item.hint}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/risk" className={buttonStyles("primary", "sm")}>
                Investigate an access event
                <ArrowUpRight className="size-3.5" />
              </Link>
              <Link
                to="/incidents"
                className={buttonStyles("ghost", "sm")}
              >
                <ShieldAlert className="size-3.5" />
                Open review queue
              </Link>
              <span className="text-[10px] text-mist/60">
                Data refresh {formatTime(data.generated_at)}
              </span>
            </div>
          </div>
        </Card>

        <Card
          strong
          className="relative flex min-h-[360px] flex-col justify-between overflow-hidden p-5 sm:p-6 xl:col-span-5"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,217,255,0.10),transparent_58%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-shield-cyan/80">
                Dataset snapshot
              </p>
              <p className="mt-1 text-[11px] text-mist">
                Synthetic identity landscape
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl border border-shield-cyan/20 bg-shield-cyan/[0.055] text-shield-cyan">
              <Fingerprint className="size-5" />
            </span>
          </div>

          <div className="relative my-6 flex items-center justify-center">
            <div
              aria-hidden="true"
              className="absolute size-48 rounded-full border border-shield-cyan/10 sm:size-52"
            />
            <div
              aria-hidden="true"
              className="absolute size-36 rounded-full border border-shield-blue/20"
            />
            <div className="relative flex size-28 flex-col items-center justify-center rounded-full border border-shield-cyan/20 bg-ink-950/70 shadow-[0_0_54px_-24px_rgba(0,217,255,0.65)]">
              <span className="font-display text-3xl font-semibold tracking-[-0.05em] text-cloud">
                {formatNumber(counts.identities)}
              </span>
              <span className="mt-1 text-[9px] uppercase tracking-[0.16em] text-mist">
                identities
              </span>
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-2">
            {[
              {
                label: "Access events",
                value: counts.events,
                icon: Activity,
                tone: "text-shield-cyan",
              },
              {
                label: "Critical identities",
                value: counts.critical_identities,
                icon: ShieldAlert,
                tone: "text-danger",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.07] bg-ink-950/45 p-3"
              >
                <div className="flex items-center gap-2">
                  <item.icon className={cn("size-3.5", item.tone)} />
                  <p className="text-[9px] uppercase tracking-[0.12em] text-mist">
                    {item.label}
                  </p>
                </div>
                <p className="mt-2 font-display text-xl font-semibold text-cloud">
                  {formatNumber(item.value)}
                </p>
              </div>
            ))}
          </div>

          <div className="relative mt-4 flex items-center justify-between gap-3 text-[9px] text-mist/65">
            <span>Generated {formatTime(data.generated_at)}</span>
            <Link
              to="/threats"
              className="inline-flex items-center gap-1 text-shield-cyan hover:text-shield-teal"
            >
              Explore relationships
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Monitored identities"
          value={formatNumber(counts.identities)}
          hint={
            <p className="text-[10px] leading-4 text-mist">
              {formatNumber(counts.critical_identities)} critical ·{" "}
              {formatNumber(counts.elevated_identities)} elevated
            </p>
          }
          icon={<Users className="size-4" />}
          tone="cyan"
          progress={100 - (counts.critical_identities / Math.max(counts.identities, 1)) * 100}
        />
        <MetricCard
          label="Authentication events"
          value={formatNumber(counts.events)}
          hint={
            <p className="text-[10px] leading-4 text-mist">
              Synthetic records across 24 hours
            </p>
          }
          icon={<Activity className="size-4" />}
          tone="blue"
          progress={100}
        />
        <MetricCard
          label="Labeled suspicious"
          value={formatNumber(counts.suspicious_events)}
          hint={
            <p className="text-[10px] leading-4 text-mist">
              {formatPercent(counts.suspicious_events / Math.max(counts.events, 1))} of the
              research dataset
            </p>
          }
          icon={<ShieldAlert className="size-4" />}
          tone="warning"
          progress={(counts.suspicious_events / Math.max(counts.events, 1)) * 100}
        />
        <MetricCard
          label="High-risk signals"
          value={formatNumber(counts.high_risk_events)}
          hint={
            <p className="text-[10px] leading-4 text-mist">
              {formatPercent(counts.high_risk_events / Math.max(counts.events, 1))} of events
              reach HIGH
            </p>
          }
          icon={<Siren className="size-4" />}
          tone="danger"
          progress={(counts.high_risk_events / Math.max(counts.events, 1)) * 100}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader
            title="Risk distribution"
            subtitle="Rule-based classification across all synthetic events."
            icon={<Fingerprint className="size-4" />}
          />
          <div className="p-5">
            <RiskDonut data={data.risk_distribution} />
          </div>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader
            title="Detection activity by hour"
            subtitle="Event volume and dataset labels across the 24-hour clock."
            icon={<Activity className="size-4" />}
            action={
              <Link
                to="/analytics"
                className="text-[10px] font-medium text-shield-cyan hover:text-shield-teal"
              >
                Open analytics
              </Link>
            }
          />
          <div className="px-2 pb-4 pt-3">
            <ActivityArea data={data.hourly_activity} height={250} />
          </div>
          <div className="flex items-center gap-4 border-t border-white/[0.06] px-5 py-3 text-[10px] text-mist">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-shield-cyan" /> All events
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-danger" /> Labeled suspicious
            </span>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Priority incidents"
            subtitle="Highest rule-risk events in the dataset. Prioritization only — not proof of compromise."
            icon={<ShieldAlert className="size-4" />}
            action={
              <Link
                to="/identities"
                className="text-[10px] font-medium text-shield-cyan hover:text-shield-teal"
              >
                View identities
              </Link>
            }
          />
          {data.priority_incidents.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.16em] text-mist">
                    <th className="px-5 py-3 font-semibold">Identity</th>
                    <th className="px-3 py-3 font-semibold">Signal</th>
                    <th className="px-3 py-3 font-semibold">Location</th>
                    <th className="px-3 py-3 font-semibold">Event</th>
                    <th className="px-5 py-3 text-right font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {data.priority_incidents.map((event) => (
                    <tr
                      key={event.event_id}
                      className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-3">
                        <Link
                          to={`/identities/${event.user_id}`}
                          className="text-xs font-medium text-cloud hover:text-shield-cyan"
                        >
                          {event.user_id}
                        </Link>
                        <p className="mt-0.5 text-[10px] text-mist">
                          Home {event.home_country}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {event.impossible_travel ? (
                            <Badge tone="danger">Impossible travel</Badge>
                          ) : null}
                          {event.country_unusual ? (
                            <Badge tone="warning">Foreign country</Badge>
                          ) : null}
                          {event.failed_attempts >= 3 ? (
                            <Badge tone="warning">
                              {event.failed_attempts} failures
                            </Badge>
                          ) : null}
                          {!event.impossible_travel &&
                          !event.country_unusual &&
                          event.failed_attempts < 3 ? (
                            <Badge tone="muted">Time anomaly</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-mist">
                        {event.country}
                        <span className="ml-1 text-mist/50">· {event.hour}:00</span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[10px] text-mist">
                        {event.event_id}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RiskBadge level={event.risk_level} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="No priority incidents"
                description="No HIGH-risk events are present in the current dataset."
              />
            </div>
          )}
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            title="Deterministic insights"
            subtitle="Computed from dataset counts and rule thresholds. Not generated by an LLM."
            icon={<Sparkles className="size-4" />}
          />
          <div className="space-y-2.5 p-4">
            {data.insights.map((insight) => {
              const style = insightStyles[insight.tone];
              const Icon = style.icon;
              return (
                <div
                  key={insight.title}
                  className={cn(
                    "rounded-xl border p-3",
                    style.className,
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon
                      className={cn("mt-0.5 size-3.5 shrink-0", style.iconClass)}
                    />
                    <div>
                      <p className="text-[11px] font-medium leading-4 text-cloud">
                        {insight.title}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-mist">
                        {insight.detail}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-white/[0.06] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">
                Model status
              </span>
              <Badge tone="cyan">{model.name}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Precision", value: precision },
                { label: "Recall", value: recall },
                { label: "F1", value: model.f1 ?? 0 },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-center"
                >
                  <p className="font-mono text-[13px] text-cloud">
                    {formatPercent(metric.value, 1)}
                  </p>
                  <p className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-mist">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-mist/70">
              Decision threshold {model.threshold?.toFixed(2) ?? "—"} on a{" "}
              {formatNumber(model.test_size)}-event held-out synthetic test set.
            </p>
            <Link
              to="/analytics"
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-shield-cyan hover:text-shield-teal"
            >
              Review model metrics
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <CardHeader
            title="Authentication geography"
            subtitle="Top countries by event volume, with HIGH-risk overlay."
            icon={<Database className="size-4" />}
          />
          <div className="px-2 pb-4 pt-4">
            <CountryBars data={data.country_activity.slice(0, 8)} />
          </div>
        </Card>

        <Card className="xl:col-span-6">
          <CardHeader
            title="Identity watchlist"
            subtitle="Ranked by recent risk signal, not by historical maximum alone."
            icon={<Users className="size-4" />}
            action={
              <Link
                to="/identities"
                className="text-[10px] font-medium text-shield-cyan hover:text-shield-teal"
              >
                Full directory
              </Link>
            }
          />
          <div className="divide-y divide-white/[0.05]">
            {data.top_identities.map((identity) => (
              <Link
                key={identity.user_id}
                to={`/identities/${identity.user_id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.025]"
              >
                <span className="flex size-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-[10px] font-semibold uppercase text-mist">
                  {identity.user_id.replace("user_", "").slice(-2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-cloud">
                      {identity.user_id}
                    </span>
                    <StatusBadge status={identity.status} />
                  </span>
                  <span className="mt-0.5 block text-[10px] text-mist">
                    {identity.home_country} · {identity.event_count} events ·{" "}
                    {identity.recent_high_risk_count} recent high-risk
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-display text-sm font-semibold text-cloud">
                    {identity.risk_score}
                  </span>
                  <span className="block text-[8px] uppercase tracking-[0.12em] text-mist">
                    recent max
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[10px] leading-4 text-mist/65">
        <span className="inline-flex items-center gap-2">
          <Database className="size-3.5 text-shield-cyan/70" />
          Source: {data.dataset.source} · profiles: {data.dataset.profiles}
        </span>
        <span>{data.dataset.note}</span>
      </div>
    </div>
  );
}
