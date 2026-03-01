"""
认证 API：注册、登录、获取当前用户信息
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import re

from app.db.base import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """用户登录，返回 JWT Token"""
    # 查找用户
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
        )

    # 查租户信息
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    token = create_access_token({"sub": str(user.id), "tenant_id": user.tenant_id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": user.tenant_id,
            "tenant_name": tenant.name if tenant else "",
            "plan": tenant.plan if tenant else "",
        },
    }


class RegisterRequest(BaseModel):
    company_name: str   # 公司/品牌名称
    full_name: str      # 姓名
    email: str          # 邮箱
    password: str       # 密码


@router.post("/register", response_model=Token)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """新用户注册：同时创建租户（公司）和第一个管理员账号"""

    # 基础校验
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    if not re.match(r"[^@]+@[^@]+\.[^@]+", req.email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    if not req.company_name.strip():
        raise HTTPException(status_code=400, detail="公司名称不能为空")

    # 检查邮箱是否已注册
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该邮箱已注册，请直接登录")

    # 生成唯一 slug（公司标识）
    base_slug = re.sub(r"[^a-z0-9]", "", req.company_name.lower()) or "company"
    slug = base_slug
    counter = 1
    while True:
        existing_tenant = await db.execute(select(Tenant).where(Tenant.slug == slug))
        if not existing_tenant.scalar_one_or_none():
            break
        slug = f"{base_slug}{counter}"
        counter += 1

    # 创建租户
    tenant = Tenant(name=req.company_name.strip(), slug=slug, plan="trial")
    db.add(tenant)
    await db.flush()  # 获取 tenant.id

    # 创建管理员用户
    user = User(
        tenant_id=tenant.id,
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name.strip(),
        role="owner",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "tenant_id": user.tenant_id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": user.tenant_id,
            "tenant_name": tenant.name,
            "plan": tenant.plan,
        },
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取当前登录用户信息"""
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "tenant_id": current_user.tenant_id,
        "tenant_name": tenant.name if tenant else "",
        "plan": tenant.plan if tenant else "",
    }
