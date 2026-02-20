from app.agents.base import BaseAgent
from app.services.retrieval.search import search_service

class RetrievalAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="RetrievalAgent")
        self.search_service = search_service

    async def process(self, query: str) -> dict:
        results = self.search_service.search(query)
        return {"query": query, "results": results}
