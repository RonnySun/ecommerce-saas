"""
垂直电商 AI Agent
POST /api/v1/agent/chat

架构说明：
  用户提问 → MiniMax M2.5（Anthropic 兼容 API）→ tool_use 调用数据查询 → 自然语言回答
  工具与 bot.py 对应的4个接口数据完全一致，但响应由 AI 组织成自然语言。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional, List
import uuid
import anthropic

from app.db.base import get_db
from app.models import Store, DailyStat, Tenant
from app.core.config import settings
from app.api.v1.endpoints.bot import BOT_API_TOKEN

router = APIRouter()

# ---- 请求 / 响应模型 ----

class ChatRequest(BaseModel):
    tenant_id: int = 1
    token: str
    message: str
    session_id: Optional[str] = None  # 预留，Phase 3 多轮对话用

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    tools_called: List[str] = []
    model: str = "MiniMax-M2.5"
    input_tokens: int = 0
    output_tokens: int = 0


# ---- MiniMax 客户端 ----

def get_ai_client() -> anthropic.Anthropic:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="AI 服务未配置，请设置 ANTHROPIC_API_KEY")
    return anthropic.Anthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        base_url=settings.MINIMAX_BASE_URL,
    )


# ---- 工具定义（告诉 AI 有哪些数据可以查）----

TOOLS = [
    {
        "name": "get_overview",
        "description": (
            "获取指定天数内的整体经营数据，包括 GMV、净利润、订单数、广告 ROI 及环比变化。"
            "适用于：'总览'、'整体情况'、'近X天怎么样'、'表现如何' 等问题。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "统计天数，支持 1、7、30、90，默认 7",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_stores",
        "description": (
            "获取各店铺经营排行，按 GMV 降序，含平台、GMV、利润率、ROI。"
            "适用于：'哪个店铺最好/最差'、'店铺对比'、'ROI 最低的'、'拼多多店怎么样' 等问题。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "统计天数，默认 7",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_finance",
        "description": (
            "获取财务成本拆分：GMV → 退款损失 → 货品成本 → 平台佣金 → 广告费 → 净利润。"
            "适用于：'成本分析'、'钱都花在哪'、'广告费占比'、'利润率' 等问题。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "统计天数，默认 30",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_alert",
        "description": (
            "检测各店铺异常预警：GMV 骤降超 20%、广告 ROI 低于 2.0。"
            "适用于：'有没有异常'、'哪里出问题了'、'需要关注什么'、'风险' 等问题。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


# ---- 数据查询函数（与 bot.py 逻辑一致，返回结构化文本供 AI 使用）----

PLATFORM_LABEL = {"taobao": "天猫", "jd": "京东", "pdd": "拼多多", "shopify": "独立站"}


async def _get_store_ids(tenant_id: int, db: AsyncSession) -> list:
    result = await db.execute(
        select(Store.id).where(Store.tenant_id == tenant_id, Store.is_active == True)
    )
    return [r[0] for r in result.fetchall()]


async def query_overview(tenant_id: int, days: int, db: AsyncSession) -> str:
    end = datetime.now()
    start = end - timedelta(days=days)
    prev_start = start - timedelta(days=days)

    tenant_result = await db.execute(select(Tenant.name).where(Tenant.id == tenant_id))
    tenant_name = tenant_result.scalar() or f"租户{tenant_id}"

    store_ids = await _get_store_ids(tenant_id, db)
    if not store_ids:
        return "该租户暂无店铺数据。"

    def q(s, e):
        return select(
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.net_profit).label("profit"),
            func.sum(DailyStat.orders_count).label("orders"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.refund_amount).label("refund"),
        ).where(and_(DailyStat.store_id.in_(store_ids), DailyStat.stat_date >= s, DailyStat.stat_date < e))

    cur = (await db.execute(q(start, end))).fetchone()
    pre = (await db.execute(q(prev_start, start))).fetchone()

    def safe(v): return float(v or 0)
    def pct(c, p): return round((c - p) / p * 100, 1) if p and p != 0 else 0

    gmv, profit, orders, ad, refund = safe(cur.gmv), safe(cur.profit), int(safe(cur.orders)), safe(cur.ad_cost), safe(cur.refund)
    p_gmv, p_profit, p_orders = safe(pre.gmv), safe(pre.profit), int(safe(pre.orders))
    roi = round(gmv / ad, 2) if ad > 0 else 0
    profit_rate = round(profit / gmv * 100, 1) if gmv > 0 else 0

    return (
        f"【{tenant_name} 近{days}天经营总览】\n"
        f"GMV: {gmv/10000:.2f}万元（环比{'↑' if pct(gmv,p_gmv)>=0 else '↓'}{abs(pct(gmv,p_gmv))}%）\n"
        f"净利润: {profit/10000:.2f}万元（环比{'↑' if pct(profit,p_profit)>=0 else '↓'}{abs(pct(profit,p_profit))}%）\n"
        f"利润率: {profit_rate}%\n"
        f"订单量: {orders}单（环比{'↑' if pct(orders,p_orders)>=0 else '↓'}{abs(pct(orders,p_orders))}%）\n"
        f"广告费: {ad/10000:.2f}万元，退款: {refund/10000:.2f}万元\n"
        f"广告 ROI: {roi}"
    )


async def query_stores(tenant_id: int, days: int, db: AsyncSession) -> str:
    start = datetime.now() - timedelta(days=days)

    result = await db.execute(
        select(
            Store.id, Store.name, Store.platform,
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.net_profit).label("profit"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.orders_count).label("orders"),
            func.avg(DailyStat.roi).label("avg_roi"),
        )
        .join(DailyStat, DailyStat.store_id == Store.id)
        .where(and_(Store.tenant_id == tenant_id, Store.is_active == True, DailyStat.stat_date >= start))
        .group_by(Store.id, Store.name, Store.platform)
        .order_by(func.sum(DailyStat.gmv).desc())
    )
    rows = result.fetchall()
    if not rows:
        return "暂无店铺数据。"

    lines = [f"【各店铺近{days}天排行（按GMV降序）】"]
    for i, r in enumerate(rows, 1):
        gmv = float(r.gmv or 0)
        profit = float(r.profit or 0)
        roi = round(float(r.avg_roi or 0), 2)
        profit_rate = round(profit / gmv * 100, 1) if gmv > 0 else 0
        platform = PLATFORM_LABEL.get(r.platform, r.platform)
        lines.append(
            f"第{i}名 {r.name}（{platform}）：GMV {gmv/10000:.2f}万 / 利润率 {profit_rate}% / ROI {roi} / 订单 {int(r.orders or 0)}单"
        )
    return "\n".join(lines)


async def query_finance(tenant_id: int, days: int, db: AsyncSession) -> str:
    start = datetime.now() - timedelta(days=days)

    tenant_result = await db.execute(select(Tenant.name).where(Tenant.id == tenant_id))
    tenant_name = tenant_result.scalar() or f"租户{tenant_id}"

    store_ids = await _get_store_ids(tenant_id, db)

    result = await db.execute(
        select(
            func.sum(DailyStat.gmv).label("gmv"),
            func.sum(DailyStat.refund_amount).label("refund"),
            func.sum(DailyStat.ad_cost).label("ad_cost"),
            func.sum(DailyStat.net_profit).label("net_profit"),
            func.sum(DailyStat.orders_count).label("orders"),
        ).where(and_(DailyStat.store_id.in_(store_ids), DailyStat.stat_date >= start))
    )
    row = result.fetchone()

    gmv = float(row.gmv or 0)
    refund = float(row.refund or 0)
    ad_cost = float(row.ad_cost or 0)
    net_profit = float(row.net_profit or 0)
    orders = int(row.orders or 0)
    goods_cost = round(gmv * 0.40, 2)
    platform_fee = round(gmv * 0.05, 2)
    profit_rate = round(net_profit / gmv * 100, 1) if gmv > 0 else 0
    avg_order_value = round(gmv / orders, 2) if orders > 0 else 0

    return (
        f"【{tenant_name} 近{days}天财务拆分】\n"
        f"GMV: {gmv/10000:.2f}万元\n"
        f"  - 退款损失: {refund/10000:.2f}万元（占GMV {round(refund/gmv*100,1) if gmv>0 else 0}%）\n"
        f"  - 货品成本: {goods_cost/10000:.2f}万元（估算40%）\n"
        f"  - 平台佣金: {platform_fee/10000:.2f}万元（估算5%）\n"
        f"  - 广告费: {ad_cost/10000:.2f}万元（占GMV {round(ad_cost/gmv*100,1) if gmv>0 else 0}%）\n"
        f"净利润: {net_profit/10000:.2f}万元（利润率 {profit_rate}%）\n"
        f"客单价: {avg_order_value:.1f}元 / 共{orders}单"
    )


async def query_alert(tenant_id: int, db: AsyncSession) -> str:
    today = datetime.now()
    week_start = today - timedelta(days=7)
    prev_week_start = week_start - timedelta(days=7)

    stores_result = await db.execute(
        select(Store.id, Store.name, Store.platform)
        .where(Store.tenant_id == tenant_id, Store.is_active == True)
    )
    stores_info = {r.id: {"name": r.name, "platform": r.platform} for r in stores_result.fetchall()}

    alerts = []
    for store_id, info in stores_info.items():
        cur = (await db.execute(
            select(func.sum(DailyStat.gmv).label("gmv"), func.avg(DailyStat.roi).label("roi"))
            .where(and_(DailyStat.store_id == store_id, DailyStat.stat_date >= week_start))
        )).fetchone()

        pre = (await db.execute(
            select(func.sum(DailyStat.gmv).label("gmv"))
            .where(and_(DailyStat.store_id == store_id, DailyStat.stat_date >= prev_week_start, DailyStat.stat_date < week_start))
        )).fetchone()

        cur_gmv, cur_roi = float(cur.gmv or 0), float(cur.roi or 0)
        pre_gmv = float(pre.gmv or 0)

        if pre_gmv > 0:
            drop = (cur_gmv - pre_gmv) / pre_gmv * 100
            if drop < -20:
                alerts.append(f"⚠️ {info['name']} GMV 环比下降 {abs(drop):.1f}%（{pre_gmv/10000:.1f}万→{cur_gmv/10000:.1f}万）")

        if 0 < cur_roi < 2.0:
            level = "🔴 严重" if cur_roi < 1.5 else "⚠️ 警告"
            alerts.append(f"{level} {info['name']} 广告 ROI 仅 {cur_roi:.2f}（建议 >2.0）")

    if not alerts:
        return "近7天各店铺经营数据正常，无明显异常。"
    return f"【发现 {len(alerts)} 条预警】\n" + "\n".join(alerts)


# ---- 工具执行调度 ----

async def execute_tool(name: str, inputs: dict, tenant_id: int, db: AsyncSession) -> str:
    try:
        if name == "get_overview":
            return await query_overview(tenant_id, inputs.get("days", 7), db)
        elif name == "get_stores":
            return await query_stores(tenant_id, inputs.get("days", 7), db)
        elif name == "get_finance":
            return await query_finance(tenant_id, inputs.get("days", 30), db)
        elif name == "get_alert":
            return await query_alert(tenant_id, db)
        else:
            return f"未知工具: {name}"
    except Exception as e:
        return f"数据查询失败: {str(e)}"


# ---- 电商垂直领域 System Prompt ----

SYSTEM_PROMPT = """你是一个专业的电商数据分析助手，服务于同时运营天猫/京东/拼多多等多平台店铺的商家团队。

【你的职责】
1. 用简洁、专业的语言分析店铺经营数据
2. 不只是播报数字，要给出可执行的分析结论和建议
3. 熟悉各平台运营差异

【各平台 ROI 参考基准】
- 拼多多：健康 ROI 约 1.5-2.5（价格战激烈，流量便宜但客单价低）
- 天猫/京东：健康 ROI 约 2.5-4.0（品牌溢价高，广告贵）
- 独立站：ROI 差异大，新站期 < 2 属正常

【常见问题分析框架】
- ROI 持续低于 2.0 → 检查广告定向、出价策略、落地页转化率
- GMV 环比下降 > 15% → 排查：活动是否结束、竞品是否打价格战、物流是否有问题
- 利润率低于 20% → 检查退款率、货品成本结构、平台佣金变化

【回答风格】
- 用中文回答
- 数字精确（保留1-2位小数）
- 结构清晰：先结论，再数据，最后建议
- 控制在300字以内，重点突出"""


# ---- 主接口 ----

@router.post("/chat", response_model=ChatResponse)
async def agent_chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    垂直电商 AI Agent 对话接口
    - 鉴权：与 bot.py 相同的 Bot Token
    - 模型：MiniMax M2.5（通过 Anthropic 兼容 API 调用）
    - 工具：get_overview / get_stores / get_finance / get_alert
    """
    # 鉴权
    if req.token != BOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="无效的 Bot 令牌")

    # 加载租户 MD 配置，拼接到 System Prompt
    from sqlalchemy import text as sa_text
    system_prompt = SYSTEM_PROMPT
    try:
        cfg_rows = (await db.execute(
            sa_text("SELECT file_name, content FROM agent_configs WHERE tenant_id = :tid ORDER BY file_name"),
            {"tid": req.tenant_id},
        )).fetchall()
        if cfg_rows:
            extras = "\n\n---\n\n".join(f"<!-- {r[0].upper()}.md -->\n{r[1]}" for r in cfg_rows)
            system_prompt = SYSTEM_PROMPT + "\n\n---\n\n" + extras
    except Exception:
        pass  # 配置加载失败时降级到默认 System Prompt

    session_id = req.session_id or str(uuid.uuid4())
    client = get_ai_client()
    messages = [{"role": "user", "content": req.message}]
    tools_called: List[str] = []
    total_input_tokens  = 0
    total_output_tokens = 0
    MODEL_NAME = "MiniMax-M2.5"

    # Agentic loop（最多 5 轮工具调用）
    for _ in range(5):
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=1024,
            system=system_prompt,
            tools=TOOLS,
            messages=messages,
        )

        # 累计每轮 token 用量
        if hasattr(response, "usage") and response.usage:
            total_input_tokens  += getattr(response.usage, "input_tokens",  0) or 0
            total_output_tokens += getattr(response.usage, "output_tokens", 0) or 0

        # 模型决定直接回答，不调用工具
        if response.stop_reason == "end_turn":
            # 用 block.type == "text" 精确匹配，避免 MiniMax reasoning 块（thinking）干扰
            reply = next(
                (block.text for block in response.content if block.type == "text"),
                "抱歉，暂时无法回答这个问题，请换个方式提问。",
            )
            return ChatResponse(
                reply=reply,
                session_id=session_id,
                tools_called=tools_called,
                model=MODEL_NAME,
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens,
            )

        # 模型要调用工具
        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    tools_called.append(block.name)
                    data = await execute_tool(block.name, block.input, req.tenant_id, db)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": data,
                    })
            messages.append({"role": "user", "content": tool_results})
            continue

        # 其他 stop_reason（max_tokens 等）
        break

    # 兜底回答
    return ChatResponse(
        reply="数据已获取，但回答生成超时，请重试。",
        session_id=session_id,
        tools_called=tools_called,
        model=MODEL_NAME,
        input_tokens=total_input_tokens,
        output_tokens=total_output_tokens,
    )
