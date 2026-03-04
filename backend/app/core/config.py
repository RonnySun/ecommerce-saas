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
    
    # OpenAI SDK 默认配置（用于导入模块的兜底调用）
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.minimaxi.com/v1"
    OPENAI_MODEL: str = "MiniMax-M2.5"
    # 兼容旧环境变量，避免本地 .env 启动失败
    ANTHROPIC_API_KEY: Optional[str] = None
    MINIMAX_BASE_URL: Optional[str] = None

    # OpenClaw
    OPENCLAW_API_URL: str = "http://127.0.0.1:18789"
    
    class Config:
        env_file = ".env"
        env_ignore_empty = True  # 忽略空字符串环境变量，优先使用 .env 文件

settings = Settings()
