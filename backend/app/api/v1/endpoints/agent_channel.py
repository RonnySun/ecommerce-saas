from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.api.v1.endpoints.bot import BOT_API_TOKEN
from app.db.base import get_db
from app.services import feishu_listener, dingtalk_listener
from app.services.channel_config import (
    load_channel_config,
    normalize_channel_config,
    save_channel_config,
    validate_channel_config,
)

router = APIRouter()


class ChannelConfigUpdate(BaseModel):
    token: str
    provider: str
    feishu: Optional[dict] = None
    dingtalk: Optional[dict] = None


def _check_token(token: str) -> None:
    if token != BOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="无效的 Bot 令牌")


@router.get("")
async def get_channel_config(
    tenant_id: int = Query(1),
    token: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    _check_token(token)
    cfg = await load_channel_config(db, tenant_id)
    return {"ok": True, "config": cfg}


@router.put("")
async def update_channel_config(
    body: ChannelConfigUpdate,
    tenant_id: int = Query(1),
    db: AsyncSession = Depends(get_db),
):
    _check_token(body.token)

    cfg = normalize_channel_config(
        {
            "provider": body.provider,
            "feishu": body.feishu or {},
            "dingtalk": body.dingtalk or {},
        }
    )

    try:
        validate_channel_config(cfg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await save_channel_config(db, tenant_id, cfg)
    await db.commit()

    provider = cfg.get("provider")

    # 热更新监听器：飞书/钉钉互斥运行，保存后按当前渠道重启监听
    if provider == "feishu":
        feishu = cfg.get("feishu") or {}
        app_id = (feishu.get("app_id") or "").strip()
        app_secret = (feishu.get("app_secret") or "").strip()
        valid = (
            bool(app_id)
            and bool(app_secret)
            and not app_id.startswith("cli_xxx")
            and not app_secret.startswith("xxx")
        )

        if valid:
            try:
                dingtalk_listener.stop_listener()
                feishu_listener.stop_listener()
                feishu_listener.start_listener(app_id, app_secret, tenant_id)
                return {
                    "ok": True,
                    "provider": provider,
                    "listener_restarted": True,
                    "message": "飞书配置已保存并重启监听",
                }
            except Exception as e:
                return {
                    "ok": True,
                    "provider": provider,
                    "listener_restarted": False,
                    "message": f"飞书配置已保存，但监听重启失败: {e}",
                }

        dingtalk_listener.stop_listener()
        feishu_listener.stop_listener()
        return {
            "ok": True,
            "provider": provider,
            "listener_restarted": False,
            "message": "飞书配置已保存（当前凭证不完整，监听器已停止）",
        }

    if provider == "dingtalk":
        dingtalk = cfg.get("dingtalk") or {}
        app_key = (dingtalk.get("app_key") or "").strip()
        app_secret = (dingtalk.get("app_secret") or "").strip()
        robot_code = (dingtalk.get("robot_code") or "").strip()
        valid = bool(app_key) and bool(app_secret) and bool(robot_code)

        if valid:
            try:
                feishu_listener.stop_listener()
                dingtalk_listener.stop_listener()
                dingtalk_listener.start_listener(app_key, app_secret, robot_code, tenant_id)
                return {
                    "ok": True,
                    "provider": provider,
                    "listener_restarted": True,
                    "message": "钉钉配置已保存并重启监听",
                }
            except Exception as e:
                return {
                    "ok": True,
                    "provider": provider,
                    "listener_restarted": False,
                    "message": f"钉钉配置已保存，但监听重启失败: {e}",
                }

        feishu_listener.stop_listener()
        dingtalk_listener.stop_listener()
        return {
            "ok": True,
            "provider": provider,
            "listener_restarted": False,
            "message": "钉钉配置已保存（当前凭证不完整，监听器已停止）",
        }

    dingtalk_listener.stop_listener()
    feishu_listener.stop_listener()
    return {
        "ok": True,
        "provider": provider,
        "listener_restarted": False,
        "message": "钉钉配置已保存（飞书监听器已停止）",
    }
