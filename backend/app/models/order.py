"""
订单模型
"""
from sqlalchemy import String, DateTime, Integer, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from decimal import Decimal
from app.db.base import Base

class Order(Base):
    """订单"""
    __tablename__ = "orders"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_id: Mapped[int] = mapped_column(Integer, ForeignKey("stores.id"))
    order_no: Mapped[str] = mapped_column(String(100))              # 订单号
    status: Mapped[str] = mapped_column(String(20), default="paid") # paid/refunded/cancelled
    gmv: Mapped[Decimal] = mapped_column(Numeric(12, 2))            # 成交金额
    ad_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)  # 广告费
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)  # 平台佣金
    net_profit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)    # 净利润
    order_date: Mapped[DateTime] = mapped_column(DateTime)
    import_batch_id: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    
    # 关联
    store = relationship("Store", back_populates="orders")

class DailyStat(Base):
    """每日汇总数据（预聚合，提升查询速度）"""
    __tablename__ = "daily_stats"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_id: Mapped[int] = mapped_column(Integer, ForeignKey("stores.id"))
    stat_date: Mapped[DateTime] = mapped_column(DateTime)
    gmv: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    orders_count: Mapped[int] = mapped_column(Integer, default=0)
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    ad_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    net_profit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    roi: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
