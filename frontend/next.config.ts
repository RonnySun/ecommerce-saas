import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产 Docker 镜像优化：只保留必要文件，镜像从 ~1GB 缩小到 ~150MB
  output: "standalone",
};

export default nextConfig;
