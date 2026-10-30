import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { RiskDistributionItem } from "@/types/api";
import { cn, formatNumber } from "@/lib/utils";

const COLORS: Record<string, string> = {
  LOW: "#20D6A0",
  MEDIUM: "#FFB547",
  HIGH: "#FF4D6D",
};

export function RiskDonut({
  data,
  className,
}: {
  data: RiskDistributionItem[];
  className?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const high = data.find((item) => item.level === "HIGH")?.count ?? 0;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="level"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={3}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((item) => (
                <Cell key={item.level} fill={COLORS[item.level]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold tracking-[-0.04em] text-cloud">
            {formatNumber(total)}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-mist">
            Events
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {data.map((item) => (
          <div key={item.level} className="flex items-center gap-2.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[item.level] }}
            />
            <span className="min-w-0 flex-1 text-[11px] capitalize text-mist">
              {item.level.toLowerCase()} risk
            </span>
            <span className="font-mono text-[11px] text-cloud">
              {formatNumber(item.count)}
            </span>
            <span className="w-10 text-right font-mono text-[10px] text-mist">
              {(item.share * 100).toFixed(0)}%
            </span>
          </div>
        ))}
        <div className="border-t border-white/[0.07] pt-3 text-[10px] leading-4 text-mist/70">
          {formatNumber(high)} high-risk events require analyst attention in
          this synthetic dataset.
        </div>
      </div>
    </div>
  );
}
