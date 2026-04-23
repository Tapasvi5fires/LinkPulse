import os
from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "LinkPulse"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "super-secret-key-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # Storage Configuration
    STORAGE_BACKEND: str = "local" # local or supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    STORAGE_BUCKET: str = "linkpulse-storage"
    MAX_UPLOAD_SIZE_MB: int = 20
    
    # Gemini Configuration
    GEMINI_API_KEY: Optional[str] = None
    
    # Qdrant Configuration
    QDRANT_URL: Optional[str] = "http://localhost:6334"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = "linkpulse_vectors"
    
    # Search Configuration
    TAVILY_API_KEY: Optional[str] = None
    
    # Groq Configuration (Fallback)
    GROQ_API_KEY: Optional[str] = None
    
    # OpenAI (Deprecated but kept for reference/fallback if needed)
    OPENAI_API_KEY: Optional[str] = None
    
    # Ports (used for CORS and other config)
    BACKEND_PORT: int = 8090
    FRONTEND_PORT: int = 3090
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8090"

    # OAuth Configuration
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8090",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8090"
    ]

    @property
    def CORS_ORIGINS(self) -> List[str]:
        origins = self.BACKEND_CORS_ORIGINS.copy()
        if self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL)
        if self.BACKEND_URL not in origins:
            origins.append(self.BACKEND_URL)
        return list(set(origins))

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        if not self.DATABASE_URL:
            return "sqlite+aiosqlite:///./missing_db_url.db"
        url = self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
        # Supabase requires SSL for external connections
        if "supabase" in url and "ssl=" not in url:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}ssl=require"
        return url

    class Config:
        case_sensitive = True
        # Use an absolute path relative to this file to find the .env in the root
        env_file = os.path.join(os.path.dirname(__file__), "../../../.env")

settings = Settings()
