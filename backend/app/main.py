from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings


# ---- 自动启动渠道监听器 ----

@asynccontextmanager
async def lifespan(app: FastAPI):
    """服务启动时按当前渠道自动拉起监听器"""
    try:
        await asyncio.wait_for(_auto_start_channel(), timeout=5)
    except asyncio.TimeoutError:
        print("[Channel] 自动启动超时（已跳过，不影响API服务）")
    except Exception as e:
        print(f"[Channel] 自动启动异常（已跳过，不影响API服务）: {e}")
    yield
    # 服务停止时关闭监听器（飞书 + 钉钉）
    try:
        from app.services import feishu_listener, dingtalk_listener
        if feishu_listener.is_running():
            feishu_listener.stop_listener()
        if dingtalk_listener.is_running():
            dingtalk_listener.stop_listener()
    except Exception:
        pass


async def _auto_start_channel():
    """
    从数据库读取渠道配置并启动监听器。
    当前版本只支持单租户（tenant_id=1），多租户后续扩展。
    """
    try:
        from app.db.base import AsyncSessionLocal
        from app.services import feishu_listener, dingtalk_listener
        from app.services.channel_config import (
            load_channel_config,
            resolve_feishu_runtime_config,
            resolve_dingtalk_runtime_config,
        )

        async with AsyncSessionLocal() as db:
            channel_cfg = await load_channel_config(db, tenant_id=1)
            provider = (channel_cfg.get("provider") or "").lower()

            if provider == "feishu":
                config = await resolve_feishu_runtime_config(db, tenant_id=1)
                app_id = config.get("app_id", "")
                app_secret = config.get("app_secret", "")
                tenant_id = config.get("tenant_id", 1)
                if not app_id or app_id.startswith("cli_xxx") or not app_secret:
                    print("[Feishu] 飞书配置不完整，跳过自动启动")
                    return
                dingtalk_listener.stop_listener()
                feishu_listener.start_listener(app_id, app_secret, tenant_id)
                return

            if provider == "dingtalk":
                config = await resolve_dingtalk_runtime_config(db, tenant_id=1)
                app_key = config.get("app_key", "")
                app_secret = config.get("app_secret", "")
                robot_code = config.get("robot_code", "")
                tenant_id = config.get("tenant_id", 1)
                if not app_key or not app_secret or not robot_code:
                    print("[DingTalk] 钉钉配置不完整，跳过自动启动")
                    return
                feishu_listener.stop_listener()
                dingtalk_listener.start_listener(app_key, app_secret, robot_code, tenant_id)
                return

            print("[Channel] 当前渠道未配置，跳过自动启动")

    except Exception as e:
        print(f"[Channel] 自动启动失败（可忽略，服务仍正常）: {e}")


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
