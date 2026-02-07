import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import BottomTabBar from '@/components/BottomTabBar' // 假設路徑
import './globals.css' // 先 comment 呢行

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '日本旅遊規劃',
  description: 'Trip Planner'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-HK" className={inter.className} suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <meta name="robots" content="notranslate" />
      </head>
      <body className="min-h-dvh pb-20 font-sans bg-gradient-to-br from-slate-50 to-blue-50 antialiased">
        {children}
        <BottomTabBar />
      </body>
    </html>
  )
}