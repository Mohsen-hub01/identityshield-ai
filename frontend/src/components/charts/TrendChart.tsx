import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsResponse } from "@/types/api";

export function TrendChart({
  data,
  height = 250,
}: {
  data: AnalyticsResponse["sequence_trend"];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid
          strokeDasharray="3 4"
          stroke="rgba(148,163,184,0.09)"
          vertical={false}
        />
        <XAxis
          dataKey="sequence"
          tick={{ fill: "#94A3B8", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
          tick={{ fill: "#94A3B8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(8,11,18,0.96)",
            border: "1px solid rgba(148,163,184,0.14)",
            borderRadius: 12,
            fontSize: 11,
            color: "#F5F8FC",
          }}
          formatter={(value, name) => [
            `${(Number(value) * 100).toFixed(1)}%`,
            name === "suspicious_share" ? "Suspicious" : "High-risk",
          ]}
        />
        <Line
          type="monotone"
          dataKey="suspicious_share"
          stroke="#00D9FF"
          strokeWidth={1.8}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="high_risk_share"
          stroke="#FF4D6D"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
