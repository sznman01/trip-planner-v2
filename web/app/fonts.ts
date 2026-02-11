// app/fonts.ts
import localFont from "next/font/local"

export const myFont = localFont({
  src: [
    { path: "./fonts/ZenMaruGothic-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/ZenMaruGothic-Medium.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-my",
  display: "swap",
})