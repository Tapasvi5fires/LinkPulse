from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language

class Chunker:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Standard text splitter for documents
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        # Code-aware splitter: splits on function/class/block boundaries
        self.code_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=[
                "\nclass ",      # Class definitions
                "\ndef ",        # Function definitions
                "\nasync def ",  # Async function definitions
                "\n\n",          # Double newlines (block separator)
                "\n",            # Single newlines
                " ",             # Spaces
                "",              # Character level
            ]
        )

    def chunk_text(self, text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Chunk prose/document text and attach metadata to each chunk.
        """
        if not text or len(text.strip()) < 10:
            return []
        
        chunks = self.splitter.split_text(text)
        return self._format_chunks(chunks, metadata)
    
    def chunk_code(self, text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Chunk code with awareness of code structure (functions, classes, blocks).
        Preserves formatting and handles small files gracefully.
        """
        if not text or len(text.strip()) < 10:
            return []
        
        # For small files that are under chunk_size, keep as single chunk
        if len(text) <= self.chunk_size:
            return self._format_chunks([text], metadata)
        
        chunks = self.code_splitter.split_text(text)
        return self._format_chunks(chunks, metadata)
    
    def _format_chunks(self, chunks: list, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Format chunks with metadata."""
        chunked_docs = []
        for i, chunk in enumerate(chunks):
            if chunk and len(chunk.strip()) > 5:  # Skip near-empty chunks
                doc = {
                    "content": chunk,
                    "metadata": {**(metadata or {}), "chunk_index": i}
                }
                chunked_docs.append(doc)
        return chunked_docs

chunker = Chunker()
