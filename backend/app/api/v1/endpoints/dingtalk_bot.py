"""
钉钉监听器管理接口

GET  /api/v1/dingtalk/status  — 查询监听状态
POST /api/v1/dingtalk/start   — 从配置启动监听
POST /api/v1/dingtalk/stop    — 停止监听
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.api.v1.endpoints.bot import BOT_API_TOKEN
from app.services.channel_config import resolve_dingtalk_runtime_config

router = APIRouter()


def _check_token(token: str) -> None:
    if token != BOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="无效的 Bot 令牌")


@router.get("/status")
async def dingtalk_status(token: str = Query(None)):
    _check_token(token)
    from app.services import dingtalk_listener
    return {"running": dingtalk_listener.is_running()}


@router.post("/start")
async def dingtalk_start(
    tenant_id: int = Query(1),
    token: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    _check_token(token)

    from app.services import dingtalk_listener

    if dingtalk_listener.is_running():
        if dingtalk_listener.is_ws_alive():
            return {"ok": True, "message": "钉钉监听器已在运行中"}
        dingtalk_listener.stop_listener()

    config = await resolve_dingtalk_runtime_config(db, tenant_id)
    app_key = (config.get("app_key") or "").strip()
    app_secret = (config.get("app_secret") or "").strip()
    robot_code = (config.get("robot_code") or "").strip()

    if not app_key or not app_secret or not robot_code:
        raise HTTPException(
            status_code=400,
            detail="钉钉配置不完整，请在「秒算配置 → 渠道接入」填写 AppKey / AppSecret / RobotCode",
        )

    dingtalk_listener.start_listener(app_key, app_secret, robot_code, tenant_id)
    return {"ok": True, "message": f"钉钉监听器启动中（AppKey: {app_key}）"}


@router.post("/stop")
async def dingtalk_stop(token: str = Query(None)):
    _check_token(token)
    from app.services import dingtalk_listener
    dingtalk_listener.stop_listener()
    return {"ok": True, "message": "钉钉监听器已停止"}
