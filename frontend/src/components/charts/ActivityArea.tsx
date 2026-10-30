import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HourlyActivity } from "@/types/api";

export function ActivityArea({
  data,
  height = 240,
}: {
  data: HourlyActivity[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
        <defs>
          <linearGradient id="events-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D9FF" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#00D9FF" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="suspicious-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF4D6D" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#FF4D6D" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 4"
          stroke="rgba(148,163,184,0.09)"
          vertical={false}
        />
        <XAxis
          dataKey="hour"
          tickFormatter={(value: number) => `${value}h`}
          tick={{ fill: "#94A3B8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={2}
        />
        <YAxis
          tick={{ fill: "#94A3B8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={38}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(8,11,18,0.96)",
            border: "1px solid rgba(148,163,184,0.14)",
            borderRadius: 12,
            fontSize: 11,
            color: "#F5F8FC",
          }}
          labelFormatter={(value) => `${value}:00`}
        />
        <Area
          type="monotone"
          dataKey="events"
          name="Events"
          stroke="#00D9FF"
          strokeWidth={1.8}
          fill="url(#events-fill)"
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="suspicious"
          name="Labeled suspicious"
          stroke="#FF4D6D"
          strokeWidth={1.4}
          fill="url(#suspicious-fill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
