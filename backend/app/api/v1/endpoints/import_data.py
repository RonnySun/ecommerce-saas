"""
AI 智能导入 API
POST /import/analyze  - 上传文件，AI 分析列映射
POST /import/confirm  - 确认映射，写入数据库
"""
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.base import get_db
from app.models.import_job import ImportJob
from app.models.order import Order
from app.models.store import Store
from app.models.user import User
from app.services.ai_import import ai_analyze_columns, get_sample_data, read_file, SYSTEM_FIELDS

router = APIRouter()
MAX_IMPORT_CHARTS = 20
HISTORY_PAGE_SIZE = 5


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
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    preview_summary: dict = Field(default_factory=dict)
    duplicate_risk: bool = False
    duplicate_warning: str = ""
    chart_limit_reached: bool = False
    chart_limit_message: str = ""


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
    batch_id: str = ""


class ImportHistoryItem(BaseModel):
    id: int
    batch_id: str
    filename: str
    status: str
    total_rows: int
    mapped_columns: int
    success_count: int
    failed_count: int
    skipped_count: int
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    created_at: str = ""
    finished_at: str = ""


class ImportHistoryResponse(BaseModel):
    total_files: int
    total_rows: int
    total_success: int
    total_failed: int
    current_page: int
    page_size: int
    total_pages: int
    max_charts: int = MAX_IMPORT_CHARTS
    reached_limit: bool = False
    items: list[ImportHistoryItem]


class ImportBatchChartResponse(BaseModel):
    batch_id: str
    filename: str
    summary: dict
    trend: list[dict]
    stores: list[dict]
    note: str = ""


@router.get("/history", response_model=ImportHistoryResponse)
async def get_import_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(HISTORY_PAGE_SIZE, ge=1, le=HISTORY_PAGE_SIZE),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_import_job_chart_columns(db)
    total_row = (
        await db.execute(
            select(
                func.count(ImportJob.id).label("total_files"),
                func.coalesce(func.sum(ImportJob.total_rows), 0).label("total_rows"),
                func.coalesce(func.sum(ImportJob.success_count), 0).label("total_success"),
                func.coalesce(func.sum(ImportJob.failed_count), 0).label("total_failed"),
            ).where(ImportJob.tenant_id == current_user.tenant_id)
        )
    ).fetchone()

    total_files = int(total_row.total_files or 0)
    total_pages = max(1, (total_files + page_size - 1) // page_size)
    if page > total_pages:
        page = total_pages

    history_rows = (
        await db.execute(
            select(ImportJob)
            .where(ImportJob.tenant_id == current_user.tenant_id)
            .order_by(ImportJob.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    items = [
        ImportHistoryItem(
            id=r.id,
            batch_id=r.batch_id,
            filename=r.filename,
            status=r.status,
            total_rows=r.total_rows,
            mapped_columns=r.mapped_columns,
            success_count=r.success_count,
            failed_count=r.failed_count,
            skipped_count=r.skipped_count,
            model=r.model or "",
            input_tokens=r.input_tokens or 0,
            output_tokens=r.output_tokens or 0,
            created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            finished_at=r.finished_at.strftime("%Y-%m-%d %H:%M:%S") if r.finished_at else "",
        )
        for r in history_rows
    ]

    return ImportHistoryResponse(
        total_files=total_files,
        total_rows=int(total_row.total_rows or 0),
        total_success=int(total_row.total_success or 0),
        total_failed=int(total_row.total_failed or 0),
        current_page=page,
        page_size=page_size,
        total_pages=total_pages,
        reached_limit=total_files >= MAX_IMPORT_CHARTS,
        items=items,
    )


@router.get("/history/{batch_id}/charts", response_model=ImportBatchChartResponse)
async def get_import_batch_charts(
    batch_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_import_job_chart_columns(db)
    job = (
        await db.execute(
            select(ImportJob).where(
                ImportJob.tenant_id == current_user.tenant_id,
                ImportJob.batch_id == batch_id,
            )
        )
    ).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="导入批次不存在")

    if job.chart_summary and job.chart_trend is not None and job.chart_stores is not None:
        summary = dict(job.chart_summary or {})
        summary["success_count"] = int(job.success_count or 0)
        summary["failed_count"] = int(job.failed_count or 0)
        summary["skipped_count"] = int(job.skipped_count or 0)
        return ImportBatchChartResponse(
            batch_id=batch_id,
            filename=job.filename,
            summary=summary,
            trend=list(job.chart_trend or []),
            stores=list(job.chart_stores or []),
            note="",
        )

    trend_rows = (
        await db.execute(
            select(
                func.date(Order.order_date).label("date"),
                func.sum(Order.gmv).label("gmv"),
                func.sum(Order.ad_cost).label("ad_cost"),
                func.sum(Order.net_profit).label("net_profit"),
                func.count(Order.id).label("orders"),
            )
            .where(Order.import_batch_id == batch_id)
            .group_by(func.date(Order.order_date))
            .order_by(func.date(Order.order_date))
        )
    ).fetchall()

    store_rows = (
        await db.execute(
            select(
                Store.id,
                Store.name,
                func.sum(Order.gmv).label("gmv"),
                func.sum(Order.net_profit).label("net_profit"),
                func.count(Order.id).label("orders"),
            )
            .join(Order, Order.store_id == Store.id)
            .where(
                Store.tenant_id == current_user.tenant_id,
                Order.import_batch_id == batch_id,
            )
            .group_by(Store.id, Store.name)
            .order_by(func.sum(Order.gmv).desc())
        )
    ).fetchall()

    totals_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(Order.gmv), 0).label("gmv"),
                func.coalesce(func.sum(Order.ad_cost), 0).label("ad_cost"),
                func.coalesce(func.sum(Order.net_profit), 0).label("net_profit"),
                func.count(Order.id).label("orders"),
            ).where(Order.import_batch_id == batch_id)
        )
    ).fetchone()

    summary = {
        "total_rows": job.total_rows,
        "success_count": job.success_count,
        "failed_count": job.failed_count,
        "skipped_count": job.skipped_count,
        "gmv": float(totals_row.gmv or 0),
        "ad_cost": float(totals_row.ad_cost or 0),
        "net_profit": float(totals_row.net_profit or 0),
        "orders": int(totals_row.orders or 0),
    }
    trend = [
        {
            "date": str(r.date),
            "gmv": float(r.gmv or 0),
            "ad_cost": float(r.ad_cost or 0),
            "net_profit": float(r.net_profit or 0),
            "orders": int(r.orders or 0),
        }
        for r in trend_rows
    ]
    stores = [
        {
            "store_id": int(r.id),
            "name": r.name,
            "gmv": float(r.gmv or 0),
            "net_profit": float(r.net_profit or 0),
            "orders": int(r.orders or 0),
        }
        for r in store_rows
    ]

    return ImportBatchChartResponse(
        batch_id=batch_id,
        filename=job.filename,
        summary=summary,
        trend=trend,
        stores=stores,
        note="",
    )


@router.delete("/history/{batch_id}")
async def delete_import_batch(
    batch_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_import_job_chart_columns(db)
    job = (
        await db.execute(
            select(ImportJob).where(
                ImportJob.tenant_id == current_user.tenant_id,
                ImportJob.batch_id == batch_id,
            )
        )
    ).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="导入批次不存在")

    store_ids = [
        r[0]
        for r in (
            await db.execute(
                select(Store.id).where(Store.tenant_id == current_user.tenant_id)
            )
        ).fetchall()
    ]
    if store_ids:
        await db.execute(
            delete(Order).where(
                Order.import_batch_id == batch_id,
                Order.store_id.in_(store_ids),
            )
        )
    await db.delete(job)
    await db.commit()
    return {"ok": True, "batch_id": batch_id}


# ─────────────────────────────────────────────
# 接口1：上传文件，AI 分析列映射
# ─────────────────────────────────────────────

# 临时存储上传的文件内容（实际生产环境应用 Redis 或对象存储）
_file_cache: dict[str, dict] = {}


async def _ensure_import_job_chart_columns(db: AsyncSession) -> None:
    """
    兼容历史库：自动补齐 import_jobs 图表字段，避免因未跑迁移导致导入失败。
    """
    required = {
        "chart_summary": "JSON",
        "chart_trend": "JSON",
        "chart_stores": "JSON",
    }
    rows = (
        await db.execute(
            sa_text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'import_jobs'"
            )
        )
    ).fetchall()
    existing = {r[0] for r in rows}
    changed = False
    for col, col_type in required.items():
        if col in existing:
            continue
        await db.execute(sa_text(f"ALTER TABLE import_jobs ADD COLUMN {col} {col_type}"))
        changed = True
    if changed:
        await db.commit()


def _parse_decimal(val, default=0) -> Decimal:
    if val is None or str(val).strip() == "":
        return Decimal(str(default))
    clean = str(val).replace("¥", "").replace("￥", "").replace(",", "").strip()
    try:
        return Decimal(clean)
    except InvalidOperation:
        return Decimal(str(default))


def _build_preview_summary(df: pd.DataFrame, mapping: dict[str, str]) -> dict:
    total_rows = len(df)
    mapped = {k: v for k, v in (mapping or {}).items() if v != "ignore"}
    gmv_col = next((c for c, f in mapped.items() if f == "gmv"), None)
    ad_col = next((c for c, f in mapped.items() if f == "ad_cost"), None)
    fee_col = next((c for c, f in mapped.items() if f == "platform_fee"), None)
    profit_col = next((c for c, f in mapped.items() if f == "net_profit"), None)
    date_col = next((c for c, f in mapped.items() if f == "order_date"), None)
    store_col = next((c for c, f in mapped.items() if f == "store_name"), None)

    total_gmv = Decimal("0")
    total_ad = Decimal("0")
    total_fee = Decimal("0")
    total_profit = Decimal("0")
    valid_dates = []
    stores = set()

    for _, row in df.iterrows():
        if gmv_col and gmv_col in df.columns:
            total_gmv += _parse_decimal(row.get(gmv_col), 0)
        if ad_col and ad_col in df.columns:
            total_ad += _parse_decimal(row.get(ad_col), 0)
        if fee_col and fee_col in df.columns:
            total_fee += _parse_decimal(row.get(fee_col), 0)
        if profit_col and profit_col in df.columns:
            total_profit += _parse_decimal(row.get(profit_col), 0)
        if store_col and store_col in df.columns:
            s = str(row.get(store_col) or "").strip()
            if s:
                stores.add(s)
        if date_col and date_col in df.columns:
            raw_date = row.get(date_col)
            if raw_date is not None and str(raw_date).strip():
                try:
                    valid_dates.append(pd.to_datetime(raw_date))
                except Exception:
                    pass

    # 若未映射净利润，按公式估算（与导入逻辑一致）
    if not profit_col:
        total_profit = total_gmv - total_ad - total_fee

    date_from = min(valid_dates).strftime("%Y-%m-%d") if valid_dates else ""
    date_to = max(valid_dates).strftime("%Y-%m-%d") if valid_dates else ""
    return {
        "total_rows": total_rows,
        "store_count": len(stores),
        "date_from": date_from,
        "date_to": date_to,
        "total_gmv": float(total_gmv),
        "total_ad_cost": float(total_ad),
        "total_platform_fee": float(total_fee),
        "total_net_profit": float(total_profit),
    }


def _build_chart_snapshot(df: pd.DataFrame, mapping: dict[str, str]) -> tuple[dict, list[dict], list[dict]]:
    mapped = {k: v for k, v in (mapping or {}).items() if v != "ignore"}
    gmv_col = next((c for c, f in mapped.items() if f == "gmv"), None)
    ad_col = next((c for c, f in mapped.items() if f == "ad_cost"), None)
    fee_col = next((c for c, f in mapped.items() if f == "platform_fee"), None)
    profit_col = next((c for c, f in mapped.items() if f == "net_profit"), None)
    date_col = next((c for c, f in mapped.items() if f == "order_date"), None)
    store_col = next((c for c, f in mapped.items() if f == "store_name"), None)

    trend_map: dict[str, dict] = {}
    store_map: dict[str, dict] = {}
    total_gmv = Decimal("0")
    total_ad = Decimal("0")
    total_profit = Decimal("0")
    rows_count = 0

    for _, row in df.iterrows():
        rows_count += 1
        gmv = _parse_decimal(row.get(gmv_col), 0) if gmv_col and gmv_col in df.columns else Decimal("0")
        ad_cost = _parse_decimal(row.get(ad_col), 0) if ad_col and ad_col in df.columns else Decimal("0")
        platform_fee = _parse_decimal(row.get(fee_col), 0) if fee_col and fee_col in df.columns else Decimal("0")
        if profit_col and profit_col in df.columns:
            net_profit = _parse_decimal(row.get(profit_col), 0)
        else:
            net_profit = gmv - ad_cost - platform_fee

        store_name = str(row.get(store_col) or "").strip() if store_col and store_col in df.columns else ""
        if not store_name:
            store_name = "默认店铺"

        date_key = ""
        raw_date = row.get(date_col) if date_col and date_col in df.columns else None
        if raw_date is not None and str(raw_date).strip():
            try:
                date_key = pd.to_datetime(raw_date).strftime("%Y-%m-%d")
            except Exception:
                date_key = ""
        if not date_key:
            date_key = "未识别日期"

        trend_item = trend_map.setdefault(date_key, {"date": date_key, "gmv": Decimal("0"), "ad_cost": Decimal("0"), "net_profit": Decimal("0"), "orders": 0})
        trend_item["gmv"] += gmv
        trend_item["ad_cost"] += ad_cost
        trend_item["net_profit"] += net_profit
        trend_item["orders"] += 1

        store_item = store_map.setdefault(store_name, {"name": store_name, "gmv": Decimal("0"), "net_profit": Decimal("0"), "orders": 0})
        store_item["gmv"] += gmv
        store_item["net_profit"] += net_profit
        store_item["orders"] += 1

        total_gmv += gmv
        total_ad += ad_cost
        total_profit += net_profit

    trend = sorted(
        [
            {
                "date": k,
                "gmv": float(v["gmv"]),
                "ad_cost": float(v["ad_cost"]),
                "net_profit": float(v["net_profit"]),
                "orders": int(v["orders"]),
            }
            for k, v in trend_map.items()
        ],
        key=lambda x: x["date"],
    )
    stores = sorted(
        [
            {
                "name": k,
                "gmv": float(v["gmv"]),
                "net_profit": float(v["net_profit"]),
                "orders": int(v["orders"]),
            }
            for k, v in store_map.items()
        ],
        key=lambda x: x["gmv"],
        reverse=True,
    )
    summary = {
        "total_rows": int(rows_count),
        "orders": int(rows_count),
        "gmv": float(total_gmv),
        "ad_cost": float(total_ad),
        "net_profit": float(total_profit),
    }
    return summary, trend, stores


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_import_job_chart_columns(db)
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

        # 缓存文件与分析元信息（用于后续 confirm 接口读取和导入历史）
        cache_key = f"{current_user.id}_{filename}"

        # 调用 AI 分析
        ai_result = await ai_analyze_columns(sample["columns"], sample["sample_rows"], db, current_user.tenant_id)
        meta = ai_result.get("meta", {})
        preview_summary = _build_preview_summary(df, ai_result.get("mapping", {}))
        _file_cache[cache_key] = {
            "file_bytes": file_bytes,
            "analyze_meta": {
                "model": meta.get("model", ""),
                "input_tokens": int(meta.get("input_tokens", 0) or 0),
                "output_tokens": int(meta.get("output_tokens", 0) or 0),
                "preview_summary": preview_summary,
            },
        }

        recent_job = (
            await db.execute(
                select(ImportJob)
                .where(
                    ImportJob.tenant_id == current_user.tenant_id,
                    ImportJob.filename == filename,
                )
                .order_by(ImportJob.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        duplicate_risk = False
        duplicate_warning = ""
        if recent_job:
            duplicate_risk = True
            recent_time = recent_job.created_at.strftime("%Y-%m-%d %H:%M:%S") if recent_job.created_at else "未知时间"
            duplicate_warning = (
                f"检测到你在 {recent_time} 导入过同名文件「{filename}」，"
                "可能包含重复订单。继续导入会自动跳过重复订单。"
            )

        current_count = (
            await db.execute(
                select(func.count(ImportJob.id)).where(ImportJob.tenant_id == current_user.tenant_id)
            )
        ).scalar() or 0
        chart_limit_reached = int(current_count) >= MAX_IMPORT_CHARTS
        chart_limit_message = (
            f"历史图表最多保留 {MAX_IMPORT_CHARTS} 条，当前已满，请先删除部分历史再导入。"
            if chart_limit_reached
            else ""
        )

        return AnalyzeResponse(
            columns=sample["columns"],
            sample_rows=sample["sample_rows"],
            total_rows=sample["total_rows"],
            mapping=ai_result.get("mapping", {}),
            confidence=ai_result.get("confidence", {}),
            tips=ai_result.get("tips", ""),
            system_fields=SYSTEM_FIELDS,
            model=meta.get("model", ""),
            input_tokens=int(meta.get("input_tokens", 0) or 0),
            output_tokens=int(meta.get("output_tokens", 0) or 0),
            preview_summary=preview_summary,
            duplicate_risk=duplicate_risk,
            duplicate_warning=duplicate_warning,
            chart_limit_reached=chart_limit_reached,
            chart_limit_message=chart_limit_message,
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
    await _ensure_import_job_chart_columns(db)
    """
    Step 2：用户在前端确认（或微调）映射后，正式将数据写入数据库
    - 按映射关系解析每一行数据
    - 自动创建不存在的店铺
    - 跳过重复订单号
    - 返回导入结果统计
    """
    cache_key = f"{current_user.id}_{req.filename}"
    cache_item = _file_cache.get(cache_key) or {}
    file_bytes = cache_item.get("file_bytes")
    if not file_bytes:
        raise HTTPException(status_code=400, detail="文件已过期，请重新上传")
    analyze_meta = cache_item.get("analyze_meta") or {}

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

    current_count = (
        await db.execute(
            select(func.count(ImportJob.id)).where(ImportJob.tenant_id == current_user.tenant_id)
        )
    ).scalar() or 0
    if int(current_count) >= MAX_IMPORT_CHARTS:
        raise HTTPException(status_code=400, detail=f"历史图表最多保留 {MAX_IMPORT_CHARTS} 条，请先删除部分历史后再导入")

    chart_summary, chart_trend, chart_stores = _build_chart_snapshot(df, field_map)

    batch_id = uuid.uuid4().hex
    import_job = ImportJob(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        batch_id=batch_id,
        filename=req.filename,
        total_rows=len(df),
        mapped_columns=len(field_map),
        model=str(analyze_meta.get("model") or ""),
        input_tokens=int(analyze_meta.get("input_tokens", 0) or 0),
        output_tokens=int(analyze_meta.get("output_tokens", 0) or 0),
        chart_summary=chart_summary,
        chart_trend=chart_trend,
        chart_stores=chart_stores,
        status="running",
    )
    db.add(import_job)
    await db.flush()

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
            gmv          = _parse_decimal(row_data.get("gmv"), 0)
            ad_cost      = _parse_decimal(row_data.get("ad_cost"), 0)
            platform_fee = _parse_decimal(row_data.get("platform_fee"), 0)
            net_profit   = _parse_decimal(row_data.get("net_profit"), 0)

            # 如果利润没有映射列，自动估算（GMV - 广告费 - 平台佣金）
            if "net_profit" not in mapped_fields:
                net_profit = gmv - ad_cost - platform_fee

            # ── 解析订单号 ─────────────────────
            order_no = str(row_data.get("order_no", "")).strip()
            if not order_no:
                order_no = f"IMPORT_{row_idx + 1}"

            # ── 重复订单跳过 ───────────────────
            existing_count = (
                await db.execute(
                    select(func.count(Order.id)).where(
                        Order.store_id == store.id,
                        Order.order_no == order_no,
                    )
                )
            ).scalar() or 0
            if existing_count > 0:
                skipped += 1
                continue

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
                import_batch_id=batch_id,
            )
            db.add(order)
            success += 1

        except Exception as e:
            failed += 1
            if len(errors) < 10:
                errors.append(f"第 {row_idx + 2} 行：{str(e)}")

    import_job.success_count = success
    import_job.failed_count = failed
    import_job.skipped_count = skipped
    import_job.finished_at = datetime.now()
    if failed == 0:
        import_job.status = "success"
    elif success > 0:
        import_job.status = "partial"
    else:
        import_job.status = "failed"
        import_job.error_message = "；".join(errors[:3]) if errors else "导入失败"

    await db.commit()

    # 清除缓存
    _file_cache.pop(cache_key, None)

    return ImportResult(
        success=success,
        failed=failed,
        skipped=skipped,
        errors=errors,
        batch_id=batch_id,
    )
