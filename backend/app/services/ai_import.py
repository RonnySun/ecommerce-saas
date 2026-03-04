"""
AI 智能导入服务
功能：
1) 先做鲁棒读表（CSV/Excel、编码/分隔符/表头行/Sheet 自动识别）
2) 再让 LLM 做字段语义映射，规则引擎做兜底
"""
import csv
import io
import json
import re
from typing import Dict, List, Tuple

import pandas as pd
from openai import OpenAI

from app.core.config import settings
from app.services.model_config import resolve_model_runtime_config

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


_FIELD_ALIASES: Dict[str, List[str]] = {
    "order_no": ["订单号", "订单编号", "交易单号", "交易号", "流水号", "order", "order_no", "order id", "订单id"],
    "store_name": ["店铺", "店铺名", "门店", "店铺名称", "账号", "店铺账号", "店名", "store", "shop"],
    "gmv": ["gmv", "销售额", "成交金额", "实付金额", "付款金额", "支付金额", "订单金额", "总金额", "交易金额", "营业额"],
    "ad_cost": ["广告费", "推广费", "投放费用", "营销费", "广告消耗", "ad", "ad cost", "推广消耗"],
    "platform_fee": ["平台佣金", "佣金", "手续费", "服务费", "平台服务费", "抽佣", "技术服务费", "结算服务费"],
    "net_profit": ["净利润", "利润", "毛利", "收益", "净收益", "profit", "net"],
    "order_date": ["日期", "下单日期", "订单日期", "付款时间", "成交时间", "支付时间", "交易时间", "时间", "date"],
}


def _normalize_col_name(name: object) -> str:
    text = str(name or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _dedup_columns(columns: List[str]) -> List[str]:
    used: Dict[str, int] = {}
    result: List[str] = []
    for raw in columns:
        col = _normalize_col_name(raw) or "未命名列"
        idx = used.get(col, 0)
        if idx == 0:
            result.append(col)
        else:
            result.append(f"{col}_{idx + 1}")
        used[col] = idx + 1
    return result


def _detect_csv_delimiter(text: str) -> str:
    sample = "\n".join(text.splitlines()[:20])
    if not sample.strip():
        return ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
        return dialect.delimiter
    except Exception:
        pass
    counts = {d: sample.count(d) for d in [",", "\t", ";", "|"]}
    best = max(counts, key=counts.get)
    return best if counts[best] > 0 else ","


def _header_keyword_boost(val: str) -> int:
    s = str(val or "").lower()
    boost = 0
    for aliases in _FIELD_ALIASES.values():
        if any(a.lower() in s for a in aliases):
            boost += 2
    return boost


def _detect_header_row(preview_df: pd.DataFrame, max_scan: int = 15) -> int:
    """
    在前若干行中定位最可能的表头行。
    评分规则偏向：
    - 非空列较多
    - 文本列名较多
    - 与已知业务关键词匹配
    """
    if preview_df.empty:
        return 0

    best_row = 0
    best_score = -10**9
    rows = min(max_scan, len(preview_df))

    for i in range(rows):
        row = preview_df.iloc[i]
        values = [str(v).strip() for v in row.tolist() if str(v).strip() and str(v).strip().lower() != "nan"]
        if not values:
            continue

        non_empty = len(values)
        unique_count = len(set(values))
        text_like = sum(1 for v in values if re.search(r"[A-Za-z\u4e00-\u9fff]", v))
        numeric_like = sum(1 for v in values if re.fullmatch(r"[-+]?\d+(\.\d+)?", v))
        keyword_boost = sum(_header_keyword_boost(v) for v in values)
        duplicate_penalty = (non_empty - unique_count) * 2
        numeric_penalty = numeric_like * 2

        score = non_empty * 4 + text_like * 2 + keyword_boost - duplicate_penalty - numeric_penalty
        if score > best_score:
            best_score = score
            best_row = i

    return best_row


def _pick_excel_sheet(excel: pd.ExcelFile) -> str:
    """
    选择最可能是明细数据的 sheet（数据密度最高 + 列数合理）。
    """
    best_sheet = excel.sheet_names[0]
    best_score = -1
    for name in excel.sheet_names:
        try:
            preview = pd.read_excel(excel, sheet_name=name, header=None, nrows=60, dtype=str)
        except Exception:
            continue
        if preview.empty:
            continue
        non_empty = int(preview.notna().sum().sum())
        cols = int(preview.shape[1])
        rows = int(preview.shape[0])
        score = non_empty + cols * 3 + rows
        if score > best_score:
            best_score = score
            best_sheet = name
    return best_sheet


def _read_csv_robust(file_bytes: bytes) -> pd.DataFrame:
    encodings = ["utf-8-sig", "utf-8", "gbk", "gb18030", "gb2312"]
    last_err = None
    for encoding in encodings:
        try:
            text = file_bytes.decode(encoding)
            delimiter = _detect_csv_delimiter(text)
            preview = pd.read_csv(
                io.StringIO(text),
                sep=delimiter,
                header=None,
                dtype=str,
                nrows=60,
                engine="python",
            )
            header_row = _detect_header_row(preview)
            df = pd.read_csv(
                io.StringIO(text),
                sep=delimiter,
                header=header_row,
                dtype=str,
                engine="python",
            )
            return df
        except Exception as e:
            last_err = e
            continue
    raise ValueError(f"CSV 文件解析失败，请检查编码或分隔符。{last_err}")


def _read_excel_robust(file_bytes: bytes) -> pd.DataFrame:
    excel = pd.ExcelFile(io.BytesIO(file_bytes))
    if not excel.sheet_names:
        raise ValueError("Excel 没有可读取的工作表")
    sheet_name = _pick_excel_sheet(excel)
    preview = pd.read_excel(excel, sheet_name=sheet_name, header=None, nrows=60, dtype=str)
    header_row = _detect_header_row(preview)
    df = pd.read_excel(excel, sheet_name=sheet_name, header=header_row, dtype=str)
    return df


def read_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """读取 Excel/CSV 并自动识别 sheet + 表头行，返回 DataFrame。"""
    lower = (filename or "").lower()
    if lower.endswith(".csv"):
        df = _read_csv_robust(file_bytes)
    elif lower.endswith((".xlsx", ".xls")):
        df = _read_excel_robust(file_bytes)
    else:
        raise ValueError("只支持 .xlsx .xls .csv 格式的文件")

    if df is None or df.empty:
        raise ValueError("未识别到有效数据，请确认文件包含订单明细")

    df.columns = _dedup_columns([_normalize_col_name(c) for c in df.columns.tolist()])
    df = df.dropna(how="all")
    if df.empty:
        raise ValueError("文件内容为空，请检查后重试")
    return df


def get_sample_data(df: pd.DataFrame, rows: int = 3) -> dict:
    """提取列名和前几行样本数据，用于发给 AI 分析"""
    columns = df.columns.tolist()
    # 清理列名（去掉多余空格）
    columns = [_normalize_col_name(c) for c in columns]
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


def _heuristic_mapping(columns: List[str]) -> Tuple[Dict[str, str], Dict[str, float]]:
    mapping: Dict[str, str] = {}
    confidence: Dict[str, float] = {}
    for col in columns:
        normalized = col.lower()
        best_field = "ignore"
        best_score = 0
        for field, aliases in _FIELD_ALIASES.items():
            for alias in aliases:
                if alias.lower() in normalized:
                    score = len(alias)
                    if score > best_score:
                        best_field = field
                        best_score = score
        if best_field == "ignore":
            mapping[col] = "ignore"
            confidence[col] = 0.35
        else:
            mapping[col] = best_field
            confidence[col] = 0.82 if best_score >= 3 else 0.7
    return mapping, confidence


def _extract_json_object(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
        if blocks:
            text = blocks[0].strip()

    # 直接 JSON
    try:
        return json.loads(text)
    except Exception:
        pass

    # 截取第一个 {...}
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("AI 返回不是 JSON")
    return json.loads(m.group(0))


def _merge_mapping(columns: List[str], llm_result: dict, rule_map: Dict[str, str], rule_conf: Dict[str, float]) -> dict:
    llm_map_raw = llm_result.get("mapping") or {}
    llm_conf_raw = llm_result.get("confidence") or {}

    mapping: Dict[str, str] = {}
    confidence: Dict[str, float] = {}
    valid_fields = set(SYSTEM_FIELDS.keys())
    for col in columns:
        llm_field = llm_map_raw.get(col)
        llm_ok = isinstance(llm_field, str) and llm_field in valid_fields
        if llm_ok:
            mapping[col] = llm_field
            try:
                c = float(llm_conf_raw.get(col, 0.75))
            except Exception:
                c = 0.75
            confidence[col] = max(0.0, min(1.0, c))
            continue
        mapping[col] = rule_map.get(col, "ignore")
        confidence[col] = float(rule_conf.get(col, 0.35))

    return {
        "mapping": mapping,
        "confidence": confidence,
        "tips": llm_result.get("tips") or "已完成智能字段识别，可手动微调后导入。",
    }


async def ai_analyze_columns(columns: list[str], sample_rows: list[list], db, tenant_id: int) -> dict:
    """
    调用模型服务（OpenAI SDK 兼容接口），分析列名，返回字段映射建议
    返回格式：{"用户列名": "system_field_key", ...}
    """
    runtime_cfg = await resolve_model_runtime_config(db, tenant_id)
    provider = runtime_cfg.get("provider", "minimax")
    model_name = runtime_cfg.get("model", "") or settings.OPENAI_MODEL
    api_key = runtime_cfg.get("api_key", "") or settings.OPENAI_API_KEY
    base_url = runtime_cfg.get("base_url", "") or settings.OPENAI_BASE_URL

    if not api_key:
        raise ValueError("AI 服务未配置，请设置模型 API Key")
    if not model_name:
        raise ValueError("AI 服务未配置，请设置模型名称")
    if not base_url:
        raise ValueError("AI 服务未配置，请设置 Base URL")

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    rule_mapping, rule_confidence = _heuristic_mapping(columns)

    # 构建 AI prompt（让 LLM 在规则基础上纠偏）
    fields_desc = "\n".join([f"  - {k}：{v}" for k, v in SYSTEM_FIELDS.items()])
    rule_text = "\n".join([f'  - "{k}" -> "{v}"' for k, v in rule_mapping.items()])
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

【规则引擎初步映射（可纠正）】
{rule_text}

【要求】
1. 根据列名含义和样本数据，判断每列最可能对应的系统字段，可对规则映射进行纠正
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

    response = client.chat.completions.create(
        model=model_name,
        max_tokens=1024,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = (response.choices[0].message.content or "").strip()
    llm_result = _extract_json_object(raw)
    result = _merge_mapping(columns, llm_result, rule_mapping, rule_confidence)
    usage = getattr(response, "usage", None)
    result["meta"] = {
        "model": f"{provider}/{model_name}",
        "input_tokens": getattr(usage, "prompt_tokens", 0) or 0,
        "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
    }
    return result
