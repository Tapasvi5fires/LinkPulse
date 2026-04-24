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
    
    # REDIS_URL: str = "redis://localhost:6379/0"
    # CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    # CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # Storage Configuration
    STORAGE_BACKEND: str = "local" # local or supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    STORAGE_BUCKET: str = "linkpulse-storage"
    MAX_UPLOAD_SIZE_MB: int = 20
    
    # S3 Compatibility (Required for Supabase S3)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_S3_BUCKET: Optional[str] = "linkpulse-storage"
    AWS_S3_REGION: str = "ap-south-1"
    AWS_S3_ENDPOINT: Optional[str] = None
    
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
    
    # App Configuration
    USE_GEMINI_EMBEDDINGS: bool = True
    
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
        "http://127.0.0.1:8090",
        "https://linkpulse-eta.vercel.app",
        "https://linkpulse-eta.vercel.app/",
        "https://linkpulse-frontend.vercel.app",
        "https://linkpulse-frontend.vercel.app/",
        "https://linkpulse-backend-klv2.onrender.com",
        "https://linkpulse-backend-klv2.onrender.com/"
    ]

    @property
    def CORS_ORIGINS(self) -> List[str]:
        origins = self.BACKEND_CORS_ORIGINS.copy()
        
        # Add values from Env vars if they exist
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL)
            # Also add without trailing slash just in case
            if self.FRONTEND_URL.endswith("/"):
                origins.append(self.FRONTEND_URL[:-1])
                
        if self.BACKEND_URL and self.BACKEND_URL not in origins:
            origins.append(self.BACKEND_URL)
            
        return list(set(origins))

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        if not self.DATABASE_URL:
            # Fallback for local dev if DATABASE_URL is missing
            return "sqlite+aiosqlite:///./missing_db_url.db"
        
        # 1. Basic Cleaning
        url = self.DATABASE_URL.strip().replace("\r", "").replace("\n", "")
        
        # 2. Normalize to a parseable format (temporarily use http for urlparse)
        # We need to handle postgres://, postgresql://, or even postgresql+asyncpg://
        for prefix in ["postgresql+asyncpg://", "postgresql://", "postgres://"]:
            if url.startswith(prefix):
                temp_url = url.replace(prefix, "http://", 1)
                break
        else:
            # If no known prefix, just try to parse what we have or return as is
            temp_url = url if "://" in url else f"http://{url}"

        try:
            from urllib.parse import urlparse, quote_plus, parse_qs, urlencode
            p = urlparse(temp_url)
            
            # Extract components
            username = p.username or "postgres"
            password = p.password or ""
            hostname = p.hostname
            port = p.port or 5432
            path = p.path
            query_params = parse_qs(p.query)
            
            # SUPABASE POOLER (6543) SPECIAL HANDLING
            is_supabase = "supabase" in (hostname or "") or "pooler" in (hostname or "")
            
            if is_supabase:
                # Force Port 6543 for Transaction Mode (Highly recommended for FastAPI)
                if port == 5432:
                    port = 6543
                
                # Force Username suffix for Pooler (postgres.[ref])
                if port == 6543 and "." not in username:
                    if self.SUPABASE_URL and "supabase.co" in self.SUPABASE_URL:
                        try:
                            ref = self.SUPABASE_URL.split("://")[1].split(".")[0]
                            username = f"postgres.{ref}"
                        except Exception: pass
            
            # Robust Password Encoding (unquoted by urlparse, must be re-quoted for the final string)
            encoded_password = quote_plus(password)
            
            # Asyncpg SSL normalization
            if "sslmode" in query_params:
                val = query_params.pop("sslmode")
                query_params["ssl"] = val
            
            if is_supabase and "ssl" not in query_params:
                query_params["ssl"] = ["require"]
            
            # Reconstruct final URL with the required asyncpg driver
            new_query = urlencode(query_params, doseq=True)
            final_url = f"postgresql+asyncpg://{username}:{encoded_password}@{hostname}:{port}{path}"
            if new_query:
                final_url += f"?{new_query}"
            
            return final_url
            
        except Exception as e:
            # Fatal fallback if reconstruction fails
            print(f"CRITICAL: DB URL Reconstruction failed: {e}")
            # Last ditch attempt: simple string replacement
            return url.replace("postgres://", "postgresql+asyncpg://").replace("postgresql://", "postgresql+asyncpg://")

    class Config:
        case_sensitive = True
        # Use an absolute path relative to this file to find the .env in the root
        env_file = os.path.join(os.path.dirname(__file__), "../../../.env")

settings = Settings()
