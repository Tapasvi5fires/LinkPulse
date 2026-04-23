import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.api import api_router
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import engine, SessionLocal
from app.models.base import Base
# Import models to ensure they are registered with Base.metadata
from app.models.user import User
from app.models.audit import AuditLog
import asyncio

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

try:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )

    # Set all CORS enabled origins (Nuclear fallback for Cloud debugging)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # LOUD DEBUGGING MIDDLEWARE
    @app.middleware("http")
    async def log_requests(request, call_next):
        print(f"🔥 REQUEST RECEIVED: {request.method} {request.url}")
        try:
            response = await call_next(request)
            print(f"✅ RESPONSE SENT: {response.status_code}")
            return response
        except Exception as e:
            print(f"💥 REQUEST CRASHED: {str(e)}")
            raise e

    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.on_event("startup")
    async def startup_event():
        logger.info("🚀 LINKPULSE BACKEND VERSION 6.0 - OFFICIAL SPEC ENABLED")
        
        # Initialize VectorDB (Payload Indices & Dimension Check)
        try:
            from app.services.processing.vector_db import vector_db
            # VectorDB initialization happens on import/first access
            logger.info("VectorDB initialized and indices verified.")
        except Exception as e:
            logger.error(f"VectorDB initialization failed: {e}")

        # Database Schema Sync
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                logger.info("✅ Database schema synchronized successfully.")
        except Exception as e:
            logger.error(f"❌ Database synchronization FAILED: {e}")

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
