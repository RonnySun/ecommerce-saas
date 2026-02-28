from fastapi import APIRouter
from app.api.v1.endpoints import stats

router = APIRouter()
router.include_router(stats.router, prefix="/stats", tags=["统计数据"])
