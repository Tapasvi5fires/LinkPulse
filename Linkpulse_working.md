# LinkPulse — Complete Working Guide & Feature Flow

> **What is LinkPulse?**
> An Autonomous Knowledge Base & Intelligence Engine. You feed it data (files, websites, GitHub repos, YouTube videos, Instagram posts), and it turns everything into an AI-searchable brain that you can chat with, visualize, and analyze.

---

## TABLE OF CONTENTS

1. [Tech Stack & Architecture](#1-tech-stack--architecture)
2. [Project File Structure](#2-project-file-structure)
3. [Database & Data Storage](#3-database--data-storage)
4. [Environment Configuration](#4-environment-configuration)
5. [Scenario 1 — First Visit & Registration](#5-scenario-1--first-visit--registration)
6. [Scenario 2 — Login Flow](#6-scenario-2--login-flow)
7. [Scenario 3 — Uploading Files (Dashboard)](#7-scenario-3--uploading-files-dashboard)
8. [Scenario 4 — Ingesting a URL (Website, GitHub, YouTube, Instagram)](#8-scenario-4--ingesting-a-url)
9. [Scenario 5 — Chatting with Your Knowledge Base](#9-scenario-5--chatting-with-your-knowledge-base)
10. [Scenario 6 — Knowledge Graph Visualization](#10-scenario-6--knowledge-graph-visualization)
11. [Scenario 7 — Analytics Page](#11-scenario-7--analytics-page)
12. [Scenario 8 — Summarization Feature](#12-scenario-8--summarization-feature)
13. [Scenario 9 — Deleting Sources](#13-scenario-9--deleting-sources)
14. [Scenario 10 — Command Palette (Ctrl+K)](#14-scenario-10--command-palette-ctrlk)
15. [Full Backend API Reference](#15-full-backend-api-reference)
16. [Data Processing Pipeline (Deep Dive)](#16-data-processing-pipeline-deep-dive)
17. [RAG & LLM Layer (Deep Dive)](#17-rag--llm-layer-deep-dive)
18. [Frontend Architecture (Deep Dive)](#18-frontend-architecture-deep-dive)
19. [How Everything Connects — Master Data Flow](#19-how-everything-connects--master-data-flow)

---

## 1. Tech Stack & Architecture

### Frontend
| Concern | Technology |
|---|---|
| Framework | Next.js 14.2 (App Router, TypeScript) |
| UI Library | Radix UI + shadcn/ui components |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Charts | Recharts |
| Knowledge Graph | Custom Canvas + Physics Simulation |
| HTTP | Native `fetch` (no axios) |
| State | React `useState` / `useEffect` (no Redux) |
| Auth Persistence | `localStorage` (JWT token + theme) |
| Port | 3090 |

### Backend
| Concern | Technology |
|---|---|
| Framework | FastAPI (async, Python 3.12) |
| ORM | SQLAlchemy (async) |
| Relational DB | PostgreSQL |
| Vector DB | FAISS (local, persisted as `.bin` + `.pkl`) |
| Task Queue | Celery + Redis |
| Embeddings | Sentence-Transformers (`all-MiniLM-L6-v2`, 384-dim) |
| Reranker | CrossEncoder (`ms-marco-MiniLM-L-6-v2`) |
| LLM Primary | Groq (`llama-3.3-70b-versatile`) |
| LLM Fallback | Google Gemini (`gemini-2.0-flash`) |
| Web Search | Tavily API |
| Auth | JWT (HS256, 24hr expiry) + bcrypt passwords |
| Port | 8090 |

### External Services
- **Groq** — Fast free-tier LLM inference
- **Google Gemini** — Embedding model (`text-embedding-004`) + LLM fallback
- **Tavily** — Live web search for chat
- **GitHub** — Public repo cloning
- **YouTube Transcript API** — Subtitle extraction
- **Instaloader + Playwright** — Instagram scraping

---

## 2. Project File Structure

```
LINKPULSE_MAJOR_PROJECT/
├── backend/
│   ├── app/
│   │   ├── main.py                        # FastAPI app, router registration, CORS, startup
│   │   ├── core/
│   │   │   ├── config.py                  # Pydantic Settings (env vars)
│   │   │   ├── database.py                # Async SQLAlchemy engine + session factory
│   │   │   ├── logging_config.py          # Structured logging setup
│   │   │   └── security.py                # JWT encode/decode, bcrypt helpers
│   │   ├── models/
│   │   │   └── user.py                    # SQLAlchemy User ORM model
│   │   ├── schemas/
│   │   │   └── user.py                    # Pydantic request/response schemas
│   │   ├── api/
│   │   │   └── endpoints/
│   │   │       ├── auth.py                # POST /auth/login
│   │   │       ├── users.py               # CRUD for users
│   │   │       ├── ingestion.py           # Upload, URL ingest, sources list, delete
│   │   │       ├── chat.py                # Chat (sync + streaming)
│   │   │       ├── search.py              # Vector search endpoint
│   │   │       ├── summary.py             # AI summarization endpoint
│   │   │       ├── knowledge_graph.py     # Graph nodes/edges endpoint
│   │   │       └── files.py               # Serve uploaded files
│   │   ├── services/
│   │   │   ├── llm.py                     # LLMService (Groq → Gemini fallback)
│   │   │   ├── ingestion/
│   │   │   │   ├── task_manager.py        # In-memory task state tracker
│   │   │   │   ├── pipeline.py            # Main ingest orchestrator
│   │   │   │   ├── pdf.py                 # PDFIngestor (PyMuPDF + OCR)
│   │   │   │   ├── docx.py                # DocxIngestor (python-docx)
│   │   │   │   ├── pptx.py                # PptxIngestor (python-pptx)
│   │   │   │   ├── text.py                # TextIngestor (.txt, .md)
│   │   │   │   ├── website.py             # WebsiteIngestor (trafilatura + playwright)
│   │   │   │   ├── github.py              # GitHubIngestor (git clone)
│   │   │   │   ├── youtube.py             # YouTubeIngestor (transcript API)
│   │   │   │   └── instagram.py           # InstagramIngestor (instaloader + playwright)
│   │   │   ├── processing/
│   │   │   │   ├── cleaner.py             # DataCleaner (prose vs code modes)
│   │   │   │   ├── chunker.py             # Chunker (document + code strategies)
│   │   │   │   ├── embedding.py           # EmbeddingService (local or Gemini)
│   │   │   │   └── vector_db.py           # VectorDB (FAISS CRUD)
│   │   │   └── retrieval/
│   │   │       ├── search.py              # SearchService (vector → rerank → diversity)
│   │   │       └── web_search.py          # TavilySearchService
│   │   └── dependencies.py                # FastAPI `get_current_user` dependency
│   ├── data/
│   │   ├── faiss_index.bin                # FAISS vector index (auto-created)
│   │   ├── metadata.pkl                   # Chunk metadata store (auto-created)
│   │   └── storage/                       # Uploaded files (uuid_filename)
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── app/
        │   ├── layout.tsx                 # Root layout, CommandPalette mount
        │   ├── page.tsx                   # Splash screen → redirect to /login
        │   ├── login/page.tsx             # Login form
        │   ├── register/page.tsx          # Registration form
        │   ├── dashboard/page.tsx         # Main ingestion + source management
        │   ├── chat/page.tsx              # AI chat with streaming
        │   ├── analytics/page.tsx         # Usage statistics
        │   └── knowledge-graph/page.tsx   # Force graph visualization
        └── components/
            ├── Sidebar.tsx                # Nav, theme toggle, logout
            ├── CommandPalette.tsx         # Ctrl+K global search
            └── ui/
                └── MultiFileUpload.tsx    # Drag-drop file uploader
```

---

## 3. Database & Data Storage

### PostgreSQL — Relational Data

**Table: `users`**

| Column | Type | Notes |
|---|---|---|
| `id` | Integer (PK) | Auto-increment |
| `email` | String (unique, indexed) | Login identifier |
| `hashed_password` | String | bcrypt hash |
| `full_name` | String | Nullable |
| `is_active` | Boolean | Default: True |
| `is_superuser` | Boolean | First registered user = True |
| `created_at` | DateTime (TZ) | Auto-set on insert |
| `updated_at` | DateTime (TZ) | Auto-updated |

### FAISS + Pickle — Vector Data

**`data/faiss_index.bin`** — Binary FAISS index (IndexFlatL2, 384 dimensions)

**`data/metadata.pkl`** — Python pickle list, each entry:

```python
{
  "text": str,            # The actual chunk content
  "source_url": str,      # Where it came from (file path or URL)
  "source_type": str,     # "pdf" | "website" | "github" | "youtube" | "instagram" | "docx" | "pptx" | "text"
  "user_id": int,         # Owner — enables multi-tenant isolation
  "title": str,           # Document title
  "chunk_index": int,     # Position within source (0, 1, 2...)
  "ingested_at": str,     # ISO timestamp

  # Source-specific extras:
  # GitHub: "repo", "file_path", "filename", "file_size"
  # YouTube: "video_id", "language_code"
  # Instagram: "author", "shortcode", "ingestion_method"
  # Website: "crawl_at", "depth"
  # Files: "page_count" (PDF), "slide_count" (PPTX)
}
```

### File Storage

Uploaded files are saved at: `data/storage/{uuid}_{original_filename}`

The UUID prefix prevents filename collisions between users.

---

## 4. Environment Configuration

**File: `backend/.env`** (not committed, create from template)

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=linkpulse
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5440/linkpulse

# Redis (Celery broker + result backend)
REDIS_URL=redis://localhost:6380/0
CELERY_BROKER_URL=redis://localhost:6380/1
CELERY_RESULT_BACKEND=redis://localhost:6380/2

# Security
SECRET_KEY=super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# LLM API Keys
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
TAVILY_API_KEY=your-tavily-key

# Optional: use Gemini for embeddings instead of local model
USE_GEMINI_EMBEDDINGS=false

# Ports
BACKEND_PORT=8090
FRONTEND_PORT=3090
```

---

## 5. Scenario 1 — First Visit & Registration

### What the User Sees

1. Navigate to `http://localhost:3090/`
2. See a splash screen: **"Initializing Neural Engine..."** with animated logo
3. After ~2 seconds, automatically redirected to `/login`

### Code Path

**`frontend/src/app/page.tsx`**
- Runs a `useEffect` with `setTimeout`
- Checks `localStorage` for a JWT token
- If token exists → redirect to `/dashboard`
- If no token → redirect to `/login`

### Registration Flow

1. User clicks **"Create an account"** on login page → goes to `/register`
2. Fills in: Full Name, Email, Password
3. Password strength meter shows 5 levels (very weak → very strong) in real time
4. Clicks **Register**

**Frontend** sends:
```http
POST http://localhost:8090/api/v1/users/open
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "MySecurePass123!",
  "full_name": "John Doe"
}
```

**Backend** (`api/endpoints/users.py`):
1. Checks if email already exists in `users` table
2. Hashes password with bcrypt
3. Creates `User` row
4. **First user ever registered** → `is_superuser = True` automatically
5. Returns `{ "id": 1, "email": "...", "full_name": "...", ... }`

**Frontend** then shows a success screen and redirects to `/login`.


---

## 6. Scenario 2 — Login Flow

### What the User Does

1. Goes to `/login`
2. Enters email + password
3. Clicks **"Access System"**

### Detailed Code Flow

**Frontend** (`app/login/page.tsx`):
```typescript
// Sends OAuth2-compatible form data
const formData = new FormData();
formData.append('username', email);   // Backend expects 'username' field
formData.append('password', password);

const response = await fetch('http://localhost:8090/api/v1/auth/login', {
  method: 'POST',
  body: formData,
});
const data = await response.json();
localStorage.setItem('token', data.access_token);
router.push('/dashboard');
```

**Backend** (`api/endpoints/auth.py`):
1. Receives `OAuth2PasswordRequestForm` (multipart form: username, password)
2. Queries PostgreSQL: `SELECT * FROM users WHERE email = username`
3. Verifies password: `passlib.context.verify(plain_password, hashed_password)`
4. If valid, calls `security.create_access_token(subject=user.id)`
5. JWT payload: `{ "sub": "1", "exp": <24hrs from now> }`
6. Signs with `HS256` + `SECRET_KEY`
7. Returns: `{ "access_token": "eyJ...", "token_type": "bearer" }`

**After Login:**
- Token stored in `localStorage` as `'token'`
- All subsequent requests include header: `Authorization: Bearer eyJ...`
- Backend `get_current_active_user` dependency decodes JWT on every protected route to identify the caller

### How Auth Guards Work

Every protected backend route has this dependency:
```python
current_user: User = Depends(get_current_active_user)
```

This runs:
1. Extracts `Authorization: Bearer <token>` header
2. Decodes JWT → gets `user_id`
3. Fetches user from DB
4. Checks `is_active = True`
5. Raises `401 Unauthorized` if anything fails

Frontend auth guard (in each page's `useEffect`):
```typescript
const token = localStorage.getItem('token');
if (!token) { router.push('/login'); return; }
```

---

## 7. Scenario 3 — Uploading Files (Dashboard)

### What the User Does

1. Navigates to `/dashboard`
2. Clicks **"Add Source"** → opens upload dialog
3. Selects the **Files** tab
4. Drags & drops PDF/DOCX/PPTX/TXT/MD files
5. Optionally types a **Folder Name** to group them
6. Clicks **"Upload All"**

### Component: `MultiFileUpload.tsx`

- Drag-drop zone accepts: `application/pdf`, `.docx`, `.pptx`, `.txt`, `.md`
- Each file gets a row with: filename, size, status indicator
- Status states: `pending → uploading → success / error`
- Progress bar per file
- Keyboard shortcuts: `Ctrl+A` select all, `Escape` deselect

### Upload API Call (per file)

```typescript
const formData = new FormData();
formData.append('files', file);
if (folderName) formData.append('folder_name', folderName);

fetch('http://localhost:8090/api/v1/ingestion/upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

### Backend Processing (`api/endpoints/ingestion.py`)

```
POST /api/v1/ingestion/upload
  → Accepts: multipart/form-data (files[], folder_name?)
  → For each file:
      1. Generate UUID filename → save to data/storage/
      2. Create background task via TaskManager
      3. Launch Celery worker: process_file_task(file_path, user_id, folder_name)
      4. Return: { "task_id": "...", "filename": "...", "status": "processing" }
```

### Background Processing Pipeline

**Step 1 — Type Detection & Extraction**

| File Type | Ingestor | Library |
|---|---|---|
| `.pdf` | `PDFIngestor` | PyMuPDF (`fitz`) + pytesseract (OCR fallback) |
| `.docx` | `DocxIngestor` | `python-docx` |
| `.pptx` | `PptxIngestor` | `python-pptx` |
| `.txt` / `.md` | `TextIngestor` | Built-in `open()` |

**For PDF specifically:**
- Page-by-page text extraction with PyMuPDF
- If page text is empty → runs Tesseract OCR on page image
- Produces: `List[Document]` with text + page metadata

**Step 2 — Cleaning** (`services/processing/cleaner.py` → `DataCleaner`)

- Detects if content is code (GitHub) or prose (documents)
- **Prose mode**: Collapse whitespace, decode HTML entities, remove HTML tags
- **Code mode**: Preserve indentation/newlines, only remove excessive blank lines

**Step 3 — Chunking** (`services/processing/chunker.py` → `Chunker`)

- **Document chunks**: 800 tokens, 150 overlap, splits on `\n\n` → `\n` → `. ` → ` `
- **Code chunks**: 800 tokens, 150 overlap, splits on `\nclass ` → `\ndef ` → `\nasync def ` → `\n`
- Small code files (<800 tokens) kept as a single chunk
- Each chunk gets injected metadata: `chunk_index`, `source_url`, `source_type`, `user_id`, `title`

**Step 4 — Embedding** (`services/processing/embedding.py` → `EmbeddingService`)

- Default: Local Sentence-Transformers (`all-MiniLM-L6-v2`)
  - 384-dimensional float32 vectors
  - Runs entirely locally — no API cost
  - Batch processing for efficiency
- Optional: Google Gemini (`text-embedding-004`, 768-dim) if `USE_GEMINI_EMBEDDINGS=true`

**Step 5 — Vector Storage** (`services/processing/vector_db.py` → `VectorDB`)

- Inserts embedding vectors into FAISS `IndexFlatL2`
- Inserts chunk metadata into the pickle list (by matching index position)
- Saves both files to disk immediately after each batch

### Task Polling (Frontend)

The dashboard polls every 3 seconds:
```typescript
setInterval(async () => {
  const tasks = await fetch('/api/v1/ingestion/tasks', { headers: authHeader });
  // Updates task status badges in UI
  // When task disappears from list → refresh sources grid
}, 3000);
```

Task states:
- `processing` → spinner badge
- `completed` → green badge (disappears after 5 seconds)
- `failed` → red badge (stays 15 seconds, can manually clear)

---

## 8. Scenario 4 — Ingesting a URL

### URL Tab in Dashboard

The dashboard URL tab has 4 sub-tabs: **Website**, **GitHub**, **YouTube**, **Instagram**

All send to the same endpoint:
```http
POST /api/v1/ingestion/url
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://...",
  "source_type": "website" | "github" | "youtube" | "instagram",
  "depth": 2  // optional, for website crawling
}
```

### Website Ingestion (`WebsiteIngestor`)

1. **Primary**: `trafilatura` library extracts main article text (removes ads, nav, etc.)
2. **Fallback**: Playwright headless browser if trafilatura returns nothing
3. **Link Crawling**: Finds all `<a href>` links on page, filters to same domain, follows up to `depth` levels
4. **Limit**: Max 20 pages per ingestion job
5. **Metadata**: `title`, `crawl_at`, `depth`

### GitHub Ingestion (`GitHubIngestor`)

1. Accepts: `owner/repo`, `https://github.com/owner/repo`, or `github.com/owner/repo`
2. Shallow clones: `git clone --depth=1 <url> <temp_dir>`
3. Timeout: 2 minutes
4. **Included file types**: `.py`, `.js`, `.ts`, `.tsx`, `.jsx`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.h`, `.cs`, `.rb`, `.php`, `.swift`, `.kt`, `.md`, `.rst`, `.txt`, `.yaml`, `.yml`, `.json`, `.toml`, `.env.example`
5. **Skipped directories**: `node_modules`, `venv`, `.git`, `__pycache__`, `dist`, `build`, `.next`, `.cache`
6. **File size limit**: 500KB per file
7. Each file = one `Document` with metadata: `repo`, `file_path`, `filename`, `file_size`
8. Temp clone directory deleted after processing

### YouTube Ingestion (`YouTubeIngestor`)

1. Extracts video ID from URL
2. Calls `YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'en-US'])`
3. Joins all transcript segments into one text block
4. Falls back to auto-generated captions if manual captions unavailable
5. Metadata: `video_id`, `language_code`

### Instagram Ingestion (`InstagramIngestor`)

1. **Primary**: `instaloader` library
   - Downloads post by shortcode
   - Extracts: caption, author, likes, date, comments
2. **Fallback**: Playwright browser automation
   - Navigates to URL in headless Chrome
   - Scrapes caption text from DOM
3. URL formats supported: `/p/SHORTCODE/` or `/reels/SHORTCODE/`
4. Metadata: `author`, `shortcode`, `ingestion_method`

---

## 9. Scenario 5 — Chatting with Your Knowledge Base

### What the User Does

1. Navigates to `/chat`
2. Optionally selects a **Source Filter** (narrow to specific repo/folder)
3. Optionally selects a **Persona**:
   - `professional` — Formal, business tone
   - `eli5` — Explain Like I'm 5 (simple language)
   - `developer` — Code-first, technical details
   - `academic` — Citation-heavy, structured
4. Optionally toggles **Web Search** (enables live Tavily search)
5. Types a question, hits Enter

### Frontend Chat Implementation (`app/chat/page.tsx`)

**`handleSubmit(e)`** function:
1. Adds user message to conversation state
2. Calls streaming endpoint via `fetch` with `ReadableStream`

```typescript
const response = await fetch('http://localhost:8090/api/v1/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: userMessage,
    history: conversationHistory,
    persona: selectedPersona,
    source_filter: selectedSources,
    web_search: webSearchEnabled,
  }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);

  if (chunk.startsWith('metadata:')) {
    // Parse sources used — display citation panel
    const sources = JSON.parse(chunk.replace('metadata:', ''));
    setSourceCitations(sources);
  } else if (chunk.startsWith('data:')) {
    // Append token to current AI message
    setCurrentMessage(prev => prev + chunk.replace('data:', ''));
  } else if (chunk.startsWith('error:')) {
    // Show error toast
  }
}
```

**`groupSourcesForFilter()`**: Organizes all user sources into a hierarchical tree:
- GitHub repos (group by `repo` metadata)
- Folders (group by `folder_name` metadata)
- Websites (group by domain)
- Individual files

### Backend Chat Flow (`api/endpoints/chat.py`)

**`POST /api/v1/chat/stream`** — returns `StreamingResponse`

```
1. Load user's sources summary
   → Fetch all metadata entries belonging to user_id
   → Build a "sources index" string for the LLM to reference

2. Vector Retrieval (SearchService)
   → Embed query with EmbeddingService
   → FAISS search: k=20 candidates (or k=15 if source_filter active)
   → Filter results to current user_id
   → If source_filter: further filter to matching source_url(s)
   → Rerank with CrossEncoder (ms-marco-MiniLM-L-6-v2)
   → Ensure source diversity (results from multiple docs, not just one)
   → Return top k chunks

3. Web Search (optional, TavilySearchService)
   → LLM generates 3 optimized search queries from user question
   → Parallel Tavily API calls for all 3 queries
   → Merge + deduplicate results by URL
   → Filter results with content length > 100 chars

4. Prompt Assembly
   → Persona system prompt
   → User's knowledge base summary
   → Retrieved document chunks (formatted as [Source N: title]\ntext)
   → Web search results (if enabled)
   → Conversation history (prior turns)
   → Current user question

5. LLM Generation (LLMService)
   → Try Groq (llama-3.3-70b-versatile)
   → If Groq fails → try Gemini (gemini-2.0-flash)
   → Stream tokens as Server-Sent Events

6. Stream Format:
   → First: "metadata:{json_array_of_sources}"
   → Then: "data:{token}" for each generated token
   → On error: "error:{message}"
```

### Persona System Prompts

Each persona injects a different instruction block:

**Professional:**
> "Respond in a formal, concise manner. Use clear structure with headers. Avoid colloquialisms."

**ELI5:**
> "Explain as if talking to a 5-year-old. Use simple words, analogies, and short sentences."

**Developer:**
> "Prioritize code examples, technical precision, and implementation details. Use markdown code blocks."

**Academic:**
> "Use scholarly language. Cite sources explicitly. Structure with Introduction, Analysis, Conclusion."

---

## 10. Scenario 6 — Knowledge Graph Visualization

### What the User Sees

A force-directed interactive graph where:
- **Nodes** = each unique ingested source
- **Edges** = relationships between sources (same repo, same folder, same type)
- Node **size** = number of chunks (more content = bigger node)
- Node **color** = source type (different color per type: pdf/website/github/etc.)

### Backend: `GET /api/v1/knowledge-graph`

**Graph Construction Algorithm:**

**1. Build Nodes:**
```
For each unique source_url in user's metadata:
  → node.id = sequential index
  → node.label = filename or last URL segment
  → node.type = source_type
  → node.chunks = count of chunks from this source
  → node.size = clamp(chunks * 1.5, 3, 30)
  → node.repo = github repo name (if github type)
  → node.folder = folder_name (if file with folder)
```

**2. Build Edges (Relationship Rules):**

| Rule | Condition | Edge Weight |
|---|---|---|
| `same_repo` | Both nodes from same GitHub repo | 0.9 |
| `same_folder` | Both nodes from same upload folder | 0.8 |
| `same_type` | Both nodes are same source type | 0.3 |

- Same repo: max 8 edges per node
- Same folder: max 8 edges per node
- Same type: only added if total nodes ≤ 15, max 4 per node (prevents clutter)

**3. Stats Returned:**
- `total_nodes`, `total_edges`, `total_chunks`
- `type_distribution`: `{ "pdf": 3, "github": 1, "youtube": 2 }`
- `most_connected`: node with most edges

### Frontend Physics Simulation (`app/knowledge-graph/page.tsx`)

Uses a **custom Canvas-based physics simulation** (not a library):

```
Forces applied each animation frame:
  - Repulsion: F = 3000 / dist²  (nodes push each other apart)
  - Attraction: F along edges, proportional to edge weight
  - Center Pull: gentle force toward canvas center (keeps graph on screen)
  - Damping: velocity *= 0.85 (slows down over time → stabilizes)

Rendering: requestAnimationFrame loop (60FPS target)
Interactions: pan (mousedown+drag), zoom (scroll wheel), node drag
```

Node tooltip on hover shows: title, type, chunk count, source URL.

---

## 11. Scenario 7 — Analytics Page

### What the User Sees

`/analytics` — Summary statistics for the entire knowledge base.

### Data Displayed

**Summary Cards:**
- Total Sources (all ingested items)
- Total Documents (PDF/DOCX/PPTX/TXT)
- Total Websites
- Total Videos (YouTube)
- Total Repositories (GitHub)
- Total Social (Instagram)

**Distribution Chart:**
- Bar or pie chart showing breakdown by type
- Uses Recharts library

**Recent Activity Feed:**
- Last 50 ingested sources
- Shows: icon (by type), title, source URL, relative time ("2 hours ago")
- Sorted by `ingested_at` descending

### Data Source

Analytics reads directly from the FAISS metadata pickle file — it groups by `source_url` to count unique sources, then further groups by `source_type` for distribution.

No separate analytics database — it's derived from the vector store metadata.

---

## 12. Scenario 8 — Summarization Feature

### What the User Does

On the Dashboard, hover a source card → click **"Summarize"** button.

### API Call

```http
POST /api/v1/summary
Authorization: Bearer <token>
Content-Type: application/json

{
  "source_url": "https://github.com/owner/repo"
}
```

### Backend (`api/endpoints/summary.py`)

1. Fetches all chunks for the given `source_url` from metadata store
2. Concatenates chunk texts (truncated to fit LLM context window)
3. Sends to `LLMService.generate_content()`:
   ```
   Prompt: "Summarize the following document in 3-5 bullet points.
   Focus on the key ideas, main topics, and important facts.
   Document: {content}"
   ```
4. Returns markdown-formatted summary

### Frontend

Summary shown in a dialog/modal overlay on the source card.
Uses the `react-markdown` renderer for formatting.

---

## 13. Scenario 9 — Deleting Sources

### Single Delete

Click the delete (trash) icon on a source card.

```http
DELETE /api/v1/ingestion/sources
Authorization: Bearer <token>
Content-Type: application/json

{
  "source_url": "https://example.com/document.pdf"
}
```

Backend:
1. Finds all FAISS vector IDs where `metadata[i].source_url == source_url AND metadata[i].user_id == current_user.id`
2. Removes those vectors from FAISS index
3. Removes those entries from metadata pickle
4. Saves updated index + metadata to disk
5. If it was an uploaded file: deletes from `data/storage/`

### Bulk Delete

Multi-select sources (checkboxes appear on hover) → "Delete Selected" button.

```http
POST /api/v1/ingestion/sources/bulk-delete
Authorization: Bearer <token>
Content-Type: application/json

{
  "source_urls": ["url1", "url2", "url3"]
}
```

Processes each URL in sequence, same logic as single delete.

---

## 14. Scenario 10 — Command Palette (Ctrl+K)

### Trigger

Press `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac) from any page.

### `CommandPalette.tsx`

**Search Results — 3 categories:**

1. **Navigation** — Dashboard, Chat, Knowledge Graph, Analytics
2. **Actions** — Toggle Theme, Logout
3. **Recently Ingested Sources** — Last 10 sources, fetched from `/api/v1/ingestion/sources`

**Behavior:**
- Type to filter across all 3 categories simultaneously
- Arrow keys navigate results
- `Enter` executes the action
- `Escape` closes palette
- Clicking outside closes palette

**Implementation:**
```typescript
// Global keyboard listener in layout.tsx
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    setCommandPaletteOpen(true);
  }
});
```

---

## 15. Full Backend API Reference

### Base URL: `http://localhost:8090`

### Authentication

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | No | `form: username, password` | `{ access_token, token_type }` |

### Users

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/v1/users/open` | No | `{ email, password, full_name? }` | User object |
| `GET` | `/api/v1/users/me` | Yes | — | Current user |
| `PUT` | `/api/v1/users/me` | Yes | `{ full_name?, password? }` | Updated user |
| `GET` | `/api/v1/users/` | Admin | — | All users list |

### Ingestion

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/v1/ingestion/upload` | Yes | `multipart: files[], folder_name?` | Task status array |
| `POST` | `/api/v1/ingestion/url` | Yes | `{ url, source_type, depth? }` | Task status |
| `GET` | `/api/v1/ingestion/sources` | Yes | — | User's sources list |
| `POST` | `/api/v1/ingestion/content` | Yes | `{ source_url }` | Raw text content |
| `DELETE` | `/api/v1/ingestion/sources` | Yes | `{ source_url }` | `{ message: "deleted" }` |
| `POST` | `/api/v1/ingestion/sources/bulk-delete` | Yes | `{ source_urls: [] }` | `{ deleted: N }` |
| `GET` | `/api/v1/ingestion/tasks` | Yes | — | Active task states |
| `POST` | `/api/v1/ingestion/tasks/clear-failed` | Yes | `{ task_id }` | `{ message }` |

### Chat

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/v1/chat/` | Yes | `{ query, history?, persona?, source_filter?, web_search? }` | `{ response, sources }` |
| `POST` | `/api/v1/chat/stream` | Yes | Same as above | SSE stream |

### Search

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/v1/search/` | Yes | `{ query, k? }` | `[{ id, score, metadata, rerank_score }]` |

### Summary & Graph

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/v1/summary/` | Yes | `{ source_url }` | `{ summary: string }` |
| `GET` | `/api/v1/knowledge-graph/` | Yes | — | `{ nodes, edges, stats }` |

### System

| Method | Path | Auth | Returns |
|---|---|---|---|
| `GET` | `/` | No | Welcome message |
| `GET` | `/health` | No | `{ status: "healthy" }` |
| `GET` | `/api/v1/files/{filename}` | No | File bytes |

---

## 16. Data Processing Pipeline (Deep Dive)

### Full Ingestion Pipeline Flow

```
RAW INPUT (file bytes or URL)
        │
        ▼
┌─────────────────┐
│   EXTRACTION    │  Type-specific ingestor reads raw content
│  (Ingestor)     │  Output: List[Document(text, metadata)]
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    CLEANING     │  DataCleaner.clean(text, is_code)
│  (DataCleaner)  │  - Prose: collapse whitespace, strip HTML
└────────┬────────┘  - Code: preserve indentation, remove excess blank lines
         │
         ▼
┌─────────────────┐
│    CHUNKING     │  Chunker.chunk(documents)
│   (Chunker)     │  800 tok chunks, 150 tok overlap
└────────┬────────┘  Injects metadata per chunk
         │
         ▼
┌─────────────────┐
│   EMBEDDING     │  EmbeddingService.embed(texts)
│ (SentenceTrans) │  → 384-dim float32 vectors
└────────┬────────┘  Batch processing
         │
         ▼
┌─────────────────┐
│  VECTOR STORE   │  VectorDB.add(vectors, metadata_list)
│   (FAISS)       │  IndexFlatL2.add(vectors)
└────────┬────────┘  metadata.pkl append + save
         │
         ▼
    TASK COMPLETE
```

### Chunking Token Calculation

The chunker uses character approximation:
- ~4 characters per token (standard approximation)
- 800 tokens ≈ 3200 characters max chunk size
- 150 tokens ≈ 600 characters overlap between adjacent chunks

Overlap ensures that concepts spanning a chunk boundary are retrievable from either chunk.

### Embedding Model Details

**`all-MiniLM-L6-v2`** (default, local):
- Architecture: 6-layer MiniLM (distilled from BERT)
- Output: 384-dimensional L2-normalized vectors
- Speed: ~10,000 sentences/second on CPU
- Memory: ~80MB model size
- No internet required after first download

---

## 17. RAG & LLM Layer (Deep Dive)

### Search & Retrieval Pipeline

```
USER QUERY STRING
        │
        ▼
Embed query → 384-dim vector
        │
        ▼
FAISS IndexFlatL2.search(query_vector, k=200)
  → Returns (distances, indices) for 200 nearest neighbors
        │
        ▼
Filter: keep only indices where metadata[i].user_id == current_user
        │
        ▼
Source Filter (if selected):
  → keep only indices where metadata[i].source_url in filter_list
        │
        ▼
CrossEncoder reranking:
  → Score each (query, chunk_text) pair with ms-marco-MiniLM-L-6-v2
  → Higher score = more relevant
        │
        ▼
Source Diversity sort:
  → Interleave results from different source_urls
  → Prevents one large document dominating all results
        │
        ▼
Return top 20 chunks (or 15 if source_filter active)
```

### Why L2 Distance + Reranking?

- **FAISS L2** is fast but imprecise (captures semantic similarity at scale)
- **CrossEncoder** is slow but precise (reads query + passage together)
- Two-stage approach: FAISS casts a wide net (200 candidates), CrossEncoder picks the best 20

### LLM Prompt Structure

```
[SYSTEM - Persona Instructions]
You are a knowledge assistant. Respond in {persona} style.

[KNOWLEDGE BASE OVERVIEW]
The user has the following documents available:
- {source_1_title} ({source_1_type})
- {source_2_title} ...

[RETRIEVED CONTEXT]
[Source 1: document_title.pdf]
{chunk_text_1}

[Source 2: github_repo/file.py]
{chunk_text_2}
...

[WEB SEARCH RESULTS] (if enabled)
Title: {web_result_title}
URL: {web_result_url}
Content: {web_result_content}
...

[CONVERSATION HISTORY]
User: {previous_question}
Assistant: {previous_answer}
...

[CURRENT QUESTION]
{user_query}

IMPORTANT: Base your answer ONLY on the context provided above.
If the information is not in the context, say so clearly.
```

### Streaming SSE Protocol

Backend uses FastAPI `StreamingResponse` with `text/event-stream`:

```
→ Server sends: metadata:{"sources":[{"title":"...","url":"...","type":"..."}]}
→ Server sends: data:The
→ Server sends: data: quick
→ Server sends: data: brown
→ Server sends: data: fox
→ [stream ends]
```

Frontend reads line by line, strips prefix, appends to message state.

---

## 18. Frontend Architecture (Deep Dive)

### State Management Pattern

No Redux or Context API — state lives in individual page components:

```typescript
// Dashboard page state
const [sources, setSources] = useState<Source[]>([]);
const [tasks, setTasks] = useState<Task[]>([]);
const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
const [filterType, setFilterType] = useState<string>('all');
const [searchQuery, setSearchQuery] = useState('');
const [sortMode, setSortMode] = useState(() => localStorage.getItem('sortMode') || 'newest');
```

### Authentication in Every Component

```typescript
// Pattern used in every protected page
useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) {
    router.push('/login');
    return;
  }
  fetchData(token);
}, []);

const getToken = () => localStorage.getItem('token') ?? '';
```

### Source Grouping Logic (Dashboard)

The dashboard automatically groups sources:

```typescript
function groupSources(sources: Source[]) {
  const groups: Group[] = [];

  // GitHub repos: group by metadata.repo
  const repos = [...new Set(sources.filter(s => s.type === 'github').map(s => s.repo))];
  repos.forEach(repo => groups.push({ type: 'repo', name: repo, items: [...] }));

  // Upload folders: group by metadata.folder_name
  const folders = [...new Set(sources.filter(s => s.folder_name).map(s => s.folder_name))];
  folders.forEach(folder => groups.push({ type: 'folder', name: folder, items: [...] }));

  // Websites: group by domain
  const domains = [...new Set(sources.filter(s => s.type === 'website').map(s => new URL(s.url).hostname))];
  domains.forEach(domain => groups.push({ type: 'domain', name: domain, items: [...] }));

  // Ungrouped: everything else
  const ungrouped = sources.filter(s => !s.repo && !s.folder_name && s.type !== 'website');
  groups.push({ type: 'ungrouped', items: ungrouped });

  return groups;
}
```

### Theme System

```typescript
// In Sidebar.tsx
const toggleTheme = () => {
  const newTheme = theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  localStorage.setItem('theme', newTheme);
  document.documentElement.classList.toggle('dark', newTheme === 'dark');
};

// On page load (layout.tsx)
const savedTheme = localStorage.getItem('theme') ?? 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');
```

---

## 19. How Everything Connects — Master Data Flow

### From Raw Data to AI Answer — Complete End-to-End

```
USER uploads PDF "research_paper.pdf"
         │
         ▼
[Browser] MultiFileUpload.tsx
  → POST /api/v1/ingestion/upload (multipart)
         │
         ▼
[FastAPI] ingestion.py endpoint
  → Save to data/storage/uuid_research_paper.pdf
  → Create Celery task
         │
         ▼
[Celery Worker] pipeline.py
  → PDFIngestor: extract 40 pages of text
  → DataCleaner: normalize whitespace
  → Chunker: split into ~25 chunks (800 tokens each)
  → EmbeddingService: generate 25 × 384-dim vectors
  → VectorDB: append to FAISS + metadata.pkl
  → Task status: "completed"
         │
         ▼
[Browser] Dashboard polls /tasks every 3s
  → Sees "completed" → refreshes source grid
  → Source "research_paper.pdf" appears in grid
         │
         ▼
USER goes to /chat, types: "What are the key findings?"
         │
         ▼
[Browser] chat/page.tsx handleSubmit()
  → POST /api/v1/chat/stream (JSON)
         │
         ▼
[FastAPI] chat.py stream endpoint
  → SearchService: embed query → FAISS search → rerank → get 20 best chunks from PDF
  → LLMService: build prompt with persona + context + question
  → Groq API: stream llama-3.3-70b response
  → SSE stream: metadata:{sources} + data:{tokens}...
         │
         ▼
[Browser] ReadableStream reader
  → Parses metadata → shows "Source: research_paper.pdf" citation
  → Appends tokens → shows ChatGPT-style typing effect
  → Stream ends → final answer displayed with source citations
```

### Multi-Tenancy Isolation

Every stored chunk has `user_id` in metadata. Every FAISS search result is filtered:

```python
results = [r for r in raw_results if metadata[r.id].user_id == current_user.id]
```

User A can never see User B's documents — enforced at both retrieval and delete operations.

### Error Handling Cascade

```
LLM Failure:
  Groq API error → try Gemini API → if both fail → return error message

Ingestion Failure:
  Primary ingestor fails → try fallback (e.g., playwright for websites/instagram)
  → If all fail → task state = "failed" with error message

Vector Search Failure:
  No relevant chunks found → proceed with just web search (if enabled)
  → If web search disabled too → LLM answers from its training data with disclaimer
```

---

*This document covers the complete LinkPulse system as of April 2026. For individual component details, see `backend/BACKEND_TECHNICAL_DETAILS.md` and `frontend/FRONTEND_TECHNICAL_DETAILS.md`.*
