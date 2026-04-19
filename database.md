# LinkPulse Database Architecture

LinkPulse uses a multi-layered storage strategy to handle structured user data, high-performance background tasks, and unstructured AI knowledge.

## 1. PostgreSQL (Structured Data)
The primary relational database handles application state, user accounts, and audit trails.

### Tables

#### `users`
Managed in: [user.py](file:///d:/PERSONEL%20PROJECTS/LINKPULSE_MAJOR_PROJECT/backend/app/models/user.py)
Stores core user information and permissions.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer (PK) | Unique user identifier. |
| `email` | String (Unique) | User's email address (login primary key). |
| `hashed_password` | String | PBKDF2-hashed password. |
| `full_name` | String | Display name. |
| `is_active` | Boolean | Account status (True/False). |
| `is_superuser` | Boolean | Administrative privilege flag. |
| `created_at` | DateTime | Account creation timestamp. |

#### `audit_logs`
Managed in: [audit.py](file:///d:/PERSONEL%20PROJECTS/LINKPULSE_MAJOR_PROJECT/backend/app/models/audit.py)
Tracks system-wide actions for security and debugging.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer (PK) | Unique log identifier. |
| `user_id` | Integer (FK) | Reference to the user who performed the action. |
| `action` | String | Name of the action (e.g., `LOGIN`, `INGEST`). |
| `resource` | String | Target of the action (e.g., a specific URL or file). |
| `details` | Text | JSON or raw text details about the action. |
| `created_at` | DateTime | Timestamp of the event. |

---

## 2. Redis (Job Queue & State)
Redis acts as the central nervous system for LinkPulse's background ingestion pipeline.

*   **Role**: Message Broker & Result Backend for **Celery**.
*   **Usage**: 
    1.  **Ingestion Queue**: When you click "Add Source", the task is pushed to Redis.
    2.  **Tracking**: In-progress ingestion states and status updates are polled from Redis/Celery.
    3.  **Caching**: Temporary state for ongoing AI streams.

---

## 3. Vector Database (AI Knowledge)
LinkPulse uses an "At-Rest" vector storage system for ultra-fast RAG (Retrieval-Augmented Generation).

Managed in: [vector_db.py](file:///d:/PERSONEL%20PROJECTS/LINKPULSE_MAJOR_PROJECT/backend/app/services/processing/vector_db.py)

### Physical Storage
Stored locally in the `backend/data/` directory:
- `faiss_index.bin`: A binary **FAISS Index** containing high-dimensional embeddings (384 dimensions).
- `metadata.pkl`: A Python **Pickle** file mapping vector IDs to their rich metadata (text, source URL, user ownership).

### Metadata Schema
Each entry in the vector database contains:
- `user_id`: Ownership for security (isolation).
- `source_url`: The origin URL or file path.
- `source_type`: (website, github, pdf, etc.)
- `text`: The actual text content chunk.
- `chunk_index`: Position of the chunk in the original document.

---

## 4. Role-Based Access Control (RBAC)
LinkPulse implements RBAC via FastAPI dependencies.

*   **Logic Location**: `backend/app/api/deps.py`
*   **Mechanisms**:
    1.  **Standard User**: Verified via JWT token; can only access resources where `user_id` matches their own in PostgreSQL and the Vector DB.
    2.  **Superuser**: Can bypass ownership checks for system-wide analytics and auditing.
    3.  **Active Check**: Every request verifies `is_active`. If set to `False`, all access is immediately revoked.

---

## 5. File Storage
*   **Persistent Storage**: `backend/data/storage/` (Permanently stored PDFs/Files).
*   **Temporary Uploads**: `backend/data/uploads/` (Cleaned up after ingestion).
