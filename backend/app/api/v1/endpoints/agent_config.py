"""
掌舵 Agent 配置接口
GET/PUT /api/v1/agent/config/{file_name}

每个租户可以配置3个 MD 文件：
  soul   — Agent 行为准则（相当于 OpenClaw 的 SOUL.md）
  skills — 行业知识与技能（相当于 TOOLS.md）
  context— 公司/产品背景（相当于 USER.md）

这些内容会在 agent.py 对话时注入 System Prompt。
"""
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime

from app.db.base import get_db
from app.api.v1.endpoints.bot import BOT_API_TOKEN

router = APIRouter()

# 合法的文件名
ALLOWED_FILES = {"soul", "skills", "context", "feishu"}

# 默认内容（首次使用时展示）
DEFAULTS = {
    "soul": """# 掌舵 · 行为准则（SOUL）

## 角色定位
你是专业的电商经营分析师，服务于多平台店铺商家。

## 行为规则
- 回答简洁、数字精确、结论明确
- 遇到异常数据主动给出可执行建议
- 不确定时说明数据来源和局限性

## 语气风格
专业但不生硬，像一个懂数据的合伙人。
""",
    "skills": """# 掌舵 · 行业知识（SKILLS）

## 各平台 ROI 基准
- 拼多多：健康 ROI 1.5–2.5（价格战激烈，客单价低）
- 天猫/京东：健康 ROI 2.5–4.0（品牌溢价高，广告贵）
- 独立站：新站期 <2 属正常，成熟期目标 >3

## 异常分析框架
- ROI 持续低于 2.0 → 检查广告定向、出价策略、落地页转化率
- GMV 环比下降 >15% → 排查：活动节奏、竞品促销、物流时效
- 利润率低于 20% → 检查退款率、货品成本、平台佣金变化

## 季节性规律
- Q4（10–12月）：双11/双12，GMV 通常是全年高峰
- Q1（1–3月）：年后淡季，GMV 通常下滑 20–30%
""",
    "feishu": """# 秒算 · 飞书机器人配置（FEISHU）

## 飞书机器人凭证

App ID: cli_xxxxxxxxxxxxxxxx
App Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

## 租户绑定

tenant_id: 1

## 说明

- App ID 和 App Secret 在飞书开放平台 → 凭证与基础信息 中获取
- tenant_id 填写你的企业 ID（默认为 1）
- 保存后在下方点击「启动监听」连接飞书
- 使用 WebSocket 长连接，无需公网 IP，本地即可运行
""",
    "context": """# 掌舵 · 商家背景（CONTEXT）

## 公司信息
（请填写你的公司名称和主营品类）

## 主要平台
（请列出主要经营的平台和店铺）

## 特殊情况
（请填写近期活动、促销计划或其他需要 AI 知晓的背景信息）
""",
}


class ConfigUpdate(BaseModel):
    content: str
    token: str


@router.get("/{file_name}")
async def get_config(
    file_name: str,
    tenant_id: int = Query(1),
    token: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """获取指定配置文件内容"""
    if token != BOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="无效的 Bot 令牌")
    if file_name not in ALLOWED_FILES:
        raise HTTPException(status_code=404, detail=f"文件名无效，可选：{', '.join(ALLOWED_FILES)}")

    from sqlalchemy import text
    result = await db.execute(
        text("SELECT content FROM agent_configs WHERE tenant_id = :tid AND file_name = :fname"),
        {"tid": tenant_id, "fname": file_name},
    )
    row = result.fetchone()
    return {
        "file_name": file_name,
        "content": row[0] if row else DEFAULTS[file_name],
        "is_default": row is None,
    }


@router.put("/{file_name}")
async def update_config(
    file_name: str,
    body: ConfigUpdate,
    tenant_id: int = Query(1),
    db: AsyncSession = Depends(get_db),
):
    """保存配置文件内容（有则更新，无则创建）"""
    if body.token != BOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="无效的 Bot 令牌")
    if file_name not in ALLOWED_FILES:
        raise HTTPException(status_code=404, detail=f"文件名无效，可选：{', '.join(ALLOWED_FILES)}")

    from sqlalchemy import text
    # upsert
    await db.execute(
        text("""
            INSERT INTO agent_configs (tenant_id, file_name, content, updated_at)
            VALUES (:tid, :fname, :content, :now)
            ON CONFLICT (tenant_id, file_name)
            DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
        """),
        {"tid": tenant_id, "fname": file_name, "content": body.content, "now": datetime.now()},
    )
    await db.commit()

    # 飞书配置保存后，立即热重载监听器，避免“配置已变更但连接仍是旧凭证”
    if file_name == "feishu":
        from app.services import feishu_listener

        cfg = feishu_listener.parse_feishu_config(body.content or "")
        app_id = (cfg.get("app_id") or "").strip()
        app_secret = (cfg.get("app_secret") or "").strip()
        feishu_tenant_id = int(cfg.get("tenant_id", tenant_id))

        valid = (
            bool(app_id)
            and bool(app_secret)
            and not app_id.startswith("cli_xxx")
            and not app_secret.startswith("xxx")
        )
        if valid:
            try:
                feishu_listener.stop_listener()
                time.sleep(0.5)
                feishu_listener.start_listener(app_id, app_secret, feishu_tenant_id)
                return {
                    "ok": True,
                    "file_name": file_name,
                    "listener_restarted": True,
                    "app_id": app_id,
                    "tenant_id": feishu_tenant_id,
                }
            except Exception as e:
                return {
                    "ok": True,
                    "file_name": file_name,
                    "listener_restarted": False,
                    "error": f"飞书监听器重启失败: {e}",
                }

        # 配置无效时停掉监听，避免看起来“运行中”但实际不可用
        feishu_listener.stop_listener()
        return {
            "ok": True,
            "file_name": file_name,
            "listener_restarted": False,
            "error": "飞书配置不完整（App ID/App Secret），监听器已停止",
        }

    return {"ok": True, "file_name": file_name}
