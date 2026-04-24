import os
import sys
import asyncio
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).parent
sys.path.append(str(project_root))

from dotenv import load_dotenv
load_dotenv()

from app.services.processing.embedding import embedding_service
from app.services.processing.vector_db import vector_db
from app.services.llm import llm_service
from app.core.config import settings

async def test_e2e_flow():
    print("--- STARTING E2E FLOW TEST ---")
    
    test_query = "What is LinkPulse?"
    
    # 1. TEST EMBEDDING
    print("\n1. Testing Embedding (Targeting 768 dim)...")
    try:
        vector = embedding_service.embed_query(test_query)
        print(f"SUCCESS! Embedding Success! Dim: {len(vector)}")
        if len(vector) != 768:
            print(f"ERROR: Vector dimension is {len(vector)}, expected 768.")
            return
    except Exception as e:
        print(f"ERROR: Embedding Failed: {e}")
        return

    # 2. TEST QDRANT SEARCH
    print("\n2. Testing Qdrant Search...")
    try:
        # We try to search in the main collection (Synchronous call)
        results = vector_db.search(query_vector=vector, k=1)
        print(f"SUCCESS! Qdrant Search Success! Found {len(results)} results.")
    except Exception as e:
        print(f"ERROR: Qdrant Search Failed: {e}")
        print("HINT: If this says 'Dimension Error', it means your collection is not 768.")

    # 3. TEST LLM CHAT
    print("\n3. Testing LLM Chat Completion...")
    try:
        response = await llm_service.generate_content(
            prompt=f"User asked: {test_query}. Context: LinkPulse is an AI document assistant."
        )
        print(f"SUCCESS! LLM Success! Response preview: {response[:50]}...")
    except Exception as e:
        print(f"ERROR: LLM Failed: {e}")

    print("\n--- E2E TEST COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(test_e2e_flow())
