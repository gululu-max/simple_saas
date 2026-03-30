import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
  },
  turbopack: {
  },
  webpack: (config: any) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**'],
    };
    return config;
  },

  // 图片优化配置
  images: {
    // Next.js Image 组件输出格式优先级
    formats: ["image/webp"],
    // 针对移动端优化的设备宽度断点
    deviceSizes: [640, 750, 828, 1080, 1200],
    // 缩略图尺寸
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;