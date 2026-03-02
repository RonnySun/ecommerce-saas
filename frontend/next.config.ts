import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产 Docker 镜像优化：只保留必要文件，镜像从 ~1GB 缩小到 ~150MB
  output: "standalone",

  // 本地开发代理：把 /api/ 转发到后端 8000 端口（生产环境由 nginx 处理）
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
