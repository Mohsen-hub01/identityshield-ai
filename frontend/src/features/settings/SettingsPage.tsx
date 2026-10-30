import {
  Activity,
  Check,
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  LogOut,
  MonitorCog,
  RotateCcw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ProvenanceBadge } from "@/components/data/ProvenanceBadge";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useHealth, useOverview, useProjectInfo } from "@/hooks/queries";
import { useAuth } from "@/services/auth/AuthContext";
import { canAnalyze, roleLabel } from "@/services/auth/session";
import { usePreferences } from "@/services/preferences/PreferencesContext";
import { clearPendingReviews, usePendingReviews } from "@/store/pendingReviews";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

const motionOptions = [
  { value: "system", label: "System", detail: "Follow OS preference" },
  { value: "on", label: "Reduced", detail: "Minimize motion" },
  { value: "off", label: "Full", detail: "Allow animation" },
] as const;

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <span>
        <span className="block text-[11px] font-medium text-cloud">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-mist">
          {description}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-shield-cyan/40 bg-shield-cyan/25"
            : "border-white/10 bg-white/[0.06]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full transition-transform",
            checked
              ? "left-0.5 translate-x-4 bg-shield-cyan"
              : "left-0.5 bg-mist",
          )}
        />
      </button>
    </label>
  );
}

export function SettingsPage() {
  const { session, logout } = useAuth();
  const {
    motionPreference,
    setMotionPreference,
    visuals3d,
    setVisuals3d,
    reducedMotion,
  } = usePreferences();
  const overview = useOverview();
  const health = useHealth();
  const project = useProjectInfo();
  const pending = usePendingReviews();
  const [cleared, setCleared] = useState(false);

  const role = session?.user.role;
  const allowed = canAnalyze(role);
  const capabilities = [
    { label: "View dashboards and identities", viewer: true },
    { label: "Ask grounded playbook questions", viewer: true },
    { label: "Run access-event analysis", viewer: false },
    { label: "Submit human review decisions", viewer: false },
  ];

  const clearConversations = () => {
    window.localStorage.removeItem("identityshield.copilot.conversations");
    window.localStorage.removeItem("identityshield.copilot.attachedEvent");
    setCleared(true);
    window.setTimeout(() => setCleared(false), 2500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="cyan" dot>
              Settings
            </Badge>
            <Badge tone="muted">Research prototype</Badge>
          </>
        }
        title="Session, visualization and local data."
        description="Control how the experience behaves in this browser and review the provenance of the data behind it."
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <Card>
            <CardHeader
              title="Account"
              subtitle="JWT session held in this browser tab only."
              icon={<UserRound className="size-4" />}
            />
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-2xl border border-shield-cyan/20 bg-shield-cyan/[0.055] font-display text-lg font-semibold uppercase text-shield-cyan">
                  {session?.user.username.slice(0, 2) ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-semibold text-cloud">
                      {session?.user.username ?? "Unknown user"}
                    </p>
                    <Badge tone={role === "admin" ? "cyan" : role === "analyst" ? "blue" : "muted"}>
                      {role ? roleLabel(role) : "—"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-mist">
                    Session expires {formatDateTime(
                      session ? new Date(session.expiresAt).toISOString() : null,
                    )}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={logout}
                  leftIcon={<LogOut className="size-3.5" />}
                >
                  Sign out
                </Button>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {capabilities.map((capability) => {
                  const enabled = capability.viewer || allowed;
                  return (
                    <div
                      key={capability.label}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[10px]"
                    >
                      {enabled ? (
                        <Check className="size-3 shrink-0 text-success" />
                      ) : (
                        <X className="size-3 shrink-0 text-mist/40" />
                      )}
                      <span className={enabled ? "text-mist" : "text-mist/40"}>
                        {capability.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-ink-950/30 p-3">
                <KeyRound className="mt-0.5 size-3.5 shrink-0 text-shield-cyan" />
                <p className="text-[9px] leading-4 text-mist/70">
                  The token is decoded for display only. Authorisation is enforced
                  by the FastAPI backend on every protected request; the frontend
                  role gates are a usability layer, not the security boundary.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Visualization"
              subtitle="Preferences apply immediately and persist in this browser."
              icon={<MonitorCog className="size-4" />}
            />
            <div className="space-y-4 p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">
                  Motion
                </p>
                <p className="mt-1 text-[10px] text-mist/70">
                  Reduced motion disables continuous 3D rotation and shortens
                  non-essential transitions.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {motionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMotionPreference(option.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        motionPreference === option.value
                          ? "border-shield-cyan/30 bg-shield-cyan/[0.06]"
                          : "border-white/[0.07] bg-white/[0.015] hover:bg-white/[0.035]",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-[11px] font-medium",
                          motionPreference === option.value
                            ? "text-shield-cyan"
                            : "text-cloud",
                        )}
                      >
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-mist">
                        {option.detail}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[9px] text-mist/55">
                  Effective motion: {reducedMotion ? "reduced" : "full"}.
                </p>
              </div>

              <Toggle
                label="3D visualizations"
                description="Use WebGL for the identity core and threat graph. A 2D fallback is always available."
                checked={visuals3d}
                onChange={setVisuals3d}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-5">
          <Card>
            <CardHeader
              title="Data provenance"
              subtitle="What this dataset is, and what it is not."
              icon={<Database className="size-4" />}
            />
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <ProvenanceBadge dataset={overview.data?.dataset} />
                {overview.isLoading ? (
                  <Badge tone="muted">Loading</Badge>
                ) : overview.isError ? (
                  <Badge tone="warning">Unavailable</Badge>
                ) : (
                  <Badge tone="success" dot>
                    Loaded
                  </Badge>
                )}
              </div>
              <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
                    Source
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[9px] text-cloud">
                    {overview.data?.dataset.source ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-mist">
                    Profiles
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[9px] text-cloud">
                    {overview.data?.dataset.profiles ?? "—"}
                  </p>
                </div>
              </div>
              <p className="text-[10px] leading-5 text-mist">
                {overview.data?.dataset.note ??
                  "All identities and access events are synthetic research records."}
              </p>
              <div className="rounded-xl border border-warning/15 bg-warning/[0.035] p-3">
                <p className="flex items-start gap-2 text-[10px] leading-4 text-warning/85">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                  Risk scores and model output are investigation aids. They are not
                  proof of compromise and must not be treated as production
                  security verdicts.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="System status"
              subtitle="Backend, model metadata and local storage."
              icon={<Server className="size-4" />}
            />
            <div className="space-y-2 p-5">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
                <span className="flex items-center gap-2 text-[10px] text-mist">
                  <Activity className="size-3.5 text-shield-cyan" />
                  API health
                </span>
                <Badge
                  tone={
                    health.isLoading
                      ? "muted"
                      : health.isError
                        ? "danger"
                        : "success"
                  }
                  dot
                >
                  {health.isLoading
                    ? "Checking"
                    : health.isError
                      ? "Unreachable"
                      : health.data?.status ?? "OK"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
                <span className="flex items-center gap-2 text-[10px] text-mist">
                  <Cpu className="size-3.5 text-shield-blue" />
                  Model
                </span>
                <span className="max-w-[55%] truncate font-mono text-[10px] text-cloud">
                  {project.data?.model ?? overview.data?.model.name ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
                <span className="flex items-center gap-2 text-[10px] text-mist">
                  <Server className="size-3.5 text-shield-cyan" />
                  Version
                </span>
                <span className="font-mono text-[10px] text-cloud">
                  {project.data?.version ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
                <span className="flex items-center gap-2 text-[10px] text-mist">
                  <KeyRound className="size-3.5 text-shield-blue" />
                  Decision threshold
                </span>
                <span className="font-mono text-[10px] text-cloud">
                  {project.data?.decision_threshold?.toFixed(2) ??
                    overview.data?.model.threshold?.toFixed(2) ??
                    "—"}
                </span>
              </div>
              <p className="pt-1 text-[9px] leading-4 text-mist/55">
                Health checks refresh every 30 seconds. The API is expected on
                http://127.0.0.1:8000 during local development.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Local data"
              subtitle="Browser-only state used by this interface."
              icon={<HardDrive className="size-4" />}
            />
            <div className="space-y-2 p-5">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
                <span className="text-[10px] text-mist">Pending review queue</span>
                <span className="font-mono text-[10px] text-cloud">
                  {formatNumber(pending.length)} item
                  {pending.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={clearConversations}
                  leftIcon={<Sparkles className="size-3.5" />}
                  className="justify-start"
                >
                  Clear Copilot conversation history
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={clearPendingReviews}
                  disabled={!pending.length}
                  leftIcon={<Trash2 className="size-3.5" />}
                  className="justify-start"
                >
                  Clear pending review queue
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMotionPreference("system");
                    setVisuals3d(true);
                  }}
                  leftIcon={<RotateCcw className="size-3.5" />}
                  className="justify-start"
                >
                  Reset visualization preferences
                </Button>
              </div>
              {cleared ? (
                <p className="rounded-lg border border-success/15 bg-success/[0.04] px-3 py-2 text-[10px] text-success">
                  Copilot conversation history cleared in this browser.
                </p>
              ) : null}
              <p className="text-[9px] leading-4 text-mist/55">
                Conversation history, preferences and the pending review queue never
                leave this browser. Completed reviews are audited by the backend.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link to="/incidents" className={buttonStyles("ghost", "sm")}>
                  Open review queue
                </Link>
                <Link to="/copilot" className={buttonStyles("ghost", "sm")}>
                  Open Copilot
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
