from app.agents.retrieval import RetrievalAgent
from app.agents.answer import AnswerAgent
import logging

logger = logging.getLogger(__name__)

class AgentOrchestrator:
    def __init__(self):
        self.retrieval_agent = RetrievalAgent()
        self.answer_agent = AnswerAgent()

    async def run(self, query: str) -> dict:
        logger.info(f"Orchestrator started for query: {query}")
        
        # 1. Retrieve Context
        retrieval_output = await self.retrieval_agent.run(query)
        retrieved_docs = retrieval_output.get("output", {}).get("results", [])
        
        # 2. Generate Answer
        answer_input = {
            "query": query,
            "results": retrieved_docs
        }
        answer_output = await self.answer_agent.run(answer_input)
        final_answer = answer_output.get("output", "I could not generate an answer.")
        
        return {
            "query": query,
            "answer": final_answer,
            "sources": retrieved_docs
        }

agent_orchestrator = AgentOrchestrator()
