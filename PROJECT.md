# Project: ThirdEye Production Upgrade & AI Insights Engine

## Architecture
ThirdEye is a modern product analytics and session recording platform with a FastAPI backend (`apps/api/`) and a Next.js web application (`apps/web/`).

### Subsystem Boundaries & Data Flow
1. **Database Layer (`apps/api/app/database.py`, `models.py`)**:
   - PostgreSQL 15 database instance storing multi-tenant analytics data.
   - Declarative Base with 6 models: `Organization`, `User`, `Project`, `Connector`, `Event`, `SessionRecording`.
   - Multi-tenant boundary anchored on `Organization.id`. All projects, users, events, and session recordings are strictly scoped to the tenant organization.
2. **AI Insights Engine (`apps/api/app/api/ai.py`, `services/ai_service.py`, `schemas/ai.py`)**:
   - Endpoint: `POST /api/v1/ai/query` (alias `POST /api/v1/ai/insights`).
   - Translates natural language questions to read-only PostgreSQL queries using Google Gemini API (`google-genai` / `google-generativeai`).
   - 5-stage defense-in-depth pipeline: schema introspection -> deterministic SQL generation -> AST & keyword safety validation (SELECT/WITH only, `:org_id` mandatory check, forbidden keyword blacklist) -> read-only PostgreSQL execution (`SET TRANSACTION READ ONLY`) -> plain-English insight synthesis.
   - Deterministic offline mock fallback for automated test runs without external API keys.
3. **Container Infrastructure (`apps/api/Dockerfile`, `.dockerignore`)**:
   - Production multi-stage Dockerfile based on `python:3.11-slim-bookworm`.
   - Builder stage creates clean virtual environment `/opt/venv` with pre-compiled wheels.
   - Runner stage runs as unprivileged non-root user `thirdeye` (UID 10001) with pre-created storage directories and healthcheck.
   - `.dockerignore` prevents leakage of Windows `venv/`, local SQLite files, and recording binaries.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dynamic DB URL & Pooling | Update `database.py` to read `DATABASE_URL`, configure Postgres connection pooling, remove SQLite-only `check_same_thread`. | M1 | Survey (explorer 1) |
| 2 | PostgreSQL Schema Compatibility | Ensure all 6 SQLAlchemy models compile cleanly into PostgreSQL DDL via `Base.metadata.create_all()`. | M1 | Survey (explorer 1) |
| 3 | SQLite Guards in main.py | Guard SQLite-specific triggers and view setup in `apps/api/app/main.py` so they only execute when dialect is SQLite. | M1 | Survey (explorer 1) |
| 4 | Postgres Migration Test Script | Create `test_postgres_migration.py` verifying connection, `create_all()`, mock `Organization` and `User` creation and retrieval. | M1 | Survey (explorer 1 & 3) |
| 5 | AI Query Request/Response Schemas | Create `apps/api/app/schemas/ai.py` with `AIQueryRequest` and `AIQueryResponse`. | M2 | Survey (explorer 2) |
| 6 | Gemini Text-to-SQL Service | Create `apps/api/app/services/ai_service.py` with schema prompt generator, Gemini client, deterministic mock fallback, and insight generator. | M2 | Survey (explorer 2) |
| 7 | Multi-Layer SQL Safety Validation | Implement AST/token safety check enforcing single statement, SELECT/WITH only, keyword blacklist, and mandatory `:org_id` scoping. | M2 | Survey (explorer 2) |
| 8 | Read-Only PostgreSQL Query Execution | Execute validated SQL within a read-only transaction (`SET TRANSACTION READ ONLY`) with row limits and timeout. | M2 | Survey (explorer 2) |
| 9 | AI Insights FastAPI Router | Create `apps/api/app/api/ai.py` mounted at `POST /api/v1/ai/query` with auth and tenant injection. | M2 | Survey (explorer 2) |
| 10 | AI Programmatic Verification Script | Create `test_ai.py` sending natural language queries, asserting JSON insight, testing tenant isolation, and asserting prompt injection defense. | M2 | Survey (explorer 2) |
| 11 | Backend `.dockerignore` | Create `apps/api/.dockerignore` excluding `venv/`, `thirdeye.db`, `storage/recordings/*`, and caches. | M3 | Survey (explorer 3) |
| 12 | Complete `requirements.txt` | Update `apps/api/requirements.txt` with all runtime dependencies (`google-genai`, `python-jose`, `passlib`, `bcrypt`, `python-multipart`, etc.). | M3 | Survey (explorer 3) |
| 13 | Multi-Stage Backend Dockerfile | Overhaul `apps/api/Dockerfile` with 2-stage build, non-root user `thirdeye`, healthcheck, and AWS-ready production configuration. | M3 | Survey (explorer 3) |
| 14 | Docker Image Build & Smoke Test | Verify `docker build -t thirdeye-api apps/api` completes cleanly and container runs successfully. | M3 | Survey (explorer 3) |
| 15 | Integrated Acceptance Verification | End-to-end execution of all verification criteria across PostgreSQL, AI Insights, and Docker image. | M4 | ORIGINAL_REQUEST |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | PostgreSQL Migration | Features 1, 2, 3, 4: `database.py`, `models.py`, `main.py` guard, `test_postgres_migration.py` | None | PLANNED |
| M2 | AI Insights Engine | Features 5, 6, 7, 8, 9, 10: `schemas/ai.py`, `services/ai_service.py`, `api/ai.py`, `test_ai.py` | M1 | PLANNED |
| M3 | Backend Dockerization | Features 11, 12, 13, 14: `.dockerignore`, `requirements.txt`, `Dockerfile`, `docker build` | M1, M2 | PLANNED |
| M4 | Integrated Acceptance | Feature 15: Full test suite execution across all acceptance criteria | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### M1 (Database) ↔ M2 (AI Insights)
- `database.py` exports `engine`, `SessionLocal`, `Base`, `get_db`.
- Database URL configuration: `DATABASE_URL` environment variable.
- Connection: `engine.connect()` supports `text()` parameterized queries with `{"org_id": org_id}`.
- Model definitions in `app/models.py`:
  - `Organization`: `id`, `name`, `created_at`
  - `User`: `id`, `email`, `hashed_password`, `name`, `role`, `organization_id`, `created_at`
  - `Project`: `id`, `name`, `domain`, `api_key`, `organization_id`, `created_at`
  - `Connector`: `id`, `project_id`, `provider`, `access_token`, `status`
  - `Event`: `id`, `project_id`, `event_type`, `url`, `referrer`, `session_id`, `properties`, `created_at`
  - `SessionRecording`: `id`, `session_id`, `project_id`, `duration`, `file_path`, `created_at`

### M2 (AI Insights) ↔ API & Frontend
- Endpoint: `POST /api/v1/ai/query` (alias `POST /api/v1/ai/insights`)
- Headers: `Authorization: Bearer <jwt_token>`
- Request Body:
  ```json
  {
    "query": "How many users registered today?",
    "project_id": null
  }
  ```
- Response Body (200 OK):
  ```json
  {
    "query": "How many users registered today?",
    "sql": "SELECT COUNT(*) AS count FROM users WHERE organization_id = :org_id AND created_at >= CURRENT_DATE",
    "insight": "There are currently 2 users registered today in your organization.",
    "data": [{"count": 2}],
    "row_count": 1,
    "execution_time_ms": 42.5
  }
  ```
- Error Responses:
  - 400 Bad Request: `{"detail": "SQL safety violation: destructive commands or cross-tenant query detected."}`
  - 401 Unauthorized: `{"detail": "Could not validate credentials"}`

### M3 (Docker) ↔ Runtime & Platform
- Build command: `docker build -t thirdeye-api apps/api`
- Port: `8000` (configurable via `PORT` environment variable)
- User: `thirdeye` (UID 10001)
- Working directory: `/app`
- Default entrypoint: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Volume mount: `/app/storage/recordings`

---

## Code Layout
```
apps/api/
├── .dockerignore                  # Docker build context exclusions (M3)
├── Dockerfile                     # Multi-stage production container definition (M3)
├── main.py                        # Entrypoint proxy
├── requirements.txt               # Complete Python runtime requirements (M3)
├── test_ai.py                     # Programmatic AI test script (M2)
├── test_postgres_migration.py     # Programmatic PostgreSQL migration test script (M1)
├── public/                        # Static assets (te.js, rrweb-record.min.js)
├── storage/recordings/            # Mock S3 session recordings store
└── app/
    ├── database.py                # PostgreSQL engine, sessionmaker, pooling (M1)
    ├── models.py                  # SQLAlchemy declarative models (M1)
    ├── auth.py                    # JWT authentication & password hashing
    ├── main.py                    # FastAPI app initialization, routes mount, startup (M1, M2)
    ├── api/
    │   └── ai.py                  # AI Insights router (M2)
    ├── schemas/
    │   └── ai.py                  # AI request/response Pydantic models (M2)
    └── services/
        └── ai_service.py          # Gemini integration, SQL validator & executor (M2)
```
