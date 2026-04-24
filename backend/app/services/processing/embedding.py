import os
import logging
from typing import List
from app.core.config import settings
import warnings

# Suppress "FutureWarning: All support for the `google.generativeai` package has ended..."
# We will migrate to `google.genai` in a future update, but for now we silence the noise.
warnings.filterwarnings("ignore", category=FutureWarning, message=".*google.generativeai.*")

try:
    import google.generativeai as genai
except ImportError:
    genai = None # Handle missing dependency gracefully

logger = logging.getLogger(__name__)

# Lazy loading variables
_model = None

class EmbeddingService:
    def __init__(self):
        # Determine provider: Default to Gemini in production/cloud to save RAM
        # On Render Free Tier (512MB), we MUST use Gemini to avoid OOM crashes
        self.use_gemini = bool(settings.GEMINI_API_KEY) and settings.USE_GEMINI_EMBEDDINGS
        
        if self.use_gemini:
             logger.info("Using Gemini Cloud Embeddings (RAM-safe mode)")
             genai.configure(api_key=settings.GEMINI_API_KEY)
        else:
             logger.warning("Using Local Embeddings (High RAM usage - not recommended for Free Tier)")
        
    def _get_local_model(self):
        global _model
        if _model is None:
            try:
                logger.info("Loading local SentenceTransformer model... (Memory intensive)")
                from sentence_transformers import SentenceTransformer
                # Use a lightweight model for default
                _model = SentenceTransformer('all-MiniLM-L6-v2')
            except ImportError:
                logger.error("sentence_transformers not installed. Please install it for local embeddings.")
                raise
        return _model

    def _get_gemini_embedding(self, text: str, task_type: str) -> List[float]:
        """Try multiple model names and versions to avoid 404 errors."""
        # List of models to try in order of preference
        models_to_try = [
            "models/text-embedding-004", 
            "models/gemini-embedding-001",
            "models/gemini-embedding-2-preview",
            "models/embedding-001",
            "text-embedding-004",
            "gemini-embedding-001"
        ]
        
        last_err = None
        for model_name in models_to_try:
            try:
                result = genai.embed_content(
                    model=model_name,
                    content=text,
                    task_type=task_type
                )
                return result['embedding']
            except Exception as e:
                last_err = e
                continue
        
        raise last_err

    def embed_query(self, text: str) -> List[float]:
        try:
            if self.use_gemini:
                return self._get_gemini_embedding(text, "retrieval_query")
            
            # Local fallback
            model = self._get_local_model()
            return model.encode(text).tolist()
        except Exception as e:
            logger.error(f"Embedding query failed: {e}")
            raise

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        try:
            if self.use_gemini:
                embeddings = []
                for text in texts:
                    emb = self._get_gemini_embedding(text, "retrieval_document")
                    embeddings.append(emb)
                return embeddings

            # Local fallback
            model = self._get_local_model()
            embeddings = model.encode(texts)
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Batch embedding failed: {e}")
            raise

embedding_service = EmbeddingService()
