import {
  ArrowUpRight,
  Boxes,
  Globe2,
  Link2,
  Network,
  Search,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ThreatGraph3D } from "@/components/3d/ThreatGraph3D";
import { ProvenanceBadge } from "@/components/data/ProvenanceBadge";
import { RiskBadge } from "@/components/data/RiskBadge";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useThreatGraph } from "@/hooks/queries";
import { cn, formatNumber } from "@/lib/utils";
import type { ThreatLink, ThreatNode } from "@/types/api";

function aggregateCountry(node: ThreatNode, links: ThreatLink[], nodes: ThreatNode[]) {
  const related = links.filter(
    (link) => link.source === node.id || link.target === node.id,
  );
  const identityIds = new Set(
    related.map((link) =>
      nodes.find((entry) => entry.id === link.source && entry.type === "identity")
        ? link.source
        : link.target,
    ),
  );
  return {
    identities: identityIds.size,
    events: related.reduce((sum, link) => sum + link.events, 0),
    suspicious: related.reduce((sum, link) => sum + link.suspicious, 0),
    high: related.reduce((sum, link) => sum + link.high_risk, 0),
    maxRisk: related.reduce((max, link) => Math.max(max, link.max_risk), 0),
  };
}

function NodePanel({
  node,
  nodes,
  links,
}: {
  node: ThreatNode;
  nodes: ThreatNode[];
  links: ThreatLink[];
}) {
  if (node.type === "country") {
    const summary = aggregateCountry(node, links, nodes);
    const related = links
      .filter((link) => link.source === node.id || link.target === node.id)
      .sort((a, b) => b.high_risk - a.high_risk || b.events - a.events)
      .slice(0, 6);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-shield-blue/20 bg-shield-blue/[0.07] text-[#88aaff]">
            <Globe2 className="size-5" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-cloud">
              {node.label}
            </p>
            <p className="text-[10px] text-mist">Observed access country</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Identities", value: summary.identities },
            { label: "Events", value: summary.events },
            { label: "Suspicious", value: summary.suspicious },
            { label: "High risk", value: summary.high },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
                {item.label}
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-cloud">
                {formatNumber(item.value)}
              </p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
            Linked identities
          </p>
          <div className="space-y-1.5">
            {related.map((link) => {
              const identityId =
                nodes.find(
                  (entry) => entry.id === link.source && entry.type === "identity",
                )?.id ?? link.target;
              return (
                <Link
                  key={`${link.source}-${link.target}`}
                  to={`/identities/${identityId}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="font-mono text-[10px] text-cloud">
                    {identityId}
                  </span>
                  <span className="text-[9px] text-mist">
                    {link.events} events · {link.high_risk} high
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        <p className="text-[9px] leading-4 text-mist/60">
          Country links describe observed synthetic authentication records. They
          do not establish attribution or malicious infrastructure.
        </p>
      </div>
    );
  }

  const countryLinks = links
    .filter((link) => link.source === node.id || link.target === node.id)
    .sort((a, b) => b.high_risk - a.high_risk || b.events - a.events);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] font-mono text-xs text-shield-cyan">
            {node.id.replace("user_", "").slice(-2)}
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-cloud">
              {node.id}
            </p>
            <p className="text-[10px] text-mist">
              Home {node.home_country ?? "—"} · {formatNumber(node.event_count)}{" "}
              events
            </p>
          </div>
        </div>
        <RiskBadge level={node.risk_level} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
            Recent max
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-cloud">
            {node.risk_score}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
            Countries
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-cloud">
            {countryLinks.length}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
          Observed country links
        </p>
        <div className="space-y-1.5">
          {countryLinks.slice(0, 6).map((link) => {
            const countryId =
              nodes.find(
                (entry) => entry.id === link.source && entry.type === "country",
              )?.id ?? link.target;
            return (
              <div
                key={`${link.source}-${link.target}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2"
              >
                <span className="flex items-center gap-2 text-[10px] text-cloud">
                  <Globe2 className="size-3 text-shield-blue" />
                  {countryId}
                </span>
                <span className="text-[9px] text-mist">
                  {link.events} events · max {link.max_risk}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link to={`/identities/${node.id}`} className={buttonStyles("secondary", "sm")}>
          Open identity
          <ArrowUpRight className="size-3" />
        </Link>
        <Link
          to={`/copilot?q=${encodeURIComponent(
            `Investigate the most recent access behaviour for ${node.id}. What playbook evidence applies?`,
          )}`}
          className={buttonStyles("outline", "sm")}
        >
          <Sparkles className="size-3" />
          Ask Copilot
        </Link>
      </div>
    </div>
  );
}

export function ThreatIntelligencePage() {
  const graph = useThreatGraph();
  const [riskFilter, setRiskFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes = graph.data?.nodes ?? [];
  const links = graph.data?.links ?? [];

  const visibleNodes = useMemo(
    () =>
      nodes.filter((node) => {
        if (riskFilter === "all") return true;
        if (riskFilter === "high") return node.risk_level === "HIGH";
        return node.risk_level !== "LOW";
      }),
    [nodes, riskFilter],
  );
  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );
  const visibleLinks = useMemo(
    () => links.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target)),
    [links, visibleIds],
  );

  const selected =
    nodes.find((node) => node.id === selectedId) ??
    visibleNodes.find((node) => node.type === "identity" && node.risk_level === "HIGH") ??
    visibleNodes[0];

  const counts = useMemo(
    () => ({
      identities: nodes.filter((node) => node.type === "identity").length,
      countries: nodes.filter((node) => node.type === "country").length,
      links: links.length,
      highLinks: links.filter((link) => link.high_risk > 0).length,
    }),
    [nodes, links],
  );

  const searchMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return nodes
      .filter((node) => node.label.toLowerCase().includes(query))
      .slice(0, 6);
  }, [nodes, search]);

  const priorityLinks = useMemo(
    () =>
      [...links]
        .filter((link) => link.suspicious > 0 || link.high_risk > 0)
        .sort(
          (a, b) =>
            b.high_risk - a.high_risk ||
            b.suspicious - a.suspicious ||
            b.max_risk - a.max_risk,
        )
        .slice(0, 12),
    [links],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Threat intelligence
            </Badge>
            <ProvenanceBadge dataset={graph.data?.dataset} />
          </>
        }
        title="See how identities connect to observed access countries."
        description="An interactive relationship graph built from synthetic authentication records. Link weight reflects event volume; colour reflects observed risk."
        actions={
          <Link to="/identities" className={buttonStyles("secondary", "md")}>
            <Users className="size-4" />
            Identity directory
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Identities",
            value: counts.identities,
            icon: Users,
            tone: "text-shield-cyan",
          },
          {
            label: "Countries",
            value: counts.countries,
            icon: Globe2,
            tone: "text-[#88aaff]",
          },
          {
            label: "Relationship links",
            value: counts.links,
            icon: Link2,
            tone: "text-cloud",
          },
          {
            label: "Links with high risk",
            value: counts.highLinks,
            icon: ShieldAlert,
            tone: "text-danger",
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

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Identity–country graph"
            subtitle={graph.data?.note ?? "Relationships derived from synthetic access events."}
            icon={<Network className="size-4" />}
            action={
              <Badge tone="muted">
                {visibleNodes.length} nodes · {visibleLinks.length} edges
              </Badge>
            }
          />
          <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={riskFilter}
              onChange={setRiskFilter}
              items={[
                { value: "all", label: "All nodes" },
                { value: "elevated", label: "Elevated +" },
                { value: "high", label: "High only" },
              ]}
            />
            <div className="relative w-full lg:w-64">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find an identity or country…"
                leadingIcon={<Search className="size-4" />}
                aria-label="Search graph nodes"
              />
              {searchMatches.length ? (
                <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur">
                  {searchMatches.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(node.id);
                        setSearch("");
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-2 text-[11px] text-cloud">
                        {node.type === "identity" ? (
                          <Users className="size-3 text-shield-cyan" />
                        ) : (
                          <Globe2 className="size-3 text-shield-blue" />
                        )}
                        {node.label}
                      </span>
                      <RiskBadge level={node.risk_level} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {graph.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-[520px] w-full" />
            </div>
          ) : graph.isError ? (
            <div className="p-4">
              <ErrorState
                message={
                  graph.error instanceof Error
                    ? graph.error.message
                    : "Unable to load the threat graph."
                }
                onRetry={() => graph.refetch()}
              />
            </div>
          ) : visibleNodes.length ? (
            <div className="p-3">
              <ThreatGraph3D
                nodes={visibleNodes}
                links={visibleLinks}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
              />
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<Boxes className="size-5" />}
                title="No nodes match this filter"
                description="Choose a broader risk filter to restore graph nodes."
              />
            </div>
          )}
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            title="Node inspector"
            subtitle="Select a node in the graph to inspect its relationships."
            icon={<TriangleAlert className="size-4" />}
          />
          <div className="p-5">
            {selected ? (
              <NodePanel node={selected} nodes={nodes} links={links} />
            ) : (
              <p className="py-10 text-center text-xs text-mist">
                No node selected.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader
            title="Priority relationship paths"
            subtitle="Ordered by high-risk observations, then suspicious volume."
            icon={<ShieldAlert className="size-4" />}
          />
          {priorityLinks.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.16em] text-mist">
                    <th className="px-5 py-3 font-semibold">Identity</th>
                    <th className="px-3 py-3 font-semibold">Country</th>
                    <th className="px-3 py-3 font-semibold">Events</th>
                    <th className="px-3 py-3 font-semibold">Suspicious</th>
                    <th className="px-3 py-3 font-semibold">High</th>
                    <th className="px-5 py-3 text-right font-semibold">Max risk</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityLinks.map((link) => {
                    const identityId =
                      nodes.find(
                        (node) =>
                          node.id === link.source && node.type === "identity",
                      )?.id ?? link.target;
                    const countryId =
                      nodes.find(
                        (node) => node.id === link.source && node.type === "country",
                      )?.id ?? link.target;
                    return (
                      <tr
                        key={`${link.source}-${link.target}`}
                        onClick={() => setSelectedId(identityId)}
                        className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.025]"
                      >
                        <td className="px-5 py-3">
                          <Link
                            to={`/identities/${identityId}`}
                            onClick={(event) => event.stopPropagation()}
                            className="font-mono text-[10px] text-shield-cyan hover:underline"
                          >
                            {identityId}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-mist">
                          {countryId}
                        </td>
                        <td className="px-3 py-3 font-mono text-[10px] text-cloud">
                          {link.events}
                        </td>
                        <td className="px-3 py-3 font-mono text-[10px] text-warning">
                          {link.suspicious}
                        </td>
                        <td className="px-3 py-3 font-mono text-[10px] text-danger">
                          {link.high_risk}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-display text-sm font-semibold text-cloud">
                            {link.max_risk}
                          </span>
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
                icon={<Network className="size-5" />}
                title="No priority paths in this dataset"
                description="The graph returned no suspicious or high-risk relationship links."
              />
            </div>
          )}
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader
            title="Reading the graph"
            subtitle="What the visual encodes, and what it does not."
            icon={<Network className="size-4" />}
          />
          <div className="space-y-4 p-5">
            {[
              {
                title: "Node size",
                detail:
                  "Identity nodes scale with event volume. Country nodes are fixed-size octahedra.",
              },
              {
                title: "Link colour",
                detail:
                  "Red links contain at least one high-risk observation, amber links contain suspicious records, cyan links are benign-only.",
              },
              {
                title: "Selection",
                detail:
                  "Select a node to highlight its immediate relationships and open the inspector.",
              },
              {
                title: "Attribution boundary",
                detail:
                  "A shared country is not evidence of a shared actor. This view is an investigation aid over synthetic records.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <p className="text-[11px] font-medium text-cloud">{item.title}</p>
                <p className="mt-1 text-[10px] leading-5 text-mist">
                  {item.detail}
                </p>
              </div>
            ))}
            <Link to="/playbooks" className={buttonStyles("secondary", "sm")}>
              Review response playbooks
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
