# Local Development Setup for LinkPulse

This guide helps you run LinkPulse locally with unique ports to avoid conflicts with your other projects.

## 🚀 Option 1: Docker (Recommended)

This is the easiest way to run the entire stack (Postgres, Redis, Backend, Frontend) with a single command.

### 1. Configure Ports
Open `.env` in the root directory and set your desired ports:
```ini
BACKEND_PORT=8090   # Change if needed, e.g., 8005
FRONTEND_PORT=3090  # Change if needed, e.g., 3005
```

### 2. Start the App
Run the start script:
```bash
./start_linkpulse.bat
```
Or manually:
```bash
docker-compose up --build
```

---

## 💻 Option 2: No Docker (Manual Mode)

Use this if you want to run everything on your local machine.

### Prerequisites (CRITICAL)
1.  **PostgreSQL**: Must be running on `localhost:5432` (database: `linkpulse`, user/pass: `postgres`).
2.  **Redis**: Must be running on `localhost:6379`.
3.  **Python 3.10+** & **Node.js 18+**.

### Quick Start (Hybrid Mode)
1. **Start Infrastructure (Postgres + Redis)** via Docker:
   ```bash
   ./start_infrastructure.bat
   ```
   *(This ensures the database runs on the correct port `5440`)*

2. **Start App (Backend + Frontend)** manually:
   ```bash
   ./start_manual.bat
   ```
*Note: You must still install dependencies first (see below).*

### Manual Setup Steps
If the script doesn't work, follow these steps:

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Run migrations (if needed)
# alembic upgrade head 

# Start Server on a specific port (e.g., 8090)
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Update .env.local if needed to point to your backend port
# echo "NEXT_PUBLIC_API_URL=http://localhost:8090" > .env.local

# Start Client on a specific port (e.g., 3090)
npm run dev -- -p 3090
```
