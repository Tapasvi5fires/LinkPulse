import faiss
import numpy as np
import pickle
import os
from typing import List, Dict, Any

class VectorDB:
    def __init__(self, dimension: int = 384, index_path: str = "data/faiss_index.bin", metadata_path: str = "data/metadata.pkl"):
        self.dimension = dimension
        self.index_path = index_path
        self.metadata_path = metadata_path
        self.metadata: Dict[int, Dict[str, Any]] = {}  # Map ID -> Metadata
        
        # Create data directory if not exists
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        
        import logging
        logger = logging.getLogger(__name__)
        
        if os.path.exists(index_path) and os.path.exists(metadata_path):
            try:
                self.index = faiss.read_index(index_path)
                with open(metadata_path, "rb") as f:
                    self.metadata = pickle.load(f)
                logger.info(f"Loaded VectorDB from disk. {self.index.ntotal} vectors, {len(self.metadata)} metadata entries.")
            except Exception as e:
                logger.error(f"Failed to load VectorDB from disk: {e}. Starting fresh.")
                self.index = faiss.IndexFlatL2(dimension)
                self.metadata = {}
        else:
            logger.info("VectorDB data not found. Creating new index.")
            self.index = faiss.IndexFlatL2(dimension)

    def add(self, embeddings: List[List[float]], metadatas: List[Dict[str, Any]]):
        if not embeddings:
            return
            
        vectors = np.array(embeddings).astype('float32')
        start_id = self.index.ntotal
        self.index.add(vectors)
        
        for i, meta in enumerate(metadatas):
            self.metadata[start_id + i] = meta
            
        self.save()

    def search(self, query_vector: List[float], k: int = 5) -> List[Dict[str, Any]]:
        vector = np.array([query_vector]).astype('float32')
        distances, indices = self.index.search(vector, k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1:
                meta = self.metadata.get(idx, {})
                results.append({
                    "id": int(idx),
                    "score": float(distances[0][i]),
                    "metadata": meta
                })
        return results

    def delete_source(self, source_url: str) -> int:
        """
        Remove entries with matching source_url from metadata.
        Returns number of removed entries.
        """
        to_delete = []
        for i, meta in self.metadata.items():
            # Check source_url, url, OR the fallback ID used by get_ingested_sources
            fallback_id = f"doc_{meta.get('title', 'unknown')}"
            
            if (meta.get("source_url") == source_url or 
                meta.get("url") == source_url or 
                fallback_id == source_url):
                to_delete.append(i)
                
        for i in to_delete:
            del self.metadata[i]
            
        if to_delete:
            self.save()
            import logging
            logging.getLogger(__name__).info(f"Removed {len(to_delete)} vectors for source {source_url}")
            
        return len(to_delete)

    def save(self):
        faiss.write_index(self.index, self.index_path)
        with open(self.metadata_path, "wb") as f:
            pickle.dump(self.metadata, f)

vector_db = VectorDB()
