from typing import List, Dict, Any
from app.services.processing.embedding import embedding_service
from app.services.processing.vector_db import vector_db
from rank_bm25 import BM25Okapi
import numpy as np
from sentence_transformers import CrossEncoder
import logging

logger = logging.getLogger(__name__)

class SearchService:
    def __init__(self):
        self.reranker = None
        # BM25 requires all documents. In a real system, use Elasticsearch/Solr.
        # Here we simulate with in-memory documents from VectorDB metadata if feasible,
        # or just rely on Vector Search + Reranking for MVP if BM25 is too heavy.
        self.bm25 = None
        self.corpus = []

    def _get_reranker(self):
        if self.reranker is None:
            self.reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
        return self.reranker

    def update_bm25(self):
        # Allow manual triggering of BM25 index update
        # This is expensive and should be done in background
        docs = []
        for meta in vector_db.metadata.values():
            if "text" in meta:
                docs.append(meta["text"])
        
        if docs:
            tokenized_corpus = [doc.split(" ") for doc in docs]
            self.bm25 = BM25Okapi(tokenized_corpus)
            self.corpus = docs
            logger.info(f"BM25 index updated with {len(docs)} documents")

    def search(self, query: str, k: int = 10, filter_source: Any = None, user_id: int = None) -> List[Dict[str, Any]]:
        # 1. Vector Search
        query_embedding = embedding_service.embed_query(query)
        
        # If filtering, we need to fetch more results to ensure we find enough matching documents
        search_k = k * 20 if filter_source else k * 10
        vector_results = vector_db.search(query_embedding, k=search_k)
        
        # Filter by user_id if provided
        if user_id is not None:
            vector_results = [
                res for res in vector_results
                if res["metadata"].get("user_id") == user_id
            ]

        # Filter by source if requested
        if filter_source:
            # Normalize to list
            filters = filter_source if isinstance(filter_source, list) else [filter_source]
            
            vector_results = [
                res for res in vector_results 
                if res["metadata"].get("source_url") in filters or res["metadata"].get("url") in filters
            ]
        
        # 2. BM25 Search (Optional/Hybrid)
        bm25_results = []
        if self.bm25:
            tokenized_query = query.split(" ")
            # Get top N docs
            # API for BM25Okapi is different, usually get_top_n
            # This is a bit complex to map back to IDs without keeping an index map.
            # Skipping full BM25 implementation for MVP in favor of strong Vector + Rerank
            pass

        # 3. Reranking
        if not vector_results:
            return []

        reranker = self._get_reranker()
        
        # Prepare pairs for reranking: [query, doc_text]
        pairs = []
        for Res in vector_results:
            doc_text = Res["metadata"].get("text", "")
            pairs.append([query, doc_text])
            
        scores = reranker.predict(pairs)
        
        # Attach scores and sort
        for i, res in enumerate(vector_results):
            res["rerank_score"] = float(scores[i])
            
        # Sort by rerank score
        vector_results.sort(key=lambda x: x["rerank_score"], reverse=True)
        
        # Source diversity: when no filter, ensure results come from multiple sources
        if not filter_source and len(vector_results) > k:
            diverse_results = []
            source_slots: dict = {}  # Track how many chunks per source
            
            # First pass: pick top-scoring chunk from each unique source
            for res in vector_results:
                src = res["metadata"].get("source_url") or res["metadata"].get("url") or "unknown"
                if src not in source_slots:
                    diverse_results.append(res)
                    source_slots[src] = 1
            
            # Second pass: fill remaining slots with next best chunks
            for res in vector_results:
                if len(diverse_results) >= k:
                    break
                if res not in diverse_results:
                    diverse_results.append(res)
            
            return diverse_results[:k]
        
        return vector_results[:k]

search_service = SearchService()
