import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "white" | "beige" | "pink" | "blue" | "black";

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  cycleTheme: () => void; // ✅ 加返
}

const ORDER: ThemeName[] = ["white", "beige", "pink", "blue", "black"];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "beige",
          setTheme: (theme) => set({ theme }),
      cycleTheme: () => {
        const cur = get().theme;
        const idx = ORDER.indexOf(cur);
        const next = ORDER[(idx + 1 + ORDER.length) % ORDER.length] ?? "beige";
        set({ theme: next });
      },
    }),
    { name: "travel-theme", version: 1 }
  )
);
