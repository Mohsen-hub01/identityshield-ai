import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function RiskTimeline({
  values,
  height = 180,
}: {
  values: Array<{ event_id: string; risk_score: number }>;
  height?: number;
}) {
  const data = values.map((value, index) => ({
    index: index + 1,
    risk: value.risk_score,
    event: value.event_id,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="risk-timeline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFB547" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#FFB547" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 4"
          stroke="rgba(148,163,184,0.09)"
          vertical={false}
        />
        <XAxis dataKey="index" hide />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#94A3B8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(8,11,18,0.96)",
            border: "1px solid rgba(148,163,184,0.14)",
            borderRadius: 12,
            fontSize: 11,
            color: "#F5F8FC",
          }}
          labelFormatter={(_, payload) => {
            const event = payload?.[0]?.payload as { event?: string } | undefined;
            return event?.event ?? "Event";
          }}
          formatter={(value) => [String(value), "Risk score"]}
        />
        <Area
          type="monotone"
          dataKey="risk"
          stroke="#FFB547"
          strokeWidth={1.6}
          fill="url(#risk-timeline-fill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
