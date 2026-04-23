# LinkPulse Hybrid Cloud Deployment Guide 🚀

This guide provides step-by-step instructions for deploying LinkPulse to a production-grade hybrid cloud environment using free-tier services.

## 🏗️ Architecture Overview
- **Frontend**: Vercel (Next.js)
- **Backend (API)**: Render (FastAPI)
- **Worker**: Render (Celery)
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage (Private Bucket)
- **Task Broker/State**: Upstash (Redis)
- **Vector Database**: Qdrant Cloud

---

## 🛰️ Step 1: Provision Infrastructure (The "Cloud Backbone")

### 1. Supabase (Postgres & Storage)
1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **Storage** -> **New Bucket**.
3. **Name**: `linkpulse-storage`
4. **Public**: ❌ **OFF** (Keep it private for security).
5. Go to **Project Settings** -> **Database** and copy the **Transaction Connection String** (use the one ending in `:5432/postgres`).
6. Go to **Project Settings** -> **API** and copy the `URL` and `service_role` key (this is your `SUPABASE_KEY`).

### 2. Upstash (Redis)
1. Create a new Redis database at [upstash.com](https://upstash.com).
2. Select the region closest to your Render deployment (e.g., us-east-1).
3. Copy the **REST URL** or the **Node.js connection string**. You need the one starting with `rediss://`.

### 3. Qdrant Cloud (Vector DB)
1. Create a free cluster at [qdrant.tech](https://qdrant.tech).
2. Copy the **Cluster URL** (e.g., `https://xxx.qdrant.io`).
3. Generate an **API Key** and copy it.

---

## 🚀 Step 2: Deploy Backend & Worker (Render)

### 1. Create the Backend Service
1. Connect your GitHub repo to [Render](https://render.com).
2. Create a **Web Service**.
3. **Root Directory**: `backend`
4. **Runtime**: `Python 3`
5. **Build Command**: `pip install -r requirements.txt`
6. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
7. **Environment Variables**: (See Step 3)

### 2. Create the Worker Service
1. Create a **Background Worker** on Render.
2. Use the same GitHub repo and same `backend` root directory.
3. **Start Command**: `celery -A app.core.celery_app worker --loglevel=info --concurrency=1`
   - *Note: We use `--concurrency=1` to stay within Upstash connection limits.*
4. **Environment Variables**: (Use the same as Backend)

---

## 🖥️ Step 3: Deploy Frontend (Vercel)

1. Connect your repo to [Vercel](https://vercel.com).
2. **Root Directory**: `frontend`
3. **Framework Preset**: `Next.js`
4. **Environment Variable**:
   - `NEXT_PUBLIC_API_URL`: Your Render Backend URL (e.g., `https://linkpulse-backend.onrender.com`)

---

## 🔑 Step 4: Environment Variables Checklist

Add these to your **Render** and **Vercel** dashboards:

| Variable | Source | Note |
| :--- | :--- | :--- |
| `DATABASE_URL` | Supabase | Use `postgresql+asyncpg://...` |
| `REDIS_URL` | Upstash | Must start with `rediss://` |
| `CELERY_BROKER_URL` | Upstash | Same as `REDIS_URL` |
| `CELERY_RESULT_BACKEND`| Upstash | Same as `REDIS_URL` |
| `STORAGE_BACKEND` | - | Set to `supabase` |
| `SUPABASE_URL` | Supabase | Your project URL |
| `SUPABASE_KEY` | Supabase | Use the **service_role** key |
| `STORAGE_BUCKET` | Supabase | `linkpulse-storage` |
| `QDRANT_URL` | Qdrant | Your cluster URL |
| `QDRANT_API_KEY` | Qdrant | Your API Key |
| `GEMINI_API_KEY` | Google | For AI features |
| `SECRET_KEY` | - | Generate a random string |

---

## 🛡️ Security & Reliability Features Implemented
- **Signed URLs**: All your files are private. The backend generates temporary links that expire in 1 hour.
- **Cold Start Resilience**: The frontend automatically retries requests if the backend is "sleeping" (common on Render free tier).
- **Task Persistence**: If the worker restarts, it picks up pending tasks from Upstash Redis.
- **Idempotency**: Re-ingesting a file automatically clears old vector chunks, so you never get duplicate answers.

---

## ✅ Final Check
Once everything is deployed:
1. Try uploading a PDF. 
2. Wait for the "Processing" status to turn into "Completed".
3. Check the "Sources" tab — the "View" button should generate a secure signed link to your file in Supabase.
4. Try a Chat query to ensure the RAG pipeline is connected to Qdrant Cloud.
