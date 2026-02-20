import logging
from typing import List
from datetime import datetime
import os
from app.services.ingestion.base import BaseIngestor, IngestedDocument

logger = logging.getLogger(__name__)

class TextIngestor(BaseIngestor):
    async def ingest(self, source: str, **kwargs) -> List[IngestedDocument]:
        """
        Ingest a Text/Markdown file from a file path.
        """
        from starlette.concurrency import run_in_threadpool
        return await run_in_threadpool(self._ingest_sync, source)

    def _ingest_sync(self, source: str) -> List[IngestedDocument]:
        documents = []
        try:
            with open(source, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            if content.strip():
                documents.append(IngestedDocument(
                    content=content,
                    source_url=source,
                    source_type="text", # or markdown
                    metadata={
                        "title": os.path.basename(source),
                        "ingested_at": datetime.utcnow().isoformat(),
                        "source_url": source, # Inject for persistence
                        "source_type": "text"
                    }
                ))
        except Exception as e:
            logger.error(f"Error ingesting Text file {source}: {e}")
            raise e

        return documents
