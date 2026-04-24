import logging
import json
# redis imported dynamically in TaskManager if needed
from typing import Dict, List, Set, Any
from datetime import datetime, timedelta
from app.core.config import settings

logger = logging.getLogger(__name__)

class TaskManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TaskManager, cls).__new__(cls)
            cls._instance.tasks: Dict[str, Any] = {}
            # Redis is optional for Free Tier
            try:
                import redis
                from app.core.config import settings
                if hasattr(settings, "REDIS_URL") and settings.REDIS_URL:
                    cls._instance.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
                    cls._instance.redis.ping()
                    cls._instance.use_redis = True
                    logger.info("TaskManager: Using Redis for task persistence.")
                else:
                    cls._instance.use_redis = False
            except (ImportError, Exception) as e:
                logger.info(f"TaskManager: Redis not used ({type(e).__name__}). Using in-memory storage.")
                cls._instance.use_redis = False
        return cls._instance

    def _get_key(self, task_id: str) -> str:
        return f"linkpulse:task:{task_id}"

    def add_task(self, task_id: str, user_id: int, source_url: str, source_type: str):
        task_data = {
            "task_id": task_id,
            "user_id": user_id,
            "source_url": source_url,
            "source_type": source_type,
            "status": "processing",
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": None,
            "error": None
        }
        
        if self.use_redis:
            try:
                # Set with 12 hour TTL to handle long ingestions
                self.redis.setex(self._get_key(task_id), 43200, json.dumps(task_data))
            except Exception as e:
                logger.error(f"Failed to save task to Redis: {e}")
        else:
            self.tasks[task_id] = task_data
        
        logger.info(f"Task added: {task_id} for user {user_id}")

    def _update_task(self, task_id: str, updates: Dict[str, Any]):
        if self.use_redis:
            key = self._get_key(task_id)
            try:
                data = self.redis.get(key)
                if data:
                    task_data = json.loads(data)
                    task_data.update(updates)
                    self.redis.setex(key, 43200, json.dumps(task_data))
            except Exception as e:
                logger.error(f"Failed to update task in Redis: {e}")
        else:
            if task_id in self.tasks:
                self.tasks[task_id].update(updates)

    def complete_task(self, task_id: str):
        self._update_task(task_id, {
            "status": "completed",
            "finished_at": datetime.utcnow().isoformat()
        })
        logger.info(f"Task marked as completed: {task_id}")

    def fail_task(self, task_id: str, error: str):
        self._update_task(task_id, {
            "status": "failed",
            "error": str(error),
            "finished_at": datetime.utcnow().isoformat()
        })
        logger.error(f"Task failed: {task_id} - {error}")
    
    def get_user_tasks(self, user_id: int) -> List[Dict[str, Any]]:
        user_tasks = []
        
        if self.use_redis:
            try:
                # This is inefficient but okay for small scale/free tier
                # In a real system, we'd use a Set for user tasks
                keys = self.redis.keys("linkpulse:task:*")
                for key in keys:
                    data = self.redis.get(key)
                    if data:
                        task = json.loads(data)
                        if task.get("user_id") == user_id:
                            user_tasks.append(task)
            except Exception as e:
                logger.error(f"Failed to fetch tasks from Redis: {e}")
        else:
            user_tasks = [t for t in self.tasks.values() if t.get("user_id") == user_id]

        # Filter out old tasks (logic handled by Redis TTL usually, but for UI cleanup)
        now = datetime.utcnow()
        active_tasks = []
        for task in user_tasks:
            status = task.get("status")
            if status == "processing":
                active_tasks.append(task)
            else:
                finished_at = task.get("finished_at")
                if finished_at:
                    fin_dt = datetime.fromisoformat(finished_at)
                    # Show completed for 30s, failed for 60s
                    limit = 30 if status == "completed" else 60
                    if now - fin_dt < timedelta(seconds=limit):
                        active_tasks.append(task)
        
        return active_tasks

    def clear_failed_task(self, task_id: str):
        if self.use_redis:
            try:
                self.redis.delete(self._get_key(task_id))
            except Exception as e:
                logger.error(f"Failed to delete task from Redis: {e}")
        else:
            if task_id in self.tasks:
                del self.tasks[task_id]

task_manager = TaskManager()
