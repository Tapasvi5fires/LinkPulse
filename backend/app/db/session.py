from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

# Create async engine with a small, disciplined pool for production
# Using a small pool (2-5) is better for Supabase Transaction Pooler (6543)
# as it allows connection reuse without hitting global limits.
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=2,          # Small base pool for reuse
    max_overflow=10,      # Allow bursts
    pool_recycle=1800,    # Recycle every 30 mins
    pool_timeout=60,      # Wait up to 60s for a connection
    connect_args={
        "command_timeout": 60,
        "server_settings": {"search_path": "public"}
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
