"""
店铺模型 - 每个租户可有多个店铺
"""
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import enum
from app.db.base import Base

class PlatformEnum(str, enum.Enum):
    taobao = "taobao"       # 淘宝/天猫
    jd = "jd"               # 京东
    pdd = "pdd"             # 拼多多
    shopify = "shopify"     # 独立站
    other = "other"

class Store(Base):
    """店铺"""
    __tablename__ = "stores"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)         # 店铺名称
    platform: Mapped[str] = mapped_column(String(20), default="other")    # 所在平台
    external_id: Mapped[str] = mapped_column(String(100), nullable=True)  # 平台店铺ID
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    
    # 关联
    tenant = relationship("Tenant", back_populates="stores")
    orders = relationship("Order", back_populates="store")
