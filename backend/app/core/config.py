from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # 应用基础配置
    APP_NAME: str = "电商SaaS平台"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    # 数据库
    DATABASE_URL: str = "postgresql+asyncpg://saas_user:saas_pass@localhost:5432/ecommerce_saas"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT认证
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时
    
    # MiniMax API（Anthropic 兼容）
    ANTHROPIC_API_KEY: Optional[str] = None
    MINIMAX_BASE_URL: str = "https://api.minimaxi.com/anthropic"

    # OpenClaw
    OPENCLAW_API_URL: str = "http://127.0.0.1:18789"
    
    class Config:
        env_file = ".env"

settings = Settings()
