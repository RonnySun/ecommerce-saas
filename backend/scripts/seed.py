"""
数据库种子脚本：将 mock_data.json 导入数据库
运行方式：python scripts/seed.py
"""
import asyncio
import json
import sys
import os
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.models.tenant import Tenant
from app.models.store import Store
from app.models.order import DailyStat
from app.models.user import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def seed():
    # 加载模拟数据
    mock_path = os.path.join(os.path.dirname(__file__), "../../data/mock/mock_data.json")
    with open(mock_path, encoding="utf-8") as f:
        data = json.load(f)

    async with AsyncSessionLocal() as session:
        # 清空旧数据
        from sqlalchemy import text
        await session.execute(text("TRUNCATE TABLE daily_stats, orders, stores, users, tenants RESTART IDENTITY CASCADE"))
        await session.commit()
        print("🗑️  旧数据已清空")

        # 1. 写入租户
        tenants = {}
        for t in data["tenants"]:
            tenant = Tenant(name=t["name"], slug=t["slug"], plan=t["plan"])
            session.add(tenant)
            await session.flush()
            tenants[t["id"]] = tenant.id
        await session.commit()
        print(f"✅ 租户写入完成：{len(data['tenants'])} 条")

        # 2. 写入店铺
        stores = {}
        for s in data["stores"]:
            store = Store(
                tenant_id=tenants[s["tenant_id"]],
                name=s["name"],
                platform=s["platform"],
            )
            session.add(store)
            await session.flush()
            stores[s["id"]] = store.id
        await session.commit()
        print(f"✅ 店铺写入完成：{len(data['stores'])} 条")

        # 3. 写入每日统计
        batch = []
        for stat in data["daily_stats"]:
            batch.append(DailyStat(
                store_id=stores[stat["store_id"]],
                stat_date=datetime.strptime(stat["stat_date"], "%Y-%m-%d"),
                gmv=Decimal(str(stat["gmv"])),
                orders_count=stat["orders_count"],
                refund_amount=Decimal(str(stat["refund_amount"])),
                ad_cost=Decimal(str(stat["ad_cost"])),
                net_profit=Decimal(str(stat["net_profit"])),
                roi=Decimal(str(stat["roi"])),
            ))
        session.add_all(batch)
        await session.commit()
        print(f"✅ 每日统计写入完成：{len(batch)} 条")

        # 4. 写入演示用户
        demo_users = [
            User(tenant_id=1, email="owner@youpin.com",
                 hashed_password=pwd_context.hash("demo123"),
                 full_name="优品老板", role="owner"),
            User(tenant_id=1, email="finance@youpin.com",
                 hashed_password=pwd_context.hash("demo123"),
                 full_name="财务小王", role="finance"),
            User(tenant_id=2, email="owner@legou.com",
                 hashed_password=pwd_context.hash("demo123"),
                 full_name="乐购老板", role="owner"),
        ]
        session.add_all(demo_users)
        await session.commit()
        print(f"✅ 演示用户写入完成：{len(demo_users)} 条")

    print("\n🎉 数据库初始化完成！")
    print("   演示账号：owner@youpin.com / demo123")


if __name__ == "__main__":
    asyncio.run(seed())
