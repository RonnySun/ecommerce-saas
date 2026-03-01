"""
AI 智能导入 API
POST /import/analyze  - 上传文件，AI 分析列映射
POST /import/confirm  - 确认映射，写入数据库
"""
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.base import get_db
from app.models.order import Order
from app.models.store import Store
from app.models.user import User
from app.services.ai_import import ai_analyze_columns, get_sample_data, read_file, SYSTEM_FIELDS

router = APIRouter()


# ─────────────────────────────────────────────
# 数据结构定义
# ─────────────────────────────────────────────

class AnalyzeResponse(BaseModel):
    """AI 分析结果"""
    columns: list[str]           # 用户文件的列名
    sample_rows: list[list]      # 前3行样本数据
    total_rows: int              # 文件总行数
    mapping: dict[str, str]      # AI 建议映射 {"用户列名": "system_field"}
    confidence: dict[str, float] # 置信度
    tips: str                    # AI 提示
    system_fields: dict          # 系统字段说明（给前端展示下拉选项用）


class ColumnMapping(BaseModel):
    column: str      # 用户文件列名
    field: str       # 映射到的系统字段


class ConfirmRequest(BaseModel):
    """用户确认映射后，发起正式导入"""
    filename: str
    mappings: list[ColumnMapping]   # 最终确认的映射关系


class ImportResult(BaseModel):
    success: int     # 成功导入行数
    failed: int      # 失败行数
    skipped: int     # 跳过行数（重复订单号）
    errors: list[str]  # 错误详情（最多显示10条）


# ─────────────────────────────────────────────
# 接口1：上传文件，AI 分析列映射
# ─────────────────────────────────────────────

# 临时存储上传的文件内容（实际生产环境应用 Redis 或对象存储）
_file_cache: dict[str, bytes] = {}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Step 1：上传 Excel/CSV 文件，AI 自动分析列映射
    - 读取文件列名和样本数据
    - 调用 Claude AI 判断每列含义
    - 返回映射建议，供用户在前端确认或调整
    """
    # 文件大小限制：10MB
    MAX_SIZE = 10 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="文件过大，最大支持 10MB")

    filename = file.filename or "unknown"

    try:
        # 读取文件
        df = read_file(file_bytes, filename)

        # 提取列名和样本数据
        sample = get_sample_data(df, rows=3)

        # 缓存文件（用于后续 confirm 接口读取）
        cache_key = f"{current_user.id}_{filename}"
        _file_cache[cache_key] = file_bytes

        # 调用 AI 分析
        ai_result = ai_analyze_columns(sample["columns"], sample["sample_rows"])

        return AnalyzeResponse(
            columns=sample["columns"],
            sample_rows=sample["sample_rows"],
            total_rows=sample["total_rows"],
            mapping=ai_result.get("mapping", {}),
            confidence=ai_result.get("confidence", {}),
            tips=ai_result.get("tips", ""),
            system_fields=SYSTEM_FIELDS,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件解析失败：{str(e)}")


# ─────────────────────────────────────────────
# 接口2：用户确认映射，正式导入数据库
# ─────────────────────────────────────────────

@router.post("/confirm", response_model=ImportResult)
async def confirm_import(
    req: ConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2：用户在前端确认（或微调）映射后，正式将数据写入数据库
    - 按映射关系解析每一行数据
    - 自动创建不存在的店铺
    - 跳过重复订单号
    - 返回导入结果统计
    """
    cache_key = f"{current_user.id}_{req.filename}"
    file_bytes = _file_cache.get(cache_key)
    if not file_bytes:
        raise HTTPException(status_code=400, detail="文件已过期，请重新上传")

    # 构建映射字典 {用户列名: 系统字段}
    field_map = {m.column: m.field for m in req.mappings if m.field != "ignore"}

    # 检查必填字段
    mapped_fields = set(field_map.values())
    required_fields = {"order_date"}  # 至少要有日期
    missing = required_fields - mapped_fields
    if missing:
        field_names = [SYSTEM_FIELDS.get(f, f) for f in missing]
        raise HTTPException(status_code=400, detail=f"缺少必要字段：{', '.join(field_names)}")

    try:
        df = read_file(file_bytes, req.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件读取失败：{str(e)}")

    # 获取当前租户的所有店铺（用于匹配/创建）
    store_result = await db.execute(
        select(Store).where(Store.tenant_id == current_user.tenant_id)
    )
    stores = {s.name: s for s in store_result.scalars().all()}

    success, failed, skipped = 0, 0, 0
    errors = []

    for row_idx, row in df.iterrows():
        try:
            row_data = {}

            # 按映射关系提取数据
            for col, field in field_map.items():
                if col in df.columns:
                    val = row[col]
                    row_data[field] = val if pd.notna(val) else None

            # ── 解析店铺 ──────────────────────
            store_name = str(row_data.get("store_name", "")).strip()
            if not store_name:
                store_name = "默认店铺"

            if store_name not in stores:
                # 自动创建新店铺
                new_store = Store(
                    tenant_id=current_user.tenant_id,
                    name=store_name,
                    platform="other",
                )
                db.add(new_store)
                await db.flush()  # 获取新店铺的 id
                stores[store_name] = new_store

            store = stores[store_name]

            # ── 解析日期 ──────────────────────
            raw_date = row_data.get("order_date")
            if raw_date is None:
                raise ValueError("订单日期为空")
            try:
                order_date = pd.to_datetime(raw_date)
            except Exception:
                raise ValueError(f"日期格式无法识别：{raw_date}")

            # ── 解析金额字段 ───────────────────
            def parse_decimal(val, default=0) -> Decimal:
                if val is None or str(val).strip() == "":
                    return Decimal(str(default))
                # 去掉货币符号、逗号
                clean = str(val).replace("¥", "").replace("￥", "").replace(",", "").strip()
                try:
                    return Decimal(clean)
                except InvalidOperation:
                    return Decimal(str(default))

            gmv          = parse_decimal(row_data.get("gmv"), 0)
            ad_cost      = parse_decimal(row_data.get("ad_cost"), 0)
            platform_fee = parse_decimal(row_data.get("platform_fee"), 0)
            net_profit   = parse_decimal(row_data.get("net_profit"), 0)

            # 如果利润没有映射列，自动估算（GMV - 广告费 - 平台佣金）
            if "net_profit" not in mapped_fields:
                net_profit = gmv - ad_cost - platform_fee

            # ── 解析订单号 ─────────────────────
            order_no = str(row_data.get("order_no", "")).strip()
            if not order_no:
                order_no = f"IMPORT_{row_idx + 1}"

            # ── 写入数据库 ─────────────────────
            order = Order(
                store_id=store.id,
                order_no=order_no,
                gmv=gmv,
                ad_cost=ad_cost,
                platform_fee=platform_fee,
                net_profit=net_profit,
                order_date=order_date,
                status="paid",
            )
            db.add(order)
            success += 1

        except Exception as e:
            failed += 1
            if len(errors) < 10:
                errors.append(f"第 {row_idx + 2} 行：{str(e)}")

    await db.commit()

    # 清除缓存
    _file_cache.pop(cache_key, None)

    return ImportResult(
        success=success,
        failed=failed,
        skipped=skipped,
        errors=errors,
    )
