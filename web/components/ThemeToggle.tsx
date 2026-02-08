"use client";

import { useMemo } from "react";
import { useThemeStore, type ThemeName } from "@/lib/store/theme";
import { Palette } from "lucide-react";  // 用單一 Palette icon

function labelOf(t: ThemeName) {
  const labels: Record<ThemeName, string> = {
    white: "白",
    beige: "米",
    pink: "粉",
    blue: "藍",
    black: "黑",
  };
  return labels[t];
}

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="fixed right-4 bottom-20 z-50 inline-flex items-center gap-2
           border border-[color:var(--border)] bg-[color:var(--card)]
           px-4 py-2 text-sm font-semibold text-[color:var(--muted)]
           shadow-sm backdrop-blur-md hover:opacity-95 opacity-70"
      aria-label={`切換到 ${labelOf(theme)}`}
    >
      <Palette className="h-4 w-4" />
      <span>{labelOf(theme)}</span>
    </button>
  );
}
