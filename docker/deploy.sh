#!/bin/bash
# =====================================================
#  一键部署脚本（在服务器上执行）
#  用法：chmod +x deploy.sh && ./deploy.sh
# =====================================================
set -e   # 遇错立即停止

echo "🚀 开始部署..."

# 检查 .env 是否存在
if [ ! -f ".env" ]; then
    echo "❌ 未找到 .env 文件！请先复制 .env.example 并填写配置"
    exit 1
fi

# 拉取最新代码（如果是 git 仓库）
if [ -d "../.git" ]; then
    echo "📦 拉取最新代码..."
    git -C .. pull
fi

# 构建并启动所有服务
echo "🔨 构建 Docker 镜像..."
docker compose -f docker-compose.prod.yml build --no-cache

echo "🗄️  启动数据库..."
docker compose -f docker-compose.prod.yml up -d postgres redis
sleep 8  # 等待数据库就绪

echo "⚡ 执行数据库迁移..."
docker compose -f docker-compose.prod.yml run --rm backend \
    python -m alembic upgrade head 2>/dev/null || echo "（跳过迁移，可能未配置 alembic）"

echo "▶️  启动所有服务..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "✅ 部署完成！"
echo "   查看状态：docker compose -f docker-compose.prod.yml ps"
echo "   查看日志：docker compose -f docker-compose.prod.yml logs -f"
