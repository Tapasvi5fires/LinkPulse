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
        logger.info("🚀 LINKPULSE BACKEND VERSION 6.0 - OFFICIAL SPEC ENABLED")
        import socket
        import asyncio
        
        # 1. DNS Check - Let's see what Render sees
        hosts_to_check = [
            "aws-0-ap-south-1.pooler.supabase.com",
            "db.knytuuxlmmqyfqhtrmtt.supabase.co"
        ]
        resolved_ips = {}
        for h in hosts_to_check:
            try:
                ip = socket.gethostbyname(h)
                logger.info(f"DNS CHECK: {h} resolves to {ip}")
                resolved_ips[h] = ip
            except Exception as e:
                logger.warning(f"DNS CHECK: {h} FAILED (System DNS): {e}")
                # Fallback to manual IP check
                try:
                    import subprocess
                    out = subprocess.check_output(["nslookup", h], timeout=5).decode()
                    if "Address:" in out:
                        ip = out.split("Address:")[-1].strip().split()[0]
                        logger.info(f"DNS CHECK: {h} resolved via NSLOOKUP: {ip}")
                        resolved_ips[h] = ip
                except:
                    pass

        # 2. Official Spec Candidates
        project_ref = "knytuuxlmmqyfqhtrmtt"
        password = "LinkPulse2024"
        
        # Build candidates using both Hostname and Resolved IP
        candidates = []
        pooler_host = "aws-0-ap-south-1.pooler.supabase.com"
        
        # Spec 1: Official Session Mode + Identity Options (The missing piece?)
        options = "?ssl=require&options=-c%20search_path=public&application_name=linkpulse"
        candidates.append(f"postgresql+asyncpg://postgres.{project_ref}:{password}@{pooler_host}:5432/postgres{options}")
        
        # Spec 2: Transaction Mode + Identity Options
        candidates.append(f"postgresql+asyncpg://postgres.{project_ref}:{password}@{pooler_host}:6543/postgres{options}")
        
        # Spec 3: Resolved IP + Identity Options
        if pooler_host in resolved_ips:
            ip = resolved_ips[pooler_host]
            candidates.append(f"postgresql+asyncpg://postgres.{project_ref}:{password}@{ip}:5432/postgres{options}")

        for attempt, url in enumerate(candidates):
            log_url = url.replace(password, "****")
            logger.info(f"Trying Official Spec {attempt + 1}: {log_url}")
            
            try:
                from sqlalchemy.ext.asyncio import create_async_engine
                temp_engine = create_async_engine(url, pool_pre_ping=True, connect_args={"command_timeout": 15})
                async with temp_engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                    logger.info(f"✅ SUCCESS! Connected using Spec {attempt + 1}")
                    return
            except Exception as e:
                logger.warning(f"❌ Spec {attempt + 1} FAILED: {e}")
                await asyncio.sleep(2)

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
