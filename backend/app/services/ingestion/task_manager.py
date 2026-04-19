import logging
from typing import Dict, List, Set, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class IngestionTask:
    def __init__(self, task_id: str, user_id: int, source_url: str, source_type: str):
        self.task_id = task_id
        self.user_id = user_id
        self.source_url = source_url
        self.source_type = source_type
        self.status = "processing"
        self.started_at = datetime.utcnow()
        self.finished_at = None
        self.error = None

    def to_dict(self):
        return {
            "task_id": self.task_id,
            "user_id": self.user_id,
            "source_url": self.source_url,
            "source_type": self.source_type,
            "status": self.status,
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
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
            task = self.tasks[task_id]
            task.status = "completed"
            task.finished_at = datetime.utcnow()
            logger.info(f"Task marked as completed: {task_id}")

    def fail_task(self, task_id: str, error: str):
        if task_id in self.tasks:
            task = self.tasks[task_id]
            task.status = "failed"
            task.error = error
            task.finished_at = datetime.utcnow()
            logger.error(f"Task failed: {task_id} - {error}")
    
    def get_user_tasks(self, user_id: int) -> List[Dict[str, Any]]:
        now = datetime.utcnow()
        active_tasks = []
        tasks_to_delete = []

        for task_id, task in self.tasks.items():
            if task.user_id != user_id:
                continue
            
            # Keep active tasks
            if task.status in ["processing", "queued"]:
                active_tasks.append(task.to_dict())
                continue
            
            # Check for cleanup
            if task.finished_at:
                # Keep completed tasks for 5 seconds
                if task.status == "completed":
                    if now - task.finished_at < timedelta(seconds=5):
                        active_tasks.append(task.to_dict())
                    else:
                        tasks_to_delete.append(task_id)
                
                # Keep failed tasks for 15 seconds
                elif task.status == "failed":
                    if now - task.finished_at < timedelta(seconds=15):
                        active_tasks.append(task.to_dict())
                    else:
                        tasks_to_delete.append(task_id)

        # Cleanup
        for tid in tasks_to_delete:
            if tid in self.tasks:
                del self.tasks[tid]

        return active_tasks

    def clear_failed_task(self, task_id: str):
        if task_id in self.tasks:
            del self.tasks[task_id]

task_manager = TaskManager()
