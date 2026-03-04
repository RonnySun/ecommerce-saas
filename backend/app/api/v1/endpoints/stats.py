"""
数据统计 API
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

from app.db.base import get_db
from app.models import Store, Order

router = APIRouter()


@router.get("/overview")
async def get_overview(
    tenant_id: int = Query(1, description="租户ID"),
    days: int = Query(7, description="天数"),
    store_id: int = Query(0, description="店铺ID，0表示全部"),
    db: AsyncSession = Depends(get_db),
):
    """首页核心指标：总GMV、利润、订单数、ROI"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)

    # 获取该租户的所有店铺ID
    store_query = select(Store.id).where(Store.tenant_id == tenant_id, Store.is_active == True)
    if store_id:
        store_query = store_query.where(Store.id == store_id)
    store_ids_result = await db.execute(store_query)
    store_ids = [r[0] for r in store_ids_result.fetchall()]

    if not store_ids:
        return {
            "gmv": 0,
            "profit": 0,
            "orders": 0,
            "roi": 0,
            "gmv_change": 0,
            "profit_change": 0,
            "orders_change": 0,
        }

    def stats_query(start, end):
        return select(
            func.sum(Order.gmv).label("total_gmv"),
            func.sum(Order.net_profit).label("total_profit"),
            func.count(Order.id).label("total_orders"),
            func.sum(Order.ad_cost).label("total_ad_cost"),
        ).where(
            and_(
                Order.store_id.in_(store_ids),
                Order.order_date >= start,
                Order.order_date < end,
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
    store_id: int = Query(0, description="店铺ID，0表示全部"),
    db: AsyncSession = Depends(get_db),
):
    """趋势图数据：每天的GMV/利润/广告费"""
    start_date = datetime.now() - timedelta(days=days)

    store_query = select(Store.id).where(Store.tenant_id == tenant_id, Store.is_active == True)
    if store_id:
        store_query = store_query.where(Store.id == store_id)
    store_ids_result = await db.execute(store_query)
    store_ids = [r[0] for r in store_ids_result.fetchall()]
    if not store_ids:
        return []

    result = await db.execute(
        select(
            func.date(Order.order_date).label("date"),
            func.sum(Order.gmv).label("gmv"),
            func.sum(Order.net_profit).label("profit"),
            func.sum(Order.ad_cost).label("ad_cost"),
            func.count(Order.id).label("orders"),
        )
        .where(
            and_(
                Order.store_id.in_(store_ids),
                Order.order_date >= start_date,
            )
        )
        .group_by(func.date(Order.order_date))
        .order_by(func.date(Order.order_date))
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
    store_id: int = Query(0, description="店铺ID，0表示全部"),
    db: AsyncSession = Depends(get_db),
):
    """各店铺今日/近N天汇总数据"""
    start_date = datetime.now() - timedelta(days=days)

    query = (
        select(
            Store.id,
            Store.name,
            Store.platform,
            func.sum(Order.gmv).label("gmv"),
            func.sum(Order.net_profit).label("profit"),
            func.sum(Order.ad_cost).label("ad_cost"),
            func.count(Order.id).label("orders"),
        )
        .join(Order, Order.store_id == Store.id)
        .where(
            and_(
                Store.tenant_id == tenant_id,
                Store.is_active == True,
                Order.order_date >= start_date,
            )
        )
        .group_by(Store.id, Store.name, Store.platform)
        .order_by(func.sum(Order.gmv).desc())
    )
    if store_id:
        query = query.where(Store.id == store_id)

    result = await db.execute(query)

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
            "roi": round(float(r.gmv or 0) / float(r.ad_cost or 1), 2) if float(r.ad_cost or 0) > 0 else 0,
        }
        for r in rows
    ]
