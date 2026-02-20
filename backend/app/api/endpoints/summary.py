from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api import deps
from app.models.user import User
import google.generativeai as genai
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

class SummaryRequest(BaseModel):
    text: str = None
    source_url: str = None
    # If source_url is provided, we might need to fetch the content from vector db or re-fetch it.
    # For now, let's support direct text summary or simple URL if we can fetch it easily.
    # To keep it simple for the MVP integration, we might just pass the text from frontend or ID.
    
class SummaryResponse(BaseModel):
    summary: str

@router.post("/", response_model=SummaryResponse)
async def summarize(
    request: SummaryRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Summarize a given text or document.
    """
    if not settings.GEMINI_API_KEY:
         raise HTTPException(status_code=500, detail="LLM not configured")

    content_to_summarize = request.text
    
    if not content_to_summarize and request.source_url:
        # TODO: Fetch content from vector db by source_url if possible, 
        # or simplified: Frontend sends the text content or we implement a fetcher.
        # For this iteration, let's assume the frontend sends the text or we handle it later.
        # Actually, let's try to fetch from vector DB if we can access it here.
        from app.services.processing.vector_db import vector_db
        
        # This is a naive lookup, assuming source_url matches one in metadata
        # In a real app we'd query the DB more efficiently
        target_url = request.source_url.replace("\\", "/")
        found_text = ""
        for meta in vector_db.metadata.values():
            meta_url = meta.get("source_url", "").replace("\\", "/")
            if meta_url == target_url or target_url in meta_url:
                found_text += meta.get("text", "") + "\n"
        
        if found_text:
            content_to_summarize = found_text[:10000] # Limit context for summary
        else:
             logger.warning(f"Summary source not found: {request.source_url}")
             raise HTTPException(status_code=404, detail="Source not found or empty")

    if not content_to_summarize:
        raise HTTPException(status_code=400, detail="No content to summarize")

    try:
        from app.services.llm import llm_service
        
        prompt = f"""
        You are an expert analyst. Provide a **comprehensive and detailed summary** of the following text.
        
        **Structure your response as follows:**
        
        # 📑 Executive Summary
        (A detailed paragraph providing a high-level overview of the main topic and purpose.)

        # 🔑 Key Insights & Takeaways
        (A structured list of the most important points. Use bolding for emphasis.)
        - **Point 1**: Detail...
        - **Point 2**: Detail...

        # 🧐 In-Depth Analysis
        (Dive deeper into specific sections, arguments, or data points found in the text.)

        # 💡 Conclusion
        (A final wrapping up of the content's significance.)

        **Tone:** Professional, clear, and easy to understand.
        **Formatting:** Use Markdown (headers, bullets, bold text) strictly.

        Text to Summarize:
        {content_to_summarize[:25000]} 
        """
        # Limit input length to avoid token limits if very large
        
        summary_text = await llm_service.generate_content(prompt)
        return {"summary": summary_text}
        
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")
