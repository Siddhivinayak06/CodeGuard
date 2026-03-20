"use client";

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function StatusChart({ data, total }: { data: any[], total: number }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={200} minWidth={0}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            isAnimationActive={true}
            animationBegin={500}
            animationDuration={1200}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center Stat */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {total}
        </span>
        <span className="text-xs text-gray-500">Total</span>
      </div>
    </>
  );
}
