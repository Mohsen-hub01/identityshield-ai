import type { ShapExplanation } from "@/types/api";
import { cn } from "@/lib/utils";

export function ShapBars({
  explanations,
  className,
  limit = 8,
}: {
  explanations: ShapExplanation[];
  className?: string;
  limit?: number;
}) {
  const items = [...explanations]
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, limit);
  const maxAbs = Math.max(...items.map((item) => Math.abs(item.shap_value)), 0.001);

  return (
    <div className={cn("space-y-3.5", className)}>
      <div className="flex items-center justify-between text-[10px] text-mist">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" /> lowers suspicion
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-danger" /> raises suspicion
        </span>
      </div>
      {items.map((item) => {
        const positive = item.shap_value > 0;
        const width = (Math.abs(item.shap_value) / maxAbs) * 50;
        return (
          <div key={item.factor}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[11px] text-mist">
                {item.factor}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-[10px]",
                  positive
                    ? "text-danger"
                    : item.shap_value < 0
                      ? "text-success"
                      : "text-mist",
                )}
              >
                {item.shap_value > 0 ? "+" : ""}
                {item.shap_value.toFixed(4)}
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <span className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
              <span
                className={cn(
                  "absolute inset-y-0 rounded-full transition-[width] duration-700",
                  positive
                    ? "left-1/2 bg-gradient-to-r from-danger to-danger/55"
                    : "right-1/2 bg-gradient-to-l from-success to-success/55",
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
      {!items.length ? (
        <p className="py-6 text-center text-xs text-mist">
          No SHAP contributions returned.
        </p>
      ) : null}
    </div>
  );
}
