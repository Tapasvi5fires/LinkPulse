import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import os
import logging
from typing import List
from datetime import datetime
from app.services.ingestion.base import BaseIngestor, IngestedDocument

logger = logging.getLogger(__name__)

class PDFIngestor(BaseIngestor):
    async def ingest(self, source: str, **kwargs) -> List[IngestedDocument]:
        """
        Ingest a PDF from a file path or bytes.
        """
        from starlette.concurrency import run_in_threadpool

        return await run_in_threadpool(self._ingest_sync, source)

    def _ingest_sync(self, source: str) -> List[IngestedDocument]:
        documents = []
        doc = None
        try:
            # Read file into memory to avoid file handle issues during background processing
            file_data = None
            if isinstance(source, str) and (source.startswith("http") or source.startswith("https")):
                 # TODO: implementation for URL if needed, currently treating as local path for upload
                 pass 
            else:
                 with open(source, "rb") as f:
                     file_data = f.read()

            if file_data:
                doc = fitz.open(stream=file_data, filetype="pdf")
            else:
                doc = fitz.open(source)
                
            full_text = ""
            
            # Iterate and extract
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text()
                
                if not text.strip():
                    # Fallback to OCR
                    try:
                        pix = page.get_pixmap()
                        img_data = pix.tobytes("png")
                        image = Image.open(io.BytesIO(img_data))
                        text = pytesseract.image_to_string(image)
                    except Exception as ocr_error:
                        logger.warning(f"OCR failed for page {page_num}: {ocr_error}")

                full_text += f"\n--- Page {page_num + 1} ---\n{text}"
            
            if full_text.strip():
                documents.append(IngestedDocument(
                    content=full_text,
                    source_url=source,
                    source_type="pdf",
                    metadata={
                        "title": os.path.basename(source),
                        "page_count": doc.page_count,
                        "ingested_at": datetime.utcnow().isoformat()
                    }
                ))
        except Exception as e:
            logger.error(f"Error ingesting PDF {source}: {e}")
            raise e
        finally:
            if doc:
                try:
                    doc.close()
                except Exception as close_error:
                    logger.warning(f"Error closing PDF doc: {close_error}")
            
        return documents
