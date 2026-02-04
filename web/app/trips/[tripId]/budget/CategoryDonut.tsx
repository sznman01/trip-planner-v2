"use client";

import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

type ExpenseLike = {
  category: "food" | "attraction" | "shopping" | "transport" | "other" | (string & {});
  amountHKD: number;
};

const LABELS: Record<string, string> = {
  food: "餐飲",
  attraction: "觀光",
  shopping: "購物",
  transport: "交通",
  other: "其他",
};

const COLORS: Record<string, string> = {
  food: "#F59E0B",
  attraction: "#3B82F6",
  shopping: "#EC4899",
  transport: "#10B981",
  other: "#94A3B8",
};

export function CategoryDonut({ expenses }: { expenses: ExpenseLike[] }) {
  const data = useMemo(() => {
    const sums: Record<string, number> = { food: 0, attraction: 0, shopping: 0, transport: 0, other: 0 };

    for (const e of expenses ?? []) {
      const k = String(e.category ?? "other");
      const v = Number(e.amountHKD ?? 0);
      if (!Number.isFinite(v)) continue;
      if (k in sums) sums[k] += v;
      else sums.other += v;
    }

    return Object.entries(sums)
      .map(([key, value]) => ({
        key,
        name: LABELS[key] ?? key,
        value: Math.max(0, value),
        color: COLORS[key] ?? "#94A3B8",
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const total = useMemo(() => data.reduce((s, x) => s + x.value, 0), [data]);

  if (!data.length) {
    return <div className="text-sm text-slate-500">未有支出記錄</div>;
  }

  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
      <div className="relative h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={52} outerRadius={76} paddingAngle={2} stroke="transparent">
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any) => {
                const v = Number(value ?? 0);
                const pct = total ? ((v / total) * 100).toFixed(1) : "0.0";
                return [`HKD ${v.toLocaleString("zh-HK")} (${pct}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-[11px] text-slate-500">已花費</div>
            <div className="text-sm font-extrabold text-slate-900">{total.toLocaleString("zh-HK")}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {data.slice(0, 4).map((x) => {
          const pct = total ? (x.value / total) * 100 : 0;
          return (
            <div key={x.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="truncate text-slate-700">{x.name}</span>
                  <span className="tabular-nums text-slate-500">{pct.toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full" style={{ width: `${pct}%`, background: x.color }} />
                </div>
              </div>
            </div>
          );
        })}
        {data.length > 4 ? <div className="text-[11px] text-slate-400">其餘請滑過圓環查看</div> : null}
      </div>
    </div>
  );
}
