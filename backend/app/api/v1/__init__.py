from fastapi import APIRouter
from app.api.v1.endpoints import stats, auth, finance, bot, import_data, stores, export, agent, agent_config, feishu_bot

router = APIRouter()
router.include_router(stats.router, prefix="/stats", tags=["统计数据"])
router.include_router(auth.router, prefix="/auth", tags=["认证"])
router.include_router(finance.router, prefix="/finance", tags=["财务"])
router.include_router(bot.router, prefix="/bot", tags=["Bot接口"])
router.include_router(import_data.router, prefix="/import", tags=["AI智能导入"])
router.include_router(stores.router, prefix="/stores", tags=["店铺管理"])
router.include_router(export.router, prefix="/export", tags=["数据导出"])
router.include_router(agent.router, prefix="/agent", tags=["秒算Agent"])
router.include_router(agent_config.router, prefix="/agent/config", tags=["秒算配置"])
router.include_router(feishu_bot.router, prefix="/feishu", tags=["飞书监听器"])
