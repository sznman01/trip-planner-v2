import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "white" | "beige" | "pink" | "blue" | "black";

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  cycleTheme: () => void; // ✅ 加返
}

export const useThemeStore = create(
  persist<ThemeState>(
    (set, get) => ({
      theme: "beige",
      setTheme: (newTheme: ThemeName) => {
        set({ theme: newTheme });
        console.log("Theme changed to:", newTheme);
      },
      cycleTheme: () => { // ✅ 實作
        const themes: ThemeName[] = ["white", "beige", "pink", "blue", "black"];
        const current = get().theme;
        const currentIndex = themes.indexOf(current);
        const nextIndex = (currentIndex + 1) % themes.length;
        set({ theme: themes[nextIndex] });
      },
    }),
    { name: "travel-theme" }
  )
);
