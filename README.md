# ⚡ LinkPulse: Autonomous Web-to-Knowledge AI Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Qdrant](https://img.shields.io/badge/Vector%20DB-Qdrant-red?style=for-the-badge&logo=qdrant)](https://qdrant.tech/)
[![Docker](https://img.shields.io/badge/Deployment-Docker-blue?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

LinkPulse is a production-grade, multi-agent AI engine designed to bridge the gap between fragmented web data and actionable private knowledge. It autonomously ingests, processes, and synthesizes information from diverse sources into a unified, ultra-fast RAG (Retrieval-Augmented Generation) pipeline.

---

## ✨ Core Features

### 🔍 Hybrid Intelli-Search
- **Unified Retrieval**: Combines live web search results (via Tavily) with your private knowledge base.
- **Context Synthesis**: LLM-driven responses that cite both internal documents and real-time web data.
- **Smart Toggle**: Instantly switch between "Knowledge Only" and "Hybrid" search modes.

### 📥 Universal Data Ingestion
- **YouTube Intelligence**: Automatic transcript extraction and summarization.
- **Document Processing**: Deep parsing of PDFs (with OCR), Docx, Pptx, TXT, and Markdown.
- **Instagram Ingestion**: Scrape and index Instagram profiles and posts.
- **GitHub Integration**: Ingest entire repositories or specific directories with full file-tree awareness.
- **Web Crawling**: Deep-crawl websites and convert pages into clean, searchable knowledge chunks using Playwright and Trafilatura.

### 🎨 Premium UI/UX (Luxury Experience)
- **Knowledge Graph**: Interactive 2D visualization of your knowledge base using `react-force-graph-2d`.
- **Universal Card Expansion**: Every source card features an internal detailed view with high-precision scrollers.
- **Command Palette (CMD+K)**: A global, lightning-fast navigation and action hub.
- **Floating Selection Bar**: Bulk-manage ingestions with a sleek, interactive selection interface.
- **Search-in-Card**: Real-time filtering within expanded repository and website groups.
- **Ingestion Pulse**: Live micro-animations for real-time processing feedback.

---

## 🧠 Gen AI & RAG Architecture

### 🛡️ Intelligent Retrieval
LinkPulse uses a multi-stage retrieval pipeline to ensure maximum precision:
1.  **Vector Search**: High-dimensional semantic search using **Qdrant**.
2.  **Hybrid Search**: Combining dense vector embeddings with **BM25** lexical search.
3.  **Cross-Encoder Reranking**: Re-evaluating top candidates using `ms-marco-MiniLM-L-6-v2` for high-precision context selection.
4.  **Autonomous Research**: Generating multiple search trajectories (Tavily) to retrieve live web data.

### ✍️ Prompt Engineering & Personas
Dynamic system instructions tailor the AI's response to your needs:
- **Professional**: Balanced, thorough, and business-oriented.
- **Developer**: Technical, precise, with code snippets and architecture focus.
- **ELI5**: Simple language, analogies, and emojis.
- **Academic**: Formal, rigorously cited, and analytical.

### 🔗 Knowledge Synthesis
- **Conflict Resolution**: Highlights contradictions between internal documents and live web data.
- **Source Citation**: Automatic inline citations for both internal (`Internal: Doc Name`) and web (`[🌐 Page Title](URL)`) sources.

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Framer Motion, Recharts |
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy (PostgreSQL), Alembic |
| **Vector Engine** | **Qdrant** (Vector Database) |
| **Task Queue** | **Celery** + **Redis** (Asynchronous processing) |
| **AI Models** | **Gemini 2.0 Flash**, **Groq (Llama 3.3 70B)**, LangChain |
| **Embeddings** | HuggingFace Sentence Transformers |
| **Search API** | Tavily AI |
| **Web Scraping** | Playwright, Trafilatura, BeautifulSoup4 |
| **Auth** | OAuth 2.0 (Google, GitHub) |

---

## 🚀 Quick Start

### 1. Clone & Set Environment
```bash
git clone https://github.com/Tapasvi5fires/LINKPULSE.git
cd LINKPULSE
cp .env.example .env  # Update your API keys!
```

### 2. Choose Your Deployment Path

LinkPulse is designed for flexibility. You can deploy it using **Docker** (recommended for production/full stack) or via **Manual Setup** for local development.

#### 🐳 Option A: Docker Deployment (Recommended)
LinkPulse is fully **Docker-compatible** and optimized for containerized environments.

```bash
# Standard Deployment
docker compose up -d --build

# CPU Optimized (Lightning fast builds, no GPU binaries)
docker compose -f docker-compose.local.yml up -d --build
```

#### 🐍 Option B: Manual Setup (Local Development)
Ideal for working on specific services without the overhead of containers.

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
# Ensure Postgres, Redis, and Qdrant are running locally
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

**Frontend Setup:**
```bash
cd ../frontend
npm install
npm run dev # Runs on port 3090
```

---

## 🛠️ Infrastructure Orchestration
The following services are managed via `docker-compose.yml` but can also be connected to manually:
- **PostgreSQL**: Persistent relational storage (Port 5440).
- **Redis**: High-speed message broker for Celery tasks (Port 6380).
- **Qdrant**: High-performance vector database (Port 6334).
- **FastAPI**: The core AI engine and API gateway (Port 8090).
- **Next.js**: The luxury dashboard and chat interface (Port 3090).

---

## 🌐 Networking & Infrastructure

LinkPulse uses a dedicated Docker network (`linkpulse-network`) to orchestrate its services:

| Service | Internal Port | External Port | Description |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | 5432 | **5440** | Primary database |
| **Redis** | 6379 | **6380** | Celery broker & cache |
| **Qdrant** | 6333 | **6334** | Vector storage |
| **Backend** | 8000 | **8090** | FastAPI Engine |
| **Frontend** | 3000 | **3090** | Next.js Dashboard |

---

## 📁 Project Structure

```text
LINKPULSE/
├── backend/                # FastAPI Engine & RAG Pipeline
│   ├── app/
│   │   ├── api/            # Endpoints (Chat, Ingestion, OAuth)
│   │   ├── services/       # Core Logic (LLM, Retrieval, Ingestion)
│   │   └── models/         # Database Schemas
│   ├── Dockerfile          # Standard Docker Image
│   └── Dockerfile.local    # CPU-optimized Image
├── frontend/               # Next.js Dashboard & Chat UI
├── docker-compose.yml      # Multi-service Orchestration
└── .env                    # Environment Configuration
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built with ❤️ by [Tapasvi5fires](https://github.com/Tapasvi5fires)*
*Paper: [https://zenodo.org/records/19138712](https://zenodo.org/records/19138712)*
