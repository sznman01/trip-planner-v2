import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "sakura" | "matcha" | "dark";

type ThemeState = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  cycleTheme: () => void;
};

const ORDER: ThemeName[] = ["sakura", "matcha", "dark"];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "sakura",
      setTheme: (t) => set({ theme: t }),
      cycleTheme: () => {
        const cur = get().theme;
        const idx = ORDER.indexOf(cur);
        const next = ORDER[(idx + 1 + ORDER.length) % ORDER.length] ?? "sakura";
        set({ theme: next });
      },
    }),
    {
      name: "theme_v1",
      version: 1,
    }
  )
);
