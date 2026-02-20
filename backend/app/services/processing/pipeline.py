from typing import List, Dict, Any
from app.services.processing.cleaner import data_cleaner
from app.services.processing.chunker import chunker
from app.services.processing.embedding import embedding_service
from app.services.processing.vector_db import vector_db
import logging

logger = logging.getLogger(__name__)

# File extensions that should be treated as code (preserve formatting)
CODE_EXTENSIONS = {
    '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h', '.cs',
    '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.sh', '.bash',
    '.yaml', '.yml', '.json', '.xml', '.toml', '.ini', '.cfg', '.conf',
    '.sql', '.html', '.css', '.scss', '.less', '.vue', '.svelte',
}

def _is_code_source(metadata: Dict[str, Any]) -> bool:
    """Detect if the source is code based on source_type or file path."""
    source_type = metadata.get("source_type", "")
    source_url = metadata.get("source_url", "")
    file_path = metadata.get("path", "")
    
    # GitHub sources are always code
    if source_type == "github":
        return True
    
    # Check file extension
    for ext in CODE_EXTENSIONS:
        if source_url.endswith(ext) or file_path.endswith(ext):
            return True
    
    return False

class ProcessingPipeline:
    async def process_document(self, content: str, metadata: Dict[str, Any], user_id: int = None):
        """
        Run the full processing pipeline: Clean -> Chunk -> Embed -> Store
        """
        try:
            if user_id:
                metadata["user_id"] = user_id
                
            is_code = _is_code_source(metadata)
            
            # 1. Clean (preserve code formatting for code files)
            cleaned_text = data_cleaner.clean_text(content, is_code=is_code)
            
            if not cleaned_text or len(cleaned_text.strip()) < 10:
                logger.warning(f"Content too short after cleaning, skipping: {metadata.get('source_url', 'unknown')}")
                return
            
            # 2. Chunk (use code-aware separators for code files)
            if is_code:
                chunks = chunker.chunk_code(cleaned_text, metadata)
            else:
                chunks = chunker.chunk_text(cleaned_text, metadata)
            
            if not chunks:
                # For very short content, create a single chunk instead of skipping
                logger.info(f"No chunks from splitter, creating single chunk for: {metadata.get('source_url', 'unknown')}")
                chunks = [{
                    "content": cleaned_text,
                    "metadata": {**(metadata or {}), "chunk_index": 0}
                }]

            # 3. Embed
            texts = [chunk["content"] for chunk in chunks]
            embeddings = embedding_service.embed_documents(texts)
            
            # 4. Store
            metadatas = [chunk["metadata"] for chunk in chunks]
            
            for i, meta in enumerate(metadatas):
                meta["text"] = texts[i]

            vector_db.add(embeddings, metadatas)
            logger.info(f"Processed {len(chunks)} chunks from {metadata.get('source_url', 'unknown')}")
            
        except Exception as e:
            logger.error(f"Error in processing pipeline: {e}")
            raise e

processing_pipeline = ProcessingPipeline()
