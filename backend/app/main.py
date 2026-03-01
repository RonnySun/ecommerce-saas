from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
)

# CORS（允许前端访问）
# 生产环境通过 ALLOWED_ORIGINS 环境变量配置，多个域名用逗号分隔
import os
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": f"{settings.APP_NAME} API is running 🚀"}

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}

# 路由注册
from app.api.v1 import router
app.include_router(router, prefix="/api/v1")
