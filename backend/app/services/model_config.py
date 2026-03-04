import json
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


MODEL_FILE_NAME = "model"
SUPPORTED_PROVIDERS = ("minimax", "qwen", "deepseek", "kimi")

DEFAULT_PROVIDER_CONFIGS: Dict[str, Dict[str, str]] = {
    "minimax": {
        "model": "MiniMax-M2.5",
        "api_key": "",
        "base_url": "https://api.minimaxi.com/v1",
    },
    "qwen": {
        "model": "qwen-max-latest",
        "api_key": "",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
    "deepseek": {
        "model": "deepseek-chat",
        "api_key": "",
        "base_url": "https://api.deepseek.com/v1",
    },
    "kimi": {
        "model": "moonshot-v1-8k",
        "api_key": "",
        "base_url": "https://api.moonshot.cn/v1",
    },
}

DEFAULT_MODEL_CONFIG: Dict[str, Any] = {
    "active_provider": "minimax",
    "providers": DEFAULT_PROVIDER_CONFIGS,
}


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_base_url(provider: str, value: str) -> str:
    """
    兼容旧配置：历史上使用 /anthropic 路径，现统一到 OpenAI 兼容 /v1 路径。
    """
    url = _to_text(value)
    if url.endswith("/anthropic"):
        return DEFAULT_PROVIDER_CONFIGS[provider]["base_url"]
    return url


def normalize_model_config(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    payload = payload or {}
    active_provider = _to_text(payload.get("active_provider") or "minimax").lower()
    if active_provider not in SUPPORTED_PROVIDERS:
        active_provider = "minimax"

    providers_payload = payload.get("providers") or {}
    providers: Dict[str, Dict[str, str]] = {}
    for provider in SUPPORTED_PROVIDERS:
        base_default = DEFAULT_PROVIDER_CONFIGS[provider]
        raw = providers_payload.get(provider) or {}
        providers[provider] = {
            "model": _to_text(raw.get("model") or base_default["model"]),
            "api_key": _to_text(raw.get("api_key") or ""),
            "base_url": _normalize_base_url(provider, _to_text(raw.get("base_url") or base_default["base_url"])),
        }

    return {"active_provider": active_provider, "providers": providers}


def validate_model_config(cfg: Dict[str, Any]) -> None:
    active_provider = cfg.get("active_provider")
    if active_provider not in SUPPORTED_PROVIDERS:
        raise ValueError("不支持的模型提供商")

    providers = cfg.get("providers") or {}
    active_cfg = providers.get(active_provider) or {}

    if not _to_text(active_cfg.get("model")):
        raise ValueError("当前模型提供商未配置模型名")
    if not _to_text(active_cfg.get("base_url")):
        raise ValueError("当前模型提供商未配置 Base URL")
    if not _to_text(active_cfg.get("api_key")):
        raise ValueError("当前模型提供商未配置 API Key")


async def load_model_config(db: AsyncSession, tenant_id: int) -> Dict[str, Any]:
    row = (
        await db.execute(
            sa_text(
                "SELECT content FROM agent_configs "
                "WHERE tenant_id = :tid AND file_name = :fname"
            ),
            {"tid": tenant_id, "fname": MODEL_FILE_NAME},
        )
    ).fetchone()

    if row and row[0]:
        try:
            return normalize_model_config(json.loads(row[0]))
        except Exception:
            pass

    # 默认回退到系统环境变量里的 OpenAI 配置，兼容旧版本。
    fallback = normalize_model_config(DEFAULT_MODEL_CONFIG)
    fallback["providers"]["minimax"]["api_key"] = _to_text(settings.OPENAI_API_KEY)
    fallback["providers"]["minimax"]["base_url"] = _to_text(settings.OPENAI_BASE_URL)
    fallback["providers"]["minimax"]["model"] = _to_text(settings.OPENAI_MODEL) or fallback["providers"]["minimax"]["model"]
    return fallback


async def save_model_config(db: AsyncSession, tenant_id: int, cfg: Dict[str, Any]) -> None:
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
        {"tid": tenant_id, "fname": MODEL_FILE_NAME, "content": cfg_json, "now": datetime.now()},
    )


async def resolve_model_runtime_config(db: AsyncSession, tenant_id: int) -> Dict[str, str]:
    cfg = await load_model_config(db, tenant_id)
    provider = cfg["active_provider"]
    provider_cfg = (cfg.get("providers") or {}).get(provider) or {}
    return {
        "provider": provider,
        "model": _to_text(provider_cfg.get("model")),
        "api_key": _to_text(provider_cfg.get("api_key")),
        "base_url": _to_text(provider_cfg.get("base_url")),
    }
