from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.bot import BOT_API_TOKEN
from app.db.base import get_db
from app.services.model_config import (
    load_model_config,
    normalize_model_config,
    save_model_config,
    validate_model_config,
)

router = APIRouter()


class ProviderConfig(BaseModel):
    model: str = ""
    api_key: str = ""
    base_url: str = ""


class ModelConfigUpdate(BaseModel):
    token: str
    active_provider: str
    providers: dict[str, ProviderConfig]


def _check_token(token: str) -> None:
    if token != BOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="无效的 Bot 令牌")


@router.get("")
async def get_model_config(
    tenant_id: int = Query(1),
    token: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    _check_token(token)
    cfg = await load_model_config(db, tenant_id)
    return {"ok": True, "config": cfg}


@router.put("")
async def update_model_config(
    body: ModelConfigUpdate,
    tenant_id: int = Query(1),
    db: AsyncSession = Depends(get_db),
):
    _check_token(body.token)

    payload = {
        "active_provider": body.active_provider,
        "providers": {
            key: {
                "model": value.model,
                "api_key": value.api_key,
                "base_url": value.base_url,
            }
            for key, value in body.providers.items()
        },
    }
    cfg = normalize_model_config(payload)
    try:
        validate_model_config(cfg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await save_model_config(db, tenant_id, cfg)
    await db.commit()

    return {
        "ok": True,
        "active_provider": cfg["active_provider"],
        "model": cfg["providers"][cfg["active_provider"]]["model"],
    }
