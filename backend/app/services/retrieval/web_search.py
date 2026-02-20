import asyncio
import httpx
import logging
from typing import List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

class TavilySearchService:
    def __init__(self):
        self.api_key = settings.TAVILY_API_KEY
        self.base_url = "https://api.tavily.com/search"

    async def generate_search_queries(self, query: str, limit: int = 3) -> List[str]:
        """
        Use LLM to break down a complex query into multiple optimized search queries.
        """
        from app.services.llm import llm_service
        
        prompt = f"""You are an expert search engine optimizer. 
Given the user's research question, generate up to {limit} distinct search queries that would help provide a comprehensive, 360-degree answer.
Vary the perspective of each query.

USER QUESTION: {query}

Output ONLY a JSON list of strings. 
Example: ["Nvidia Q4 financial results 2024", "Nvidia Blackwell chip production status", "AMD vs Nvidia market share 2024"]
"""
        try:
            response = await llm_service.generate_content(prompt)
            # Basic JSON extraction (assuming it returns something like ["q1", "q2"])
            import json
            import re
            
            # Find list in response
            match = re.search(r'\[.*\]', response, re.DOTALL)
            if match:
                queries = json.loads(match.group(0))
                if isinstance(queries, list):
                    return queries[:limit]
            
            return [query] # Fallback to original query
        except Exception as e:
            logger.error(f"Failed to generate search queries: {e}")
            return [query]

    async def search(self, query: str, search_depth: str = "advanced", max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Perform a web search using Tavily API.
        """
        if not self.api_key:
            logger.warning("TAVILY_API_KEY not set. Skipping web search.")
            return []

        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": search_depth,
            "include_answer": False,
            "include_images": False,
            "max_results": max_results
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.base_url, json=payload)
                response.raise_for_status()
                data = response.json()
                
                results = data.get("results", [])
                logger.info(f"Tavily search returned {len(results)} results for query: {query}")
                return results
        except Exception as e:
            logger.error(f"Tavily search failed for query '{query}': {e}")
            return []

    async def search_parallel(self, queries: List[str]) -> List[Dict[str, Any]]:
        """
        Execute multiple search queries in parallel.
        """
        tasks = [self.search(q, max_results=3) for q in queries]
        results_nested = await asyncio.gather(*tasks)
        
        # Flatten and deduplicate by URL
        seen_urls = set()
        unique_results = []
        
        for sublist in results_nested:
            for res in sublist:
                url = res.get("url")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    unique_results.append(res)
        
        return unique_results

web_search_service = TavilySearchService()
