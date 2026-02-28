"""
财务模块 API：盈亏核算、广告ROI、利润明细
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

from app.db.base import get_db
from app.models import Store, DailyStat
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/summary")
async def get_finance_summary(
    days: int = Query(30, description="统计天数"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """财务总览：GMV/成本/毛利/净利润"""
    start_date = datetime.now() - timedelta(days=days)

    store_ids_result = await db.execute(
        select(Store.id).where(Store.tenant_id == current_user.tenant_id)
    )
    store_ids = [r[0] for r in store_ids_result.fetchall()]

    result = await db.execute(
        select(
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.refund_amount).label("refund"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.net_profit).label("net_profit"),
            func.sum(DailyStat.orders_count).label("orders"),
        ).where(
            and_(
                DailyStat.store_id.in_(store_ids),
                DailyStat.stat_date >= start_date,
            )
        )
    )
    row = result.fetchone()

    gmv = float(row.gmv or 0)
    refund = float(row.refund or 0)
    ad_cost = float(row.ad_cost or 0)
    net_profit = float(row.net_profit or 0)
    orders = int(row.orders or 0)

    # 估算平台佣金（GMV * 5%）
    platform_fee = round(gmv * 0.05, 2)
    # 货品成本（GMV * 40%）
    goods_cost = round(gmv * 0.40, 2)
    gross_profit = round(gmv - refund - goods_cost, 2)
    profit_rate = round(net_profit / gmv * 100, 1) if gmv > 0 else 0

    return {
        "period_days": days,
        "gmv": gmv,
        "refund": refund,
        "net_gmv": round(gmv - refund, 2),
        "goods_cost": goods_cost,
        "platform_fee": platform_fee,
        "ad_cost": ad_cost,
        "gross_profit": gross_profit,
        "net_profit": net_profit,
        "profit_rate": profit_rate,
        "orders": orders,
        "avg_order_value": round(gmv / orders, 2) if orders > 0 else 0,
    }


@router.get("/roi-analysis")
async def get_roi_analysis(
    days: int = Query(30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """各店铺广告ROI分析"""
    start_date = datetime.now() - timedelta(days=days)

    result = await db.execute(
        select(
            Store.id,
            Store.name,
            Store.platform,
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.net_profit).label("profit"),
            func.avg(DailyStat.roi).label("avg_roi"),
        )
        .join(DailyStat, DailyStat.store_id == Store.id)
        .where(
            and_(
                Store.tenant_id == current_user.tenant_id,
                DailyStat.stat_date >= start_date,
            )
        )
        .group_by(Store.id, Store.name, Store.platform)
        .order_by(func.avg(DailyStat.roi).desc())
    )

    rows = result.fetchall()
    return [
        {
            "store_id": r.id,
            "name": r.name,
            "platform": r.platform,
            "gmv": float(r.gmv or 0),
            "ad_cost": float(r.ad_cost or 0),
            "profit": float(r.profit or 0),
            "roi": round(float(r.avg_roi or 0), 2),
            "ad_ratio": round(float(r.ad_cost or 0) / float(r.gmv or 1) * 100, 1),
        }
        for r in rows
    ]


@router.get("/profit-trend")
async def get_profit_trend(
    days: int = Query(30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """利润趋势（按天）"""
    start_date = datetime.now() - timedelta(days=days)

    store_ids_result = await db.execute(
        select(Store.id).where(Store.tenant_id == current_user.tenant_id)
    )
    store_ids = [r[0] for r in store_ids_result.fetchall()]

    result = await db.execute(
        select(
            func.date(DailyStat.stat_date).label("date"),
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.net_profit).label("profit"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.refund_amount).label("refund"),
        )
        .where(
            and_(
                DailyStat.store_id.in_(store_ids),
                DailyStat.stat_date >= start_date,
            )
        )
        .group_by(func.date(DailyStat.stat_date))
        .order_by(func.date(DailyStat.stat_date))
    )

    return [
        {
            "date": str(r.date),
            "gmv": float(r.gmv or 0),
            "profit": float(r.profit or 0),
            "ad_cost": float(r.ad_cost or 0),
            "refund": float(r.refund or 0),
            "profit_rate": round(float(r.profit or 0) / float(r.gmv or 1) * 100, 1),
        }
        for r in result.fetchall()
    ]
