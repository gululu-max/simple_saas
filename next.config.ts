import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用 gzip 压缩
  compress: true,

  devIndicators: {},
  turbopack: {},

  webpack: (config: any) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**'],
    };
    return config;
  },

  images: {
    formats: ["image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // 实验性优化
  experimental: {
    // 自动优化第三方脚本加载
    optimizePackageImports: [
      "lucide-react",
      "@supabase/supabase-js",
    ],
  },
};

export default nextConfig;