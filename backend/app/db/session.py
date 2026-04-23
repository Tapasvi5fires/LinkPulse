from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

# Create async engine
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=True,
    pool_pre_ping=True,
    connect_args={
        "command_timeout": 30,
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
