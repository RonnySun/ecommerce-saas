"""
飞书Bot专用接口 - 无需JWT，使用固定Bot Token鉴权
返回自然语言友好的数据格式，方便AI直接整合成对话回复
"""
from fastapi import APIRouter, Header, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

from app.db.base import get_db
from app.models import Store, DailyStat, Tenant

router = APIRouter()

# Bot专用令牌（生产环境应放在环境变量中）
BOT_API_TOKEN = "bot-ecommerce-saas-2024"


def verify_bot_token(x_bot_token: str = Header(None)):
    """验证Bot专用令牌"""
    if x_bot_token != BOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="无效的Bot令牌，请使用正确的 X-Bot-Token")
    return True


@router.get("/overview")
async def bot_overview(
    tenant_id: int = Query(1, description="租户ID，1=优品电商，2=乐购网络"),
    days: int = Query(7, description="统计天数，支持1/7/30/90"),
    _: bool = Depends(verify_bot_token),
    db: AsyncSession = Depends(get_db),
):
    """
    【Bot接口】经营总览
    返回指定租户近N天的核心经营数据，包含GMV、净利润、订单数、ROI及环比变化
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)

    # 获取租户信息
    tenant_result = await db.execute(
        select(Tenant.name).where(Tenant.id == tenant_id)
    )
    tenant_name = tenant_result.scalar() or f"租户{tenant_id}"

    # 获取该租户的所有店铺ID
    store_ids_result = await db.execute(
        select(Store.id).where(Store.tenant_id == tenant_id, Store.is_active == True)
    )
    store_ids = [r[0] for r in store_ids_result.fetchall()]

    if not store_ids:
        return {"error": "该租户没有店铺数据", "tenant_id": tenant_id}

    def stats_query(start, end):
        return select(
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.net_profit).label("profit"),
            func.sum(DailyStat.orders_count).label("orders"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.refund_amount).label("refund"),
        ).where(
            and_(
                DailyStat.store_id.in_(store_ids),
                DailyStat.stat_date >= start,
                DailyStat.stat_date < end,
            )
        )

    cur = (await db.execute(stats_query(start_date, end_date))).fetchone()
    pre = (await db.execute(stats_query(prev_start, start_date))).fetchone()

    def safe(val): return float(val or 0)
    def pct(cur_val, pre_val):
        if not pre_val or pre_val == 0: return 0
        return round((cur_val - pre_val) / pre_val * 100, 1)

    gmv = safe(cur.gmv)
    profit = safe(cur.profit)
    orders = int(safe(cur.orders))
    ad = safe(cur.ad_cost)
    refund = safe(cur.refund)
    p_gmv = safe(pre.gmv)
    p_profit = safe(pre.profit)
    p_orders = safe(pre.orders)

    roi = round(gmv / ad, 2) if ad > 0 else 0
    profit_rate = round(profit / gmv * 100, 1) if gmv > 0 else 0
    gmv_change = pct(gmv, p_gmv)
    profit_change = pct(profit, p_profit)
    orders_change = pct(orders, p_orders)

    return {
        "tenant_name": tenant_name,
        "period_days": days,
        "summary": f"{tenant_name}近{days}天经营概览：GMV {gmv/10000:.1f}万元（{'↑' if gmv_change >= 0 else '↓'}{abs(gmv_change)}%），净利润 {profit/10000:.1f}万元（{'↑' if profit_change >= 0 else '↓'}{abs(profit_change)}%），订单{orders}单，广告ROI {roi}，利润率{profit_rate}%",
        "gmv": round(gmv, 2),
        "gmv_wan": round(gmv / 10000, 2),
        "gmv_change_pct": gmv_change,
        "profit": round(profit, 2),
        "profit_wan": round(profit / 10000, 2),
        "profit_change_pct": profit_change,
        "profit_rate_pct": profit_rate,
        "orders": orders,
        "orders_change_pct": orders_change,
        "ad_cost": round(ad, 2),
        "refund": round(refund, 2),
        "roi": roi,
    }


@router.get("/stores")
async def bot_stores(
    tenant_id: int = Query(1, description="租户ID"),
    days: int = Query(7, description="统计天数"),
    _: bool = Depends(verify_bot_token),
    db: AsyncSession = Depends(get_db),
):
    """
    【Bot接口】各店铺排行
    返回各店铺按GMV排序的经营数据，包含平台、GMV、利润、ROI
    """
    start_date = datetime.now() - timedelta(days=days)

    platform_label = {
        "taobao": "天猫",
        "jd": "京东",
        "pdd": "拼多多",
        "shopify": "独立站",
    }

    result = await db.execute(
        select(
            Store.id,
            Store.name,
            Store.platform,
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.net_profit).label("profit"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.orders_count).label("orders"),
            func.avg(DailyStat.roi).label("avg_roi"),
        )
        .join(DailyStat, DailyStat.store_id == Store.id)
        .where(
            and_(
                Store.tenant_id == tenant_id,
                Store.is_active == True,
                DailyStat.stat_date >= start_date,
            )
        )
        .group_by(Store.id, Store.name, Store.platform)
        .order_by(func.sum(DailyStat.gmv).desc())
    )

    rows = result.fetchall()
    stores = []
    for i, r in enumerate(rows, 1):
        gmv = float(r.gmv or 0)
        profit = float(r.profit or 0)
        ad_cost = float(r.ad_cost or 0)
        roi = round(float(r.avg_roi or 0), 2)
        profit_rate = round(profit / gmv * 100, 1) if gmv > 0 else 0
        stores.append({
            "rank": i,
            "store_id": r.id,
            "name": r.name,
            "platform": platform_label.get(r.platform, r.platform),
            "gmv": round(gmv, 2),
            "gmv_wan": round(gmv / 10000, 2),
            "profit": round(profit, 2),
            "profit_rate_pct": profit_rate,
            "ad_cost": round(ad_cost, 2),
            "roi": roi,
            "orders": int(r.orders or 0),
            "summary": f"第{i}名【{r.name}】({platform_label.get(r.platform, r.platform)}) GMV {gmv/10000:.1f}万 / 利润 {profit/10000:.1f}万 / ROI {roi}",
        })

    return {
        "period_days": days,
        "store_count": len(stores),
        "stores": stores,
    }


@router.get("/finance")
async def bot_finance(
    tenant_id: int = Query(1, description="租户ID"),
    days: int = Query(30, description="统计天数"),
    _: bool = Depends(verify_bot_token),
    db: AsyncSession = Depends(get_db),
):
    """
    【Bot接口】财务成本拆分
    返回收支明细：GMV、退款、货品成本、平台佣金、广告费、净利润
    """
    start_date = datetime.now() - timedelta(days=days)

    # 获取租户名称
    tenant_result = await db.execute(select(Tenant.name).where(Tenant.id == tenant_id))
    tenant_name = tenant_result.scalar() or f"租户{tenant_id}"

    store_ids_result = await db.execute(
        select(Store.id).where(Store.tenant_id == tenant_id, Store.is_active == True)
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

    goods_cost = round(gmv * 0.40, 2)        # 估算货品成本40%
    platform_fee = round(gmv * 0.05, 2)      # 估算平台佣金5%
    profit_rate = round(net_profit / gmv * 100, 1) if gmv > 0 else 0
    avg_order_value = round(gmv / orders, 2) if orders > 0 else 0

    return {
        "tenant_name": tenant_name,
        "period_days": days,
        "summary": (
            f"{tenant_name}近{days}天财务：GMV {gmv/10000:.1f}万 → "
            f"退款损失 {refund/10000:.1f}万 / 货品成本 {goods_cost/10000:.1f}万 / "
            f"平台佣金 {platform_fee/10000:.1f}万 / 广告费 {ad_cost/10000:.1f}万 → "
            f"净利润 {net_profit/10000:.1f}万（利润率{profit_rate}%）"
        ),
        "gmv": round(gmv, 2),
        "refund": round(refund, 2),
        "goods_cost": goods_cost,
        "platform_fee": platform_fee,
        "ad_cost": round(ad_cost, 2),
        "net_profit": round(net_profit, 2),
        "profit_rate_pct": profit_rate,
        "orders": orders,
        "avg_order_value": avg_order_value,
    }


@router.get("/alert")
async def bot_alert(
    tenant_id: int = Query(1, description="租户ID"),
    _: bool = Depends(verify_bot_token),
    db: AsyncSession = Depends(get_db),
):
    """
    【Bot接口】异常预警检测
    检测各店铺近7天内的ROI下降、GMV骤降等异常情况
    """
    today = datetime.now()
    week_start = today - timedelta(days=7)
    prev_week_start = week_start - timedelta(days=7)

    store_ids_result = await db.execute(
        select(Store.id, Store.name, Store.platform).where(
            Store.tenant_id == tenant_id, Store.is_active == True
        )
    )
    stores_info = {r.id: {"name": r.name, "platform": r.platform} for r in store_ids_result.fetchall()}

    alerts = []
    for store_id, info in stores_info.items():
        # 近7天数据
        cur_result = await db.execute(
            select(
                func.sum(DailyStat.gmv).label("gmv"),
                func.avg(DailyStat.roi).label("roi"),
                func.sum(DailyStat.net_profit).label("profit"),
            ).where(
                and_(DailyStat.store_id == store_id, DailyStat.stat_date >= week_start)
            )
        )
        cur = cur_result.fetchone()

        # 上周数据
        pre_result = await db.execute(
            select(
                func.sum(DailyStat.gmv).label("gmv"),
                func.avg(DailyStat.roi).label("roi"),
            ).where(
                and_(
                    DailyStat.store_id == store_id,
                    DailyStat.stat_date >= prev_week_start,
                    DailyStat.stat_date < week_start,
                )
            )
        )
        pre = pre_result.fetchone()

        cur_gmv = float(cur.gmv or 0)
        cur_roi = float(cur.roi or 0)
        pre_gmv = float(pre.gmv or 0)
        pre_roi = float(pre.roi or 0)

        # 检测GMV骤降（>20%）
        if pre_gmv > 0:
            gmv_change = (cur_gmv - pre_gmv) / pre_gmv * 100
            if gmv_change < -20:
                alerts.append({
                    "level": "⚠️ 警告",
                    "store": info["name"],
                    "type": "GMV骤降",
                    "detail": f"{info['name']} GMV环比下降{abs(gmv_change):.1f}%（{pre_gmv/10000:.1f}万→{cur_gmv/10000:.1f}万）",
                })

        # 检测ROI下降（低于2）
        if cur_roi > 0 and cur_roi < 2.0:
            alerts.append({
                "level": "🔴 严重" if cur_roi < 1.5 else "⚠️ 警告",
                "store": info["name"],
                "type": "ROI偏低",
                "detail": f"{info['name']} 广告ROI仅{cur_roi:.2f}（建议 >2.0），广告费可能浪费",
            })

    if not alerts:
        return {
            "status": "正常",
            "message": "近7天各店铺经营数据正常，无明显异常",
            "alerts": [],
        }

    return {
        "status": "有异常",
        "alert_count": len(alerts),
        "message": f"发现{len(alerts)}条预警，请关注！",
        "alerts": alerts,
    }
