import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeSync from "@/components/ThemeSync";
import BottomTabBar from "@/components/BottomTabBar";
import "./globals.css";                // ✅ 一定要 import

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "日本旅遊規劃",
  description: "Trip Planner",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-HK"
      className={inter.className}
      suppressHydrationWarning
    >
      <head>
        <meta name="google" content="notranslate" />
        <meta name="robots" content="notranslate" />
      </head>
      <body className="min-h-dvh pb-20 font-sans antialiased">
        {/* ✅ 掛喺 body 入面，一 render app 就同步 theme */}
        <ThemeSync />
        {children}
        <BottomTabBar />
      </body>
    </html>
  );
}
