import { cn } from "@/lib/utils";

export function Progress({
  value,
  tone = "cyan",
  className,
  label,
}: {
  value: number;
  tone?: "cyan" | "success" | "warning" | "danger" | "blue";
  className?: string;
  label?: string;
}) {
  const tones = {
    cyan: "from-shield-cyan to-shield-teal",
    success: "from-success to-shield-teal",
    warning: "from-warning to-[#ff8a5b]",
    danger: "from-danger to-[#ff7a95]",
    blue: "from-shield-blue to-shield-cyan",
  };

  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-mist">
          <span>{label}</span>
          <span className="font-mono text-cloud">{Math.round(value)}%</span>
        </div>
      ) : null}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-[width] duration-700",
            tones[tone],
          )}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
