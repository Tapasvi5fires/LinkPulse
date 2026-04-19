import sys
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.api.api import api_router
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

# Global Warning Filters
import warnings
# Suppress "FutureWarning: All support for the `google.generativeai` package has ended..."
# We will migrate to `google.genai` in a future update.
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")

# CORS Options
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        # Create tables (for development/MVP simple setup)
        # In production, use Alembic migrations
        await conn.run_sync(Base.metadata.create_all)

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
    """Serve uploaded files from storage directory."""
    # Try relative path first (more common in dev)
    file_path = os.path.join(STORAGE_DIR_RELATIVE, filename)
    if not os.path.isfile(file_path):
        # Try absolute path
        file_path = os.path.join(STORAGE_DIR, filename)
    
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    
    # Determine content type
    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = "application/octet-stream"
    
    return FileResponse(
        path=file_path,
        media_type=content_type,
        filename=filename,
        headers={
            "Content-Disposition": f"inline; filename=\"{filename}\"",
            "Access-Control-Allow-Origin": "*",
        }
    )
