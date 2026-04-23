import sys
import asyncio
import warnings

# Global Warning Filters (Must be at the top to catch early imports)
# Suppress "FutureWarning: All support for the `google.generativeai` package has ended..."
warnings.filterwarnings("ignore", category=FutureWarning, message=".*google.generativeai.*")
# Suppress Qdrant insecure connection warning for local dev
warnings.filterwarnings("ignore", message="Api key is used with an insecure connection.")
# Suppress Qdrant version mismatch warning
warnings.filterwarnings("ignore", message=".*Qdrant client version.*is incompatible with server version.*")

try:
    from fastapi import FastAPI, HTTPException, Depends
    from fastapi.middleware.cors import CORSMiddleware
    from app.api.api import api_router
    from app.api import deps
    from app.core.config import settings
    from app.core.database import engine
    from app.models.base import Base
    # Import all models so they are registered with Base.metadata
    from app.models.user import User
    from app.models.audit import AuditLog

    from app.core.logging_config import setup_logging

    # Set the event loop policy for Windows to support subprocesses (needed for Playwright)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    setup_logging()

    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="Autonomous Web-to-Knowledge AI Platform API",
        version="0.1.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
    )

    # CORS Options
    if settings.BACKEND_CORS_ORIGINS:
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
        async with engine.begin() as conn:
            # 1. Create tables if they don't exist
            await conn.run_sync(Base.metadata.create_all)
            
            # 2. Self-healing: Ensure new OAuth columns exist if table was already there
            # This is a safe way to handle schema updates without full Alembic migrations yet
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR;"))
            await conn.execute(text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;"))

    @app.get("/")
    def read_root():
        return {"message": "Welcome to LinkPulse API"}

    @app.get("/health")
    def health_check():
        return {"status": "ok"}


    # --- File serving endpoint for uploaded documents ---
    import os
    import mimetypes
    from fastapi.responses import FileResponse

    STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "storage")
    # Also check relative path
    STORAGE_DIR_RELATIVE = "data/storage"

    @app.get("/api/v1/files/{filename}")
    async def serve_file(filename: str):
        """Serve local files from storage directory (used in local dev mode)."""
        from app.services.storage import storage_service
        
        # In local mode, StorageService uses data/storage
        file_path = os.path.join("data/storage", filename)
        
        if not os.path.isfile(file_path):
            # Check absolute path fallback
            file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "storage", filename)
            
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        content_type, _ = mimetypes.guess_type(filename)
        return FileResponse(
            path=file_path,
            media_type=content_type or "application/octet-stream",
            filename=filename
        )

    @app.get("/api/v1/files/signed-url/{identifier:path}")
    async def get_file_signed_url(identifier: str, current_user: User = Depends(deps.get_current_active_user)):
        """Generate a fresh signed URL for a file identifier."""
        from app.services.storage import storage_service
        url = storage_service.get_signed_url(identifier)
        if not url:
            raise HTTPException(status_code=404, detail="File not found or access denied")
        return {"url": url}
except Exception as e:
    import traceback
    print("CRITICAL STARTUP ERROR:")
    traceback.print_exc()
    sys.exit(1)
