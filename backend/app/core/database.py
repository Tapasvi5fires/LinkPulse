from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Debug print to confirm what URL is being used
print(f"DEBUG: Connecting to DB with URL: {settings.ASYNC_DATABASE_URL}")
engine = create_async_engine(settings.ASYNC_DATABASE_URL, echo=False)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
