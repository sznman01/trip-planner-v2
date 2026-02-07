/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
    turbopack: {
      root: process.cwd(),  // ✅ 用 process.cwd()
    },
  },

  // 支援動態路由
  trailingSlash: true,
  // 圖片優化
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig
