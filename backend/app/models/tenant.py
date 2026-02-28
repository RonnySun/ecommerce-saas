"""
多租户模型 - 每个电商公司是一个租户
"""
from sqlalchemy import String, Boolean, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Tenant(Base):
    """租户（电商公司）"""
    __tablename__ = "tenants"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)        # 公司名
    slug: Mapped[str] = mapped_column(String(50), unique=True)            # 唯一标识
    plan: Mapped[str] = mapped_column(String(20), default="trial")        # trial/basic/pro/enterprise
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    
    # 关联
    stores = relationship("Store", back_populates="tenant")
    users = relationship("User", back_populates="tenant")
