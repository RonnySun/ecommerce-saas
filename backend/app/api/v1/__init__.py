from fastapi import APIRouter
from app.api.v1.endpoints import stats, auth, finance

router = APIRouter()
router.include_router(stats.router, prefix="/stats", tags=["统计数据"])
router.include_router(auth.router, prefix="/auth", tags=["认证"])
router.include_router(finance.router, prefix="/finance", tags=["财务"])
