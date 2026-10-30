import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Plus,
  ScanSearch,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RiskBadge } from "@/components/data/RiskBadge";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Hint, Input, Label, Select } from "@/components/ui/Field";
import { MarkdownLite } from "@/components/ui/MarkdownLite";
import { PageHeader } from "@/components/ui/PageHeader";
import { useProfiles } from "@/hooks/queries";
import { analyzeEvent, askQuestion, searchPlaybooks } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/client";
import { useAuth } from "@/services/auth/AuthContext";
import { canAnalyze } from "@/services/auth/session";
import { addPendingReview } from "@/store/pendingReviews";
import { cn, formatDateTime, formatPercent } from "@/lib/utils";
import type {
  AccessEventInput,
  AnalyzeResponse,
  AskSource,
  PlaybookMatch,
} from "@/types/api";

const STORAGE_KEY = "identityshield.copilot.conversations";
const EVENT_STORAGE_KEY = "identityshield.copilot.attachedEvent";

type MessageMode = "rag" | "fallback" | "analysis" | "error";
type StepStatus = "done" | "failed";

interface ChatStep {
  label: string;
  detail: string;
  status: StepStatus;
  durationMs?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  mode?: MessageMode;
  sources?: AskSource[];
  passages?: PlaybookMatch[];
  model?: string | null;
  steps?: ChatStep[];
  analysis?: AnalyzeResponse;
  event?: AccessEventInput;
  pending?: boolean;
  warning?: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

const suggestedPrompts = [
  "What should I check when impossible travel is detected?",
  "How should I handle repeated failed login attempts?",
  "What evidence should I record after a new device access?",
  "Search the playbook for escalation guidance when several signals align.",
];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createConversation(): Conversation {
  return {
    id: uid("conv"),
    title: "New investigation",
    createdAt: new Date().toISOString(),
    messages: [],
  };
}

function readConversations(): Conversation[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readAttachedEvent(): AccessEventInput | null {
  try {
    const raw = window.localStorage.getItem(EVENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AccessEventInput) : null;
  } catch {
    return null;
  }
}

function toEventInput(values: {
  user_id: string;
  country: string;
  hour: string;
  failed_attempts: string;
  new_device: boolean;
  ip_risk_score: string;
  impossible_travel: boolean;
}): AccessEventInput {
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

function eventLabel(event: AccessEventInput) {
  return `${event.user_id} · ${event.country} · ${event.hour}:00`;
}

function playbackSteps(
  result: AnalyzeResponse,
  durationMs?: number,
): ChatStep[] {
  return [
    {
      label: "Access analysis",
      detail: `Rule score ${result.risk_score} · ${result.risk_level}`,
      status: "done",
      durationMs,
    },
    {
      label: "Model explanation",
      detail: `${result.ml_analysis.prediction} · ${formatPercent(
        result.ml_analysis.suspect_probability,
        1,
      )} suspect probability`,
      status: "done",
    },
  ];
}

export function CopilotPage() {
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const allowed = canAnalyze(session?.user.role);
  const profiles = useProfiles();
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const existing = readConversations();
    return existing.length ? existing : [createConversation()];
  });
  const [activeId, setActiveId] = useState(
    () => readConversations()[0]?.id ?? "",
  );
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  const [sending, setSending] = useState(false);
  const [attachedEvent, setAttachedEvent] = useState<AccessEventInput | null>(
    () => readAttachedEvent(),
  );
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefilled = useRef(false);

  const active = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? conversations[0],
    [activeId, conversations],
  );

  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (attachedEvent) {
      window.localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(attachedEvent));
    } else {
      window.localStorage.removeItem(EVENT_STORAGE_KEY);
    }
  }, [attachedEvent]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [active?.messages.length, sending]);

  useEffect(() => {
    if (prefilled.current) return;
    const initial = searchParams.get("q");
    if (initial) {
      setInput(initial);
      prefilled.current = true;
    }
  }, [searchParams]);

  const patchMessage = (
    conversationId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === messageId ? { ...message, ...patch } : message,
              ),
            }
          : conversation,
      ),
    );
  };

  const pushMessages = (conversationId: string, messages: ChatMessage[]) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              title:
                conversation.title === "New investigation" &&
                messages.some((message) => message.role === "user")
                  ? messages
                      .find((message) => message.role === "user")!
                      .content.slice(0, 58)
                  : conversation.title,
              messages: [...conversation.messages, ...messages],
            }
          : conversation,
      ),
    );
  };

  const newConversation = () => {
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setInput("");
  };

  const deleteConversation = (id: string) => {
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== id);
      return next.length ? next : [createConversation()];
    });
    if (activeId === id) {
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      setActiveId(remaining[0]?.id ?? "");
    }
  };

  const runRag = async (
    conversationId: string,
    assistantId: string,
    question: string,
  ) => {
    const startedAt = performance.now();
    try {
      const answer = await askQuestion(question, 3);
      const duration = Math.round(performance.now() - startedAt);
      patchMessage(conversationId, assistantId, {
        content: answer.answer,
        mode: "rag",
        sources: answer.sources,
        model: answer.model,
        pending: false,
        steps: [
          {
            label: "Grounded answer",
            detail: `${answer.sources.length} source${
              answer.sources.length === 1 ? "" : "s"
            } · ${answer.model ?? "model"}`,
            status: "done",
            durationMs: duration,
          },
        ],
      });
    } catch (caught) {
      const reason =
        caught instanceof ApiError
          ? caught.detail
          : caught instanceof Error
            ? caught.message
            : "The answer request failed.";
      const fallbackStart = performance.now();
      try {
        const fallback = await searchPlaybooks(question, 3);
        patchMessage(conversationId, assistantId, {
          content:
            fallback.mode === "semantic"
              ? "The grounded answer service is unavailable. The local security retrieval layer returned the following playbook evidence."
              : "The grounded answer service is unavailable. The playbook retrieval layer also fell back to keyword matching, so treat these passages as starting evidence only.",
          mode: "fallback",
          passages: fallback.matches,
          model: null,
          pending: false,
          warning: fallback.warning ?? reason,
          steps: [
            {
              label: "Grounded answer",
              detail: reason,
              status: "failed",
              durationMs: Math.round(performance.now() - startedAt),
            },
            {
              label: "Retrieval-only fallback",
              detail: `${fallback.mode} · ${fallback.matches.length} passages`,
              status: "done",
              durationMs: Math.round(performance.now() - fallbackStart),
            },
          ],
        });
      } catch (fallbackError) {
        patchMessage(conversationId, assistantId, {
          content:
            fallbackError instanceof Error
              ? fallbackError.message
              : "Both the grounded answer and retrieval fallback failed.",
          mode: "error",
          pending: false,
          warning: reason,
          steps: [
            {
              label: "Grounded answer",
              detail: reason,
              status: "failed",
              durationMs: Math.round(performance.now() - startedAt),
            },
            {
              label: "Retrieval fallback",
              detail: "Unavailable",
              status: "failed",
            },
          ],
        });
      }
    }
  };

  const runInvestigation = async (
    conversationId: string,
    assistantId: string,
    event: AccessEventInput,
    question: string,
  ) => {
    const analysisStart = performance.now();
    try {
      const result = await analyzeEvent(event);
      const analysisDuration = Math.round(performance.now() - analysisStart);
      const signals = [
        event.impossible_travel ? "impossible travel" : "",
        event.new_device ? "new device" : "",
        event.failed_attempts >= 3 ? "repeated failed logins" : "",
        result.risk_level === "HIGH" ? "high risk access" : "",
      ]
        .filter(Boolean)
        .join(" ");

      let passages: PlaybookMatch[] = [];
      let retrievalDetail = "No matching playbook passage";
      let retrievalStatus: StepStatus = "done";
      const retrievalStart = performance.now();
      try {
        const retrieval = await searchPlaybooks(
          signals || "suspicious identity access investigation",
          3,
        );
        passages = retrieval.matches;
        retrievalDetail = `${retrieval.mode} · ${retrieval.matches.length} passages`;
      } catch {
        retrievalStatus = "failed";
        retrievalDetail = "Playbook retrieval unavailable";
      }

      if (result.status === "awaiting_human_review" && result.analysis_id) {
        addPendingReview({
          analysisId: result.analysis_id,
          createdAt: new Date().toISOString(),
          result,
          event,
          note: question.trim() || undefined,
        });
      }

      patchMessage(conversationId, assistantId, {
        content: question.trim()
          ? `Investigation complete for ${eventLabel(event)}.\n\nAnalyst note: ${question.trim()}`
          : `Investigation complete for ${eventLabel(event)}.`,
        mode: "analysis",
        analysis: result,
        event,
        passages,
        pending: false,
        steps: [
          ...playbackSteps(result, analysisDuration),
          {
            label: "Playbook retrieval",
            detail: retrievalDetail,
            status: retrievalStatus,
            durationMs: Math.round(performance.now() - retrievalStart),
          },
        ],
      });
    } catch (caught) {
      patchMessage(conversationId, assistantId, {
        content:
          caught instanceof Error
            ? caught.message
            : "The access investigation failed.",
        mode: "error",
        pending: false,
        steps: [
          {
            label: "Access analysis",
            detail: "Request failed",
            status: "failed",
            durationMs: Math.round(performance.now() - analysisStart),
          },
        ],
      });
    }
  };

  const send = async () => {
    const question = input.trim();
    if ((!question && !attachedEvent) || sending || !active) return;

    const conversationId = active.id;
    const userMessage: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content:
        question ||
        `Investigate the attached access event: ${eventLabel(attachedEvent!)}`,
      createdAt: new Date().toISOString(),
    };
    const assistantId = uid("msg");
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      pending: true,
      mode: attachedEvent ? "analysis" : "rag",
      steps: attachedEvent
        ? [
            {
              label: "Access analysis",
              detail: "Sending event to /analyze",
              status: "done",
            },
            {
              label: "Playbook retrieval",
              detail: "Waiting for the analysis result",
              status: "done",
            },
          ]
        : [
            {
              label: "Grounded answer",
              detail: "Retrieving playbook context and generating an answer",
              status: "done",
            },
          ],
    };

    pushMessages(conversationId, [userMessage, assistantMessage]);
    setInput("");
    setSending(true);

    try {
      if (attachedEvent) {
        await runInvestigation(conversationId, assistantId, attachedEvent, question);
      } else {
        await runRag(conversationId, assistantId, question);
      }
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              AI Copilot
            </Badge>
            <Badge tone="muted">Grounded retrieval</Badge>
          </>
        }
        title="Ask better questions. Keep the evidence visible."
        description="The Copilot answers from local security playbooks through the RAG endpoint. If generation is not configured, it falls back to retrieved evidence instead of inventing an answer."
        actions={
          <Button
            variant="secondary"
            onClick={newConversation}
            leftIcon={<Plus className="size-4" />}
          >
            New investigation
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="hidden xl:col-span-3 xl:block">
          <CardHeader
            title="Conversations"
            subtitle="Stored locally in this browser session."
            icon={<MessageSquare className="size-4" />}
          />
          <div className="p-2">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 pr-9 text-left transition-colors",
                    conversation.id === active?.id
                      ? "bg-shield-cyan/[0.07]"
                      : "hover:bg-white/[0.035]",
                  )}
                >
                  <p className="truncate text-[11px] font-medium text-cloud">
                    {conversation.title}
                  </p>
                  <p className="mt-0.5 text-[9px] text-mist/60">
                    {conversation.messages.length} messages ·{" "}
                    {formatDateTime(conversation.createdAt)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => deleteConversation(conversation.id)}
                  className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-mist/50 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.06] p-3">
            <p className="text-[9px] leading-4 text-mist/60">
              Tool execution is shown only when a real backend request runs.
              Conversation history never leaves this browser.
            </p>
          </div>
        </Card>

        <Card className="flex min-h-[680px] flex-col xl:col-span-9">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
          >
            {!active?.messages.length ? (
              <div className="mx-auto flex h-full max-w-3xl flex-col justify-center">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl border border-shield-cyan/20 bg-shield-cyan/[0.055] text-shield-cyan ring-glow">
                    <Sparkles className="size-7" />
                  </div>
                  <h2 className="mt-5 font-display text-xl font-semibold tracking-[-0.03em] text-cloud">
                    What do you need to investigate?
                  </h2>
                  <p className="mt-2 max-w-md text-xs leading-5 text-mist">
                    Ask about a security procedure, or attach a synthetic access
                    event to run the real analysis workflow and retrieve relevant
                    playbook passages.
                  </p>
                </div>
                <div className="mt-7 grid gap-2 sm:grid-cols-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setInput(prompt);
                      }}
                      className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition-colors hover:border-shield-cyan/20 hover:bg-shield-cyan/[0.03]"
                    >
                      <span className="flex items-start gap-2">
                        <BookOpenCheck className="mt-0.5 size-3.5 shrink-0 text-shield-cyan" />
                        <span className="text-[11px] leading-5 text-mist group-hover:text-cloud">
                          {prompt}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {!allowed ? (
                  <p className="mt-4 text-center text-[10px] text-warning/80">
                    Viewer role: knowledge questions use the RAG endpoint and
                    access-event investigation is disabled.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-6">
                {active.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {sending ? (
                  <div className="flex items-center gap-2 text-[10px] text-mist/60">
                    <LoaderCircle className="size-3.5 animate-spin text-shield-cyan" />
                    Waiting for backend response…
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.07] bg-ink-950/35 p-3 sm:p-4">
            <div className="mx-auto max-w-4xl">
              {attachedEvent ? (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-shield-cyan/20 bg-shield-cyan/[0.055] px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ScanSearch className="size-3.5 shrink-0 text-shield-cyan" />
                    <p className="truncate text-[10px] text-cloud">
                      Access event attached · {eventLabel(attachedEvent)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedEvent(null)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-mist hover:bg-white/[0.06] hover:text-cloud"
                    aria-label="Remove attached event"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}

              <div className="panel-strong rounded-2xl p-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  maxLength={2000}
                  placeholder={
                    attachedEvent
                      ? "Optional analyst note for this investigation…"
                      : "Ask about a security procedure or investigation…"
                  }
                  className="max-h-40 min-h-[56px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-cloud placeholder:text-mist/55 focus:outline-none"
                  aria-label="Message the AI Copilot"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEventDialogOpen(true)}
                      disabled={!allowed}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] text-mist transition-colors hover:bg-white/[0.06] hover:text-cloud disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Paperclip className="size-3.5" />
                      Attach access event
                    </button>
                    <span className="text-[9px] text-mist/40">
                      {input.length}/2000
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden items-center gap-1 text-[9px] text-mist/50 sm:flex">
                      <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono">
                        Enter
                      </kbd>
                      send
                      <kbd className="ml-1 rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono">
                        Shift Enter
                      </kbd>
                      newline
                    </span>
                    <Button
                      size="sm"
                      onClick={() => void send()}
                      disabled={
                        sending ||
                        (!input.trim() && !attachedEvent)
                      }
                      loading={sending}
                      rightIcon={<Send className="size-3.5" />}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-mist/50">
                <span>
                  RAG answers cite retrieved playbook passages. A risk signal is
                  not proof of compromise.
                </span>
                <Link
                  to="/playbooks"
                  className="inline-flex items-center gap-1 text-shield-cyan/80 hover:text-shield-cyan"
                >
                  Browse playbooks <ArrowUpRight className="size-2.5" />
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <EventDialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        onAttach={(event) => {
          setAttachedEvent(event);
          setEventDialogOpen(false);
        }}
        profiles={profiles.data?.profiles ?? {}}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-shield-cyan/15 bg-gradient-to-br from-shield-cyan/[0.12] to-shield-blue/[0.08] px-4 py-3">
          <p className="whitespace-pre-wrap text-[13px] leading-6 text-cloud">
            {message.content}
          </p>
          <p className="mt-1.5 text-right text-[9px] text-mist/50">
            {formatDateTime(message.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  const modeMeta =
    message.mode === "analysis"
      ? { label: "Structured investigation", tone: "cyan" as const }
      : message.mode === "fallback"
        ? { label: "Retrieval fallback", tone: "warning" as const }
        : message.mode === "error"
          ? { label: "Request failed", tone: "danger" as const }
          : { label: "Grounded RAG", tone: "success" as const };

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-shield-cyan/15 bg-shield-cyan/[0.045]">
        <ShieldMark className="size-7" animated={false} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-cloud">
            IdentityShield Copilot
          </span>
          {!message.pending ? (
            <Badge tone={modeMeta.tone}>{modeMeta.label}</Badge>
          ) : (
            <Badge tone="muted" dot>
              Processing
            </Badge>
          )}
          <span className="text-[9px] text-mist/50">
            {formatDateTime(message.createdAt)}
          </span>
        </div>

        {message.pending ? (
          <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-[11px] text-mist">
              <LoaderCircle className="size-3.5 animate-spin text-shield-cyan" />
              {message.mode === "analysis"
                ? "Running access analysis and playbook retrieval…"
                : "Retrieving playbook context and generating an answer…"}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-shield-cyan/50 to-shield-blue/40" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {message.mode === "analysis" && message.analysis ? (
              <AnalysisCard analysis={message.analysis} />
            ) : null}

            {message.content ? (
              <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <MarkdownLite content={message.content} />
              </div>
            ) : null}

            {message.passages?.length ? (
              <div className="space-y-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
                  Retrieved playbook evidence
                </p>
                {message.passages.map((passage, index) => (
                  <div
                    key={`${passage.source}-${index}`}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="cyan">{passage.title}</Badge>
                      <span className="text-[9px] text-mist">
                        {passage.section}
                      </span>
                      <span className="ml-auto font-mono text-[9px] text-mist/50">
                        distance {passage.distance.toFixed(3)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-mist">
                      {passage.text}
                    </p>
                    <p className="mt-2 font-mono text-[9px] text-mist/45">
                      {passage.source}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {message.sources?.length ? (
              <div className="space-y-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
                  Sources
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {message.sources.map((source) => (
                    <div
                      key={source.id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="cyan">{source.id}</Badge>
                        <span className="font-mono text-[9px] text-mist/50">
                          {source.distance.toFixed(3)}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-cloud">
                        {source.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-mist">
                        {source.section}
                      </p>
                      <p className="mt-1 font-mono text-[9px] text-mist/45">
                        {source.source}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {message.steps?.length ? (
              <div className="rounded-xl border border-white/[0.06] bg-ink-950/35 p-3">
                <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
                  Execution trace
                </p>
                <div className="space-y-1.5">
                  {message.steps.map((step, index) => (
                    <div
                      key={`${step.label}-${index}`}
                      className="flex items-start gap-2 text-[10px]"
                    >
                      {step.status === "done" ? (
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-3 shrink-0 text-danger" />
                      )}
                      <span className="text-cloud">{step.label}</span>
                      <span className="min-w-0 flex-1 truncate text-mist">
                        {step.detail}
                      </span>
                      {step.durationMs !== undefined ? (
                        <span className="shrink-0 font-mono text-mist/50">
                          {step.durationMs}ms
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {message.warning ? (
              <p className="rounded-lg border border-warning/15 bg-warning/[0.035] px-3 py-2 text-[10px] leading-4 text-warning/85">
                {message.warning}
              </p>
            ) : null}

            {message.model ? (
              <p className="text-[9px] text-mist/50">
                Generated by {message.model} using retrieved local playbook
                passages.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisCard({ analysis }: { analysis: AnalyzeResponse }) {
  const awaiting = analysis.status === "awaiting_human_review";
  return (
    <div className="overflow-hidden rounded-2xl border border-shield-cyan/15 bg-gradient-to-br from-shield-cyan/[0.055] to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="size-4 text-shield-cyan" />
          <span className="text-xs font-semibold text-cloud">
            {analysis.user_id} · access analysis
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={analysis.risk_level} />
          <Badge
            tone={analysis.ml_analysis.prediction === "SUSPECT" ? "danger" : "success"}
          >
            ML {analysis.ml_analysis.prediction}
          </Badge>
          {awaiting ? <Badge tone="warning">Human review</Badge> : null}
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-ink-950/35 p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
            Rule score
          </p>
          <p className="mt-1 font-display text-xl font-semibold text-cloud">
            {analysis.risk_score}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-ink-950/35 p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
            Suspect probability
          </p>
          <p className="mt-1 font-display text-xl font-semibold text-cloud">
            {formatPercent(analysis.ml_analysis.suspect_probability, 1)}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-ink-950/35 p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
            Action
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-cloud">
            {analysis.recommended_action}
          </p>
        </div>
      </div>
      <div className="border-t border-white/[0.07] px-4 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
          Rule evidence
        </p>
        <ul className="mt-2 space-y-1">
          {analysis.reasons.map((reason) => (
            <li
              key={reason}
              className="flex items-start gap-2 text-[10px] leading-4 text-mist"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-warning" />
              {reason}
            </li>
          ))}
        </ul>
      </div>
      {awaiting ? (
        <div className="flex flex-col gap-2 border-t border-warning/15 bg-warning/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] leading-4 text-warning/90">
            Workflow paused. The analysis was added to your local review queue.
          </p>
          <Link to="/incidents" className={buttonStyles("secondary", "sm")}>
            Open review
            <ChevronRight className="size-3" />
          </Link>
        </div>
      ) : null}
      <p className="border-t border-white/[0.06] px-4 py-2.5 text-[9px] leading-4 text-mist/60">
        {analysis.disclaimer}
      </p>
    </div>
  );
}

function EventDialog({
  open,
  onClose,
  onAttach,
  profiles,
}: {
  open: boolean;
  onClose: () => void;
  onAttach: (event: AccessEventInput) => void;
  profiles: Record<string, { home_country: string; usual_hour: number }>;
}) {
  const entries = useMemo(() => Object.entries(profiles), [profiles]);
  const [values, setValues] = useState({
    user_id: "",
    country: "",
    hour: "",
    failed_attempts: "0",
    new_device: false,
    ip_risk_score: "0",
    impossible_travel: false,
  });

  useEffect(() => {
    if (!open || !entries.length) return;
    setValues((current) => {
      const userId = current.user_id || entries[0][0];
      const profile = profiles[userId] ?? entries[0][1];
      return {
        ...current,
        user_id: userId,
        country: current.country || profile.home_country,
        hour: current.hour || String(profile.usual_hour),
      };
    });
  }, [open, entries, profiles]);

  const update = (key: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  const onUserChange = (userId: string) => {
    const profile = profiles[userId];
    setValues((current) => ({
      ...current,
      user_id: userId,
      country: profile?.home_country ?? current.country,
      hour: profile ? String(profile.usual_hour) : current.hour,
    }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onAttach(toEventInput(values));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Attach a synthetic access event"
      description="The Copilot will call /analyze and retrieve related playbook passages. Nothing is executed until you send the message."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onAttach(toEventInput(values))
            }
            disabled={!values.user_id || !values.country || !values.hour}
            leftIcon={<Paperclip className="size-4" />}
          >
            Attach event
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="copilot-user">Identity</Label>
          <Select
            id="copilot-user"
            value={values.user_id}
            onChange={(event) => onUserChange(event.target.value)}
          >
            {entries.map(([userId]) => (
              <option key={userId} value={userId}>
                {userId}
              </option>
            ))}
          </Select>
          <Hint>
            {values.user_id && profiles[values.user_id]
              ? `Home ${profiles[values.user_id].home_country} · usual hour ${profiles[values.user_id].usual_hour}:00`
              : "Synthetic profile"}
          </Hint>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="copilot-country">Country</Label>
            <Input
              id="copilot-country"
              value={values.country}
              onChange={(event) => update("country", event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="copilot-hour">Hour</Label>
            <Input
              id="copilot-hour"
              type="number"
              min={0}
              max={23}
              value={values.hour}
              onChange={(event) => update("hour", event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="copilot-failed">Failed attempts</Label>
            <Input
              id="copilot-failed"
              type="number"
              min={0}
              max={100}
              value={values.failed_attempts}
              onChange={(event) => update("failed_attempts", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="copilot-ip">IP risk score</Label>
            <Input
              id="copilot-ip"
              type="number"
              min={0}
              max={100}
              value={values.ip_risk_score}
              onChange={(event) => update("ip_risk_score", event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[11px] text-mist">
            New device
            <input
              type="checkbox"
              checked={values.new_device}
              onChange={(event) => update("new_device", event.target.checked)}
              className="size-4 accent-[#00d9ff]"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[11px] text-mist">
            Impossible travel
            <input
              type="checkbox"
              checked={values.impossible_travel}
              onChange={(event) => update("impossible_travel", event.target.checked)}
              className="size-4 accent-[#00d9ff]"
            />
          </label>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">
            Event preview
          </p>
          <p className="mt-1 text-[11px] text-cloud">
            {values.user_id || "identity"} · {values.country || "country"} ·{" "}
            {values.hour || "hour"}:00 · {values.failed_attempts} failures
          </p>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
