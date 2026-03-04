"""
数据导出 API：导出订单数据为 Excel
"""
import io
from datetime import datetime, timedelta
from urllib.parse import quote

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.base import get_db
from app.models.order import Order
from app.models.store import Store
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()


@router.get("/excel")
async def export_excel(
    days: int = Query(default=30, ge=1, le=365),
    store_id: int = Query(default=0),          # 0 = 全部店铺
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导出订单数据为 Excel 文件"""
    since = datetime.now() - timedelta(days=days)

    # 查所有订单（JOIN 店铺名称）
    query = (
        select(Order, Store.name.label("store_name"), Store.platform)
        .join(Store, Order.store_id == Store.id)
        .where(
            Store.tenant_id == current_user.tenant_id,
            Order.order_date >= since,
        )
    )
    if store_id:
        query = query.where(Order.store_id == store_id)

    result = await db.execute(query.order_by(Order.order_date.desc()))
    rows = result.all()

    if not rows:
        # 返回空 Excel
        df = pd.DataFrame(columns=["订单号", "店铺", "平台", "GMV", "广告费", "平台佣金", "净利润", "日期", "状态"])
    else:
        platform_map = {"taobao": "淘宝/天猫", "jd": "京东", "pdd": "拼多多", "shopify": "独立站", "other": "其他"}
        records = []
        for order, store_name, platform in rows:
            records.append({
                "订单号":   order.order_no,
                "店铺":     store_name,
                "平台":     platform_map.get(platform, platform),
                "GMV":      float(order.gmv),
                "广告费":   float(order.ad_cost),
                "平台佣金": float(order.platform_fee),
                "净利润":   float(order.net_profit),
                "日期":     order.order_date.strftime("%Y-%m-%d"),
                "状态":     "已退款" if order.status == "refunded" else "已完成",
            })
        df = pd.DataFrame(records)

    try:
        # 写入 Excel（带样式）
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="订单数据", index=False)

            # 简单美化：调整列宽
            ws = writer.sheets["订单数据"]
            col_widths = {"A": 18, "B": 16, "C": 10, "D": 12, "E": 10, "F": 10, "G": 10, "H": 12, "I": 8}
            for col, width in col_widths.items():
                ws.column_dimensions[col].width = width

            # 汇总 sheet
            if rows:
                summary_data = {
                    "指标": ["导出周期", "总订单数", "总 GMV", "总广告费", "总净利润", "平均利润率"],
                    "数值": [
                        f"近 {days} 天",
                        len(records),
                        f"¥{df['GMV'].sum():,.2f}",
                        f"¥{df['广告费'].sum():,.2f}",
                        f"¥{df['净利润'].sum():,.2f}",
                        f"{df['净利润'].sum() / df['GMV'].sum() * 100:.1f}%" if df["GMV"].sum() > 0 else "0%",
                    ],
                }
                pd.DataFrame(summary_data).to_excel(writer, sheet_name="汇总", index=False)
                ws2 = writer.sheets["汇总"]
                ws2.column_dimensions["A"].width = 14
                ws2.column_dimensions["B"].width = 16

        output.seek(0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel 生成失败：{str(e)}")

    # HTTP 头必须是 ASCII，这里使用 ASCII 文件名 + RFC5987 UTF-8 文件名
    zh_filename = f"订单数据_近{days}天_{datetime.now().strftime('%Y%m%d')}.xlsx"
    ascii_filename = f"orders_{days}d_{datetime.now().strftime('%Y%m%d')}.xlsx"
    encoded_zh = quote(zh_filename)
    content_disposition = (
        f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_zh}'
    )

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": content_disposition},
    )
