"use client";

export const dynamic = 'force-dynamic';
import { useThemeStore } from "@/lib/store/theme";
import { Palette, ArrowLeft } from "lucide-react";
import Link from "next/link";

const themes = [
  { id: "white" as const, label: "白", desc: "明亮乾淨" },
  { id: "beige" as const, label: "米", desc: "溫暖舒適" },
  { id: "pink" as const, label: "粉", desc: "櫻花浪漫" },
  { id: "blue" as const, label: "藍", desc: "清新海洋" },
  { id: "black" as const, label: "黑", desc: "暗黑模式" },
];

export default function SettingsPage() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="px-4 pt-4 pb-10 min-h-dvh bg-gradient-to-b from-[color:var(--background)] to-[color:var(--card)]">
      {/* 左上角返回首頁 ← 新增！ */}
      <Link 
        href="/" 
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-semibold text-[color:var(--muted)] shadow-sm backdrop-blur-md hover:opacity-95 opacity-70"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>返回我的旅程</span>
      </Link>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--foreground)] flex items-center gap-3">
            <Palette className="h-10 w-10 text-[color:var(--primary)]" />
            主題設定
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`group h-auto p-6 flex flex-col items-center gap-3 rounded-2xl border transition-all backdrop-blur-md shadow-sm hover:shadow-lg ${
                theme === t.id 
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/5 ring-2 ring-[color:var(--primary)]/30" 
                  : "border-[color:var(--border)] hover:border-[color:var(--ring)] hover:bg-[color:var(--card)]"
              }`}
            >
              {/* 主題預覽卡 */}
              <div 
                className="w-20 h-20 rounded-xl shadow-lg group-hover:scale-105 transition-transform"
                style={{ 
                  backgroundColor: `var(--background)`, 
                  color: `var(--foreground)` 
                }}
              />
              <div className="text-center">
                <div className="text-lg font-bold">{t.label}</div>
                <div className="text-xs text-[color:var(--muted-foreground)]">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            目前使用：{' '}
            <span className="font-semibold text-[color:var(--foreground)]">
              {themes.find((t) => t.id === theme)?.label || "白"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
