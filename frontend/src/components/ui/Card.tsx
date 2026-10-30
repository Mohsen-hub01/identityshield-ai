import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  interactive?: boolean;
  glow?: boolean;
}

export function Card({
  className,
  strong = false,
  interactive = false,
  glow = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl",
        strong ? "panel-strong" : "panel",
        interactive && "panel-hover",
        glow && "shadow-[0_0_70px_-34px_rgba(0,217,255,0.55)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-shield-cyan/15 bg-shield-cyan/[0.06] text-shield-cyan">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold tracking-[-0.01em] text-cloud">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-mist">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
