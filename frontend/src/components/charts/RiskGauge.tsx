import { cn } from "@/lib/utils";

export function RiskGauge({
  value,
  label = "Rule risk score",
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 52;
  const circumference = Math.PI * 2 * radius;
  const color =
    clamped >= 70 ? "#FF4D6D" : clamped >= 30 ? "#FFB547" : "#20D6A0";
  const level = clamped >= 70 ? "HIGH" : clamped >= 30 ? "MEDIUM" : "LOW";

  return (
    <div className={cn("relative flex size-36 items-center justify-center", className)}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.11)"
          strokeWidth="7"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold tracking-[-0.05em] text-cloud">
          {Math.round(clamped)}
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
          {level}
        </span>
        <span className="mt-1 text-[8px] uppercase tracking-[0.12em] text-mist/60">
          {label}
        </span>
      </div>
    </div>
  );
}
