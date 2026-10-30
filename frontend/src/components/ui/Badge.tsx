import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "cyan" | "blue" | "success" | "warning" | "danger" | "muted";

const tones: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/[0.055] text-cloud",
  cyan: "border-shield-cyan/25 bg-shield-cyan/[0.09] text-shield-cyan",
  blue: "border-shield-blue/25 bg-shield-blue/[0.1] text-[#88aaff]",
  success: "border-success/25 bg-success/[0.09] text-success",
  warning: "border-warning/25 bg-warning/[0.09] text-warning",
  danger: "border-danger/25 bg-danger/[0.09] text-danger",
  muted: "border-white/[0.07] bg-white/[0.025] text-mist",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
