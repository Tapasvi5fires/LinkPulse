from youtube_transcript_api import YouTubeTranscriptApi
from typing import List
import logging
from datetime import datetime
import re
from app.services.ingestion.base import BaseIngestor, IngestedDocument

logger = logging.getLogger(__name__)

class YouTubeIngestor(BaseIngestor):
    def _get_video_id(self, url: str) -> str:
        # Robust regex for various YouTube URL formats
        patterns = [
            r'(?:v=|\/|embed\/|shorts\/|youtu\.be\/)([0-9A-Za-z_-]{11})',
            r'/watch\?v=([0-9A-Za-z_-]{11})',
            r'youtube\.com/watch\?v=([0-9A-Za-z_-]{11})',
            r'youtu\.be/([0-9A-Za-z_-]{11})',
            r'youtube\.com/shorts/([0-9A-Za-z_-]{11})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    async def ingest(self, source: str, **kwargs) -> List[IngestedDocument]:
        """
        Ingest YouTube video transcript.
        """
        documents = []
        video_id = self._get_video_id(source)
        
        if not video_id:
            logger.error(f"Invalid YouTube URL: {source}")
            return []

        try:
            # Instantiate the API
            yt_api = YouTubeTranscriptApi()
            
            # Use list() to get available transcripts
            try:
                transcript_list = yt_api.list(video_id)
            except Exception as e:
                logger.warning(f"Could not list transcripts for {video_id}: {e}")
                # Fallback to direct fetch if possible, though list is usually safer
                # but if we can't list, maybe we fallback to Whisper later
                raise e

            transcript = None
            
            # 1. Try manually created English
            try:
                transcript = transcript_list.find_manually_created_transcript(['en', 'en-US'])
            except:
                pass
                
            # 2. Try generated English
            if not transcript:
                try:
                    transcript = transcript_list.find_generated_transcript(['en', 'en-US'])
                except:
                    pass
            
            # 3. Fallback to any available
            if not transcript:
                 for t in transcript_list:
                     transcript = t
                     break
            
            if not transcript:
                 raise Exception("No transcript found")

            # Fetch the actual data
            transcript_data = transcript.fetch()
            
            # Robust extraction: handle both objects (with .text) and dictionaries (with ['text'])
            full_text = " ".join([
                item.get('text', '') if isinstance(item, dict) else getattr(item, 'text', '')
                for item in transcript_data
            ])
            
            documents.append(IngestedDocument(
                 content=full_text,
                 source_url=source,
                 source_type="youtube",
                 metadata={
                     "video_id": video_id,
                     "ingested_at": datetime.utcnow().isoformat(),
                     "language": transcript.language_code
                 }
            ))
            
        except Exception as e:
            logger.error(f"Error extracting transcript for {source}: {e}")
            # Fallback to Whisper (TODO: Implement actual Whisper integration)
            logger.info("Fallback to Whisper needed here")
            raise e
            
        return documents
