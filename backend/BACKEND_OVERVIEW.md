# LinkPulse Backend: In-Depth Documentation

Welcome to the backend documentation for **LinkPulse**, an autonomous web-to-knowledge AI platform. This document provide "every detail" of how the backend works, its folder structure, and the logic within each component.

---

## 🏗️ 1. High-Level Architecture

LinkPulse backend is built using a modern, scalable AI-first architecture:

- **Web Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Asynchronous, Type-hinted)
- **AI Models**: [Google Gemini 2.0 Flash](https://deepmind.google/technologies/gemini/) & [Groq (Llama 3.3 70B)](https://groq.com/)
- **Vector Database**: [FAISS](https://github.com/facebookresearch/faiss) (FlatL2 index for similarity search)
- **Database (Relational)**: [SQLAlchemy](https://www.sqlalchemy.org/) with SQLite (Async)
- **Background Tasks**: [Celery](https://docs.celeryq.dev/) with Redis/RabbitMQ (for long-running ingestion)
- **Text Processing**: [LangChain](https://www.langchain.com/) (Text splitters and pipeline orchestration)

---

## 📂 2. Directory Structure & Folder Functionality

```text
backend/
├── app/
│   ├── agents/          # Autonomous AI agents (Answer & Retrieval)
│   ├── api/             # API routes and dependency injection
│   │   └── endpoints/   # Individual endpoint logic (Chat, Ingestion, etc.)
│   ├── core/            # Configuration, Security, DB, and Logging setup
│   ├── crud/            # CRUD operations for the relational database
│   ├── models/          # SQLAlchemy Database models (User, Audit, etc.)
│   ├── schemas/         # Pydantic schemas for data validation
│   ├── services/        # Business logic & external service integrations
│   │   ├── ingestion/   # Content extractors (YouTube, GitHub, Web, PDF)
│   │   ├── processing/  # RAG Pipeline (Chunking, Embedding, Vector DB)
│   │   └── retrieval/   # Search & Live Web research logic
│   ├── workers/         # Background worker definitions
│   ├── main.py          # FastAPI application entry point
│   └── worker.py        # Celery worker entry point
├── tests/               # Unit and integration tests
├── data/                # Persistent storage (Vector DB, Pickles, Uploads)
├── Dockerfile           # Containerization setup
└── requirements.txt     # Python dependencies
```

---

## 🛠️ 3. Component Deep Dive

### 3.1 `app/core` (System Foundation)
- **`config.py`**: Loads environment variables using Pydantic Settings. Manages API keys (Gemini, Groq, etc.) and global settings.
- **`database.py`**: Configures the asynchronous SQLAlchemy engine and session factory.
- **`security.py`**: Implementation of JWT-based authentication and password hashing.
- **`logging_config.py`**: Standardized logging across the application.

### 3.2 `app/api/endpoints` (Communication Layer)
- **`chat.py`**: 
  - Supports **Streaming RAG** responses.
  - Implements **Hybrid Synthesis**: Merges internal docs with Live Web data.
  - Provides **Personas** (ELI5, Developer, Academic).
- **`ingestion.py`**:
  - Handles **File Uploads** (PDF, DOCX, PPTX).
  - Handles **URL Ingestion** (YouTube, GitHub, Websites).
  - Manages **Background Tasks** via `task_manager`.
- **`knowledge_graph.py`**: Builds a node-edge graph of ingested data based on shared repositories, folders, and source types.
- **`summary.py`**: Generates structured "Executive Summaries" using Gemini 2.0.

### 3.3 `app/services/ingestion` (Data Harvesting)
- **`youtube.py`**: Uses `youtube-transcript-api` to extract transcripts. Handles manual/auto-generated English fallbacks.
- **`github.py`**: Performs **Local Shallow Clones** of repositories to avoid API rate limits. Scans for valid code/doc files.
- **`website.py`**: Crawls websites using `requests` and `BeautifulSoup4`.
- **`pdf.py`/`docx.py`**: Extracts text from binary file formats.

### 3.4 `app/services/processing` (RAG Pipeline)
- **`pipeline.py`**: Orchestrates the **Clean → Chunk → Embed → Store** flow.
- **`chunker.py`**: 
  - **Text Splitter**: Splits on sentences/paragraphs.
  - **Code Splitter**: Awareness of `class`, `def`, and code blocks.
- **`embedding.py`**: Generates 384-dimensional vectors using `HuggingFaceEmbeddings` (default) or Gemini.
- **`vector_db.py`**: Manages the FAISS index. Maps vector IDs to source metadata using a pickle-based storage.

### 3.5 `app/agents` (Autonomous Reasoning)
- **`orchestrator.py`**: Coordinates the retrieval and answer generation.
- **`retrieval.py`**: Decides which internal/external sources to query based on user intent.
- **`answer.py`**: Synthesizes the final response with proper citations and markdown formatting.

---

## 🔄 4. Key Execution Flows

### 4.1 Ingestion Flow
1. **Request**: User sends a URL or File via `/ingestion`.
2. **Backgrounding**: FastAPI acknowledges immediately and starts a `BackgroundTasks` (or Celery task).
3. **Extraction**: The specific `Ingestor` (YouTube, GitHub, etc.) downloads and extracts raw content.
4. **Processing**:
   - `data_cleaner` strips noise.
   - `chunker` breaks text into chunks (sensitive to code vs prose).
   - `embedding_service` vectorizes each chunk.
5. **Storage**: Vectors added to `FAISS`; metadata saved to `metadata.pkl`.

### 4.2 Query / RAG Flow
1. **User Query**: Prompt received at `/chat/stream`.
2. **Search**: 
   - **Internal**: `vector_db` finds relevant chunks of local documents.
   - **External**: `web_search_service` performs parallel searches on the live web.
3. **Synthesis**: `llm_service` (Groq/Gemini) receives a rich prompt containing all context.
4. **Streaming**: Tokens are streamed back to the frontend in real-time, accompanied by source metadata.

---

## 🚀 5. Getting Started (Backend)

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Setup Env**:
   Create a `.env` file with `GEMINI_API_KEY`, `GROQ_API_KEY`, etc.
3. **Run Application**:
   ```bash
   uvicorn app.main:app --reload
   ```
4. **Run Worker** (for background tasks):
   ```bash
   celery -A app.worker.celery_app worker --loglevel=info
   ```

---

> [!NOTE]
> LinkPulse is designed to be **autonomous**. The agents don't just search; they synthesize cross-domain information, reconcile conflicts between web and internal docs, and present data in highly structured formats.
