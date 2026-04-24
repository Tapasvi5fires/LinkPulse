from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

# Create async engine with a robust pool for production/cloud
# Optimized for Render Free Tier: Sharing 60 Supabase connections 
# across processes without hitting limits.
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=False,           
    pool_size=10,         # 10 connections per process
    max_overflow=5,       # 15 total per process (prevents pool exhaustion)
    pool_recycle=30,      # Recycle faster (Supabase kills idle connections)
    pool_timeout=30,      
    pool_use_lifo=True,
    pool_pre_ping=True,   # CRITICAL: Check connection health before use
    connect_args={
        "command_timeout": 60,
        "server_settings": {"search_path": "public"},
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0
    }
)

# Create session factory
SessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# SessionLocal will use the Base imported above

# Dependency to get DB session
async def get_db():
    async with SessionLocal() as session:
        yield session
