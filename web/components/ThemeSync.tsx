"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/store/theme";

export default function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);
  const fontSize = useThemeStore((s) => s.fontSize);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--app-font-size", `${fontSize}px`);
  }, [theme, fontSize]);

  return null;
}
