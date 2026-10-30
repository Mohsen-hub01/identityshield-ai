import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountryActivity } from "@/types/api";

export function CountryBars({ data }: { data: CountryActivity[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 28)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 2, right: 12, bottom: 0, left: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid
          strokeDasharray="3 4"
          stroke="rgba(148,163,184,0.08)"
          horizontal={false}
        />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="country"
          width={86}
          tick={{ fill: "#94A3B8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.025)" }}
          contentStyle={{
            background: "rgba(8,11,18,0.96)",
            border: "1px solid rgba(148,163,184,0.14)",
            borderRadius: 12,
            fontSize: 11,
            color: "#F5F8FC",
          }}
        />
        <Bar dataKey="events" name="Events" radius={[0, 5, 5, 0]} barSize={9}>
          {data.map((entry, index) => (
            <Cell
              key={entry.country}
              fill={
                index === 0
                  ? "#00D9FF"
                  : index < 3
                    ? "rgba(0,217,255,0.75)"
                    : "rgba(0,217,255,0.42)"
              }
            />
          ))}
        </Bar>
        <Bar
          dataKey="high_risk"
          name="High-risk"
          radius={[0, 5, 5, 0]}
          barSize={4}
        >
          {data.map((entry) => (
            <Cell key={entry.country} fill="#FF4D6D" fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
