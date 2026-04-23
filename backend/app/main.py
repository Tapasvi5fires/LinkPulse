import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.api import api_router
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import engine, Base
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
        logger.info("🚀 LINKPULSE BACKEND VERSION 5.0 - DEEP DEBUG MODE ENABLED")
        from sqlalchemy import text
        import asyncio
        import socket
        
        # Define the building blocks
        project_ref = "knytuuxlmmqyfqhtrmtt"
        password = "LinkPulse2024"
        regions = ["ap-south-1", "us-east-1"]
        ports = ["6543"] # Keep to pooler port for IP test
        
        # 1. Try to resolve the actual IP of the pooler to bypass DNS issues
        resolved_ips = []
        try:
            for reg in regions:
                host = f"aws-0-{reg}.pooler.supabase.com"
                info = socket.getaddrinfo(host, 6543, socket.AF_INET)
                for res in info:
                    resolved_ips.append((res[4][0], reg))
            logger.info(f"Resolved Supabase Poolers to IPs: {resolved_ips}")
        except Exception as e:
            logger.warning(f"DNS Resolution failed: {e}")

        # Brute-force construction
        candidates = []
        # 1. IPv4 Proxy (The "Secret Portal" for Render)
        ipv4_host = f"ipv4.db.{project_ref}.supabase.co"
        candidates.append(f"postgresql+asyncpg://postgres:{password}@{ipv4_host}:5432/postgres?ssl=require")
        candidates.append(f"postgresql+asyncpg://postgres.{project_ref}:{password}@{ipv4_host}:5432/postgres?ssl=require")

        # 2. Resolved IPs (Existing logic)
        for ip, reg in resolved_ips:
            candidates.append(f"postgresql+asyncpg://postgres.{project_ref}:{password}@{ip}:6543/postgres?ssl=require")
            candidates.append(f"postgresql+asyncpg://{project_ref}:{password}@{ip}:6543/postgres?ssl=require")

        # 3. Hostnames (Fallback)
        for reg in regions:
            host = f"aws-0-{reg}.pooler.supabase.com"
            candidates.append(f"postgresql+asyncpg://postgres.{project_ref}:{password}@{host}:6543/postgres?ssl=require")
            candidates.append(f"postgresql+asyncpg://{project_ref}:{password}@{host}:6543/postgres?ssl=require")

        max_retries = len(candidates) * 2
        retry_delay = 2
        
        for attempt in range(max_retries):
            # Rotate through candidates
            current_url = candidates[attempt % len(candidates)]
            
            # Mask password for logging
            log_url = current_url.replace(password, "****")
            logger.info(f"Trying URL candidate {attempt % len(candidates) + 1}: {log_url}")
            
            try:
                from sqlalchemy.ext.asyncio import create_async_engine
                temp_engine = create_async_engine(current_url, pool_pre_ping=True, connect_args={"command_timeout": 20})
                
                async with temp_engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                    logger.info(f"✅ SUCCESS! Database connected using candidate {attempt % len(candidates) + 1}")
                    return # Success!
            except Exception as e:
                logger.warning(f"❌ Attempt {attempt + 1} FAILED: {e}")
                if attempt < max_retries - 1:
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
