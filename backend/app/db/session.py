from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

from sqlalchemy.pool import NullPool

# Create async engine with NullPool for production
# This is RECOMMENDED when using external poolers like Supabase (Port 6543)
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    poolclass=NullPool,  # Disable client-side pooling
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
