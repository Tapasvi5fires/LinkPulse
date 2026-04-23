import os
import logging
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.core.config import settings
import uuid

logger = logging.getLogger(__name__)

class VectorDB:
    def __init__(self):
        self.collection_name = settings.QDRANT_COLLECTION
        
        # Determine if we are using cloud or local
        if settings.QDRANT_API_KEY:
            # Cloud/Remote with API Key
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY
            )
        else:
            # Local or Remote without API Key
            url = settings.QDRANT_URL
            if not url:
                url = "http://localhost:6334"
            self.client = QdrantClient(url=url)
            
        self._ensure_collection()
    
    def _reconnect(self):
        """Helper to re-initialize client if it loses attributes during reloads."""
        try:
            url = settings.QDRANT_URL or "http://localhost:6334"
            if settings.QDRANT_API_KEY:
                self.client = QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
            else:
                self.client = QdrantClient(url=url)
            logger.info("Qdrant client re-initialized.")
        except Exception as e:
            logger.error(f"Failed to reconnect to Qdrant: {e}")

    def _ensure_collection(self):
        try:
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            
            # Default dimension: 768 for Gemini text-embedding-004, 384 for all-MiniLM-L6-v2
            # We prefer 768 for Cloud/Production
            target_size = 768 if settings.GEMINI_API_KEY else 384
            
            if self.collection_name not in collection_names:
                logger.info(f"Creating collection: {self.collection_name} (Size: {target_size})")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=target_size,
                        distance=models.Distance.COSINE
                    )
                )
            else:
                # Check for dimension mismatch
                info = self.client.get_collection(self.collection_name)
                current_size = info.config.params.vectors.size
                if current_size != target_size:
                    logger.warning(f"Dimension mismatch! Collection: {current_size}, App: {target_size}. Recreating...")
                    self.client.delete_collection(self.collection_name)
                    self.client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=models.VectorParams(
                            size=target_size,
                            distance=models.Distance.COSINE
                        )
                    )
            
            # Ensure payload indexes (Required by Qdrant Cloud for filtering)
            index_fields = [
                ("user_id", models.PayloadSchemaType.INTEGER),
                ("source_url", models.PayloadSchemaType.KEYWORD),
                ("url", models.PayloadSchemaType.KEYWORD),
                ("title", models.PayloadSchemaType.KEYWORD)
            ]
            
            for field_name, schema_type in index_fields:
                try:
                    self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name=field_name,
                        field_schema=schema_type
                    )
                    logger.info(f"✅ Qdrant payload index for '{field_name}' ensured.")
                except Exception as index_error:
                    # Ignore if index already exists or other non-critical issues
                    logger.debug(f"Index check for {field_name}: {index_error}")
                    
        except Exception as e:
            logger.error(f"Error ensuring Qdrant collection or indexes: {e}")

    def add(self, embeddings: List[List[float]], metadatas: List[Dict[str, Any]]):
        if not embeddings:
            return
            
        points = []
        for i, (emb, meta) in enumerate(zip(embeddings, metadatas)):
            point_id = str(uuid.uuid4())
            points.append(models.PointStruct(
                id=point_id,
                vector=emb,
                payload=meta
            ))
            
        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        logger.info(f"Added {len(points)} vectors to Qdrant.")

    def search(self, query_vector: List[float], k: int = 5, user_id: Optional[int] = None, source_urls: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        # Build Filter
        must_filters = []
        if user_id is not None:
            must_filters.append(models.FieldCondition(
                key="user_id",
                match=models.MatchValue(value=user_id)
            ))
            
        if source_urls:
            # Match any of the provided source URLs
            must_filters.append(models.Filter(
                should=[
                    models.FieldCondition(key="source_url", match=models.MatchValue(value=url))
                    for url in source_urls
                ] + [
                    models.FieldCondition(key="url", match=models.MatchValue(value=url))
                    for url in source_urls
                ]
            ))
            
        query_filter = models.Filter(must=must_filters) if must_filters else None
        
        # Self-healing check and diagnostics
        if not hasattr(self.client, 'search'):
            logger.warning(f"Qdrant client diagnostic - Type: {type(self.client)}, Dir: {dir(self.client)[:10]}...")
            self._reconnect()

        # Try multiple methods in order of modern preference
        try:
            if hasattr(self.client, 'search'):
                search_result = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    query_filter=query_filter,
                    limit=k,
                    with_payload=True
                )
            elif hasattr(self.client, 'query_points'):
                search_result = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    query_filter=query_filter,
                    limit=k,
                    with_payload=True
                ).points
            else:
                # Last resort: direct access to internal http client if library is broken
                logger.error("All standard Qdrant methods missing! Attempting emergency recovery.")
                self._reconnect()
                search_result = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    query_filter=query_filter,
                    limit=k,
                    with_payload=True
                )
        except Exception as e:
            logger.error(f"Critical Qdrant search failure (might be missing index): {e}")
            return []
        
        results = []
        for hit in search_result:
            results.append({
                "id": hit.id,
                "score": hit.score,
                "metadata": hit.payload
            })
        return results

    def delete_source(self, source_url: str, user_id: int) -> int:
        """
        Remove entries with matching source_url AND user_id.
        """
        try:
            delete_filter = models.Filter(
                must=[
                    models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id)),
                    models.Filter(
                        should=[
                            models.FieldCondition(key="source_url", match=models.MatchValue(value=source_url)),
                            models.FieldCondition(key="url", match=models.MatchValue(value=source_url)),
                            # Fallback match for the old doc_... titles
                            models.FieldCondition(key="title", match=models.MatchValue(value=source_url[4:] if source_url.startswith("doc_") else source_url))
                        ]
                    )
                ]
            )
            
            # To get count, we scroll first
            points, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=delete_filter,
                limit=10000,
                with_payload=False
            )
            
            if not points:
                return 0
                
            point_ids = [p.id for p in points]
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.PointIdsList(points=point_ids)
            )
            
            logger.info(f"Removed {len(point_ids)} vectors for source {source_url}")
            return len(point_ids)
        except Exception as e:
            logger.error(f"Failed to delete source from Qdrant: {e}")
            return 0

    # --- Compatibility Methods ---
    
    @property
    def metadata(self):
        """
        DANGEROUS: This is a hack for backward compatibility. 
        It only returns all metadata for the 'current' operation if iterated. 
        In Qdrant, we should use get_user_metadata(user_id) instead.
        """
        logger.warning("Direct access to vector_db.metadata is deprecated. Use get_user_metadata(user_id) instead.")
        # We can't easily return a live dict that behaves like the old one without user_id.
        # However, for some endpoints that iterate over ALL metadata (Admin-like), we provide this.
        return self.get_all_metadata()

    def get_user_metadata(self, user_id: int) -> Dict[str, Dict[str, Any]]:
        """
        Fetch all metadata chunks for a user.
        """
        try:
            points, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=models.Filter(
                    must=[models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id))]
                ),
                limit=10000,
                with_payload=True
            )
            return {p.id: p.payload for p in points}
        except Exception as e:
            # If index is missing or other transient error, return empty but don't crash
            logger.warning(f"Could not fetch user metadata (might be indexing): {e}")
            return {}

    def get_all_metadata(self) -> Dict[str, Dict[str, Any]]:
        """
        Fetch all metadata chunks (use sparingly).
        """
        points, _ = self.client.scroll(
            collection_name=self.collection_name,
            limit=10000,
            with_payload=True
        )
        return {p.id: p.payload for p in points}

    def save(self):
        """No-op for Qdrant."""
        pass

vector_db = VectorDB()
