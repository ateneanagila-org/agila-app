"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Shared palette ───────────────────────────────────────────────────────────

export const CHART_COLORS = {
  green: "#239547",
  greenLight: "#5fa35e",
  orange: "#eb6324",
  yellow: "#fff967",
  pink: "#ffc2d6",
  dark: "#341111",
  blue: "#4285F4",
  red: "#e25555",
  purple: "#7c4b9f",
};

// ── Horizontal Bar Chart ─────────────────────────────────────────────────────

export type BarDatum = { label: string; value: number };

type HorizontalBarChartProps = {
  data: BarDatum[];
  title?: string;
  color?: string;
  /** Pixel height per row; chart grows with data */
  rowHeight?: number;
};

export function HorizontalBarChart({
  data,
  title,
  color = CHART_COLORS.green,
  rowHeight = 18,
}: HorizontalBarChartProps) {
  const height = Math.max(260, data.length * rowHeight + 60);

  return (
    <div className="flex h-full w-full flex-col">
      {title ? (
        <p className="mb-2 text-center font-heading text-sm font-bold text-brand-green">
          {title}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 8, right: 24, left: 8, bottom: 24 }}
            >
              <XAxis
                type="number"
                tick={{ fill: "#341111", fontSize: 10, fontWeight: 600 }}
                stroke="#341111"
                strokeOpacity={0.25}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={90}
                tick={{ fill: "#341111", fontSize: 10, fontWeight: 600 }}
                stroke="#341111"
                strokeOpacity={0.25}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "#341111", fillOpacity: 0.05 }}
                contentStyle={{
                  background: "#341111",
                  border: "none",
                  borderRadius: 10,
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                }}
                labelStyle={{ color: "#fff967", fontWeight: 700 }}
                itemStyle={{ color: "white" }}
                formatter={((value: number) => [value, "Cats"]) as never}
              />
              <Bar
                dataKey="value"
                fill={color}
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
                name="Cat Count"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Pie Chart ────────────────────────────────────────────────────────────────

export type PieSlice = { label: string; value: number; color: string };

type PieChartProps = {
  data: PieSlice[];
  title?: string;
};

export function PieChart({ data, title }: PieChartProps) {
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex h-full w-full flex-col">
      {title ? (
        <p className="mb-2 text-center font-heading text-sm font-bold text-brand-green">
          {title}
        </p>
      ) : null}
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-brand-dark/50">
          No data
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Tooltip
                contentStyle={{
                  background: "#341111",
                  border: "none",
                  borderRadius: 10,
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                }}
                labelStyle={{ color: "#fff967", fontWeight: 700 }}
                itemStyle={{ color: "white" }}
                formatter={((value: number, name: string) => [
                  `${value} (${Math.round((value / total) * 100)}%)`,
                  name,
                ]) as never}
              />
              <Legend
                verticalAlign="bottom"
                iconType="square"
                wrapperStyle={{ fontSize: 11, fontWeight: 600, color: "#341111" }}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="45%"
                outerRadius="80%"
                paddingAngle={1}
                stroke="white"
                strokeWidth={2}
                label={({ percent }: { percent?: number }) =>
                  percent && percent > 0.05
                    ? `${Math.round((percent ?? 0) * 100)}%`
                    : ""
                }
                labelLine={false}
              >
                {data.map((slice, i) => (
                  <Cell key={`${slice.label}-${i}`} fill={slice.color} />
                ))}
              </Pie>
            </RePieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
