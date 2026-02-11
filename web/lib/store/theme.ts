import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "white" | "beige" | "pink" | "blue" | "black";

type ThemeState = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;

  fontSize: number; // px
  setFontSize: (n: number) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "beige",
      setTheme: (t) => set({ theme: t }),

      fontSize: 16,
      setFontSize: (n) =>
        set({ fontSize: Math.max(12, Math.min(22, Math.round(n))) }),
    }),
    { name: "theme_v2", version: 2 }
  )
);
