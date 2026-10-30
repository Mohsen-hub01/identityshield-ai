import {
  ArrowUpRight,
  BookOpenCheck,
  FileText,
  Layers3,
  LibraryBig,
  LoaderCircle,
  Search,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Field";
import { MarkdownLite } from "@/components/ui/MarkdownLite";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePlaybookSearchMutation, usePlaybooks } from "@/hooks/queries";
import { formatNumber } from "@/lib/utils";
import type { PlaybookDocument } from "@/types/api";

const suggestedQueries = [
  "impossible travel response",
  "repeated failed login attempts",
  "new device verification",
  "escalation and human review",
];

function excerpt(text: string, length = 190) {
  const clean = text.replace(/^#+\s+/gm, "").replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

export function PlaybooksPage() {
  const playbooks = usePlaybooks();
  const searchMutation = usePlaybookSearchMutation();
  const [query, setQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("");
  const [selected, setSelected] = useState<PlaybookDocument | null>(null);

  const documents = playbooks.data?.documents ?? [];
  const filteredDocuments = useMemo(() => {
    const needle = libraryFilter.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((document) =>
      [document.title, document.filename, ...document.sections]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [documents, libraryFilter]);

  const totals = useMemo(
    () => ({
      documents: documents.length,
      sections: documents.reduce((sum, document) => sum + document.sections.length, 0),
      words: documents.reduce((sum, document) => sum + document.word_count, 0),
    }),
    [documents],
  );

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    searchMutation.mutate({ query: trimmed, topK: 5 });
  };

  const result = searchMutation.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Local knowledge
            </Badge>
            <Badge tone="muted">
              {playbooks.data?.mode ?? "retrieval"} index
            </Badge>
          </>
        }
        title="Keep the response grounded in written procedure."
        description="Browse and search the local security playbooks used by the RAG pipeline. Every retrieved passage keeps its source, section and distance visible."
        actions={
          <Link to="/copilot" className={buttonStyles("primary", "md")}>
            <Sparkles className="size-4" />
            Ask Copilot
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Playbook documents", value: totals.documents, icon: LibraryBig },
          { label: "Indexed sections", value: totals.sections, icon: Layers3 },
          { label: "Source words", value: totals.words, icon: FileText },
        ].map((item) => (
          <Card key={item.label} className="flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
              <item.icon className="size-4 text-shield-cyan" />
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

      <Card strong glow>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-shield-cyan/20 bg-shield-cyan/[0.055] text-shield-cyan">
              <BookOpenCheck className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-cloud">
                Search the response library
              </h2>
              <p className="mt-1 text-xs leading-5 text-mist">
                Retrieval uses the local vector index when available and reports a
                keyword fallback when it is not. No external model is required for
                this search.
              </p>
            </div>
          </div>

          <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What procedure do you need? e.g. impossible travel response"
              leadingIcon={<Search className="size-4" />}
              aria-label="Search playbooks"
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!query.trim() || searchMutation.isPending}
              loading={searchMutation.isPending}
              leftIcon={<Search className="size-4" />}
            >
              Search evidence
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[9px] uppercase tracking-[0.14em] text-mist/60">
              Try
            </span>
            {suggestedQueries.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuery(suggestion);
                  searchMutation.mutate({ query: suggestion, topK: 5 });
                }}
                className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] text-mist transition-colors hover:border-shield-cyan/25 hover:text-cloud"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {searchMutation.isPending ? (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[11px] text-mist">
              <LoaderCircle className="size-3.5 animate-spin text-shield-cyan" />
              Searching the local playbook index…
            </div>
          ) : null}

          {searchMutation.isError ? (
            <div className="mt-5">
              <ErrorState
                title="Playbook search failed"
                message={
                  searchMutation.error instanceof Error
                    ? searchMutation.error.message
                    : "The retrieval endpoint did not respond."
                }
                onRetry={() => submitSearch()}
              />
            </div>
          ) : null}

          {result ? (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={result.mode === "semantic" ? "success" : "warning"} dot>
                    {result.mode === "semantic"
                      ? "Semantic retrieval"
                      : "Keyword fallback"}
                  </Badge>
                  <span className="text-[10px] text-mist">
                    {result.matches.length} passages for “{result.query}”
                  </span>
                </div>
                <span className="font-mono text-[9px] text-mist/50">
                  top 5
                </span>
              </div>

              {result.warning ? (
                <p className="flex items-start gap-2 rounded-lg border border-warning/15 bg-warning/[0.035] px-3 py-2 text-[10px] leading-4 text-warning/85">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                  {result.warning}
                </p>
              ) : null}

              {result.matches.length ? (
                <div className="space-y-2">
                  {result.matches.map((match, index) => (
                    <div
                      key={`${match.source}-${match.section}-${index}`}
                      className="rounded-xl border border-white/[0.07] bg-ink-950/30 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-md bg-shield-cyan/10 font-mono text-[9px] text-shield-cyan">
                          {index + 1}
                        </span>
                        <p className="text-[11px] font-medium text-cloud">
                          {match.title}
                        </p>
                        <span className="text-[9px] text-mist">
                          {match.section}
                        </span>
                        <span className="ml-auto font-mono text-[9px] text-mist/50">
                          distance {match.distance.toFixed(3)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-mist">
                        {match.text}
                      </p>
                      <p className="mt-2 font-mono text-[9px] text-mist/45">
                        {match.source}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Search className="size-5" />}
                  title="No playbook passage matched"
                  description="Try a broader phrase or browse the library below directly."
                />
              )}
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Playbook library"
          subtitle="Local documents indexed for retrieval."
          icon={<LibraryBig className="size-4" />}
          action={
            <div className="w-full sm:w-60">
              <Input
                value={libraryFilter}
                onChange={(event) => setLibraryFilter(event.target.value)}
                placeholder="Filter titles or sections…"
                leadingIcon={<Search className="size-3.5" />}
                className="h-8 text-xs"
                aria-label="Filter playbook library"
              />
            </div>
          }
        />
        {playbooks.isLoading ? (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
        ) : playbooks.isError ? (
          <div className="p-4">
            <ErrorState
              message={
                playbooks.error instanceof Error
                  ? playbooks.error.message
                  : "Unable to load playbooks."
              }
              onRetry={() => playbooks.refetch()}
            />
          </div>
        ) : filteredDocuments.length ? (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {filteredDocuments.map((document) => (
              <article
                key={document.id}
                className="flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-shield-cyan/15 bg-shield-cyan/[0.05] text-shield-cyan">
                    <FileText className="size-4" />
                  </span>
                  <Badge tone="muted">{formatNumber(document.word_count)} words</Badge>
                </div>
                <h3 className="mt-3 font-display text-sm font-semibold text-cloud">
                  {document.title}
                </h3>
                <p className="mt-1 font-mono text-[9px] text-mist/55">
                  {document.filename}
                </p>
                <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-mist">
                  {excerpt(document.content)}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {document.sections.slice(0, 4).map((section) => (
                    <span
                      key={section}
                      className="rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 text-[9px] text-mist"
                    >
                      {section}
                    </span>
                  ))}
                  {document.sections.length > 4 ? (
                    <span className="px-1 py-0.5 text-[9px] text-mist/60">
                      +{document.sections.length - 4}
                    </span>
                  ) : null}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelected(document)}
                    leftIcon={<BookOpenCheck className="size-3.5" />}
                  >
                    Read
                  </Button>
                  <Link
                    to={`/copilot?q=${encodeURIComponent(
                      `Summarize the ${document.title} playbook and the key response steps.`,
                    )}`}
                    className="inline-flex items-center gap-1 text-[10px] text-shield-cyan/85 hover:text-shield-cyan"
                  >
                    Ask Copilot <ArrowUpRight className="size-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={<BookOpenCheck className="size-5" />}
              title="No documents match this filter"
              description="Clear the library filter to see all indexed playbooks."
              action={
                <Button variant="secondary" size="sm" onClick={() => setLibraryFilter("")}>
                  Clear filter
                </Button>
              }
            />
          </div>
        )}
      </Card>

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Playbook"}
        description={
          selected
            ? `${selected.sections.length} sections · ${formatNumber(
                selected.word_count,
              )} words · ${selected.filename}`
            : undefined
        }
        size="xl"
        footer={
          <>
            <Link
              to={`/copilot?q=${encodeURIComponent(
                `What are the key response steps in ${selected?.title ?? "this playbook"}?`,
              )}`}
              className={buttonStyles("primary", "md")}
            >
              <Sparkles className="size-4" />
              Ask Copilot
            </Link>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="grid gap-5 lg:grid-cols-[190px_1fr]">
            <aside>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
                Sections
              </p>
              <div className="space-y-1">
                {selected.sections.map((section) => (
                  <div
                    key={section}
                    className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-2.5 py-1.5 text-[10px] leading-4 text-mist"
                  >
                    {section}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-mist">
                  <TerminalSquare className="size-3 text-shield-cyan" />
                  Source
                </p>
                <p className="mt-1 break-all font-mono text-[9px] text-mist/60">
                  {selected.source}
                </p>
              </div>
            </aside>
            <div className="min-w-0">
              <MarkdownLite content={selected.content} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
