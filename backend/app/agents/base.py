from abc import ABC, abstractmethod
from typing import Any, Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name

    async def run(self, input_data: Any) -> Any:
        start_time = datetime.utcnow()
        logger.info(f"Agent {self.name} started.")
        
        try:
            result = await self.process(input_data)
        except Exception as e:
            logger.error(f"Agent {self.name} failed: {e}")
            raise e
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"Agent {self.name} finished in {duration}s.")
        
        return {
            "agent": self.name,
            "input": input_data,
            "output": result,
            "duration": duration,
            "timestamp": end_time.isoformat()
        }

    @abstractmethod
    async def process(self, input_data: Any) -> Any:
        pass
