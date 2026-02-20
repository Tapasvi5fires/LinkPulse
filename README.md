# ⚡ LinkPulse: Autonomous Web-to-Knowledge AI Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
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
- **Document Processing**: Deep parsing of PDFs, Docx, TXT, and Markdown.
- **GitHub Integration**: Ingest entire repositories or specific directories with full file-tree awareness.
- **Web Crawling**: Deep-crawl websites and convert pages into clean, searchable knowledge chunks.

### 🎨 Premium UI/UX (Luxury Experience)
- **Universal Card Expansion**: Every source card features an internal detailed view with high-precision scrollers.
- **Command Palette (CMD+K)**: A global, lightning-fast navigation and action hub.
- **Floating Selection Bar**: Bulk-manage ingestions with a sleek, interactive selection interface.
- **Search-in-Card**: Real-time filtering within expanded repository and website groups.
- **Ingestion Pulse**: Live micro-animations for real-time processing feedback.

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | Next.js 14, React, Tailwind CSS |
| **Backend** | Python 3.10+, FastAPI |
| **Vector Engine** | Pinecone / FAISS / ChromaDB |
| **AI Processing** | OpenAI / Anthropic / LangChain |
| **Search API** | Tavily AI |
| **UI Components** | Radix UI, Lucide React, Framer Motion |

---

## 🚀 Quick Start

### 1. Clone & Set Environment
```bash
git clone https://github.com/Tapasvi5fires/LINKPULSE.git
cd LINKPULSE
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

---

## 📁 Project Structure

```text
LINKPULSE/
├── backend/            # FastAPI Engine & RAG Pipeline
├── frontend/           # Next.js Dashboard & Chat UI
├── docker-compose.yml  # Containerized Deployment
└── .gitignore          # Production-ready exclusions
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built with ❤️ by [Tapasvi5fires](https://github.com/Tapasvi5fires)*
