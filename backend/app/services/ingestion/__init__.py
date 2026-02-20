from app.services.ingestion.base import BaseIngestor, IngestedDocument
from app.services.ingestion.website import WebsiteIngestor
from app.services.ingestion.pdf import PDFIngestor
from app.services.ingestion.youtube import YouTubeIngestor
from app.services.ingestion.github import GitHubIngestor
from app.services.ingestion.instagram import InstagramIngestor
from app.services.ingestion.docx import DocxIngestor
from app.services.ingestion.pptx import PptxIngestor
from app.services.ingestion.text import TextIngestor

class IngestionService:
    def __init__(self):
        self.ingestors = {
            "website": WebsiteIngestor(),
            "pdf": PDFIngestor(),
            "youtube": YouTubeIngestor(),
            "github": GitHubIngestor(),
            "instagram": InstagramIngestor(),
            "docx": DocxIngestor(),
            "pptx": PptxIngestor(),
            "text": TextIngestor(),
            "markdown": TextIngestor(),
        }

    async def ingest_source(self, source_type: str, source: str, **kwargs) -> list[IngestedDocument]:
        ingestor = self.ingestors.get(source_type)
        if not ingestor:
            raise ValueError(f"Unsupported source type: {source_type}")
        return await ingestor.ingest(source, **kwargs)

ingestion_service = IngestionService()
