"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/store/theme";

export default function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme;       // ✅ 只改 data-theme
    console.log("✅ Theme applied:", theme);
  }, [theme]);

  return null;
}
