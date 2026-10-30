import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RiskBadge } from "@/components/data/RiskBadge";
import { useHealth, useOverview, useProjectInfo } from "@/hooks/queries";
import { roleLabel } from "@/services/auth/session";
import { useAuth } from "@/services/auth/AuthContext";
import { cn, formatTime } from "@/lib/utils";

export function Topbar({
  onMenu,
  onSearch,
}: {
  onMenu: () => void;
  onSearch: () => void;
}) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const health = useHealth();
  const project = useProjectInfo();
  const overview = useOverview();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const online = health.isSuccess && health.data?.status === "healthy";
  const criticalIdentities = overview.data?.counts.critical_identities ?? 0;
  const priority = overview.data?.priority_incidents.slice(0, 4) ?? [];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/72 px-4 backdrop-blur-2xl sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="flex size-9 items-center justify-center rounded-lg text-mist hover:bg-white/[0.06] hover:text-cloud lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <button
        type="button"
        onClick={onSearch}
        className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-left text-xs text-mist transition-colors hover:border-white/15 hover:bg-white/[0.04] sm:max-w-md"
      >
        <Search className="size-3.5 shrink-0 text-mist/70" />
        <span className="hidden flex-1 truncate sm:block">
          Search views, investigations and tools…
        </span>
        <span className="flex-1 sm:hidden">Search</span>
        <kbd className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-mist/80 sm:block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-medium text-mist md:flex">
          <span
            className={cn(
              "size-1.5 rounded-full",
              online ? "bg-success" : "bg-danger",
            )}
          />
          <span className={online ? "text-success" : "text-danger"}>
            {online ? "System operational" : "API offline"}
          </span>
          <span className="text-mist/40">·</span>
          <span className="font-mono text-cloud/70">
            {project.data?.model ?? "model"}
          </span>
        </div>

        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setProfileOpen(false);
            }}
            className="relative flex size-9 items-center justify-center rounded-lg text-mist transition-colors hover:bg-white/[0.06] hover:text-cloud"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell className="size-[18px]" />
            {criticalIdentities > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[8px] font-bold text-white shadow-[0_0_10px_rgba(255,77,109,0.6)]">
                {criticalIdentities > 9 ? "9+" : criticalIdentities}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div className="panel-strong page-enter absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-cloud">Priority signals</p>
                  <p className="mt-0.5 text-[10px] text-mist">
                    Derived from the synthetic dataset
                  </p>
                </div>
                <span className="rounded-full border border-danger/20 bg-danger/[0.08] px-2 py-0.5 font-mono text-[10px] text-danger">
                  {criticalIdentities} critical
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto p-1.5">
                {priority.length ? (
                  priority.map((event) => (
                    <Link
                      key={event.event_id}
                      to={`/risk?user=${encodeURIComponent(event.user_id)}`}
                      onClick={() => setNotificationsOpen(false)}
                      className="flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-mist">
                        <ShieldCheck className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-cloud">
                            {event.user_id}
                          </span>
                          <RiskBadge level={event.risk_level} />
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-mist">
                          {event.country} · {event.hour}:00 ·{" "}
                          {event.event_id}
                        </span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="px-3 py-8 text-center text-[11px] text-mist">
                    No priority signals available.
                  </p>
                )}
              </div>
              <div className="border-t border-white/[0.07] px-4 py-2.5 text-[10px] text-mist">
                Last API refresh{" "}
                {overview.data ? formatTime(overview.data.generated_at) : "—"}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] pl-1.5 pr-2 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
            aria-label="Account menu"
            aria-expanded={profileOpen}
          >
            <span className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-shield-cyan/20 to-shield-blue/20 text-[10px] font-bold uppercase text-shield-cyan">
              {session?.user.username.slice(0, 2) ?? "IS"}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block max-w-28 truncate text-[11px] font-medium leading-4 text-cloud">
                {session?.user.username ?? "Guest"}
              </span>
              <span className="block text-[9px] leading-3 text-mist">
                {session ? roleLabel(session.user.role) : "Not signed in"}
              </span>
            </span>
            <ChevronDown className="size-3.5 text-mist" />
          </button>

          {profileOpen ? (
            <div className="panel-strong page-enter absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl">
              <div className="border-b border-white/[0.07] px-4 py-3">
                <p className="text-xs font-semibold text-cloud">
                  {session?.user.username}
                </p>
                <p className="mt-1 text-[10px] text-mist">
                  {session ? roleLabel(session.user.role) : "No session"}
                </p>
              </div>
              <div className="p-1.5">
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-mist transition-colors hover:bg-white/[0.05] hover:text-cloud"
                >
                  <UserRound className="size-3.5" />
                  Session & profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-mist transition-colors hover:bg-white/[0.05] hover:text-cloud"
                >
                  <Settings2 className="size-3.5" />
                  Preferences
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                    navigate("/login");
                  }}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-danger/90 transition-colors hover:bg-danger/[0.08]"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
