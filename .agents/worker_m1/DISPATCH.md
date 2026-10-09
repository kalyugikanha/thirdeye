# Dispatch for worker_m1

## Milestone
Milestone 1 — PostgreSQL Migration & Schema Setup

## Objective
Implement PostgreSQL support for ThirdEye:
1. Update `apps/api/app/database.py`:
   - Read `DATABASE_URL` dynamically from environment, defaulting to `postgresql://thirdeye:thirdeye_password@localhost:5432/thirdeye_db`.
   - Normalize `postgres://` prefix to `postgresql://` if provided.
   - When using PostgreSQL: configure connection pooling (`pool_pre_ping=True`, `pool_size=10`, `max_overflow=20`, `pool_recycle=300`).
   - Do NOT pass SQLite-only `check_same_thread: False` to PostgreSQL engine (only pass `connect_args={"check_same_thread": False}` if dialect is SQLite).
2. Update `apps/api/app/main.py`:
   - Guard the SQLite-specific trigger/view creation block (lines 38-70) with `if engine.dialect.name == "sqlite":` so it doesn't fail on PostgreSQL.
3. Verify models in `apps/api/app/models.py`:
   - Confirm compatibility with PostgreSQL.
4. Set up verification environment & test script:
   - Ensure a PostgreSQL container is running on port 5432 (e.g. run `docker compose up -d db` or `docker run -d --name thirdeye-postgres -p 5432:5432 -e POSTGRES_USER=thirdeye -e POSTGRES_PASSWORD=thirdeye_password -e POSTGRES_DB=thirdeye_db postgres:15-alpine`).
   - Create `apps/api/test_postgres_migration.py` and project root `test_postgres_migration.py`.
   - The test script must:
     a) Connect to the PostgreSQL instance.
     b) Run `Base.metadata.create_all(bind=engine)`.
     c) Insert mock `Organization` and `User` (with password hash and foreign key reference).
     d) Retrieve and assert them without errors, verifying multi-tenant relationship.
   - Run the script and verify it passes with exit code 0.

## Mandatory Files to Read Before Starting Work
- `d:/Project/Our Product/thirdeye/.agents/ORIGINAL_REQUEST.md` (specifically `## 2026-09-30T17:16:46Z`)
- `d:/Project/Our Product/thirdeye/PROJECT.md`
- `d:/Project/Our Product/thirdeye/.agents/explorer_survey_1/handoff.md`
- `d:/Project/Our Product/thirdeye/.agents/explorer_survey_1/report.md`

## File Ownership
You exclusively own:
- `apps/api/app/database.py`
- `apps/api/app/main.py`
- `apps/api/test_postgres_migration.py`
- `test_postgres_migration.py`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Reporting
Document all changes, execution outputs, and verification results in `d:/Project/Our Product/thirdeye/.agents/worker_m1/handoff.md`.

## 2026-09-30T17:28:03Z
Execute the PostgreSQL migration:
- Update database.py with dynamic DATABASE_URL, PostgreSQL pooling, and dialect-conditional connect_args.
- Guard the SQLite-specific triggers/views block in main.py.
- Start or verify a PostgreSQL instance (e.g. docker compose up -d db or docker run -d --name thirdeye-postgres -p 5432:5432 -e POSTGRES_USER=thirdeye -e POSTGRES_PASSWORD=thirdeye_password -e POSTGRES_DB=thirdeye_db postgres:15-alpine).
- Create test_postgres_migration.py at apps/api/test_postgres_migration.py and project root test_postgres_migration.py to connect to PostgreSQL, run Base.metadata.create_all(), insert mock Organization and User, and query them.
- Run the test script and verify it exits with 0 and passes all assertions.
- Write your complete handoff report to d:/Project/Our Product/thirdeye/.agents/worker_m1/handoff.md and notify the orchestrator.

