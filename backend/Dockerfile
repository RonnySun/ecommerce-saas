# ── 构建 FastAPI 后端镜像 ─────────────────────────
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（pandas/openpyxl 需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 先复制依赖文件，利用 Docker 层缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制源代码
COPY . .

# 启动命令（生产用 4 个 worker）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
