import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "cyan",
  progress,
  className,
}: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  icon: ReactNode;
  tone?: "cyan" | "success" | "warning" | "danger" | "blue";
  progress?: number;
  className?: string;
}) {
  const iconTones = {
    cyan: "border-shield-cyan/20 bg-shield-cyan/[0.06] text-shield-cyan",
    success: "border-success/20 bg-success/[0.06] text-success",
    warning: "border-warning/20 bg-warning/[0.06] text-warning",
    danger: "border-danger/20 bg-danger/[0.06] text-danger",
    blue: "border-shield-blue/20 bg-shield-blue/[0.07] text-[#88aaff]",
  };

  return (
    <Card interactive className={cn("overflow-hidden p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist">
            {label}
          </p>
          <p className="mt-2 font-display text-[28px] font-semibold leading-none tracking-[-0.04em] text-cloud">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            iconTones[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3">{hint}</div>
      {progress !== undefined ? (
        <Progress value={progress} tone={tone} className="mt-3" />
      ) : null}
    </Card>
  );
}
