import os
import logging
import shutil
from typing import Optional, Union
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.backend = settings.STORAGE_BACKEND.lower()
        self.local_dir = "data/storage"
        os.makedirs(self.local_dir, exist_ok=True)
        
        self.supabase_client = None
        if self.backend == "supabase":
            try:
                from supabase import create_client, Client
                self.supabase_client: Client = create_client(
                    settings.SUPABASE_URL, 
                    settings.SUPABASE_KEY
                )
                logger.info("Supabase storage client initialized.")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.backend = "local" # Fallback

    async def upload(self, file_path: str, destination_name: str) -> str:
        """
        Upload a file to storage.
        Returns the identifier (local path or supabase path).
        """
        if self.backend == "supabase":
            try:
                with open(file_path, "rb") as f:
                    self.supabase_client.storage.from_(settings.STORAGE_BUCKET).upload(
                        path=destination_name,
                        file=f,
                        file_options={"content-type": "application/octet-stream"}
                    )
                return destination_name # Return path in bucket
            except Exception as e:
                logger.error(f"Supabase upload failed: {e}")
                # Fallback to local if possible or raise
                raise e
        else:
            # Local storage
            local_path = os.path.join(self.local_dir, destination_name)
            if file_path != local_path:
                shutil.copy2(file_path, local_path)
            return local_path

    def get_signed_url(self, identifier: str, expires_in: int = 3600) -> str:
        """
        Get a temporary signed URL for the file.
        In local mode, returns a relative API path.
        """
        if self.backend == "supabase":
            try:
                res = self.supabase_client.storage.from_(settings.STORAGE_BUCKET).create_signed_url(
                    path=identifier,
                    expires_in=expires_in
                )
                return res.get("signedURL") or res.get("signedUrl")
            except Exception as e:
                logger.error(f"Error generating signed URL for {identifier}: {e}")
                return ""
        else:
            # Local mode: Return the proxy endpoint URL
            filename = os.path.basename(identifier)
            return f"/api/v1/files/{filename}"

    def delete(self, identifier: str):
        """Delete file from storage."""
        if self.backend == "supabase":
            try:
                self.supabase_client.storage.from_(settings.STORAGE_BUCKET).remove([identifier])
            except Exception as e:
                logger.warning(f"Failed to delete {identifier} from Supabase: {e}")
        else:
            if os.path.exists(identifier):
                try:
                    os.remove(identifier)
                except Exception as e:
                    logger.warning(f"Failed to delete local file {identifier}: {e}")

storage_service = StorageService()
