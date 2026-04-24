import os
import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).parent
sys.path.append(str(project_root))

from dotenv import load_dotenv
load_dotenv()

from app.services.processing.embedding import embedding_service
from app.core.config import settings

def test_gemini():
    print(f"Testing Gemini Embedding with API Key: {settings.GEMINI_API_KEY[:5]}...")
    test_text = "This is a test of the LinkPulse embedding system."
    
    try:
        embedding = embedding_service.embed_query(test_text)
        print(f"SUCCESS! Embedding length: {len(embedding)}")
        print(f"First 5 values: {embedding[:5]}")
        if len(embedding) == 768:
            print("MATCH! This is compatible with your 768-dim Qdrant collection.")
        else:
            print(f"WARNING: Got {len(embedding)} dimensions instead of 768.")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_gemini()
