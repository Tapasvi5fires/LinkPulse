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
            return "sqlite+aiosqlite:///./missing_db_url.db"
        
        url = self.DATABASE_URL.strip().replace("\r", "").replace("\n", "")
        
        try:
            # 1. Isolate Protocol
            protocol = "postgresql+asyncpg"
            if "://" in url:
                addr = url.split("://", 1)[1]
            else:
                addr = url

            # 2. Isolate Userinfo and Host/Path using rsplit (safest for passwords with '@')
            if "@" in addr:
                userinfo, hostpath = addr.rsplit("@", 1)
                if ":" in userinfo:
                    username, password = userinfo.split(":", 1)
                else:
                    username, password = userinfo, ""
            else:
                username, password, hostpath = "postgres", "", addr

            # 3. Isolate Host and Path
            if "/" in hostpath:
                host_port, path = hostpath.split("/", 1)
                path = f"/{path}"
            else:
                host_port, path = hostpath, "/postgres"

            # 4. Isolate Host and Port
            if ":" in host_port:
                hostname, port = host_port.split(":", 1)
                port = int(port)
            else:
                hostname, port = host_port, 5432

            # 5. Extract Query Params
            query = ""
            if "?" in path:
                path, query = path.split("?", 1)

            # --- SUPABASE POOLER HARDENING ---
            is_supabase = "supabase" in hostname or "pooler" in hostname
            if is_supabase:
                if port == 5432: port = 6543 # Force Transaction Mode
                if port == 6543 and "." not in username:
                    # Only append project ref if we definitely have it
                    if self.SUPABASE_URL and "supabase.co" in self.SUPABASE_URL:
                        ref = self.SUPABASE_URL.split("://")[1].split(".")[0]
                        username = f"postgres.{ref}"
            
            # --- SSL NORMALIZATION ---
            # If the user already provided ssl parameters, keep them. 
            # Otherwise, add ssl=require for Supabase.
            if is_supabase and "ssl" not in query.lower():
                query += "&ssl=require" if query else "ssl=require"
            
            # Robust Password Encoding (ONLY encode if it looks like it needs it, 
            # but usually quote_plus is safe for all strings)
            from urllib.parse import quote_plus
            encoded_password = quote_plus(password)
            
            # Reconstruct final URL
            final_url = f"{protocol}://{username}:{encoded_password}@{hostname}:{port}{path}"
            if query:
                # Ensure query starts with ? correctly
                query_str = query if query.startswith("&") else f"?{query}"
                final_url += query_str.replace("??", "?")
            
            return final_url

        except Exception as e:
            print(f"CRITICAL: Manual DB URL parse failed: {e}")
            return url.replace("postgres://", "postgresql+asyncpg://").replace("postgresql://", "postgresql+asyncpg://")

    class Config:
        case_sensitive = True
        # Use an absolute path relative to this file to find the .env in the root
        env_file = os.path.join(os.path.dirname(__file__), "../../../.env")

settings = Settings()
