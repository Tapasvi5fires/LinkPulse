from app.agents.base import BaseAgent
from app.services.llm import llm_service

class AnswerAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="AnswerAgent")
        self.llm_service = llm_service

    async def process(self, input_data: dict) -> str:
        query = input_data.get("query")
        context_docs = input_data.get("results", [])
        
        context_text = "\n\n".join([f"Source: {doc['metadata'].get('source_url', 'Unknown')}\nContent: {doc['metadata'].get('text', '')}" for doc in context_docs])
        
        answer = await self.llm_service.generate_response(prompt=query, context=context_text)
        return answer
