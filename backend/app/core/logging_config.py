import logging
import sys
from typing import Any, Dict

# Standard format for logs
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

def setup_logging():
    """
    Configure centralized logging for the application.
    """
    logging.basicConfig(
        level=logging.INFO,
        format=LOG_FORMAT,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Set levels for noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    
    # Create application logger
    logger = logging.getLogger("app")
    logger.info("Logging initialized successfully")
    return logger

# Create a global logger instance for convenience
logger = logging.getLogger("app")
