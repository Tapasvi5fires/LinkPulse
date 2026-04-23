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
            
            # Local fallback (if not using Gemini)
            model = self._get_local_model()
            return model.encode(text).tolist()
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            if not self.use_gemini:
                logger.info("Attempting Emergency Fallback to Gemini...")
                try:
                    result = genai.embed_content(
                        model="models/text-embedding-004",
                        content=text,
                        task_type="retrieval_query"
                    )
                    return result['embedding']
                except Exception as gem_e:
                    logger.error(f"Gemini fallback also failed: {gem_e}")
            raise

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        try:
            if self.use_gemini:
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
            logger.error(f"Batch embedding failed: {e}")
            if not self.use_gemini:
                logger.info("Attempting Emergency Fallback to Gemini for documents...")
                try:
                    embeddings = []
                    for text in texts:
                        result = genai.embed_content(
                            model="models/text-embedding-004",
                            content=text,
                            task_type="retrieval_document"
                        )
                        embeddings.append(result['embedding'])
                    return embeddings
                except Exception as gem_e:
                    logger.error(f"Gemini fallback failed: {gem_e}")
            raise

embedding_service = EmbeddingService()
