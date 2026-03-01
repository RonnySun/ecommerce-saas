"""
店铺管理 API：增删改查
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.base import get_db
from app.models.store import Store
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()


class StoreCreate(BaseModel):
    name: str
    platform: str = "other"
    external_id: Optional[str] = None


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None
    external_id: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_stores(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前租户的所有店铺"""
    result = await db.execute(
        select(Store)
        .where(Store.tenant_id == current_user.tenant_id)
        .order_by(Store.created_at)
    )
    stores = result.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "platform": s.platform,
            "external_id": s.external_id,
            "is_active": s.is_active,
            "created_at": s.created_at.strftime("%Y-%m-%d") if s.created_at else "",
        }
        for s in stores
    ]


@router.post("")
async def create_store(
    req: StoreCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """新建店铺"""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="店铺名称不能为空")

    # 同租户下不能重名
    existing = await db.execute(
        select(Store).where(Store.tenant_id == current_user.tenant_id, Store.name == req.name.strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该店铺名称已存在")

    store = Store(
        tenant_id=current_user.tenant_id,
        name=req.name.strip(),
        platform=req.platform,
        external_id=req.external_id,
    )
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return {"id": store.id, "name": store.name, "platform": store.platform, "is_active": store.is_active}


@router.put("/{store_id}")
async def update_store(
    store_id: int,
    req: StoreUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改店铺信息"""
    result = await db.execute(
        select(Store).where(Store.id == store_id, Store.tenant_id == current_user.tenant_id)
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="店铺不存在")

    if req.name is not None:
        store.name = req.name.strip()
    if req.platform is not None:
        store.platform = req.platform
    if req.external_id is not None:
        store.external_id = req.external_id
    if req.is_active is not None:
        store.is_active = req.is_active

    await db.commit()
    return {"success": True, "name": store.name, "is_active": store.is_active}


@router.delete("/{store_id}")
async def delete_store(
    store_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """停用店铺（软删除，保留历史数据）"""
    result = await db.execute(
        select(Store).where(Store.id == store_id, Store.tenant_id == current_user.tenant_id)
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="店铺不存在")

    store.is_active = False
    await db.commit()
    return {"success": True}
