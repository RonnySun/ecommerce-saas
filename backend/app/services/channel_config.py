import json
from typing import Any, Dict, Optional
from datetime import datetime

from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import feishu_listener


CHANNEL_FILE_NAME = "channel"
LEGACY_FEISHU_FILE_NAME = "feishu"

DEFAULT_CHANNEL_CONFIG: Dict[str, Any] = {
    "provider": "feishu",
    "feishu": {
        "app_id": "",
        "app_secret": "",
    },
    "dingtalk": {
        "app_key": "",
        "app_secret": "",
        "robot_code": "",
    },
}


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_channel_config(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    cfg = dict(DEFAULT_CHANNEL_CONFIG)
    payload = payload or {}

    provider = _to_text(payload.get("provider") or cfg["provider"]).lower()
    if provider not in {"feishu", "dingtalk"}:
        provider = "feishu"
    cfg["provider"] = provider

    raw_feishu = payload.get("feishu") or {}
    raw_dingtalk = payload.get("dingtalk") or {}

    cfg["feishu"] = {
        "app_id": _to_text(raw_feishu.get("app_id")),
        "app_secret": _to_text(raw_feishu.get("app_secret")),
    }
    cfg["dingtalk"] = {
        "app_key": _to_text(raw_dingtalk.get("app_key")),
        "app_secret": _to_text(raw_dingtalk.get("app_secret")),
        "robot_code": _to_text(raw_dingtalk.get("robot_code")),
    }
    return cfg


def validate_channel_config(cfg: Dict[str, Any]) -> None:
    provider = cfg.get("provider")
    if provider == "feishu":
        feishu = cfg.get("feishu") or {}
        if not feishu.get("app_id") or not feishu.get("app_secret"):
            raise ValueError("飞书配置不完整，请填写 App ID 和 App Secret")
    elif provider == "dingtalk":
        dingtalk = cfg.get("dingtalk") or {}
        if not dingtalk.get("app_key") or not dingtalk.get("app_secret") or not dingtalk.get("robot_code"):
            raise ValueError("钉钉配置不完整，请填写 AppKey、AppSecret 和 RobotCode")
    else:
        raise ValueError("不支持的渠道类型")


async def load_channel_config(db: AsyncSession, tenant_id: int) -> Dict[str, Any]:
    row = (
        await db.execute(
            sa_text(
                "SELECT content FROM agent_configs "
                "WHERE tenant_id = :tid AND file_name = :fname"
            ),
            {"tid": tenant_id, "fname": CHANNEL_FILE_NAME},
        )
    ).fetchone()

    if row and row[0]:
        try:
            return normalize_channel_config(json.loads(row[0]))
        except Exception:
            return normalize_channel_config(None)

    # 兼容老版 feishu.md 配置
    legacy_row = (
        await db.execute(
            sa_text(
                "SELECT content FROM agent_configs "
                "WHERE tenant_id = :tid AND file_name = :fname"
            ),
            {"tid": tenant_id, "fname": LEGACY_FEISHU_FILE_NAME},
        )
    ).fetchone()
    if not legacy_row or not legacy_row[0]:
        return normalize_channel_config(None)

    legacy_cfg = feishu_listener.parse_feishu_config(legacy_row[0])
    migrated = normalize_channel_config(
        {
            "provider": "feishu",
            "feishu": {
                "app_id": legacy_cfg.get("app_id", ""),
                "app_secret": legacy_cfg.get("app_secret", ""),
            },
        }
    )
    return migrated


async def save_channel_config(db: AsyncSession, tenant_id: int, cfg: Dict[str, Any]) -> None:
    cfg_json = json.dumps(cfg, ensure_ascii=False)
    await db.execute(
        sa_text(
            """
            INSERT INTO agent_configs (tenant_id, file_name, content, updated_at)
            VALUES (:tid, :fname, :content, :now)
            ON CONFLICT (tenant_id, file_name)
            DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
            """
        ),
        {"tid": tenant_id, "fname": CHANNEL_FILE_NAME, "content": cfg_json, "now": datetime.now()},
    )


async def resolve_feishu_runtime_config(db: AsyncSession, tenant_id: int) -> Dict[str, Any]:
    cfg = await load_channel_config(db, tenant_id)
    if cfg.get("provider") == "feishu":
        feishu = cfg.get("feishu") or {}
        return {
            "app_id": _to_text(feishu.get("app_id")),
            "app_secret": _to_text(feishu.get("app_secret")),
            "tenant_id": tenant_id,
        }

    # 若当前选中非飞书，仍回退查老配置，便于兼容手动启停 API
    legacy_row = (
        await db.execute(
            sa_text(
                "SELECT content FROM agent_configs "
                "WHERE tenant_id = :tid AND file_name = :fname"
            ),
            {"tid": tenant_id, "fname": LEGACY_FEISHU_FILE_NAME},
        )
    ).fetchone()

    if legacy_row and legacy_row[0]:
        parsed = feishu_listener.parse_feishu_config(legacy_row[0])
        return {
            "app_id": _to_text(parsed.get("app_id")),
            "app_secret": _to_text(parsed.get("app_secret")),
            "tenant_id": int(parsed.get("tenant_id") or tenant_id),
        }

    return {"app_id": "", "app_secret": "", "tenant_id": tenant_id}


async def resolve_dingtalk_runtime_config(db: AsyncSession, tenant_id: int) -> Dict[str, Any]:
    cfg = await load_channel_config(db, tenant_id)
    dingtalk = cfg.get("dingtalk") or {}
    return {
        "app_key": _to_text(dingtalk.get("app_key")),
        "app_secret": _to_text(dingtalk.get("app_secret")),
        "robot_code": _to_text(dingtalk.get("robot_code")),
        "tenant_id": tenant_id,
    }
