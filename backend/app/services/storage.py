import os
import logging
import shutil
import asyncio
from typing import Optional, Union
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.backend = settings.STORAGE_BACKEND.lower()
        self.local_dir = "data/storage"
        os.makedirs(self.local_dir, exist_ok=True)
        
        self.s3_client = None
        self.supabase_client = None
        
        # 1. Try S3 Backend first (More robust for large files)
        if self.backend == "supabase" and settings.AWS_ACCESS_KEY_ID:
            try:
                import aioboto3
                from botocore.config import Config
                self.s3_session = aioboto3.Session()
                logger.info("S3 storage initialized (Supabase S3).")
                self.backend_type = "s3"
            except Exception as e:
                logger.warning(f"S3 client failed to init, falling back: {e}")
                self.backend_type = "supabase_client"
        else:
            self.backend_type = "supabase_client" if self.backend == "supabase" else "local"

        # 2. Fallback to Supabase Standard Client
        if self.backend == "supabase" and self.backend_type == "supabase_client":
            try:
                from supabase import create_client, Client
                self.supabase_client: Client = create_client(
                    settings.SUPABASE_URL, 
                    settings.SUPABASE_KEY
                )
                logger.info("Supabase standard storage client initialized.")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.backend = "local" # Final fallback

    async def _get_s3_client(self):
        """Internal helper for async S3 client."""
        import aioboto3
        session = aioboto3.Session()
        return session.client(
            's3',
            region_name=settings.AWS_S3_REGION,
            endpoint_url=settings.AWS_S3_ENDPOINT,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )

    async def upload(self, file_path: str, destination_name: str) -> str:
        """Upload a file to storage."""
        if self.backend == "supabase":
            # Prefer S3
            if self.backend_type == "s3":
                try:
                    async with self._get_s3_client() as s3:
                        with open(file_path, "rb") as f:
                            await s3.put_object(
                                Bucket=settings.STORAGE_BUCKET,
                                Key=destination_name,
                                Body=f
                            )
                    return destination_name
                except Exception as e:
                    logger.error(f"S3 upload failed: {e}")
                    raise e
            
            # Use Standard Client
            try:
                with open(file_path, "rb") as f:
                    self.supabase_client.storage.from_(settings.STORAGE_BUCKET).upload(
                        path=destination_name,
                        file=f,
                        file_options={"content-type": "application/octet-stream"}
                    )
                return destination_name
            except Exception as e:
                logger.error(f"Supabase standard upload failed: {e}")
                raise e
        else:
            # Local storage
            local_path = os.path.join(self.local_dir, destination_name)
            if file_path != local_path:
                shutil.copy2(file_path, local_path)
            return local_path

    async def get_signed_url(self, identifier: str, expires_in: int = 3600) -> str:
        """Get a temporary signed URL for the file."""
        if self.backend == "supabase":
            if self.backend_type == "s3":
                try:
                    async with self._get_s3_client() as s3:
                        url = await s3.generate_presigned_url(
                            'get_object',
                            Params={'Bucket': settings.STORAGE_BUCKET, 'Key': identifier},
                            ExpiresIn=expires_in
                        )
                        return url
                except Exception as e:
                    logger.error(f"S3 signed URL failed: {e}")
            
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
            filename = os.path.basename(identifier)
            return f"/api/v1/files/{filename}"

    async def delete(self, identifier: str):
        """Delete file from storage."""
        if self.backend == "supabase":
            if self.backend_type == "s3":
                try:
                    async with self._get_s3_client() as s3:
                        await s3.delete_object(Bucket=settings.STORAGE_BUCKET, Key=identifier)
                    return
                except Exception as e:
                    logger.error(f"S3 delete failed: {e}")
            
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
