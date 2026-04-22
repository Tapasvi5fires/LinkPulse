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
        # Determine provider: 'gemini' if key present and configured to use it, else 'local'
        # For now, default to local unless explicitly requested or if local is too heavy?
        # Actually, let's stick to local sentence-transformers as primary to save API costs/latency
        # But provide the option.
        self.use_gemini = bool(settings.GEMINI_API_KEY) and os.getenv("USE_GEMINI_EMBEDDINGS", "False").lower() == "true"
        
        if self.use_gemini:
             genai.configure(api_key=settings.GEMINI_API_KEY)
        
    def _get_local_model(self):
        global _model
        if _model is None:
            from sentence_transformers import SentenceTransformer
            # Use a lightweight model for default
            _model = SentenceTransformer('all-MiniLM-L6-v2')
        return _model

    def embed_query(self, text: str) -> List[float]:
        try:
            if self.use_gemini:
                # Gemini embedding model
                result = genai.embed_content(
                    model="models/text-embedding-004",
                    content=text,
                    task_type="retrieval_query"
                )
                return result['embedding']
            
            # Local fallback
            model = self._get_local_model()
            return model.encode(text).tolist()
        except Exception as e:
            logger.error(f"Error embedding query: {e}")
            # Fallback to local if API fails?
            model = self._get_local_model()
            return model.encode(text).tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        try:
            if self.use_gemini:
                # Batch embedding with Gemini
                # Note: Gemini has batch limits, might need chunking here
                # For now, simple loop or batch if supported
                embeddings = []
                for text in texts:
                    result = genai.embed_content(
                        model="models/text-embedding-004",
                        content=text,
                        task_type="retrieval_document"
                    )
                    embeddings.append(result['embedding'])
                return embeddings

            # Local fallback
            model = self._get_local_model()
            embeddings = model.encode(texts)
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Error embedding documents: {e}")
            model = self._get_local_model()
            embeddings = model.encode(texts)
            return embeddings.tolist()

embedding_service = EmbeddingService()
