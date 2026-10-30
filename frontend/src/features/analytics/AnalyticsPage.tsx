import {
  Activity,
  BarChart3,
  Braces,
  ChartNoAxesCombined,
  Cpu,
  Globe2,
  Gauge,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ActivityArea } from "@/components/charts/ActivityArea";
import { CountryBars } from "@/components/charts/CountryBars";
import { RiskDonut } from "@/components/charts/RiskDonut";
import { TrendChart } from "@/components/charts/TrendChart";
import { ProvenanceBadge } from "@/components/data/ProvenanceBadge";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Progress } from "@/components/ui/Progress";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAnalytics } from "@/hooks/queries";
import {
  cn,
  formatDateTime,
  formatNumber,
  formatPercent,
  titleCase,
} from "@/lib/utils";

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function metricValue(value: unknown): string {
  const number = numeric(value);
  if (number !== null) {
    if (Math.abs(number) <= 1 && number !== 0) return formatPercent(number, 1);
    return formatNumber(number);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "—";
  return String(value);
}

export function AnalyticsPage() {
  const analytics = useAnalytics();
  const data = analytics.data;

  const totals = useMemo(() => {
    const distribution = data?.risk_distribution ?? [];
    const total = distribution.reduce((sum, item) => sum + item.count, 0);
    const high = distribution.find((item) => item.level === "HIGH")?.count ?? 0;
    return { total, high, highShare: high / Math.max(total, 1) };
  }, [data]);

  const finalMetrics = data?.model.final_metrics ?? {};
  const selected = data?.model.selected ?? {};
  const selectedMetrics =
    (selected.validation_metrics as Record<string, unknown> | undefined) ?? {};
  const threshold = numeric(finalMetrics.threshold) ?? numeric(selected.selected_threshold);

  const thresholdRows = useMemo(() => {
    const rows = data?.model.threshold_validation ?? [];
    const current = threshold ?? 0.5;
    return rows
      .map((row) => ({
        row,
        threshold: numeric(row.threshold),
      }))
      .filter(
        (item) =>
          item.threshold !== null && Math.abs(item.threshold - current) <= 0.101,
      )
      .slice(0, 9);
  }, [data, threshold]);

  if (analytics.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard className="h-28" />
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-12">
          <SkeletonCard className="h-80 xl:col-span-5" />
          <SkeletonCard className="h-80 xl:col-span-7" />
        </div>
      </div>
    );
  }

  if (analytics.isError || !data) {
    return (
      <ErrorState
        message={
          analytics.error instanceof Error
            ? analytics.error.message
            : "The analytics endpoint did not return data."
        }
        onRetry={() => analytics.refetch()}
      />
    );
  }

  const baseCount = Math.max(
    ...data.failed_attempt_distribution.map((item) => item.events),
    1,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Analytics
            </Badge>
            <ProvenanceBadge dataset={data.dataset} />
          </>
        }
        title="Measure the signals behind every risk decision."
        description="Dataset-level distributions, the behavioural signals that drive rule scoring, and the validation evidence behind the selected model threshold."
        meta={
          <span className="inline-flex items-center gap-2 text-[10px] text-mist">
            <span className="size-1.5 rounded-full bg-success" />
            Snapshot generated {formatDateTime(data.generated_at)}
          </span>
        }
        actions={
          <Link to="/risk" className={buttonStyles("secondary", "md")}>
            <ScanLine className="size-4" />
            Run an analysis
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Analyzed events",
            value: formatNumber(totals.total),
            hint: "Synthetic authentication records",
            icon: Activity,
            tone: "text-shield-cyan",
          },
          {
            label: "High-risk share",
            value: formatPercent(totals.highShare, 1),
            hint: `${formatNumber(totals.high)} HIGH classifications`,
            icon: TriangleAlert,
            tone: "text-danger",
          },
          {
            label: "Impossible travel",
            value: formatPercent(data.signals.impossible_travel_share, 1),
            hint: "Share of all events",
            icon: Globe2,
            tone: "text-warning",
          },
          {
            label: "Average IP risk",
            value: data.signals.average_ip_risk.toFixed(1),
            hint: "Score out of 100",
            icon: Gauge,
            tone: "text-[#88aaff]",
          },
        ].map((item) => (
          <Card key={item.label} className="flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
              <item.icon className={cn("size-4", item.tone)} />
            </span>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
                {item.label}
              </p>
              <p className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-cloud">
                {item.value}
              </p>
              <p className="mt-0.5 text-[9px] text-mist/65">{item.hint}</p>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader
            title="Risk distribution"
            subtitle="Rule-based classification over the full synthetic dataset."
            icon={<ChartNoAxesCombined className="size-4" />}
          />
          <div className="p-5">
            <RiskDonut data={data.risk_distribution} />
          </div>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader
            title="Behavioural signal prevalence"
            subtitle="How often each signal appears across all events."
            icon={<SlidersHorizontal className="size-4" />}
          />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Progress
              label="New device"
              value={data.signals.new_device_share * 100}
              tone="warning"
            />
            <Progress
              label="Impossible travel"
              value={data.signals.impossible_travel_share * 100}
              tone="danger"
            />
            <Progress
              label="Foreign country"
              value={data.signals.foreign_country_share * 100}
              tone="blue"
            />
            <Progress
              label="Unusual hour"
              value={data.signals.unusual_hour_share * 100}
              tone="cyan"
            />
            <div className="sm:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium text-cloud">
                    Average IP risk score
                  </p>
                  <p className="mt-0.5 text-[9px] text-mist">
                    Synthetic network signal, not a reputation feed.
                  </p>
                </div>
                <span className="font-display text-2xl font-semibold text-cloud">
                  {data.signals.average_ip_risk.toFixed(1)}
                </span>
              </div>
              <Progress
                value={data.signals.average_ip_risk}
                tone="blue"
                className="mt-2"
              />
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Detection activity by hour"
            subtitle="All events and labeled suspicious records across the 24-hour clock."
            icon={<Activity className="size-4" />}
          />
          <div className="px-2 pb-4 pt-3">
            <ActivityArea data={data.hourly_activity} height={260} />
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            title="Failed-attempt distribution"
            subtitle="Events grouped by failed login count."
            icon={<BarChart3 className="size-4" />}
          />
          <div className="space-y-3 p-5">
            {data.failed_attempt_distribution.map((item) => (
              <div key={item.bucket}>
                <div className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="text-mist">{item.bucket} failures</span>
                  <span className="font-mono text-cloud">
                    {formatNumber(item.events)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r",
                      item.bucket === "11+"
                        ? "from-danger to-[#ff7a95]"
                        : item.bucket === "6-10"
                          ? "from-warning to-[#ff8a5b]"
                          : item.bucket === "3-5"
                            ? "from-shield-cyan to-shield-teal"
                            : "from-shield-blue to-shield-cyan",
                    )}
                    style={{
                      width: `${Math.max(2, (item.events / baseCount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="border-t border-white/[0.06] pt-3 text-[9px] leading-4 text-mist/60">
              Rule scoring applies additional weight from three failed attempts
              onward.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Risk sequence over the dataset"
            subtitle="Suspicious and high-risk share in sequential event buckets."
            icon={<ChartNoAxesCombined className="size-4" />}
            action={<Badge tone="muted">{data.sequence_trend.length} buckets</Badge>}
          />
          <div className="px-2 pb-4 pt-4">
            {data.sequence_trend.length ? (
              <TrendChart data={data.sequence_trend} height={280} />
            ) : (
              <div className="p-4">
                <EmptyState
                  icon={<ChartNoAxesCombined className="size-5" />}
                  title="No sequence data"
                  description="The analytics endpoint returned no sequential event buckets."
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.06] px-5 py-3 text-[10px] text-mist">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-shield-cyan" /> Suspicious share
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-danger" /> High-risk share
            </span>
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            title="Authentication geography"
            subtitle="Top observed countries by event volume."
            icon={<Globe2 className="size-4" />}
          />
          <div className="px-2 pb-4 pt-4">
            <CountryBars data={data.country_activity.slice(0, 8)} />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader
            title="Model evaluation"
            subtitle="Held-out synthetic test set. Threshold selected on validation only."
            icon={<Cpu className="size-4" />}
            action={
              <Badge tone="cyan">
                {String(finalMetrics.model ?? selected.selected_model ?? "Model")}
              </Badge>
            }
          />
          <div className="grid gap-3 p-5 sm:grid-cols-4">
            {[
              { label: "Accuracy", value: finalMetrics.accuracy },
              { label: "Precision", value: finalMetrics.precision },
              { label: "Recall", value: finalMetrics.recall },
              { label: "F1", value: finalMetrics.f1 },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center"
              >
                <p className="font-display text-lg font-semibold text-cloud">
                  {metricValue(metric.value)}
                </p>
                <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-mist">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 border-t border-white/[0.06] p-5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-ink-950/30 p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
                Decision threshold
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-cloud">
                {threshold !== null ? threshold.toFixed(2) : "—"}
              </p>
              <p className="mt-1 text-[9px] leading-4 text-mist/65">
                {String(
                  selected.selection_method ??
                    "Threshold selected on validation data.",
                )}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-ink-950/30 p-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
                Test set
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-cloud">
                {formatNumber(numeric(finalMetrics.test_size) ?? 0)}
              </p>
              <p className="mt-1 text-[9px] leading-4 text-mist/65">
                {formatNumber(numeric(finalMetrics.test_positive_count) ?? 0)}{" "}
                labeled suspicious · average precision{" "}
                {metricValue(finalMetrics.average_precision)}
              </p>
            </div>
          </div>
          <div className="border-t border-white/[0.06] p-5">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
              Confusion matrix
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "True negative", value: finalMetrics.TN, tone: "text-success" },
                { label: "False positive", value: finalMetrics.FP, tone: "text-warning" },
                { label: "False negative", value: finalMetrics.FN, tone: "text-danger" },
                { label: "True positive", value: finalMetrics.TP, tone: "text-shield-cyan" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-center"
                >
                  <p className={cn("font-mono text-sm", item.tone)}>
                    {metricValue(item.value)}
                  </p>
                  <p className="mt-1 text-[8px] uppercase tracking-[0.1em] text-mist">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p className="border-t border-white/[0.06] px-5 py-3 text-[9px] leading-4 text-mist/60">
            Metrics describe a synthetic research dataset. They are not evidence
            of production detection performance.
          </p>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader
            title="Threshold validation sweep"
            subtitle="Validation metrics near the selected operating point."
            icon={<Braces className="size-4" />}
          />
          {thresholdRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.14em] text-mist">
                    <th className="px-5 py-2.5 font-semibold">Threshold</th>
                    <th className="px-3 py-2.5 font-semibold">Precision</th>
                    <th className="px-3 py-2.5 font-semibold">Recall</th>
                    <th className="px-5 py-2.5 text-right font-semibold">F1</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholdRows.map(({ row, threshold: rowThreshold }) => {
                    const active =
                      threshold !== null &&
                      Math.abs((rowThreshold ?? 0) - threshold) < 0.001;
                    return (
                      <tr
                        key={`${rowThreshold}-${String(row.f1)}`}
                        className={cn(
                          "border-b border-white/[0.04] last:border-0",
                          active && "bg-shield-cyan/[0.055]",
                        )}
                      >
                        <td className="px-5 py-2.5">
                          <span
                            className={cn(
                              "font-mono text-[10px]",
                              active ? "text-shield-cyan" : "text-cloud",
                            )}
                          >
                            {(rowThreshold ?? 0).toFixed(2)}
                          </span>
                          {active ? (
                            <span className="ml-2 text-[8px] uppercase tracking-[0.12em] text-shield-cyan/70">
                              selected
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-mist">
                          {metricValue(row.precision)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-mist">
                          {metricValue(row.recall)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-[10px] text-cloud">
                          {metricValue(row.f1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<Braces className="size-5" />}
                title="No validation sweep"
                description="The threshold validation report was not found."
              />
            </div>
          )}
          <div className="space-y-2 border-t border-white/[0.06] p-4">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-mist">Validation precision</span>
              <span className="font-mono text-cloud">
                {metricValue(selectedMetrics.precision)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-mist">Validation recall</span>
              <span className="font-mono text-cloud">
                {metricValue(selectedMetrics.recall)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-mist">Selected model</span>
              <span className="font-mono text-cloud">
                {String(selected.selected_model ?? "—")}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-mist">Selection method</span>
              <span className="max-w-[55%] text-right text-cloud">
                {titleCase(
                  String(selected.selection_method ?? "validation selection"),
                )}
              </span>
            </div>
          </div>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[10px] leading-4 text-mist/65">
        <span>
          Source: {data.dataset.source} · profiles: {data.dataset.profiles}
        </span>
        <Link
          to="/copilot?q=Explain%20how%20the%20risk%20threshold%20was%20selected%20and%20what%20analysts%20should%20review."
          className="inline-flex items-center gap-1 text-shield-cyan hover:text-shield-teal"
        >
          Ask Copilot to explain the metrics
          <Sparkles className="size-3" />
        </Link>
      </div>
    </div>
  );
}
