"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
];

interface DonutChartProps {
  data: { name: string; value: number; color?: string }[];
  title: string;
}

export function DonutChart({ data, title }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="w-[180px] h-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(value: number) => [
                    `${value.toLocaleString("pt-BR")} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                    "",
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            {data.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-2 text-sm">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      entry.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
                  }}
                />
                <span className="text-muted-foreground truncate">{entry.name}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
