# LinkPulse Backend: Exhaustive Technical Manual

This document provides a highly detailed, file-by-file breakdown of the **LinkPulse** backend. It covers every major component, explaining the internal logic, core functions, and overall architecture.

---

## 🏗️ 1. Project Root & Entry Points

### `main.py`
The entry point for the FastAPI application.
- **Key Responsibilities**:
    - Initializes the `FastAPI` app instance with metadata (title, version).
    - Configures **CORS** (Cross-Origin Resource Sharing) middleware based on `settings.BACKEND_CORS_ORIGINS`.
    - Includes the main `api_router` from `app.api.api`.
    - Defines a startup event to automatically create database tables using `Base.metadata.create_all`.
    - Implements a static file serving endpoint `/api/v1/files/{filename}` for uploaded documents.
- **Core Functions**:
    - `startup_event()`: Async function to initialize DB tables.
    - `serve_file(filename: str)`: Serves files from `data/storage` with appropriate mime-types and CORS headers.

### `worker.py`
Entry point for the Celery worker process.
- **Key Responsibilities**:
    - Initializes the Celery app instance using configuration from `app.core.celery_app`.
    - Registers background tasks (e.g., ingestion, periodic cleanup).

---

## 🛠️ 2. Core Framework (`app/core`)

### `config.py`
Central configuration management using Pydantic.
- **Class**: `Settings(BaseSettings)`
- **Responsibility**: Loads environment variables from a `.env` file. Manages API keys (Gemini, Groq, Tavily), DB connection strings, and JWT security parameters.

### `database.py`
Database connectivity using SQLAlchemy (Async).
- **Responsibility**: Sets up the `AsyncEngine` and `AsyncSessionLocal`.
- **Core Constant**: `engine`, `AsyncSessionLocal`.

### `security.py`
Low-level security utilities.
- **Functions**:
    - `create_access_token(subject, expires_delta)`: Generates a JWT token for user authentication.
    - `verify_password(plain_password, hashed_password)`: Compares a plain password with a Bcrypt hash.
    - `get_password_hash(password)`: Hashes a password using Bcrypt.

---

## 📡 3. API Layer (`app/api`)

### `deps.py`
Dependency injection utilities for API endpoints.
- **Functions**:
    - `get_db()`: Yields an async database session per request.
    - `get_current_user(db, token)`: Validates a JWT token and retrieves the associated User model.
    - `get_current_active_user(current_user)`: Ensures the user is not disabled.

### `endpoints/chat.py`
Powerhouse for Retrieval-Augmented Generation (RAG).
- **Functions**:
    - `chat_stream(request: ChatRequest)`: **Streaming Endpoint**. Orchestrates hybrid search (Internal + Web), synthesizes a response using Gemini/Groq, and streams tokens to the client.
    - `chat(request: ChatRequest)`: Non-streaming version of the RAG pipeline.
- **Logic**: Implements "Hybrid Synthesis" by merging local vector search results with Tavily web results.

### `endpoints/ingestion.py`
Manages data harvesting tasks.
- **Functions**:
    - `upload_files(files, folder_name)`: Handles multi-part form uploads for PDFs, DOCX, etc. Saves files to `data/storage` and triggers background ingestion.
    - `trigger_ingestion(request: IngestRequest)`: Triggers ingestion for a remote URL (YouTube, GitHub, Web).
    - `get_ingested_sources()`: Returns a list of all documents currently in the Knowledge Base, grouped by repository or folder.
    - `delete_source(request: DeleteRequest)`: Removes a source from the Vector DB and deletes its physical file.

---

## 📑 4. Models & Schemas (`app/models` & `app/schemas`)

### `models/user.py` / `models/audit.py`
SQLAlchemy models defining the database schema.
- **User**: Stores email, hashed password, and superuser status.
- **AuditLog**: Tracks system events (ingestions, queries).

### `schemas/user.py`
Pydantic schemas for data validation and serialization.
- **UserCreate / UserUpdate**: Input validation for user management.
- **User (Output)**: Sanitized user data for API responses.

---

## ⚙️ 5. Business Logic Services (`app/services`)

### `ingestion/youtube.py`
- **Class**: `YouTubeIngestor`
- **Logic**: Uses `youtube-transcript-api` to fetch video transcripts. It prioritizes manually created English transcripts, falling back to auto-generated ones. Extracts the 11-character video ID from varied URL formats.

### `ingestion/github.py`
- **Class**: `GitHubIngestor`
- **Logic**: Performs a shallow clone (`--depth 1`) of a repository to a temporary directory. Recursively scans for documentation and source code files, adhering to safe size limits and skipping binary/dependency folders like `node_modules`.

### `ingestion/website.py`
- **Class**: `WebsiteIngestor`
- **Logic**: Uses `trafilatura` for high-quality text extraction. If static extraction fails, it uses **Playwright** (Headless Chromium) to render JavaScript and crawl internal links recursively up to a specified depth.

### `processing/pipeline.py`
- **Class**: `ProcessingPipeline`
- **Core Function**: `process_document(content, metadata, user_id)`
- **Logic**: The master orchestrator for turning raw text into searchable knowledge. It calls the cleaner, chunker, embedding service, and vector DB in sequence.

### `processing/chunker.py`
- **Class**: `Chunker`
- **Logic**: 
    - **`chunk_text`**: Standard recursive splitting for natural language.
    - **`chunk_code`**: Context-aware splitting for code, ensuring class and function definitions aren't split mid-block.

### `processing/vector_db.py`
- **Class**: `VectorDB`
- **Logic**: Wraps FAISS. Manages the `faiss_index.bin` and a `metadata.pkl` file (which stores the actual text content and source info mapped to vector IDs).
- **Core Functions**: `add(embeddings, metadatas)`, `search(query_vector, k)`, `save()`.

---

## 🤖 6. AI Agents (`app/agents`)

### `orchestrator.py`
- **Class**: `AgentOrchestrator`
- **Logic**: A simple but effective agent loop.
    1. **Retrieval Phase**: Queries the internal Vector DB.
    2. **Synthesis Phase**: Feeds the context into the LLM (Gemini 2.0 or Groq Llama 3.3) to generate a cited response.

### `llm.py`
- **Class**: `LLMService`
- **Responsibility**: Provides a unified interface for Google Gemini and Groq. 
- **Core Logic**: Implements an automatic **Fallback System**. If Groq (preferred for speed) fails or reaches quota, it immediately fails over to Gemini 2.0 Flash.

---

## 📦 7. Database Operations (`app/crud`)

### `base.py`
- **Class**: `CRUDBase`
- **Logic**: A generic base class providing standard `get`, `get_multi`, `create`, `update`, and `remove` operations using SQLAlchemy's async patterns.

### `user.py`
- **Class**: `CRUDUser`
- **Responsibility**: Specializes `CRUDBase` for user models, including logic for password hashing during creation and authentication verification.

---

> [!IMPORTANT]
> **Data Security**: Every vector and metadata entry in LinkPulse is tagged with a `user_id`. The `vector_db` and API endpoints enforce this filtering strictly to ensure users can only query or see their own knowledge base.
