from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from app.api import deps
from app.core.config import settings
from app.services.ingestion import ingestion_service
from app.services.processing.pipeline import processing_pipeline
from app.models.user import User
from app.services.ingestion.task_manager import task_manager
import logging
import shutil
import os
import uuid
import re

logger = logging.getLogger(__name__)

router = APIRouter()

TEMP_UPLOAD_DIR = "data/uploads"
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

class IngestRequest(BaseModel):
    source_type: str  # website, pdf, youtube, github, etc.
    source_url: str
    depth: int = 0

class IngestResponse(BaseModel):
    message: str
    task_id: str = "background_task"

async def process_ingestion_task(source_type: str, source_url: str, user_id: int, depth: int = 0, folder_name: str = None, task_id: str = None):
    try:
        from app.services.processing.vector_db import vector_db
        from app.services.storage import storage_service
        
        logger.info(f"Starting ingestion for {source_url}")
        
        # Determine if source_url is a storage identifier (key) vs a real URL/path
        # If it doesn't start with http, data/, or /, it's likely a cloud identifier
        is_storage_key = not source_url.startswith(("http://", "https://", "data/", "/"))
        actual_processing_url = source_url
        temp_download_path = None

        if is_storage_key:
            logger.info(f"Source {source_url} is a storage key. Downloading for processing...")
            file_id = str(uuid.uuid4())[:8]
            temp_download_path = os.path.join(TEMP_UPLOAD_DIR, f"ingest_{file_id}_{source_url}")
            actual_processing_url = await storage_service.download(source_url, temp_download_path)
        
        if task_id:
            task_manager.add_task(task_id, user_id, source_url, source_type)
        
        # IDEMPOTENCY: Clear old vectors for this source before re-processing
        vector_db.delete_source(source_url, user_id)
        
        # 1. Ingest
        documents = await ingestion_service.ingest_source(source_type, actual_processing_url, depth=depth)
        
        if not documents:
            logger.warning(f"No content extracted from {source_url}")
            if task_id:
                task_manager.fail_task(task_id, "No content extracted from source. It might be private, restricted, or empty.")
            return
            
        logger.info(f"Extracted {len(documents)} documents. Starting processing.")
        
        # 2. Process (Clean -> Chunk -> Embed -> Store)
        for doc in documents:
            # IMPORTANT: Inject source_url and source_type into metadata for VectorDB
            doc.metadata["source_url"] = doc.source_url
            doc.metadata["source_type"] = doc.source_type
            
            # Add folder/group info if provided
            if folder_name:
                doc.metadata["folder_name"] = folder_name
            
            await processing_pipeline.process_document(doc.content, doc.metadata, user_id=user_id)
            
        logger.info(f"Ingestion and processing complete for {source_url} (user_id={user_id})")
        if task_id:
            task_manager.complete_task(task_id)
        
    except Exception as e:
        logger.error(f"Ingestion task failed for {source_url}: {e}")
        if task_id:
            task_manager.fail_task(task_id, str(e))
    finally:
        # Cleanup temp file ONLY if it is in temp dir, NOT storage
        files_to_cleanup = []
        if source_url and source_url.replace("\\", "/").startswith(TEMP_UPLOAD_DIR + "/") and not "data/storage" in source_url.replace("\\", "/"):
            files_to_cleanup.append(source_url)
        
        if temp_download_path and os.path.exists(temp_download_path):
            files_to_cleanup.append(temp_download_path)

        for path in files_to_cleanup:
             try:
                 if os.path.exists(path):
                     os.remove(path)
                     logger.info(f"Cleaned up temp file: {path}")
             except Exception as cleanup_error:
                 logger.warning(f"Error cleaning up {path}: {cleanup_error}")


@router.post("/upload", response_model=IngestResponse)
async def upload_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    folder_name: Optional[str] = Form(None),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upload and ingest multiple files (PDF, DOCX, PPTX, TXT, MD).
    """
    from app.services.storage import storage_service
    
    task_ids = []
    MAX_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    
    for file in files:
        # 1. Size Check
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
        
        if size > MAX_SIZE:
            logger.warning(f"File too large: {file.filename} ({size} bytes)")
            continue

        filename = file.filename.lower()
        source_type = "pdf"
        if filename.endswith(".pdf"): source_type = "pdf"
        elif filename.endswith((".docx", ".doc")): source_type = "docx"
        elif filename.endswith((".pptx", ".ppt")): source_type = "pptx"
        elif filename.endswith((".txt", ".md")): source_type = "text"
        else: continue
             
        # 2. Save to temp first, then upload via StorageService
        file_id = str(uuid.uuid4())[:8]
        # Ensure S3-safe filename: alphanumeric, periods, hyphens, and underscores only
        clean_name = re.sub(r'[^a-zA-Z0-9._-]', '_', file.filename)
        unique_name = f"{file_id}_{clean_name}"
        temp_path = os.path.join(TEMP_UPLOAD_DIR, unique_name)
        
        try:
            # Use buffered copy for large multipart files
            with open(temp_path, "wb") as buffer:
                while chunk := await file.read(1024 * 1024): # 1MB chunks
                    buffer.write(chunk)
            
            # Reset file pointer if we need to read it again (though we don't here)
            await file.seek(0)
            
            # 3. Upload to permanent storage (Local or Cloud)
            storage_identifier = await storage_service.upload(temp_path, unique_name)
            
            # 4. Trigger background ingestion
            task_id = f"upload_{file_id[:8]}"
            background_tasks.add_task(
                process_ingestion_task, 
                source_type, 
                storage_identifier, 
                current_user.id, 
                0, 
                folder_name, 
                task_id
            )
            task_ids.append(file_id)
            
        except Exception as e:
            logger.error(f"Error processing upload {file.filename}: {e}")
            if os.path.exists(temp_path): os.remove(temp_path)
            raise HTTPException(status_code=500, detail=f"Failed to process {file.filename}")
            
    return {"message": f"Started ingestion for {len(task_ids)} files", "task_id": ",".join(task_ids)}


def _extract_group(meta: dict) -> str | None:
    """Extract group name from source metadata."""
    # Explicit folder_name from upload
    folder_name = meta.get("folder_name")
    if folder_name:
        return f"folder:{folder_name}"
    
    source_type = meta.get("source_type", "")
    
    # GitHub: group by repo name
    if source_type == "github":
        repo = meta.get("repo")
        if repo:
            return f"github:{repo}"
        # Fallback: extract from URL
        source_url = meta.get("source_url", "")
        match = re.search(r'github\.com/([^/]+/[^/]+)', source_url)
        if match:
            return f"github:{match.group(1)}"
    
    # Website: group by domain
    if source_type == "website":
        from urllib.parse import urlparse
        source_url = meta.get("source_url", "")
        parsed = urlparse(source_url)
        if parsed.netloc:
            # Strip 'www.' prefix for cleaner grouping
            domain = parsed.netloc.replace("www.", "")
            return f"website:{domain}"
    
    return None


@router.get("/sources", response_model=List[Any])
async def get_ingested_sources(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get list of all ingested sources with secure on-demand signed URLs.
    """
    from app.services.processing.vector_db import vector_db
    from app.services.storage import storage_service
    
    sources = {}
    try:
        user_metadata = vector_db.get_user_metadata(current_user.id)
    except Exception as e:
        logger.error(f"Failed to fetch metadata from Qdrant: {e}")
        return []
    
    for i, meta in user_metadata.items():
        try:
            if not meta:
                continue
                
            source_url = meta.get("source_url") or meta.get("url")
            if not source_url:
                title = meta.get("title", "unknown")
                source_url = f"doc_{title}"
            
            # Skip if we already processed this source
            if source_url in sources:
                continue

            # Check if source_url is a storage identifier (Local path or Cloud key)
            download_url = None
            try:
                # Generate fresh signed URL on-demand
                if source_url and not source_url.startswith(("http://", "https://")):
                    download_url = storage_service.get_signed_url(source_url)
                elif source_url and ("data/storage" in source_url or "_" in source_url):
                    download_url = storage_service.get_signed_url(source_url)
            except Exception as storage_err:
                logger.warning(f"Could not generate signed URL for {source_url}: {storage_err}")
                download_url = None

            group = _extract_group(meta)
            sources[source_url] = {
                "source_url": source_url,
                "source_type": meta.get("source_type", "unknown"),
                "title": meta.get("title", source_url),
                "ingested_at": meta.get("ingested_at"),
                "id": str(i),
                "download_url": download_url,
                "group": group,
                "repo": meta.get("repo"),
                "path": meta.get("path"),
                "folder_name": meta.get("folder_name"),
            }
        except Exception as item_error:
            logger.error(f"Error processing source item {i}: {item_error}")
    return list(sources.values())


@router.post("/url", response_model=IngestResponse)
async def trigger_ingestion(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Trigger an ingestion task in the background.
    """
    # Simple validation
    if request.source_type not in ingestion_service.ingestors:
        raise HTTPException(status_code=400, detail="Invalid source type")

    task_id = f"url_{str(uuid.uuid4())[:8]}"
    background_tasks.add_task(process_ingestion_task, request.source_type, request.source_url, current_user.id, depth=request.depth, task_id=task_id)
    
    return {"message": f"Ingestion started for {request.source_url}", "task_id": task_id}


@router.get("/tasks", response_model=List[Any])
async def get_active_tasks(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get list of active ingestion tasks for the current user.
    """
    return task_manager.get_user_tasks(current_user.id)


@router.post("/tasks/clear-failed", response_model=Any)
async def clear_failed_task(
    task_id: str,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Clear a failed task from the task manager.
    """
    task_manager.clear_failed_task(task_id)
    return {"message": "Task cleared"}


class ContentRequest(BaseModel):
    source_url: str

@router.post("/content", response_model=Any)
async def get_source_content(
    request: ContentRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get text content for a source URL.
    """
    from app.services.processing.vector_db import vector_db
    
    source_url = request.source_url
    logger.info(f"Getting content for source: {source_url}")
    
    # Collect all chunks for this source, sorted by chunk_index
    chunks = []
    user_metadata = vector_db.get_user_metadata(current_user.id)
    for i, meta in user_metadata.items():
            
        meta_url = meta.get("source_url") or meta.get("url", "")
        if meta_url == source_url:
            chunks.append({
                "text": meta.get("text", ""),
                "chunk_index": meta.get("chunk_index", 0) 
            })
    
    # Sort by chunk_index
    chunks.sort(key=lambda x: x["chunk_index"])
    
    # Combine all chunk texts
    full_content = "\n\n".join(c["text"] for c in chunks if c["text"])
    
    if not full_content:
        return {"content": "No content found for this source.", "chunk_count": 0}
    
    return {"content": full_content, "chunk_count": len(chunks)}


class DeleteRequest(BaseModel):
    source_url: str

@router.delete("/sources", response_model=Any)
async def delete_source(
    request: DeleteRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a source and its vectors.
    """
    from app.services.processing.vector_db import vector_db
    
    source_url = request.source_url
    logger.info(f"Deleting source: {source_url}")
    
    # 1. Remove from VectorDB (with ownership verification)
    deleted_count = vector_db.delete_source(source_url, current_user.id)
    
    if deleted_count == 0:
        logger.warning(f"Source not found or access denied for deletion: {source_url} (User: {current_user.id})")
        return {"message": "Source not found or access denied", "vectors_removed": 0}
    
    # 2. Delete file if it exists in storage (Normalize paths for safety)
    # Handle both forward and backward slashes
    normalized_source = source_url.replace("\\", "/")
    if "data/storage" in normalized_source:
        try:
            if os.path.exists(source_url):
                os.remove(source_url)
                logger.info(f"Deleted file from storage: {source_url}")
            elif os.path.exists(normalized_source): # Try normalized path
                os.remove(normalized_source)
                logger.info(f"Deleted file from storage (normalized): {normalized_source}")
        except Exception as e:
            logger.warning(f"Failed to delete file {source_url}: {e}")
            
    return {"message": f"Deleted source {source_url}", "vectors_removed": deleted_count}


class BulkDeleteRequest(BaseModel):
    source_urls: List[str]

@router.post("/sources/bulk-delete", response_model=Any)
async def bulk_delete_sources(
    request: BulkDeleteRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete multiple sources and their vectors at once.
    """
    from app.services.processing.vector_db import vector_db
    
    total_deleted = 0
    for source_url in request.source_urls:
        logger.info(f"Bulk deleting: {source_url} for user {current_user.id}")
        
        deleted = vector_db.delete_source(source_url, current_user.id)
        if deleted:
            total_deleted += deleted
        
        # Delete file from storage if applicable
        normalized_source = source_url.replace("\\", "/")
        if "data/storage" in normalized_source:
            try:
                if os.path.exists(source_url):
                    os.remove(source_url)
                elif os.path.exists(normalized_source):
                    os.remove(normalized_source)
            except Exception as e:
                logger.warning(f"Failed to delete file {source_url}: {e}")
    
    return {
        "message": f"Deleted {len(request.source_urls)} sources",
        "total_vectors_removed": total_deleted
    }
