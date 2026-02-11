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
  
  const fontSize = useThemeStore((s) => s.fontSize);
const setFontSize = useThemeStore((s) => s.setFontSize);

const isDark = theme === "black";

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

       <div className="mt-4 flex items-center gap-4 overflow-x-auto pb-2">
  {themes.map((t) => {
    const active = theme === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => setTheme(t.id)}
        className={[
          "h-14 w-14 shrink-0 rounded-full border transition",
          active
            ? "ring-4 ring-[color:var(--ring)] border-[color:var(--primary)]"
            : "border-[color:var(--border)]",
        ].join(" ")}
        aria-label={`主題：${t.label}`}
        style={{
          // 重要：色盤要「固定顏色」，唔係 var(--background)
          // 你可以先用呢幾隻示意色，之後再同你 tokens 對齊
          background:
            t.id === "white"
              ? "#F8F9FA"
              : t.id === "beige"
              ? "#FFF7ED"
              : t.id === "pink"
              ? "#FB7185"
              : t.id === "blue"
              ? "#3B82F6"
              : "#0B0F14", // black
        }}
      />
    );
  })}
  </div>

{/* 字體大小 */}
<div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
  <div className="flex items-center justify-between gap-3">
    <div>
      <div className="text-sm font-semibold text-[color:var(--foreground)]">字體大小</div>
      <div className="mt-1 text-xs text-[color:var(--muted)]">全站生效</div>
    </div>
    <div className="tabular-nums text-sm font-semibold text-[color:var(--foreground)]">
      {fontSize}px
    </div>
  </div>

  <input
    className="mt-4 w-full accent-[color:var(--primary)]"
    type="range"
    min={12}
    max={22}
    step={1}
    value={fontSize}
    onChange={(e) => setFontSize(Number(e.target.value))}
    aria-label="字體大小"
  />

  <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm text-[color:var(--foreground)]">
    預覽：呢段文字會跟住字體大小改變
  </div>
</div>

{/* 深色模式 */}
<div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
  <div className="flex items-center justify-between gap-3">
    <div>
      <div className="text-sm font-semibold text-[color:var(--foreground)]">深色模式</div>
      <div className="mt-1 text-xs text-[color:var(--muted)]">切換到黑色主題</div>
    </div>

    <button
      type="button"
      onClick={() => setTheme(isDark ? "beige" : "black")}
      className={[
        "h-9 w-14 rounded-full border transition relative",
        isDark
          ? "bg-[color:var(--primary)] border-[color:var(--primary)]"
          : "bg-[color:var(--background)] border-[color:var(--border)]",
      ].join(" ")}
      aria-label="切換深色模式"
      aria-pressed={isDark}
    >
      <span
        className={[
          "absolute top-1 h-7 w-7 rounded-full bg-[color:var(--card)] shadow-sm transition",
          isDark ? "left-6" : "left-1",
        ].join(" ")}
      />
    </button>
  </div>
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
