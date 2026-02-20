import logging
from typing import Dict, List, Set, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class IngestionTask:
    def __init__(self, task_id: str, user_id: int, source_url: str, source_type: str):
        self.task_id = task_id
        self.user_id = user_id
        self.source_url = source_url
        self.source_type = source_type
        self.status = "processing"
        self.started_at = datetime.utcnow()
        self.error = None

    def to_dict(self):
        return {
            "task_id": self.task_id,
            "user_id": self.user_id,
            "source_url": self.source_url,
            "source_type": self.source_type,
            "status": self.status,
            "started_at": self.started_at.isoformat(),
            "error": self.error
        }

class TaskManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TaskManager, cls).__new__(cls)
            cls._instance.tasks: Dict[str, IngestionTask] = {}
        return cls._instance

    def add_task(self, task_id: str, user_id: int, source_url: str, source_type: str):
        task = IngestionTask(task_id, user_id, source_url, source_type)
        self.tasks[task_id] = task
        logger.info(f"Task added: {task_id} for user {user_id}")

    def complete_task(self, task_id: str):
        if task_id in self.tasks:
            del self.tasks[task_id]
            logger.info(f"Task completed and removed: {task_id}")

    def fail_task(self, task_id: str, error: str):
        if task_id in self.tasks:
            self.tasks[task_id].status = "failed"
            self.tasks[task_id].error = error
            logger.error(f"Task failed: {task_id} - {error}")
            # We keep failed tasks for a while for UI to show error? 
            # For now, let's keep them and maybe clear them on a timer later.
            # actually let's just remove them for now to keep it simple, 
            # or keep them for 5 mins.
    
    def get_user_tasks(self, user_id: int) -> List[Dict[str, Any]]:
        return [t.to_dict() for t in self.tasks.values() if t.user_id == user_id]

    def clear_failed_task(self, task_id: str):
        if task_id in self.tasks:
            del self.tasks[task_id]

task_manager = TaskManager()
