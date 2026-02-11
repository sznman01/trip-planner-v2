import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { myFont } from "./fonts"
import ThemeSync from "@/components/ThemeSync";
import BottomTabBar from "@/components/BottomTabBar";
import "./globals.css";                // ✅ 一定要 import

const inter =  Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "旅遊規劃",
  description: "Trip Planner",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-HK"
      className={`${inter.variable} ${myFont.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh pb-20 font-sans antialiased">
        <ThemeSync />
        {children}
        <BottomTabBar />
      </body>
    </html>
  );
}
