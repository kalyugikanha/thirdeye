# Database Layer Survey Report: PostgreSQL Migration

## Executive Summary
This report provides a comprehensive architectural and code-level survey of the ThirdEye database layer in `apps/api/` to guide the migration from SQLite to PostgreSQL as required by Milestone 2 (2026-09-30T17:16:46Z).

ThirdEye's backend uses **FastAPI** with **SQLAlchemy ORM (v2.x compatible)**. The schema consists of 6 models defined in `apps/api/app/models.py`. Multi-tenancy is structured hierarchically around the `organizations` table, with direct (`organization_id`) or indirect (`project_id`) foreign key references across all operational tables.

The migration from SQLite to PostgreSQL is clean and straightforward because:
1. `psycopg2-binary` is already specified in `apps/api/requirements.txt`.
2. A PostgreSQL 15 container service is already configured in `docker-compose.yml`.
3. The SQLAlchemy models use portable data types (including generic `JSON`, `DateTime`, `Integer`, `String`).
4. `Base.metadata.create_all()` will cleanly generate all tables, sequences, indexes, and foreign keys on PostgreSQL without requiring manual DDL.
5. Key code changes required are localized to `apps/api/app/database.py` (dynamic `DATABASE_URL`, pool options, removing SQLite-specific `check_same_thread`), and removing/adapting SQLite-specific raw SQL in `apps/api/app/main.py`.

---

## 1. Codebase Architecture & File Locations

### 1.1 Key Database Files
| File Path | Role & Content |
|---|---|
| `apps/api/app/database.py` | Engine initialization, `SessionLocal`, `Base = declarative_base()`, and `get_db()` dependency generator. |
| `apps/api/app/models.py` | Complete SQLAlchemy ORM model definitions (all 6 models): `User`, `Organization`, `Project`, `Connector`, `Event`, `SessionRecording`. |
| `apps/api/app/main.py` | Main FastAPI application. Invokes `models.Base.metadata.create_all(bind=engine)` at module scope (line 36), contains SQLite-specific view/trigger setup (lines 38-70), startup event for default org/user seed (lines 87-103), and all API route endpoints enforcing multi-tenancy. |
| `apps/api/app/auth.py` | JWT authentication routines (`create_access_token`, `get_current_user`, `verify_password`). Uses `get_db` and queries `models.User`. |
| `apps/api/requirements.txt` | Python dependencies. Explicitly contains `sqlalchemy` and `psycopg2-binary`. |
| `docker-compose.yml` | Root Docker Compose configuration defining `postgres:15-alpine` service (`db`) and backend service (`api`). |
| `apps/api/Dockerfile` | Python 3.11-slim container definition for the API service. |

### 1.2 Unused Directories
The following directories in `apps/api/app/` are currently empty:
- `apps/api/app/models/`
- `apps/api/app/api/`
- `apps/api/app/core/`
- `apps/api/app/schemas/`

All models reside in `apps/api/app/models.py`.

---

## 2. SQLAlchemy Models, Schemas, Constraints, and Relationships

All models inherit from `Base` imported from `app.database`.

### 2.1 Table Breakdown

#### 1. `Organization` (`__tablename__ = 'organizations'`)
- **Columns**:
  - `id`: `Integer`, Primary Key, `index=True`
  - `name`: `String`
  - `created_at`: `DateTime`, default=`datetime.utcnow`
- **Relationships**:
  - `users`: `relationship('User', back_populates='organization')` (1-to-N)
  - `projects`: `relationship('Project', back_populates='organization')` (1-to-N)
- **Constraints**: PK (`id`).

#### 2. `User` (`__tablename__ = 'users'`)
- **Columns**:
  - `id`: `Integer`, Primary Key, `index=True`
  - `email`: `String`, `unique=True`, `index=True`
  - `hashed_password`: `String`
  - `name`: `String`
  - `role`: `String`, default=`'ADMIN'`
  - `organization_id`: `Integer`, `ForeignKey('organizations.id')`, `nullable=True`
  - `created_at`: `DateTime`, default=`datetime.utcnow`
- **Relationships**:
  - `organization`: `relationship('Organization', back_populates='users')` (N-to-1)
- **Constraints**: PK (`id`), Unique (`email`), FK (`organization_id` -> `organizations.id`).

#### 3. `Project` (`__tablename__ = 'projects'`)
- **Columns**:
  - `id`: `Integer`, Primary Key, `index=True`
  - `name`: `String`
  - `domain`: `String`
  - `api_key`: `String`, `unique=True`, `index=True`
  - `organization_id`: `Integer`, `ForeignKey('organizations.id')`
  - `created_at`: `DateTime`, default=`datetime.utcnow`
- **Relationships**:
  - `organization`: `relationship('Organization', back_populates='projects')` (N-to-1)
  - `connectors`: `relationship('Connector', back_populates='project')` (1-to-N)
  - `events`: `relationship('Event', back_populates='project')` (1-to-N)
  - `recordings`: `relationship('SessionRecording', back_populates='project')` (1-to-N)
- **Constraints**: PK (`id`), Unique (`api_key`), FK (`organization_id` -> `organizations.id`).

#### 4. `Connector` (`__tablename__ = 'connectors'`)
- **Columns**:
  - `id`: `Integer`, Primary Key, `index=True`
  - `project_id`: `Integer`, `ForeignKey('projects.id')`
  - `provider`: `String` (e.g. `'github'`)
  - `access_token`: `String`
  - `status`: `String`, default=`'active'`
- **Relationships**:
  - `project`: `relationship('Project', back_populates='connectors')` (N-to-1)
- **Constraints**: PK (`id`), FK (`project_id` -> `projects.id`).

#### 5. `Event` (`__tablename__ = 'events'`)
- **Columns**:
  - `id`: `Integer`, Primary Key, `index=True`
  - `project_id`: `Integer`, `ForeignKey('projects.id')`
  - `event_type`: `String`, `index=True` (e.g. `'pageview'`, `'click'`)
  - `url`: `String`
  - `referrer`: `String`, `nullable=True`
  - `session_id`: `String`, `index=True`
  - `properties`: `JSON`, `nullable=True`
  - `created_at`: `DateTime`, default=`datetime.utcnow`
- **Relationships**:
  - `project`: `relationship('Project', back_populates='events')` (N-to-1)
- **Constraints**: PK (`id`), FK (`project_id` -> `projects.id`), Index (`ix_events_session_id`, `ix_events_event_type`).

#### 6. `SessionRecording` (`__tablename__ = 'session_recordings'`)
- **Columns**:
  - `id`: `Integer`, Primary Key, `index=True`
  - `session_id`: `String`, `index=True`, `nullable=False`
  - `project_id`: `Integer`, `ForeignKey('projects.id')`, `index=True`, `nullable=True`
  - `duration`: `Integer`, default=`0`
  - `file_path`: `String`, `nullable=False`
  - `created_at`: `DateTime`, default=`datetime.utcnow`
- **Relationships**:
  - `project`: `relationship('Project', back_populates='recordings')` (N-to-1)
- **Constraints**: PK (`id`), FK (`project_id` -> `projects.id`), Index (`ix_session_recordings_session_id`, `ix_session_recordings_project_id`).

---

## 3. Multi-Tenancy Architecture (`organization_id`)

### 3.1 Tenancy Hierarchy
```
Organization (Root Tenant)
├── Users (users.organization_id -> organizations.id)
└── Projects (projects.organization_id -> organizations.id)
     ├── Connectors (connectors.project_id -> projects.id)
     ├── Events (events.project_id -> projects.id)
     └── SessionRecordings (session_recordings.project_id -> projects.id)
```

### 3.2 Enforcement in FastAPI Endpoints
In `apps/api/app/main.py`:
- `get_user_projects(db, user)` (line 338):
  `db.query(models.Project).filter(models.Project.organization_id == user.organization_id).all()`
- `get_user_project_ids(db, user)` (line 341):
  Resolves all project IDs belonging to the authenticated user's organization.
- **Data Scoping**:
  - `/api/v1/dashboard/stats` (line 347): Filters `models.Event.project_id.in_(project_ids)`.
  - `/api/v1/analytics/timeseries` (line 363): Filters `models.Event.project_id.in_(project_ids)`.
  - `/api/projects` (lines 385, 394): Automatically binds new project to `current_user.organization_id`, and returns only projects for `current_user.organization_id`.
  - `/api/v1/connectors` (lines 405, 418): Rejects operations with HTTP 403 if `connector.project_id not in project_ids`.
  - Super Admin routes (`/api/v1/admin/projects`, `/api/v1/admin/stats` at lines 457-478): Restricted to `current_user.role == 'ADMIN'`.

### 3.3 Implications for AI Insights Engine (Text-to-SQL)
The AI Insights Engine must generate and execute SQL safely against the caller's tenant data:
1. Every query generated by Gemini must be scoped to the caller's `organization_id`.
2. Queries accessing `users` or `projects` must include:
   `WHERE organization_id = <caller_org_id>`
3. Queries accessing `events`, `connectors`, or `session_recordings` must include:
   `WHERE project_id IN (SELECT id FROM projects WHERE organization_id = <caller_org_id>)`
4. The execution engine must ensure read-only execution:
   - Check SQL statements with `SELECT` validation only (reject `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `EXECUTE`, `;`).
   - Run transactions in read-only mode: `SET TRANSACTION READ ONLY`.

---

## 4. Transition from SQLite to PostgreSQL: Exact Requirements

### 4.1 Connection String
- **Current in `apps/api/app/database.py` line 4**:
  ```python
  SQLALCHEMY_DATABASE_URL = 'sqlite:///./thirdeye.db'
  ```
- **Proposed PostgreSQL implementation**:
  ```python
  import os

  DATABASE_URL = os.getenv(
      "DATABASE_URL",
      "postgresql://thirdeye:thirdeye_password@localhost:5432/thirdeye_db"
  )
  # Normalize postgres:// to postgresql:// for SQLAlchemy 1.4+ compatibility
  if DATABASE_URL.startswith("postgres://"):
      DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
  ```

### 4.2 Engine Options & Connection Pooling
- **Current in `apps/api/app/database.py` lines 6-8**:
  ```python
  engine = create_engine(
      SQLALCHEMY_DATABASE_URL, connect_args={'check_same_thread': False}
  )
  ```
- **The SQLite Bug in PostgreSQL**:
  `check_same_thread: False` is an SQLite-only argument. Passing it to psycopg2 / PostgreSQL causes a fatal initialization error:
  `TypeError: 'check_same_thread' is an invalid keyword argument for this function`
- **Proposed Engine Configuration**:
  ```python
  if DATABASE_URL.startswith("sqlite"):
      engine = create_engine(
          DATABASE_URL,
          connect_args={"check_same_thread": False}
      )
  else:
      engine = create_engine(
          DATABASE_URL,
          pool_size=10,
          max_overflow=20,
          pool_pre_ping=True,
          pool_recycle=300
      )
  ```
- **Why these pool settings?**:
  - `pool_pre_ping=True`: Proactively sends a `SELECT 1` ping to ensure PostgreSQL connections are alive before handing them to requests. This eliminates disconnected/closed socket errors common in Docker and cloud container deployments.
  - `pool_size=10`, `max_overflow=20`: Handles concurrent FastAPI async request spikes gracefully.
  - `pool_recycle=300`: Recycles idle connections every 5 minutes to prevent stale timeouts.

### 4.3 SQLite-Specific Code in `apps/api/app/main.py`
In `apps/api/app/main.py` lines 38-70:
```python
# Ensure SessionRecording alias view and triggers exist in SQLite
try:
    with engine.connect() as _conn:
        _conn.execute(text("CREATE VIEW IF NOT EXISTS SessionRecording AS SELECT * FROM session_recordings"))
        _conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS insert_session_recording INSTEAD OF INSERT ON SessionRecording BEGIN
                INSERT INTO session_recordings (id, session_id, project_id, duration, file_path, created_at)
                VALUES (new.id, new.session_id, new.project_id, new.duration, new.file_path, new.created_at);
            END;
        """))
        _conn.commit()
except Exception:
    pass

for _db_path in [BASE_DIR / "thirdeye.db", ROOT_DIR / "thirdeye.db"]:
    if _db_path.exists():
        try:
            with sqlite3.connect(str(_db_path)) as _sconn:
                _sconn.execute("""
                    CREATE TABLE IF NOT EXISTS session_recordings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, ...
```
- **Issues with PostgreSQL**:
  - `sqlite3` direct file calls are completely inapplicable when running PostgreSQL.
  - `CREATE TRIGGER ... INSTEAD OF INSERT ON SessionRecording BEGIN ... END;` is SQLite-specific syntax that fails in PostgreSQL.
  - In PostgreSQL, views can be created with `CREATE OR REPLACE VIEW "SessionRecording" AS SELECT * FROM session_recordings` or simply queried by table name `session_recordings`.
  - **Recommendation**: Guard or condition this block with `if engine.dialect.name == "sqlite":` or cleanly create standard views in Postgres.

### 4.4 Data Type Adaptations
- **`JSON`**: `models.Event.properties = Column(JSON, nullable=True)`.
  SQLAlchemy's generic `JSON` compiles directly to `JSON` in PostgreSQL. No type modification required.
- **`DateTime`**: `Column(DateTime, default=datetime.utcnow)`.
  Compiles to `TIMESTAMP WITHOUT TIME ZONE` in PostgreSQL.
- **`Integer` primary keys**: Compiles to `SERIAL` (PostgreSQL sequences) automatically.
- **Foreign Keys**: Enforced strictly by PostgreSQL. Inserts must follow parent -> child ordering.

---

## 5. `Base.metadata.create_all()` Behavior on PostgreSQL

When `Base.metadata.create_all(bind=engine)` executes against a clean PostgreSQL database:
1. SQLAlchemy evaluates the dependency graph across models.
2. Tables are created in exact topological order:
   - `organizations`
   - `users`
   - `projects`
   - `connectors`
   - `events`
   - `session_recordings`
3. Primary key sequences (e.g. `organizations_id_seq`, `users_id_seq`, etc.) and indexes (`ix_users_email`, `ix_projects_api_key`, `ix_events_session_id`, etc.) are created automatically.
4. The operation is idempotent: if tables already exist, it completes without error.

---

## 6. Mock Organization & User Insertion & Retrieval Specification

### 6.1 Insertion Protocol
Because PostgreSQL enforces foreign keys strictly, inserting a mock `User` requires a valid `organization_id` pointing to an existing row in `organizations`:

```python
from app.database import engine, Base, SessionLocal
from app import models, auth

# 1. Ensure schema exists
Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    # 2. Insert mock Organization
    org = models.Organization(name="Postgres Verification Corp")
    db.add(org)
    db.commit()
    db.refresh(org)
    assert org.id is not None, "Failed to generate organization id"

    # 3. Insert mock User referencing the Organization
    hashed = auth.get_password_hash("testpassword123")
    user = models.User(
        email="pg_verify@thirdeye.io",
        hashed_password=hashed,
        name="Postgres Verifier",
        role="ADMIN",
        organization_id=org.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    assert user.id is not None, "Failed to generate user id"
    assert user.organization_id == org.id

    # 4. Retrieval & Verification
    retrieved_user = db.query(models.User).filter(models.User.email == "pg_verify@thirdeye.io").first()
    assert retrieved_user is not None
    assert retrieved_user.name == "Postgres Verifier"
    assert retrieved_user.organization.name == "Postgres Verification Corp"

    retrieved_org = db.query(models.Organization).filter(models.Organization.id == org.id).first()
    assert retrieved_org is not None
    assert any(u.email == "pg_verify@thirdeye.io" for u in retrieved_org.users)
finally:
    db.close()
```

### 6.2 Default Seed in `apps/api/app/main.py`
The existing FastAPI startup hook (`@app.on_event('startup')` in lines 87-103) already follows this exact order:
1. Searches for `Organization` `'ThirdEye Admin'`; creates it if not found.
2. Searches for `User` `'admin@thirdeye.io'`; creates it with `organization_id=org.id` if not found.
Once `database.py` connects to PostgreSQL, this hook will automatically seed the initial admin tenant into PostgreSQL on server start.

---

## 7. Migration Checklist for Implementation Agent

- [ ] **`apps/api/app/database.py`**:
  - Read `DATABASE_URL` from `os.getenv("DATABASE_URL")`.
  - Default to `postgresql://thirdeye:thirdeye_password@localhost:5432/thirdeye_db`.
  - Remove unconditional `connect_args={'check_same_thread': False}`.
  - Add PostgreSQL pool settings (`pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`, `pool_recycle=300`).
- [ ] **`apps/api/app/main.py`**:
  - Wrap SQLite-specific view/trigger DDL and `sqlite3.connect` operations in `if engine.dialect.name == "sqlite":`.
  - Retain `models.Base.metadata.create_all(bind=engine)` and startup hook.
- [ ] **Acceptance Test Script (`test_postgres_migration.py`)**:
  - Connect to PostgreSQL instance (Docker or local).
  - Run `Base.metadata.create_all(bind=engine)`.
  - Insert mock `Organization` and `User`.
  - Query and assert relationship without schema errors.
- [ ] **Backend Dockerfile (`apps/api/Dockerfile`)**:
  - Optimize for Python/AWS production environments (e.g. ensure `psycopg2-binary` installs cleanly, remove `--reload` for prod or use entrypoint script).
