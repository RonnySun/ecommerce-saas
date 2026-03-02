from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings


# ---- 自动启动飞书监听器 ----

@asynccontextmanager
async def lifespan(app: FastAPI):
    """服务启动时自动拉起飞书 WebSocket 监听器"""
    await _auto_start_feishu()
    yield
    # 服务停止时关闭监听器
    try:
        from app.services import feishu_listener
        if feishu_listener.is_running():
            feishu_listener.stop_listener()
    except Exception:
        pass


async def _auto_start_feishu():
    """
    从数据库读取所有租户的飞书配置并启动监听器。
    当前版本只支持单租户（tenant_id=1），多租户后续扩展。
    """
    try:
        from sqlalchemy import text as sa_text
        from app.db.base import AsyncSessionLocal
        from app.services import feishu_listener

        async with AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    sa_text(
                        "SELECT content FROM agent_configs "
                        "WHERE tenant_id = 1 AND file_name = 'feishu'"
                    )
                )
            ).fetchone()

        if not row:
            print("[Feishu] 未找到飞书配置，跳过自动启动")
            return

        config = feishu_listener.parse_feishu_config(row[0])
        app_id     = config.get("app_id", "")
        app_secret = config.get("app_secret", "")
        tenant_id  = config.get("tenant_id", 1)

        if not app_id or app_id.startswith("cli_xxx") or not app_secret:
            print("[Feishu] 飞书配置不完整，跳过自动启动")
            return

        feishu_listener.start_listener(app_id, app_secret, tenant_id)

    except Exception as e:
        print(f"[Feishu] 自动启动失败（可忽略，服务仍正常）: {e}")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    lifespan=lifespan,
)

# CORS（允许前端访问）
# 生产环境通过 ALLOWED_ORIGINS 环境变量配置，多个域名用逗号分隔
import os
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": f"{settings.APP_NAME} API is running 🚀"}

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}

# 路由注册
from app.api.v1 import router
app.include_router(router, prefix="/api/v1")
