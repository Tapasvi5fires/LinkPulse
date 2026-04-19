from typing import List
import logging
from app.services.ingestion.base import BaseIngestor, IngestedDocument
from datetime import datetime

logger = logging.getLogger(__name__)

class InstagramIngestor(BaseIngestor):
    async def ingest(self, source: str, **kwargs) -> List[IngestedDocument]:
        """
        Ingest Instagram post. source: Post URL (e.g., https://www.instagram.com/p/CODE/)
        """
        import instaloader
        
        documents = []
        L = instaloader.Instaloader()
        
        try:
            # Extract shortcode from URL (more robust)
            import re
            match = re.search(r'/(p|reels?)/([^/?#&]+)', source)
            if match:
                shortcode = match.group(2)
            else:
                logger.warning(f"Invalid Instagram URL structure: {source}")
                raise ValueError(f"Invalid Instagram URL structure. Expected /p/SHORTCODE/ or /reels/SHORTCODE/")
                
            try:
                post = instaloader.Post.from_shortcode(L.context, shortcode)
                
                content = f"Caption: {post.caption}\n\n"
                content += f"Author: {post.owner_username}\n"
                content += f"Likes: {post.likes}\n"
                content += f"Date: {post.date_local}\n\n"
                
                content += "Comments:\n"
                for comment in post.get_comments():
                    content += f"- {comment.owner.username}: {comment.text}\n"
                    if len(content) > 5000: # Limit comment size
                        break
                
                documents.append(IngestedDocument(
                    content=content,
                    source_url=source,
                    source_type="instagram",
                    metadata={
                        "shortcode": shortcode,
                        "author": post.owner_username,
                        "ingested_at": datetime.utcnow().isoformat(),
                        "via": "instaloader"
                    }
                ))
            except Exception as api_error:
                api_error_str = str(api_error)
                if any(x in api_error_str.lower() for x in ["401", "403", "forbidden", "unauthorized", "login"]):
                    logger.warning(f"Instaloader blocked by Instagram (potentially requires login). Falling back to Playwright for {source}")
                    return await self._scrape_with_playwright(source)
                else:
                    raise api_error
            
        except Exception as e:
            logger.error(f"Error ingesting Instagram post {source}: {e}")
            raise Exception(f"Failed to ingest Instagram post: {str(e)}")
            
        return documents

    async def _scrape_with_playwright(self, url: str) -> List[IngestedDocument]:
        """
        Fallback scraper using Playwright Sync API in a thread to bypass Windows asyncio issues.
        """
        import asyncio
        return await asyncio.to_thread(self._scrape_with_playwright_sync, url)

    def _scrape_with_playwright_sync(self, url: str) -> List[IngestedDocument]:
        """
        Synchronous Playwright scraping logic.
        """
        from playwright.sync_api import sync_playwright
        import time
        
        logger.info(f"Starting Playwright sync fallback for {url}")
        with sync_playwright() as p:
            browser = None
            try:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page = context.new_page()
                
                # Navigate
                page.goto(url, timeout=45000, wait_until="domcontentloaded")
                # Wait for content
                time.sleep(2)
                
                # Extract metadata
                meta_data = page.evaluate("""() => {
                    const tags = {};
                    document.querySelectorAll('meta[property^="og:"], meta[name="description"]').forEach(el => {
                        const prop = el.getAttribute('property') || el.getAttribute('name');
                        tags[prop] = el.getAttribute('content');
                    });
                    return tags;
                }""")
                
                title = page.title()
                caption = meta_data.get("og:description") or meta_data.get("description") or ""
                author = meta_data.get("og:title", "").split("on Instagram")[0].replace("Post by ", "").replace("Instagram post by ", "").strip()
                
                if not caption and not title:
                     content_text = page.content()
                     if "login" in content_text.lower() and "password" in content_text.lower():
                         raise Exception("Instagram is showing a login wall. Cannot ingest this private or restricted link.")
                     raise Exception("Could not find any content on the page (empty response).")

                content = f"Title: {title}\n\n"
                if author:
                    content += f"Author: {author}\n\n"
                if caption:
                    content += f"Caption:\n{caption}\n"
                
                content += "\n\n(Note: This content was ingested via browser fallback because Instagram's API blocked the direct request.)"
                
                return [IngestedDocument(
                    content=content,
                    source_url=url,
                    source_type="instagram",
                    metadata={
                        "author": author,
                        "ingested_at": datetime.utcnow().isoformat(),
                        "via": "playwright_sync_fallback"
                    }
                )]
            except Exception as e:
                logger.error(f"Playwright sync fallback failed: {e}")
                raise Exception(f"Instagram blocked direct access and browser fallback also failed: {str(e)}")
            finally:
                if browser:
                    browser.close()
