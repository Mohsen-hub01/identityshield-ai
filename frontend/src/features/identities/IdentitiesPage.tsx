import {
  ArrowUpRight,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ProvenanceBadge } from "@/components/data/ProvenanceBadge";
import { RiskBadge, StatusBadge } from "@/components/data/RiskBadge";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useIdentities } from "@/hooks/queries";
import { cn, formatNumber } from "@/lib/utils";

function RiskSparkline({ values }: { values: number[] }) {
  const recent = values.slice(-18);
  if (!recent.length) return null;
  return (
    <div className="flex h-7 items-end gap-[2px]" aria-hidden>
      {recent.map((value, index) => (
        <span
          key={index}
          className={cn(
            "w-[3px] rounded-sm",
            value >= 70
              ? "bg-danger/80"
              : value >= 30
                ? "bg-warning/80"
                : "bg-shield-cyan/50",
          )}
          style={{ height: `${Math.max(3, value * 0.27)}px` }}
        />
      ))}
    </div>
  );
}

export function IdentitiesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const identities = useIdentities(debouncedSearch, status);
  const items = identities.data?.identities ?? [];

  const totals = useMemo(() => {
    const all = identities.data?.identities ?? [];
    return {
      critical: all.filter((item) => item.status === "critical").length,
      elevated: all.filter((item) => item.status === "elevated").length,
      normal: all.filter((item) => item.status === "normal").length,
    };
  }, [identities.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Identity monitoring
            </Badge>
            <ProvenanceBadge dataset={identities.data?.dataset} />
          </>
        }
        title="Know which identities need attention."
        description="A directory of synthetic identities with recent-window posture, authentication volume, risk signals and the latest recorded access."
        actions={
          <Link to="/risk" className={buttonStyles("primary", "md")}>
            Analyze an event
            <ArrowUpRight className="size-4" />
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Matching identities",
            value: identities.data?.count ?? 0,
            icon: Users,
            tone: "text-shield-cyan",
          },
          {
            label: "Critical posture",
            value: totals.critical,
            icon: ShieldAlert,
            tone: "text-danger",
          },
          {
            label: "Elevated posture",
            value: totals.elevated,
            icon: TriangleAlert,
            tone: "text-warning",
          },
          {
            label: "Normal posture",
            value: totals.normal,
            icon: ShieldCheck,
            tone: "text-success",
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
                {formatNumber(item.value)}
              </p>
            </div>
          </Card>
        ))}
      </section>

      <Card>
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search identity, home country or observed country…"
              leadingIcon={<Search className="size-4" />}
              className="sm:max-w-sm"
              aria-label="Search identities"
            />
            <Tabs
              value={status}
              onChange={setStatus}
              items={[
                { value: "all", label: "All" },
                { value: "critical", label: "Critical", count: totals.critical },
                { value: "elevated", label: "Elevated", count: totals.elevated },
                { value: "normal", label: "Normal", count: totals.normal },
              ]}
            />
          </div>
          <p className="text-[10px] text-mist">
            Posture uses the most recent 12 records per identity.
          </p>
        </div>

        {identities.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : identities.isError ? (
          <div className="p-4">
            <ErrorState
              message={
                identities.error instanceof Error
                  ? identities.error.message
                  : "Unable to load identities."
              }
              onRetry={() => identities.refetch()}
            />
          </div>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.16em] text-mist">
                  <th className="px-5 py-3 font-semibold">Identity</th>
                  <th className="px-3 py-3 font-semibold">Home</th>
                  <th className="px-3 py-3 font-semibold">Posture</th>
                  <th className="px-3 py-3 font-semibold">Recent max</th>
                  <th className="px-3 py-3 font-semibold">Activity</th>
                  <th className="px-3 py-3 font-semibold">Signals</th>
                  <th className="px-3 py-3 font-semibold">Latest record</th>
                  <th className="px-5 py-3 text-right font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((identity) => (
                  <tr
                    key={identity.user_id}
                    onClick={() => navigate(`/identities/${identity.user_id}`)}
                    className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-[10px] font-semibold uppercase text-mist">
                          {identity.user_id.replace("user_", "").slice(-2)}
                        </span>
                        <div>
                          <p className="text-xs font-medium text-cloud">
                            {identity.user_id}
                          </p>
                          <p className="mt-0.5 text-[9px] text-mist">
                            {identity.event_count} recorded events
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-mist">
                      {identity.home_country}
                      <span className="ml-1 text-mist/50">
                        · usual {identity.usual_hour}:00
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={identity.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold text-cloud">
                          {identity.risk_score}
                        </span>
                        <RiskSparkline
                          values={identity.risk_series.map((point) => point.risk_score)}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-mist">
                      <span className="text-cloud">{identity.suspicious_count}</span>{" "}
                      suspicious
                      <p className="mt-0.5 text-[9px] text-mist/70">
                        {identity.recent_high_risk_count} high in recent window
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {identity.new_device_count > 0 ? (
                          <Badge tone="muted">
                            {identity.new_device_count} new devices
                          </Badge>
                        ) : null}
                        {identity.impossible_travel_count > 0 ? (
                          <Badge tone="danger">
                            {identity.impossible_travel_count} travel
                          </Badge>
                        ) : null}
                        {identity.new_device_count === 0 &&
                        identity.impossible_travel_count === 0 ? (
                          <span className="text-[10px] text-mist/60">None</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-mono text-[10px] text-mist">
                        {identity.last_event_id}
                      </p>
                      <p className="mt-0.5 text-[9px] text-mist/60">
                        {identity.last_country} · {identity.last_hour}:00
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RiskBadge level={identity.last_risk_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={<Users className="size-5" />}
              title="No identities match this view"
              description="Adjust the search text or choose another posture filter. All records are synthetic."
            />
          </div>
        )}
      </Card>
    </div>
  );
}
