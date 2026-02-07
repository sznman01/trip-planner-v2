"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/store/theme";

export default function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
