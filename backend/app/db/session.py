from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

# Create async engine with optimized pool for production
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=False, # Set to False in production for performance
    pool_pre_ping=True,
    pool_size=10,        # Increased from default 5
    max_overflow=20,     # Allow more temporary connections
    pool_recycle=3600,   # Recycle connections every hour
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
