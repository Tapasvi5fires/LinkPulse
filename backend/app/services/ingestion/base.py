from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

class IngestedDocument(BaseModel):
    content: str
    metadata: Dict[str, Any]
    source_url: str
    source_type: str
    created_at: datetime = datetime.utcnow()

class BaseIngestor(ABC):
    @abstractmethod
    async def ingest(self, source: str, **kwargs) -> List[IngestedDocument]:
        """
        Ingest data from a source and return a list of IngestedDocument objects.
        """
        pass
