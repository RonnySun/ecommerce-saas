"""
模拟数据生成器
生成多租户、多店铺、多日期的电商数据，用于开发测试
"""
import random
from datetime import datetime, timedelta
from decimal import Decimal
import json

# 模拟租户（电商公司）
TENANTS = [
    {"id": 1, "name": "优品电商有限公司", "slug": "youpin", "plan": "pro"},
    {"id": 2, "name": "乐购网络科技", "slug": "legou", "plan": "basic"},
]

# 模拟店铺
STORES = [
    {"id": 1, "tenant_id": 1, "name": "优品天猫旗舰店", "platform": "taobao"},
    {"id": 2, "tenant_id": 1, "name": "优品京东自营店", "platform": "jd"},
    {"id": 3, "tenant_id": 1, "name": "优品拼多多店", "platform": "pdd"},
    {"id": 4, "tenant_id": 2, "name": "乐购天猫店", "platform": "taobao"},
    {"id": 5, "tenant_id": 2, "name": "乐购独立站", "platform": "shopify"},
]

def generate_daily_stats(days: int = 90):
    """生成最近N天的每日数据"""
    stats = []
    today = datetime.now()
    
    for store in STORES:
        # 每个店铺基础GMV（模拟真实差异）
        base_gmv = {1: 50000, 2: 35000, 3: 20000, 4: 28000, 5: 15000}[store["id"]]
        
        for i in range(days):
            date = today - timedelta(days=i)
            # 周末效应（周末销售更好）
            weekend_boost = 1.3 if date.weekday() >= 5 else 1.0
            # 随机波动
            fluctuation = random.uniform(0.7, 1.4)
            
            gmv = round(base_gmv * weekend_boost * fluctuation, 2)
            orders = int(gmv / random.uniform(80, 200))
            ad_cost = round(gmv * random.uniform(0.08, 0.18), 2)
            platform_fee = round(gmv * 0.05, 2)
            refund = round(gmv * random.uniform(0.02, 0.08), 2)
            net_profit = round(gmv - ad_cost - platform_fee - refund - (gmv * 0.4), 2)
            roi = round(gmv / ad_cost, 2) if ad_cost > 0 else 0
            
            stats.append({
                "store_id": store["id"],
                "store_name": store["name"],
                "platform": store["platform"],
                "tenant_id": store["tenant_id"],
                "stat_date": date.strftime("%Y-%m-%d"),
                "gmv": gmv,
                "orders_count": orders,
                "refund_amount": refund,
                "ad_cost": ad_cost,
                "platform_fee": platform_fee,
                "net_profit": net_profit,
                "roi": roi,
            })
    return stats

if __name__ == "__main__":
    print("🔄 生成模拟数据...")
    stats = generate_daily_stats(90)
    
    output = {
        "tenants": TENANTS,
        "stores": STORES,
        "daily_stats": stats,
        "generated_at": datetime.now().isoformat(),
        "total_records": len(stats),
    }
    
    with open("data/mock/mock_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 生成完成：{len(stats)} 条每日统计数据")
    print(f"   租户数: {len(TENANTS)}")
    print(f"   店铺数: {len(STORES)}")
    print(f"   天数范围: 90天")
