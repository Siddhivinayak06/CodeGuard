"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

export default function ActivityChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={200} minWidth={0}>
      <AreaChart data={data}>
        <defs>
          <linearGradient
            id="colorSubs"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor="#8b5cf6"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="#8b5cf6"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="rgba(156, 163, 175, 0.2)"
        />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#9ca3af", fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#9ca3af", fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            borderRadius: "12px",
            border: "none",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        />
        <Area
          type="monotone"
          dataKey="submissions"
          stroke="#8b5cf6"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorSubs)"
          isAnimationActive={true}
          animationDuration={1500}
          animationEasing="ease-in-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
