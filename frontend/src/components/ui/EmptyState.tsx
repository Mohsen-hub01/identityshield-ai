import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-shield-cyan/15 bg-shield-cyan/[0.05] text-shield-cyan">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-sm font-semibold text-cloud">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-5 text-mist">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
