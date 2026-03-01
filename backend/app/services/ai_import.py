"""
AI 智能导入服务
功能：读取用户上传的 Excel/CSV，用 AI 分析列名，自动映射到系统字段
"""
import io
import json
import pandas as pd
from anthropic import Anthropic
from app.core.config import settings

# 系统字段定义（这些是我们数据库里有的字段）
SYSTEM_FIELDS = {
    "order_no":      "订单号",
    "store_name":    "店铺名称",
    "gmv":           "销售额/成交金额",
    "ad_cost":       "广告费",
    "platform_fee":  "平台佣金/手续费",
    "net_profit":    "净利润",
    "order_date":    "订单日期",
    "ignore":        "忽略此列（不导入）",
}


def read_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """读取 Excel 或 CSV 文件，返回 DataFrame"""
    if filename.endswith(".csv"):
        # 尝试几种常见编码
        for encoding in ["utf-8", "gbk", "gb2312", "utf-8-sig"]:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding=encoding)
                return df
            except UnicodeDecodeError:
                continue
        raise ValueError("CSV 文件编码不支持，请转换为 UTF-8 后重试")
    elif filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(file_bytes))
        return df
    else:
        raise ValueError("只支持 .xlsx .xls .csv 格式的文件")


def get_sample_data(df: pd.DataFrame, rows: int = 3) -> dict:
    """提取列名和前几行样本数据，用于发给 AI 分析"""
    columns = df.columns.tolist()
    # 清理列名（去掉多余空格）
    columns = [str(c).strip() for c in columns]
    df.columns = columns

    # 取前几行非空数据作为样本
    sample = df.dropna(how="all").head(rows)
    sample_rows = []
    for _, row in sample.iterrows():
        sample_rows.append([str(v).strip() if pd.notna(v) else "" for v in row.tolist()])

    return {
        "columns": columns,
        "sample_rows": sample_rows,
        "total_rows": len(df),
    }


def ai_analyze_columns(columns: list[str], sample_rows: list[list]) -> dict:
    """
    调用 MiniMax AI（Anthropic 兼容接口），分析列名，返回字段映射建议
    返回格式：{"用户列名": "system_field_key", ...}
    """
    # MiniMax 使用 Anthropic 兼容接口，SDK 直接复用，只换 base_url
    client = Anthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        base_url=settings.MINIMAX_BASE_URL,
    )

    # 构建 AI prompt
    fields_desc = "\n".join([f"  - {k}：{v}" for k, v in SYSTEM_FIELDS.items()])
    sample_text = ""
    for i, row in enumerate(sample_rows, 1):
        row_str = " | ".join([f"{columns[j]}={row[j]}" for j in range(min(len(columns), len(row)))])
        sample_text += f"  第{i}行数据：{row_str}\n"

    prompt = f"""你是一个电商数据分析专家。用户上传了一份电商订单数据表格，请帮我分析每列数据对应哪个系统字段。

【用户表格的列名】
{columns}

【前几行样本数据】
{sample_text}

【系统字段说明】
{fields_desc}

【要求】
1. 根据列名含义和样本数据，判断每列最可能对应的系统字段
2. 如果一列与任何系统字段都不相关（如买家昵称、收货地址等），请映射到 "ignore"
3. 如果文件中没有某个系统字段的对应列，不需要强行映射
4. 日期格式多样（2026-02-01、2026/2/1、20260201 等）都可以识别为 order_date

【返回格式】
只返回 JSON，不要有任何解释文字，格式如下：
{{
  "mapping": {{
    "用户列名1": "system_field_key",
    "用户列名2": "system_field_key",
    ...
  }},
  "confidence": {{
    "用户列名1": 0.95,
    "用户列名2": 0.80,
    ...
  }},
  "tips": "一句话说明映射结果或需要用户注意的地方"
}}"""

    response = client.messages.create(
        model="MiniMax-M2.5",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    # 解析 AI 返回的 JSON
    # MiniMax-M2.5 是推理模型，会先返回 thinking 块，再返回 text 块，取 text 块
    raw = ""
    for block in response.content:
        if hasattr(block, "text"):
            raw = block.text.strip()
            break

    # 有时候 AI 会在 JSON 外面加 markdown 代码块，去掉
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    result = json.loads(raw)
    return result
