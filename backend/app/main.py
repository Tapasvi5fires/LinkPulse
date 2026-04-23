import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.api import api_router
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.base import Base
import asyncio

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

try:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )

    # Set all CORS enabled origins
    if settings.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.on_event("startup")
    async def startup_event():
        from sqlalchemy import text
        import asyncio
        import socket
        
        # Network Diagnostic
        try:
            from urllib.parse import urlparse
            p = urlparse(settings.ASYNC_DATABASE_URL.replace("postgresql+asyncpg://", "http://"))
            print(f"DIAGNOSTIC: Attempting to reach {p.hostname} on port {p.port}...")
            socket.create_connection((p.hostname, p.port), timeout=5)
            print(f"DIAGNOSTIC: Success! Network path to {p.hostname} is OPEN.")
        except Exception as e:
            print(f"DIAGNOSTIC: FAILED! Cannot reach host. Error: {e}")
            
        # Define candidate URLs to brute-force the connection
        base_url = settings.ASYNC_DATABASE_URL
        project_ref = settings.ASYNC_DATABASE_URL.split("postgres.")[1].split(":")[0] if "postgres." in settings.ASYNC_DATABASE_URL else ""
        
        candidates = [base_url] # Start with the one provided
        
        if project_ref:
            # 1. Try with just the project_ref as username
            candidates.append(base_url.replace(f"postgres.{project_ref}", project_ref))
            # 2. Try with project_ref as database name
            candidates.append(base_url.replace("/postgres", f"/{project_ref}").replace(f"postgres.{project_ref}", "postgres"))
        
        max_retries = 9
        retry_delay = 5
        
        for attempt in range(max_retries):
            # Rotate through candidates
            current_url = candidates[attempt % len(candidates)]
            try:
                # We need to recreate the engine for each candidate if we are switching
                from sqlalchemy.ext.asyncio import create_async_engine
                temp_engine = create_async_engine(current_url, pool_pre_ping=True)
                
                async with temp_engine.begin() as conn:
                    # 1. Create tables if they don't exist
                    await conn.run_sync(Base.metadata.create_all)
                    
                    # 2. Self-healing schema updates
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;"))
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR;"))
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR;"))
                    await conn.execute(text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;"))
                    
                    logger.info(f"Database initialized successfully using URL candidate {attempt % len(candidates) + 1}")
                    return # Success!
            except Exception as e:
                logger.warning(f"Database connection attempt {attempt + 1} failed with URL candidate {attempt % len(candidates) + 1}: {e}")
                if attempt < max_retries - 1:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.error("All database connection attempts failed.")

    @app.get("/")
    def root():
        return {"message": "Welcome to LinkPulse API", "status": "online"}

    @app.get("/health")
    def health_check():
        return {"status": "healthy"}

except Exception as e:
    import traceback
    error_detail = traceback.format_exc()
    print("\n" + "="*50)
    print("CRITICAL STARTUP ERROR:")
    print(f"Error Type: {type(e).__name__}")
    print(f"Error Message: {str(e)}")
    print("\nFULL TRACEBACK:")
    print(error_detail)
    print("="*50 + "\n")
    sys.exit(1)
