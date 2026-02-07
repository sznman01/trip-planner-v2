"use client";

import { useMemo } from "react";
import { useThemeStore } from "@/lib/store/theme";
import { Moon, Sun, Leaf } from "lucide-react";

function labelOf(t: string) {
  if (t === "dark") return "深色";
  if (t === "matcha") return "抹茶";
  return "櫻花";
}

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);

  const Icon = useMemo(() => {
    if (theme === "dark") return Moon;
    if (theme === "matcha") return Leaf;
    return Sun;
  }, [theme]);

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="fixed right-4 bottom-20 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur-md hover:opacity-95"
      aria-label="切換主題"
    >
      <Icon className="h-4 w-4" />
      <span>{labelOf(theme)}</span>
    </button>
  );
}