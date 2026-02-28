"""
数据统计 API
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from app.db.base import get_db
from app.models import Tenant, Store, Order, DailyStat

router = APIRouter()


@router.get("/overview")
async def get_overview(
    tenant_id: int = Query(1, description="租户ID"),
    days: int = Query(7, description="天数"),
    db: AsyncSession = Depends(get_db),
):
    """首页核心指标：总GMV、利润、订单数、ROI"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)

    # 获取该租户的所有店铺ID
    store_ids_result = await db.execute(
        select(Store.id).where(Store.tenant_id == tenant_id, Store.is_active == True)
    )
    store_ids = [r[0] for r in store_ids_result.fetchall()]

    if not store_ids:
        return {"error": "无店铺数据"}

    def stats_query(start, end):
        return select(
            func.sum(DailyStat.gmv).label("total_gmv"),
            func.sum(DailyStat.net_profit).label("total_profit"),
            func.sum(DailyStat.orders_count).label("total_orders"),
            func.sum(DailyStat.ad_cost).label("total_ad_cost"),
        ).where(
            and_(
                DailyStat.store_id.in_(store_ids),
                DailyStat.stat_date >= start,
                DailyStat.stat_date <= end,
            )
        )

    cur = (await db.execute(stats_query(start_date, end_date))).fetchone()
    pre = (await db.execute(stats_query(prev_start, start_date))).fetchone()

    def safe(val): return float(val or 0)
    def pct(cur_val, pre_val):
        if not pre_val or pre_val == 0: return 0
        return round((cur_val - pre_val) / pre_val * 100, 1)

    gmv, profit, orders, ad = safe(cur.total_gmv), safe(cur.total_profit), safe(cur.total_orders), safe(cur.total_ad_cost)
    p_gmv, p_profit, p_orders = safe(pre.total_gmv), safe(pre.total_profit), safe(pre.total_orders)

    return {
        "gmv": gmv,
        "profit": profit,
        "orders": int(orders),
        "roi": round(gmv / ad, 2) if ad > 0 else 0,
        "gmv_change": pct(gmv, p_gmv),
        "profit_change": pct(profit, p_profit),
        "orders_change": pct(orders, p_orders),
    }


@router.get("/trend")
async def get_trend(
    tenant_id: int = Query(1),
    days: int = Query(7),
    db: AsyncSession = Depends(get_db),
):
    """趋势图数据：每天的GMV/利润/广告费"""
    start_date = datetime.now() - timedelta(days=days)

    store_ids_result = await db.execute(
        select(Store.id).where(Store.tenant_id == tenant_id, Store.is_active == True)
    )
    store_ids = [r[0] for r in store_ids_result.fetchall()]

    result = await db.execute(
        select(
            func.date(DailyStat.stat_date).label("date"),
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.net_profit).label("profit"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.orders_count).label("orders"),
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

    rows = result.fetchall()
    return [
        {
            "date": str(r.date),
            "gmv": float(r.gmv or 0),
            "profit": float(r.profit or 0),
            "ad_cost": float(r.ad_cost or 0),
            "orders": int(r.orders or 0),
        }
        for r in rows
    ]


@router.get("/stores")
async def get_stores_stats(
    tenant_id: int = Query(1),
    days: int = Query(1),
    db: AsyncSession = Depends(get_db),
):
    """各店铺今日/近N天汇总数据"""
    start_date = datetime.now() - timedelta(days=days)

    result = await db.execute(
        select(
            Store.id,
            Store.name,
            Store.platform,
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.net_profit).label("profit"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.orders_count).label("orders"),
        )
        .join(DailyStat, DailyStat.store_id == Store.id)
        .where(
            and_(
                Store.tenant_id == tenant_id,
                DailyStat.stat_date >= start_date,
            )
        )
        .group_by(Store.id, Store.name, Store.platform)
        .order_by(func.sum(DailyStat.gmv).desc())
    )

    rows = result.fetchall()
    return [
        {
            "store_id": r.id,
            "name": r.name,
            "platform": r.platform,
            "gmv": float(r.gmv or 0),
            "profit": float(r.profit or 0),
            "ad_cost": float(r.ad_cost or 0),
            "orders": int(r.orders or 0),
            "roi": round(float(r.gmv or 0) / float(r.ad_cost or 1), 2),
        }
        for r in rows
    ]
