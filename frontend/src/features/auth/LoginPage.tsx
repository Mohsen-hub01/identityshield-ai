import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { useHealth } from "@/hooks/queries";
import { ApiError } from "@/services/api/client";
import { useAuth } from "@/services/auth/AuthContext";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const health = useHealth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const online = health.isSuccess && health.data?.status === "healthy";
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (session) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.detail
          : caught instanceof Error
            ? caught.message
            : "Sign-in failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="app-background" aria-hidden />
      <div className="noise" aria-hidden />

      <div className="relative z-10 hidden w-[52%] flex-col justify-between border-r border-white/[0.06] p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <ShieldMark />
          <div>
            <p className="font-display text-[15px] font-semibold tracking-[-0.02em] text-cloud">
              IdentityShield AI
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-shield-cyan/80">
              Identity security intelligence
            </p>
          </div>
        </div>

        <div className="max-w-xl">
          <div className="relative mb-10 size-52">
            <div className="absolute inset-0 rounded-full border border-shield-cyan/15" />
            <div className="absolute inset-6 rounded-full border border-shield-cyan/20" />
            <div className="absolute inset-12 rounded-full border border-shield-blue/25" />
            <div className="spin-slow absolute inset-0 rounded-full border border-transparent border-t-shield-cyan/50" />
            <div
              className="absolute inset-8 rounded-full border border-transparent border-r-shield-teal/40"
              style={{ animation: "spin-slow 11s linear infinite reverse" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative flex size-20 items-center justify-center rounded-2xl border border-shield-cyan/25 bg-shield-cyan/[0.06] shadow-[0_0_70px_-10px_rgba(0,217,255,0.55)]">
                <Fingerprint className="size-10 text-shield-cyan" strokeWidth={1.25} />
                <span className="absolute -right-3 -top-2 size-2 rounded-full bg-shield-teal shadow-[0_0_12px_rgba(0,229,195,0.9)]" />
                <span className="absolute -bottom-2 left-3 size-1.5 rounded-full bg-shield-blue shadow-[0_0_10px_rgba(56,120,255,0.9)]" />
              </div>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-shield-cyan/80">
            Security command center
          </p>
          <h1 className="mt-4 text-balance font-display text-[42px] font-semibold leading-[1.06] tracking-[-0.05em] text-cloud xl:text-[50px]">
            Investigate identity risk with{" "}
            <span className="text-gradient">evidence, not guesses.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-mist">
            Explainable machine learning, security playbooks and human review
            in one analyst workspace. Every score is a signal — every decision
            stays with a human.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { icon: LockKeyhole, label: "JWT + RBAC" },
              { icon: ShieldCheck, label: "Human-in-the-loop" },
              { icon: Fingerprint, label: "SHAP explanations" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
              >
                <item.icon className="size-4 text-shield-cyan" />
                <p className="mt-2 text-[10px] font-medium leading-4 text-mist">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="max-w-md text-[10px] leading-4 text-mist/50">
          Research and portfolio prototype. Synthetic users and access events.
          Risk scores are investigation signals, not proof of compromise.
        </p>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <ShieldMark />
            <div>
              <p className="font-display text-base font-semibold text-cloud">
                IdentityShield AI
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-shield-cyan/80">
                AI Security
              </p>
            </div>
          </div>

          <div className="panel-strong rounded-2xl p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-cloud">
                  Analyst sign in
                </h2>
                <p className="mt-1 text-xs text-mist">
                  Use the account configured in your local environment.
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]",
                  online
                    ? "border-success/20 bg-success/[0.07] text-success"
                    : "border-danger/20 bg-danger/[0.07] text-danger",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    online ? "bg-success" : "bg-danger",
                  )}
                />
                {online ? "API ready" : "API offline"}
              </span>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="analyst"
                  leadingIcon={<UserRound className="size-4" />}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                  leadingIcon={<LockKeyhole className="size-4" />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="text-mist transition-colors hover:text-cloud"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  }
                  required
                />
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/20 bg-danger/[0.06] px-3 py-2.5 text-xs leading-5 text-danger"
                >
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="w-full"
                rightIcon={<ArrowRight className="size-4" />}
              >
                Enter command center
              </Button>
            </form>

            {!online ? (
              <div className="mt-5 rounded-xl border border-warning/15 bg-warning/[0.04] px-3 py-2.5 text-[10px] leading-4 text-warning/90">
                Start the backend with{" "}
                <code className="rounded bg-black/30 px-1 py-0.5 font-mono">
                  python -m uvicorn main:app --reload
                </code>{" "}
                then retry.
              </div>
            ) : null}

            <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-4 text-mist/60">
              Accounts and secrets are configured through{" "}
              <code className="rounded bg-white/[0.05] px-1 font-mono">
                .env
              </code>
              . Never commit credentials. Tokens are stored in session storage
              and expire according to the backend policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
