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
            # Extract shortcode from URL
            if "/p/" in source:
                shortcode = source.split("/p/")[1].split("/")[0]
            elif "/reel/" in source:
                shortcode = source.split("/reel/")[1].split("/")[0]
            else:
                logger.warning(f"Invalid Instagram URL: {source}")
                return []
                
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
                    "ingested_at": datetime.utcnow().isoformat()
                }
            ))
            
        except Exception as e:
            logger.error(f"Error ingesting Instagram post {source}: {e}")
            # Don't raise, just return empty so we don't crash everything if one link fails (e.g. private)
            
        return documents
