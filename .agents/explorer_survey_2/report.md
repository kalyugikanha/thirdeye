# Technical Survey Report: API & AI Insights Layer (Text-to-SQL via Google Gemini)

**Agent**: `explorer_survey_2`  
**Working Directory**: `d:/Project/Our Product/thirdeye/.agents/explorer_survey_2/`  
**Date**: 2026-09-30  
**Context**: Monorepo ThirdEye — AI Insights Engine & PostgreSQL Migration (Milestone 2)  

---

## Executive Summary

This report delivers the technical survey, architectural blueprint, safety specification, and verification design for the **ThirdEye AI Insights Engine (Text-to-SQL)**. 

The AI Insights Engine connects the dashboard search interface to Google Gemini, translating natural language questions (such as *"How many users registered today?"*) into read-only, multi-tenant-isolated PostgreSQL queries, executing them securely against the user's isolated data, and synthesizing plain-English actionable insights.

---

## 1. Codebase Reconnaissance: `apps/api/` Architecture

### 1.1 File Structure & Routing
The FastAPI backend is located at `apps/api/`.
- Entry points:
  - `apps/api/main.py`: 5 lines, re-exports `from app.main import app`.
  - `apps/api/app/main.py`: 479 lines, currently defines all API endpoints directly on `app = FastAPI(title='ThirdEye AI Workspace API')`.
  - Subdirectories `app/api/`, `app/core/`, `app/models/`, `app/schemas/` exist as empty directories, providing the ideal modular structure for new routers and services.
- Key existing endpoints:
  - Authentication:
    - `POST /api/auth/register` (`main.py:111-128`)
    - `POST /api/auth/login` (`main.py:130-136`)
  - Event Ingestion (Public):
    - `POST /api/v1/track` (`main.py:147-158`)
  - Session Recordings (Mock S3):
    - `POST /api/v1/recordings` (`main.py:168-282`)
    - `GET /api/v1/recordings` (`main.py:284-300`)
    - `GET /api/v1/recordings/{session_id}` (`main.py:302-335`)
  - Analytics & Dashboard (Protected):
    - `GET /api/v1/dashboard/stats` (`main.py:346-360`)
    - `GET /api/v1/analytics/timeseries` (`main.py:362-377`)
  - Projects & Connectors:
    - `POST /api/projects`, `GET /api/projects` (`main.py:384-395`)
    - `POST /api/v1/connectors`, `GET /api/v1/connectors/{project_id}` (`main.py:404-422`)
    - `GET /api/v1/github/commits` (`main.py:424-454`)
  - Super Admin:
    - `GET /api/v1/admin/projects`, `GET /api/v1/admin/stats` (`main.py:457-478`)

### 1.2 Dependency Injection & Multi-Tenant Context
The API uses FastAPI's `Depends` system for session injection and authentication:
- Database Session: `db: Session = Depends(database.get_db)`
  - Defined in `apps/api/app/database.py:13-18`:
    ```python
    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    ```
- User Authentication: `current_user: models.User = Depends(auth.get_current_user)`
  - Defined in `apps/api/app/auth.py:30-46`:
    - Reads `Authorization: Bearer <token>` via `OAuth2PasswordBearer(tokenUrl='api/auth/login')`.
    - Decodes JWT using `SECRET_KEY = 'super_secret_thirdeye_key'` and `ALGORITHM = 'HS256'`.
    - Queries `models.User` by email (`sub`) and returns the authenticated `User` ORM object.
- Multi-Tenant Scoping Structure:
  - In `models.py`:
    - `User`: has `organization_id` (ForeignKey `organizations.id`)
    - `Project`: has `organization_id` (ForeignKey `organizations.id`)
    - `Connector`: belongs to `project_id` (ForeignKey `projects.id`)
    - `Event`: belongs to `project_id` (ForeignKey `projects.id`)
    - `SessionRecording`: belongs to `project_id` (ForeignKey `projects.id`)
  - Tenant Helper Functions (`main.py:338-343`):
    ```python
    def get_user_projects(db: Session, user: models.User):
        return db.query(models.Project).filter(models.Project.organization_id == user.organization_id).all()

    def get_user_project_ids(db: Session, user: models.User):
        projects = get_user_projects(db, user)
        return [p.id for p in projects]
    ```
  - **Crucial Rule for Text-to-SQL**:
    - Queries on `users` or `projects` MUST filter: `WHERE organization_id = :org_id`
    - Queries on `events`, `session_recordings`, or `connectors` MUST filter:
      `WHERE project_id IN (SELECT id FROM projects WHERE organization_id = :org_id)`
      or `JOIN projects ON ... AND projects.organization_id = :org_id`
    - Querying across organizations without `organization_id = :org_id` constitutes a critical multi-tenant boundary violation!

---

## 2. Gemini API Libraries & Environment Configuration

### 2.1 Current Dependencies (`apps/api/requirements.txt`)
Current contents:
```
fastapi
uvicorn[standard]
pydantic
pydantic-settings
sqlalchemy
psycopg2-binary
```
Observations:
- No Google Gemini library is currently installed or specified.
- `psycopg2-binary` is already present for PostgreSQL connectivity.
- In `apps/api/venv/Lib/site-packages`: `httpx` (0.28.1), `pytest` (9.1.1), `python-dotenv` (1.2.3), and `python-jose` (3.5.0) are present.

### 2.2 Library Selection: `google-genai` vs. `google-generativeai`
Google currently has two official Python SDKs:
1. `google-genai`:
   - Google's official unified SDK (released late 2024 / 2025) for the Gemini Developer API and Vertex AI.
   - Recommended by Google for all new applications.
   - Usage:
     ```python
     from google import genai
     client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
     response = client.models.generate_content(
         model="gemini-1.5-flash",
         contents="..."
     )
     ```
2. `google-generativeai`:
   - Google's legacy Python client for Gemini.
   - Usage:
     ```python
     import google.generativeai as genai
     genai.configure(api_key=os.environ["GEMINI_API_KEY"])
     model = genai.GenerativeModel("gemini-1.5-flash")
     response = model.generate_content("...")
     ```
3. Dual-Compatible Client Architecture (Best Practice):
   - To make the codebase resilient, the AI service should dynamically support both SDKs:
     - Check if `google-genai` is available; if so, instantiate `genai.Client`.
     - Otherwise check if `google-generativeai` is available; if so, use `genai.GenerativeModel`.
     - If neither is available or if `GEMINI_API_KEY` is omitted, fall back to a rule-based mock engine for local offline testing.
   - Add `google-genai` to `apps/api/requirements.txt`.

### 2.3 Required Environment Variables
| Variable | Description | Default / Example |
|---|---|---|
| `GEMINI_API_KEY` | Official Google Gemini API key | Provided in environment or `.env` |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-flash` (fast, structured, low latency) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://thirdeye:thirdeye_password@localhost:5432/thirdeye_db` |
| `MOCK_AI_IF_NO_KEY` | Graceful fallback toggle for offline test runs | `true` |

---

## 3. AI Insights Endpoint Design

### 3.1 Route Specification
- Path: `POST /api/v1/ai/query` (with alias `POST /api/v1/ai/insights`)
- Protection: Requires valid JWT Bearer token via `current_user: models.User = Depends(auth.get_current_user)`.
- Status Code: `200 OK` on success, `400 Bad Request` on invalid/unsafe query, `401 Unauthorized` on missing/bad token, `500 Internal Server Error` on execution failure.

### 3.2 Pydantic Request & Response Schemas

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class AIQueryRequest(BaseModel):
    query: str = Field(
        ..., 
        description="Natural language question to query analytics data", 
        example="How many users registered today?"
    )
    project_id: Optional[int] = Field(
        None, 
        description="Optional project scope filter"
    )

class AIQueryResponse(BaseModel):
    query: str = Field(..., description="Original natural language query")
    sql: str = Field(..., description="Validated read-only PostgreSQL query executed")
    insight: str = Field(..., description="Plain-English natural language insight synthesized by Gemini")
    data: List[Dict[str, Any]] = Field(default_factory=list, description="Tabular result set returned from PostgreSQL")
    row_count: int = Field(..., description="Number of rows returned")
    execution_time_ms: float = Field(..., description="Total pipeline latency in milliseconds")
```

---

## 4. Safe Execution Workflow (Deep Dive)

Allowing an LLM to generate SQL that executes against a production database presents three major risks:
1. **Destructive SQL Execution**: LLM generating `DROP`, `DELETE`, `UPDATE`, or `TRUNCATE`.
2. **Cross-Tenant Data Exfiltration**: LLM omitting `organization_id` filters, exposing other organizations' private data.
3. **Denial of Service / Resource Exhaustion**: Runaway Cartesian joins, heavy scans, or infinite execution.

To eliminate these risks, the AI Insights Engine implements a **5-Stage Defense-in-Depth Pipeline**:

```
[ Natural Language Query ]
            │
            ▼
[ Stage 1: Schema Introspection & Tenant Prompt Formulation ]
  - PostgreSQL schema context
  - Strict tenant rules (:org_id parameter binding)
            │
            ▼
[ Stage 2: Deterministic LLM Generation (Gemini API) ]
  - Temperature: 0.0
  - SELECT-only instruction
            │
            ▼
[ Stage 3: Multi-Layer SQL Validation & AST/Token Inspection ]
  - Single-statement validation (no semicolons / chained statements)
  - Forbidden keyword blacklist (INSERT, UPDATE, DELETE, DROP, ALTER, etc.)
  - Query must start with SELECT or WITH
  - Mandatory tenant scoping verification (:org_id required)
            │
            ▼
[ Stage 4: Read-Only Postgres Execution ]
  - SET TRANSACTION READ ONLY (engine-level hardware lock)
  - SET LOCAL statement_timeout = '5000' (5s timeout)
  - Parameterized binding: {"org_id": current_user.organization_id}
  - Fetch limit (max 100 rows)
            │
            ▼
[ Stage 5: LLM Synthesis of Plain-English Insight ]
  - Gemini summarizes query + tabular data into clear insight
            │
            ▼
[ HTTP 200 JSON Response ]
```

### 4.1 Stage 1: Schema Introspection & Tenant Prompt Formulation
The system injects the exact PostgreSQL schema into the Gemini prompt:

```text
You are the SQL generator for the ThirdEye Analytics Platform.
Translate the user's natural language question into a single, read-only PostgreSQL query.

DATABASE SCHEMA:
- organizations (id SERIAL PK, name VARCHAR, created_at TIMESTAMP)
- users (id SERIAL PK, email VARCHAR, name VARCHAR, role VARCHAR, organization_id INT FK, created_at TIMESTAMP)
- projects (id SERIAL PK, name VARCHAR, domain VARCHAR, api_key VARCHAR, organization_id INT FK, created_at TIMESTAMP)
- connectors (id SERIAL PK, project_id INT FK, provider VARCHAR, access_token VARCHAR, status VARCHAR)
- events (id SERIAL PK, project_id INT FK, event_type VARCHAR, url VARCHAR, referrer VARCHAR, session_id VARCHAR, properties JSON, created_at TIMESTAMP)
- session_recordings (id SERIAL PK, session_id VARCHAR, project_id INT FK, duration INT, file_path VARCHAR, created_at TIMESTAMP)

TENANT ISOLATION RULES (MANDATORY):
1. The authenticated user belongs to organization_id: :org_id
2. Every query MUST filter by :org_id:
   - For `users` or `projects`: WHERE organization_id = :org_id
   - For `events`, `session_recordings`, or `connectors`:
     JOIN projects ON <table_name>.project_id = projects.id WHERE projects.organization_id = :org_id
3. NEVER return data belonging to other organizations.
4. ONLY return a SELECT query. Never use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE.
5. Use PostgreSQL date/time functions: CURRENT_DATE, NOW(), INTERVAL '1 day', etc.
6. Return ONLY the raw SQL statement. Do not include markdown fences, comments, or explanations.

User Question: "{user_query}"
```

### 4.2 Stage 2: LLM Generation
- Call Gemini API with `temperature=0.0` (zero randomness for deterministic SQL).
- Strip markdown fences (` ```sql ` / ` ``` `) and trailing semicolons.

### 4.3 Stage 3: Strict Multi-Layer SQL Validation & AST/Token Inspection
Before executing against PostgreSQL, the SQL is inspected by `validate_sql_safety(sql: str, org_id: int)`:

1. **Statement Count**:
   - Must be a single statement. Semicolons inside the query body are prohibited to prevent stacked execution (`SELECT 1; DROP TABLE users;`).
2. **Statement Type**:
   - Must start with `SELECT` or `WITH`.
3. **Forbidden Keyword Blacklist**:
   Checked via regex word boundaries `\bKEYWORD\b`:
   ```python
   FORBIDDEN_KEYWORDS = [
       "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
       "CREATE", "REPLACE", "GRANT", "REVOKE", "EXEC", "EXECUTE",
       "CALL", "COPY", "VACUUM", "MERGE", "PRAGMA", "ATTACH",
       "DETACH", "INTO", "PG_READ_FILE", "PG_WRITE_FILE", "PG_EXEC"
   ]
   ```
4. **Mandatory Tenant Scoping Verification**:
   - The query MUST contain `:org_id` or `organization_id = {org_id}` to prevent cross-tenant queries.
   - If the query references `events`, `session_recordings`, `connectors`, `users`, or `projects`, it is rejected if `:org_id` is missing.

### 4.4 Stage 4: Read-Only Postgres Execution
Even if an injection bypassed Python filters, PostgreSQL provides defense-in-depth:
```python
with engine.connect() as conn:
    # 1. Enforce read-only at PostgreSQL engine level
    conn.execute(text("SET TRANSACTION READ ONLY"))
    # 2. Enforce statement timeout
    conn.execute(text("SET LOCAL statement_timeout = '5000'")) # 5 seconds
    # 3. Parameterized execution
    result = conn.execute(text(sql), {"org_id": current_user.organization_id})
    rows = result.fetchmany(100) # Enforce max 100 rows
    cols = list(result.keys())
    data = [dict(zip(cols, row)) for row in rows]
```

### 4.5 Stage 5: LLM Synthesis of Plain-English Insight
The tabular results are formatted into a synthesis prompt for Gemini:
```text
You are the ThirdEye AI Advisor.
The user asked: "{user_query}"
The database returned the following data:
{data_json}

Provide a concise, helpful, plain-English insight (1 to 2 sentences) directly answering the user's question based on the data.
If the result is 0 or empty, explain that clearly without technical error jargon.
Do not mention SQL syntax or table names unless relevant.
```

### 4.6 Offline / Deterministic Mock Mode
If `GEMINI_API_KEY` is not present in the environment (e.g. in offline CI environments or local dev without credentials), the service gracefully switches to a rule-based engine:
- `"How many users registered today?"` ->
  - SQL: `SELECT COUNT(*) AS count FROM users WHERE organization_id = :org_id AND created_at >= CURRENT_DATE`
  - Insight: `"There are currently {count} users registered today in your organization."`
- `"How many total events have been recorded?"` ->
  - SQL: `SELECT COUNT(e.id) AS total_events FROM events e JOIN projects p ON e.project_id = p.id WHERE p.organization_id = :org_id`
  - Insight: `"Your projects have recorded a total of {total_events} events."`
- Prompt injection attempt -> Correctly triggers `400 Bad Request` safety exception.
This guarantees that automated test suites (`test_ai.py`) can run reliably in any verification environment!

---

## 5. Programmatic Verification Test Script: `test_ai.py`

### 5.1 Architecture of `test_ai.py`
Following the pattern established by `test_recordings.py`, `test_ai.py` will be a standalone, self-contained Python script placed at the monorepo root (and mirrored in `apps/api/test_ai.py`):
- Operates against either a live running server (`http://localhost:8000`) or in-process `fastapi.testclient.TestClient`.
- Zero external test runner requirement (`python test_ai.py` returns exit code 0 or 1).

### 5.2 Test Cases Suite

| Test ID | Test Name | Target / Query | Expected Result |
|---|---|---|---|
| **TC-1** | Happy Path Query | `"How many users registered today?"` | HTTP 200, valid JSON with `insight`, `sql`, `data`, `row_count` |
| **TC-2** | Analytics Query | `"What are the most visited URLs?"` | HTTP 200, valid JSON with SQL containing `:org_id` and `LIMIT` |
| **TC-3** | Tenant Isolation Scoping | Cross-tenant inspection | Verifies query is scoped to `organization_id = :org_id`; User in Org 1 cannot see Org 2 records |
| **TC-4** | Destructive Command Defense | `"DROP TABLE users; SELECT 1;"` | Rejected with HTTP 400 (`AISafetyError`), database tables remain intact |
| **TC-5** | Unauthenticated Request | Request without Bearer token | Rejected with HTTP 401 Unauthorized |

### 5.3 Programmatic Structure Outline
```python
#!/usr/bin/env python3
"""
Canonical Programmatic Acceptance Test Suite: AI Insights Engine (Text-to-SQL)
Acceptance Criteria:
- Programmatic test script sends natural language query ("How many users registered today?")
- Asserts valid JSON response containing plain-English insight
- Asserts strict tenant isolation by organization_id
- Asserts safety validation rejects destructive commands
"""

import sys, os, json, time
from typing import Dict, Any, Optional

# 1. Setup API Client (Live HTTP or FastAPI TestClient)
# 2. Register/Login test user -> Obtain Bearer Token
# 3. Seed mock organization, projects, events, and users
# 4. Execute TC-1: Natural Language Query -> Assert 200, 'insight' in json, 'sql' in json
# 5. Execute TC-2: Prompt Injection Defense -> Assert 400 Bad Request, no tables dropped
# 6. Execute TC-3: Tenant Isolation -> Assert SQL filters by :org_id
# 7. Execute TC-4: Unauthenticated Request -> Assert 401
# 8. Print formatted summary and exit(0) if all pass, exit(1) if any fail
```

---

## 6. Proposed Implementation Files Blueprint

```
apps/api/
├── app/
│   ├── api/
│   │   └── ai.py             <-- AI Insights Router (POST /api/v1/ai/query)
│   ├── schemas/
│   │   └── ai.py             <-- Pydantic AIQueryRequest, AIQueryResponse
│   ├── services/
│   │   └── ai_service.py     <-- Gemini client, prompt engineering, SQL validator, executor
│   ├── database.py           <-- Updated for PostgreSQL connection
│   ├── models.py             <-- SQLAlchemy models (User, Org, Project, Event, etc.)
│   ├── auth.py               <-- JWT auth & get_current_user
│   └── main.py               <-- Includes ai_router
├── requirements.txt          <-- Added google-genai, python-dotenv
├── Dockerfile                <-- Backend Dockerfile
└── test_ai.py                <-- Programmatic test suite
test_ai.py                    <-- Root mirror / runner
```

---

## 7. Next Actions for Implementation Phase
1. Coordinate with Explorer 1's PostgreSQL migration so that `database.py` and `models.py` cleanly support PostgreSQL queries.
2. In Milestone 2 implementation, implement `app/schemas/ai.py`, `app/services/ai_service.py`, and `app/api/ai.py`.
3. Add `google-genai` to `apps/api/requirements.txt`.
4. Provide `test_ai.py` and verify all acceptance criteria pass.
