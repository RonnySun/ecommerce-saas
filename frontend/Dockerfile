# ── 构建 Next.js 前端镜像 ─────────────────────────
# 分两阶段：先 build，再 run（镜像更小）

# 阶段1：构建
FROM node:20-alpine AS builder

WORKDIR /app

# 接收构建时的 API 地址（必须在 build 阶段注入）
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 阶段2：运行（只保留必要文件）
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# 复制构建产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
