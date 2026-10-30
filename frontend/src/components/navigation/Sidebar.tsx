import { Activity, ChevronRight, Cpu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { navigation } from "@/app/navigation";
import { useHealth, useProjectInfo } from "@/hooks/queries";
import { cn } from "@/lib/utils";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const health = useHealth();
  const project = useProjectInfo();
  const online = health.isSuccess && health.data?.status === "healthy";

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={cn(
          "fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-white/[0.07] bg-ink-950/92 backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Primary navigation"
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-white/[0.06] px-4">
          <NavLink
            to="/"
            onClick={onClose}
            className="group flex min-w-0 items-center gap-3"
          >
            <ShieldMark />
            <span className="min-w-0">
              <span className="block truncate font-display text-[15px] font-semibold tracking-[-0.02em] text-cloud">
                IdentityShield
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-shield-cyan/80">
                AI Security
              </span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-mist hover:bg-white/[0.06] hover:text-cloud lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-2.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-mist/55">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.href === "/"}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium transition-colors",
                        isActive
                          ? "bg-gradient-to-r from-shield-cyan/[0.11] to-transparent text-cloud"
                          : "text-mist hover:bg-white/[0.035] hover:text-cloud",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            "absolute inset-y-2 left-0 w-[2px] rounded-full bg-gradient-to-b from-shield-cyan to-shield-teal transition-opacity",
                            isActive ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <item.icon
                          className={cn(
                            "size-[17px] shrink-0 transition-colors",
                            isActive
                              ? "text-shield-cyan"
                              : "text-mist/75 group-hover:text-cloud",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <ChevronRight
                          className={cn(
                            "size-3.5 shrink-0 transition-all",
                            isActive
                              ? "text-shield-cyan/70"
                              : "text-transparent group-hover:text-mist/60",
                          )}
                        />
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[11px] font-medium text-cloud">
                <span className="relative flex size-2">
                  <span
                    className={cn(
                      "absolute inline-flex size-full rounded-full opacity-40",
                      online ? "bg-success" : "bg-danger",
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex size-2 rounded-full",
                      online ? "bg-success" : "bg-danger",
                    )}
                  />
                </span>
                {online ? "API operational" : "API unreachable"}
              </span>
              <Activity
                className={cn(
                  "size-3.5",
                  online ? "text-success" : "text-danger",
                )}
              />
            </div>
            <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3 text-[10px] text-mist">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <Cpu className="size-3" />
                  Model
                </span>
                <span className="truncate font-mono text-cloud/80">
                  {project.data?.model ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Threshold</span>
                <span className="font-mono text-cloud/80">
                  {project.data?.decision_threshold?.toFixed(2) ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Version</span>
                <span className="font-mono text-cloud/80">
                  {project.data?.version ?? "0.4.0"}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 px-1 text-[9px] leading-4 text-mist/45">
            Research prototype. Synthetic data. Not for real access-blocking decisions.
          </p>
        </div>
      </aside>
    </>
  );
}
