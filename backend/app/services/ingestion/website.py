import logging
import trafilatura
from typing import List, Dict, Any
from datetime import datetime
from playwright.async_api import async_playwright
from app.services.ingestion.base import BaseIngestor, IngestedDocument

logger = logging.getLogger(__name__)

class WebsiteIngestor(BaseIngestor):
    async def ingest(self, source: str, **kwargs) -> List[IngestedDocument]:
        """
        Ingest a website. source: URL. kwargs: depth (int, default=0)
        """
        depth = kwargs.get("depth", 0)
        documents = []
        visited = set()
        queue = [(source, 0)]
        
        from urllib.parse import urlparse, urljoin
        
        base_domain = urlparse(source).netloc
        
        while queue:
            current_url, current_depth = queue.pop(0)
            logger.info(f"Ingesting URL: {current_url} at depth {current_depth}")
            
            if current_url in visited:
                continue
            visited.add(current_url)
            
            try:
                # 1. Fetch content
                downloaded = trafilatura.fetch_url(current_url)
                content = None
                
                if downloaded:
                    content = trafilatura.extract(downloaded)
                
                # Fallback to Playwright
                if not content:
                    logger.info(f"Trafilatura empty/failed for {current_url}, using Playwright")
                    async with async_playwright() as p:
                        browser = await p.chromium.launch(headless=True)
                        page = await browser.new_page()
                        await page.goto(current_url, wait_until="networkidle", timeout=30000)
                        html = await page.content()
                        content = trafilatura.extract(html)
                        
                        # Extract links if needed for recursion
                        if current_depth < depth:
                            hrefs = await page.evaluate("() => Array.from(document.links).map(a => a.href)")
                            for href in hrefs:
                                # Only internal links
                                if urlparse(href).netloc == base_domain:
                                    queue.append((href, current_depth + 1))
                        await browser.close()
                elif current_depth < depth and downloaded:
                    try:
                        import lxml.html
                        tree = lxml.html.fromstring(downloaded)
                        for link in tree.iterlinks():
                            href = link[2]
                            absolute_url = urljoin(current_url, href)
                            if urlparse(absolute_url).netloc == base_domain:
                                 queue.append((absolute_url, current_depth + 1))
                    except ImportError:
                        logger.warning("lxml not installed, cannot extract links from static HTML")
                    except Exception as extraction_error:
                        logger.warning(f"Failed to extract links from {current_url}: {extraction_error}")

                if content:
                    doc = IngestedDocument(
                        content=content,
                        source_url=current_url,
                        source_type="website",
                        metadata={
                            "title": trafilatura.extract_metadata(downloaded if downloaded else html).title if (downloaded or html) else "Unknown",
                            "crawled_at": datetime.utcnow().isoformat(),
                            "depth": current_depth
                        }
                    )
                    documents.append(doc)
                
            except Exception as e:
                logger.error(f"Error ingesting {current_url}: {e}")
                
            # Safety break
            if len(documents) > 20: # Limit pages for safety
                logger.warning(f"Reached page limit (20) for {source}")
                break
                
                
        logger.info(f"Website ingestion completed for {source}. Total documents: {len(documents)}")
        return documents
