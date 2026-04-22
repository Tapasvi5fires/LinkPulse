from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api import deps
from app.services.retrieval.search import search_service
from app.models.user import User
import google.generativeai as genai
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY not set. Chat features will not return LLM responses.")

class ChatRequest(BaseModel):
    query: str
    history: Optional[List[dict]] = [] # list of {role: "user"/"model", parts: ["..."]}
    persona: str = "professional" # professional, eli5, developer
    source_filter: Optional[Any] = None # Filter by specific source URL or list of URLs
    web_search: Optional[bool] = False # Toggle live web search

class ChatResponse(BaseModel):
    answer: str
    sources: List[Any]

from fastapi.responses import StreamingResponse
import json

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Stream chat responses (RAG).
    """
    from app.services.processing.vector_db import vector_db
    from app.services.retrieval.web_search import web_search_service
    from app.services.llm import llm_service
    
    logger.info(f"Chat Stream request: {request.query}, User: {current_user.id}")
    
    # 1. Build sources summary
    source_counts: dict = {}
    user_metadata = vector_db.get_user_metadata(current_user.id)
    for meta in user_metadata.values():
        src = meta.get("source_url") or meta.get("url") or meta.get("title", "unknown")
        display_name = src
        if "data/storage" in src.replace("\\", "/"):
            import os as _os
            fname = _os.path.basename(src)
            display_name = fname[37:] if len(fname) > 37 and fname[36] == '_' else fname
        source_counts[display_name] = source_counts.get(display_name, 0) + 1
    
    all_sources_summary = ""
    if source_counts:
        all_sources_summary = "Documents in Knowledge Base:\n"
        for name, count in source_counts.items():
            all_sources_summary += f"  - {name} ({count} chunks)\n"
    
    # 2. Retrieve chunks
    if request.source_filter:
        search_results = search_service.search(request.query, k=15, filter_source=request.source_filter, user_id=current_user.id)
    else:
        search_results = search_service.search(request.query, k=20, filter_source=None, user_id=current_user.id)
    
    context_text = ""
    sources = []
    seen_texts = set()
    for res in search_results:
        text = res["metadata"].get("text", "")
        if not text or text in seen_texts: continue
        seen_texts.add(text)
        source = res["metadata"].get("source_url") or res["metadata"].get("url") or "unknown"
        context_text += f"---\nSource (Knowledge Base): {source}\nContent: {text}\n"
        sources.append(res)
    
    # 3. Web Search
    web_context = ""
    if request.web_search:
        logger.info(f"Web search enabled for query: {request.query}")
        search_queries = await web_search_service.generate_search_queries(request.query)
        web_results = await web_search_service.search_parallel(search_queries)
        for res in [r for r in web_results if r.get("content") and len(r.get("content", "")) > 100]:
            title, url, content = res.get("title", "Web Source"), res.get("url", "unknown"), res.get("content", "")
            web_context += f"---\nSource (Live Web): {title} ({url})\nContent: {content}\n"
            sources.append({"id": f"web_{url}", "metadata": {"source_url": url, "title": title, "source_type": "website", "is_web": True}})

    # 4. Prompt Construction
    persona_instruction = ""
    if request.persona == "eli5":
        persona_instruction = """PERSONA: ELI5 (Explain Like I'm 5)
        - Use simple language, short sentences, fun analogies
        - Compare technical concepts to everyday things (toys, games, food)
        - Use emojis sparingly for engagement
        - Still cover ALL the key points but in simple words"""
    elif request.persona == "developer":
        persona_instruction = """PERSONA: Developer/Technical
        - Be highly technical and precise
        - Use proper terminology, code snippets, data structures where relevant
        - Include implementation details, specifications, measurements
        - Structure with clear technical sections"""
    elif request.persona == "academic":
        persona_instruction = """PERSONA: Academic/Research
        - Use formal academic language
        - Cite sources rigorously with document names
        - Include methodology, findings, analysis structure"""
    else:
        persona_instruction = """PERSONA: Professional
        - Be thorough, well-organized, and business-oriented
        - Provide actionable insights and key takeaways
        - Use professional language but remain accessible"""

    system_instruction = f"""You are 'LinkPulse AI', an expert research and knowledge synthesis assistant.
{persona_instruction}

AVAILABLE KNOWLEDGE BASE DOCUMENTS:
{all_sources_summary if all_sources_summary else "(Knowledge base is currently empty)"}

CRITICAL INSTRUCTIONS FOR RESEARCH EXCELLENCE:
1. HYBRID SYNTHESIS: Intelligently merge internal facts with live web data.
2. STRUCTURE: Use rich Markdown (Headers, Tables, Bold, Lists).
3. CLICKABLE WEB CITATIONS: For web info, use `[🌐 Page Title](URL)`.
4. INTERNAL CITATIONS: For internal docs, use: `(Internal: Document Name)`.
5. CONFLICT RESOLUTION: Highlight contradictions between web and internal docs.
6. LENGTH: Extract every useful detail. Aim for 400-600 words for complex queries.
"""

    full_prompt = f"""{system_instruction}

══════ CONTEXT: INTERNAL KNOWLEDGE BASE ══════
{context_text if context_text else "(No matching documents found in internal knowledge base.)"}

══════ CONTEXT: LIVE WEB SEARCH ══════
{web_context if web_context else "(Web search was not enabled or no results were found.)"}

══════ USER QUESTION ══════
{request.query}

Instructions: Synthesize the information above to provide a comprehensive, high-quality response. Use bold text for key insights and cite sources inline."""

    async def event_generator():
        # First send metadata (sources)
        yield f"metadata:{json.dumps({'sources': sources})}\n"
        
        # Then stream tokens
        try:
            async for chunk in llm_service.generate_content_stream(full_prompt):
                yield f"data:{chunk}\n"
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"error:{str(e)}\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Chat with your knowledge base (RAG).
    """
    from app.services.processing.vector_db import vector_db
    from app.services.retrieval.web_search import web_search_service
    
    # 1. Build a summary of ALL available sources (so LLM always knows what docs exist)
    # Filter by user_id
    all_sources_summary = ""
    source_counts: dict = {}
    user_metadata = vector_db.get_user_metadata(current_user.id)
    for meta in user_metadata.values():
            
        src = meta.get("source_url") or meta.get("url") or meta.get("title", "unknown")
        source_type = meta.get("source_type", "unknown")
        # Clean up filename for display
        display_name = src
        if "data/storage" in src.replace("\\", "/"):
            import os as _os
            fname = _os.path.basename(src)
            if len(fname) > 37 and fname[36] == '_':
                display_name = fname[37:]
            else:
                display_name = fname
        source_counts[display_name] = source_counts.get(display_name, 0) + 1
    
    if source_counts:
        all_sources_summary = "Documents in Knowledge Base:\n"
        for name, chunk_count in source_counts.items():
            all_sources_summary += f"  - {name} ({chunk_count} chunks)\n"
    
    # 2. Retrieve relevant chunks
    logger.info(f"Chat query: {request.query}, Persona: {request.persona}, Source Filter: {request.source_filter}, User: {current_user.id}")
    
    # When no filter: retrieve MORE chunks (broader context from all sources)
    # When filter selected: retrieve focused chunks from that source
    if request.source_filter:
        search_results = search_service.search(request.query, k=15, filter_source=request.source_filter, user_id=current_user.id)
    else:
        search_results = search_service.search(request.query, k=20, filter_source=None, user_id=current_user.id)
    
    # Format context — group by source for clarity
    context_text = ""
    sources = []
    seen_texts = set()  # Deduplicate identical chunks
    
    for res in search_results:
        text = res["metadata"].get("text", "")
        if not text or text in seen_texts:
            continue
        seen_texts.add(text)
        source = res["metadata"].get("source_url") or res["metadata"].get("url") or "unknown"
        context_text += f"---\nSource (Knowledge Base): {source}\nContent: {text}\n"
        sources.append(res)
    
    # 3. Retrieve WEB CHUNKS (optional - Autonomous Research)
    web_context = ""
    if request.web_search:
        logger.info(f"Starting autonomous research for: {request.query}")
        
        # Phase 1: Generate multiple search trajectories
        search_queries = await web_search_service.generate_search_queries(request.query)
        logger.info(f"Generated search queries: {search_queries}")
        
        # Phase 2: Execute parallel searches
        web_results = await web_search_service.search_parallel(search_queries)
        
        # Phase 3: Intelligent Filtering (Keep only results with content)
        filtered_web_results = [res for res in web_results if res.get("content") and len(res.get("content", "")) > 100]
        
        for res in filtered_web_results:
            title = res.get("title", "Web Source")
            url = res.get("url", "unknown")
            content = res.get("content", "")
            web_context += f"---\nSource (Live Web): {title} ({url})\nContent: {content}\n"
            # Add to sources for UI display
            sources.append({
                "id": f"web_{url}",
                "metadata": {
                    "source_url": url,
                    "title": title,
                    "source_type": "website",
                    "is_web": True
                }
            })
        
    # 3. Generate Answer with LLM
    try:
        from app.services.llm import llm_service
        
        # Rich Persona Instructions
        persona_instruction = ""
        
        if request.persona == "eli5":
            persona_instruction = """PERSONA: ELI5 (Explain Like I'm 5)
            - Use simple language, short sentences, fun analogies
            - Compare technical concepts to everyday things (toys, games, food)
            - Use emojis sparingly for engagement
            - Still cover ALL the key points but in simple words
            - Example tone: "Think of this like a recipe book for how to safely use machines!" """
        elif request.persona == "developer":
            persona_instruction = """PERSONA: Developer/Technical
            - Be highly technical and precise
            - Use proper terminology, code snippets, data structures where relevant
            - Include implementation details, specifications, measurements
            - Structure with clear technical sections
            - Focus on procedures, parameters, and edge cases"""
        elif request.persona == "academic":
            persona_instruction = """PERSONA: Academic/Research
            - Use formal academic language
            - Cite sources rigorously with document names
            - Include methodology, findings, analysis structure
            - Use proper citation format
            - Cross-reference between documents when applicable"""
        else:  # professional / default
            persona_instruction = """PERSONA: Professional
            - Be thorough, well-organized, and business-oriented
            - Provide actionable insights and key takeaways
            - Use professional language but remain accessible
            - Include relevant details, procedures, and specifications
            - Structure the response for quick comprehension (headers, bullet points)"""

        system_instruction = f"""You are 'LinkPulse AI', an expert research and knowledge synthesis assistant.
You have access to two types of data:
1. **INTERNAL KNOWLEDGE BASE**: Private documents provided by the user.
2. **LIVE WEB SEARCH**: Real-time information from multiple search trajectories on the internet.

{persona_instruction}

═══════════════════════════════════════
AVAILABLE KNOWLEDGE BASE DOCUMENTS:
{all_sources_summary if all_sources_summary else "(Knowledge base is currently empty)"}
═══════════════════════════════════════

CRITICAL INSTRUCTIONS FOR RESEARCH EXCELLENCE:

1. **HYBRID SYNTHESIS**: Intelligently merge internal facts with live web data. Provide a DEEP, TECHNICAL, and EXHAUSTIVE response.

2. **STRUCTURE**: Use rich Markdown (Headers, Tables, Bold, Lists).

3. **CLICKABLE WEB CITATIONS**: For info from the web, ALWAYS use a clickable Markdown link.
   - Format: `[🌐 Page Title](URL)` 
   - Example: "The latest Nvidia Blackwell chips are 2x faster [🌐 Nvidia Blackwell Specs](https://nvidia.com/...) according to reports."

4. **INTERNAL CITATIONS**: For internal docs, use: `(Internal: Document Name)`.

5. **CONFLICT RESOLUTION**: If a web source contradicts an internal document, highlight this explicitly (e.g., "While internal docs state X, recent web reports suggest Y").

6. **LENGTH**: Do not be brief. Extract every useful detail. Aim for 400-600 words for complex queries.
"""
        
        prompt = f"""{system_instruction}

══════ CONTEXT: INTERNAL KNOWLEDGE BASE ══════
{context_text if context_text else "(No matching documents found in internal knowledge base.)"}

══════ CONTEXT: LIVE WEB SEARCH ══════
{web_context if web_context else "(Web search was not enabled or no results were found.)"}

══════ USER QUESTION ══════
{request.query}

Instructions: Synthesize the information above to provide a comprehensive, high-quality response. Use bold text for key insights and cite sources inline."""
        
        # Use LLM Service (handles fallback automatically)
        answer = await llm_service.generate_content(prompt)
        
        return {
            "answer": answer,
            "sources": sources
        }
        
    except Exception as e:
        logger.error(f"LLM generation failed: {e}")
        return {
            "answer": f"I encountered an error generating the response. Error details: {str(e)}",
            "sources": sources
        }
