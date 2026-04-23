from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

# Create async engine with high-capacity pool for production
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=20,         # High capacity for concurrent polling
    max_overflow=30,      # High burst capacity
    pool_recycle=1800,    # Recycle faster (30 mins)
    pool_timeout=60,      # Wait longer for a connection before failing
    pool_use_lifo=True,   # Return newest connections first (better for performance)
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
