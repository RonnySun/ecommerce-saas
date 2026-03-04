"""
飞书监听器管理接口

GET  /api/v1/feishu/status  — 查询监听状态
POST /api/v1/feishu/start   — 从配置启动 WebSocket 监听
POST /api/v1/feishu/stop    — 停止 WebSocket 监听
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.api.v1.endpoints.bot import BOT_API_TOKEN
from app.services.channel_config import resolve_feishu_runtime_config

router = APIRouter()


def _check_token(token: str) -> None:
    if token != BOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="无效的 Bot 令牌")


@router.get("/status")
async def feishu_status(token: str = Query(None)):
    """查询飞书 WebSocket 监听器当前运行状态"""
    _check_token(token)
    from app.services import feishu_listener
    return {"running": feishu_listener.is_running()}


@router.post("/start")
async def feishu_start(
    tenant_id: int = Query(1),
    token: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    从数据库读取飞书配置（FEISHU.md），启动 WebSocket 监听器。
    如果监听器已运行则直接返回成功。
    """
    _check_token(token)

    from app.services import feishu_listener

    if feishu_listener.is_running():
        # 仅在底层 WS 真连接存活时才判定“已在运行”
        if feishu_listener.is_ws_alive():
            return {"ok": True, "message": "飞书监听器已在运行中"}
        # 状态漂移：running=true 但 WS 已断，先清理再重启
        feishu_listener.stop_listener()

    config = await resolve_feishu_runtime_config(db, tenant_id)
    app_id = config.get("app_id", "")
    app_secret = config.get("app_secret", "")
    feishu_tenant_id = config.get("tenant_id", tenant_id)

    # 验证占位符未被替换
    if not app_id or app_id.startswith("cli_xxx") or not app_secret or app_secret.startswith("xxx"):
        raise HTTPException(
            status_code=400,
            detail="飞书配置不完整，请在「秒算配置 → 渠道接入」填写真实的 App ID 和 App Secret",
        )

    feishu_listener.start_listener(app_id, app_secret, feishu_tenant_id)
    return {"ok": True, "message": f"飞书监听器启动中（App ID: {app_id}）"}


@router.post("/stop")
async def feishu_stop(token: str = Query(None)):
    """停止飞书 WebSocket 监听器"""
    _check_token(token)
    from app.services import feishu_listener
    feishu_listener.stop_listener()
    return {"ok": True, "message": "飞书监听器已停止"}
