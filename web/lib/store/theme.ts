import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "white" | "beige" | "pink" | "blue" | "black";

const ORDER: ThemeName[] = ["white", "beige", "pink", "blue", "black"];

export type ThemeState = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  cycleTheme: () => void;

  fontSize: number; // px
  setFontSize: (n: number) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "beige",
      setTheme: (t) => set({ theme: t }),

      cycleTheme: () => {
        const cur = get().theme;
        const idx = ORDER.indexOf(cur);
        const next = ORDER[(idx + 1) % ORDER.length] ?? "beige";
        set({ theme: next });
      },

      fontSize: 16,
      setFontSize: (n) =>
        set({ fontSize: Math.max(12, Math.min(22, Math.round(n))) }),
    }),
    { name: "theme_v2", version: 2 }
  )
);
