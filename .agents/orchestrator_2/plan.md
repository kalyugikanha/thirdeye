# Execution Plan: ThirdEye Production Upgrade

## Overview
This plan implements the three core requirements specified in ORIGINAL_REQUEST.md (2026-09-30T17:16:46Z):
1. PostgreSQL Migration with strict multi-tenant isolation
2. AI Insights Engine (Text-to-SQL via Google Gemini API)
3. Backend Dockerization for FastAPI (`apps/api/Dockerfile`)

## Phases and Milestones

### Phase 0: Survey & Technical Reconnaissance
- Dispatch 3 parallel Explorers:
  - Explorer 1: Inspect `database.py`, models (`apps/api/models/`), SQLAlchemy setup, schema definitions, and multi-tenant `organization_id` patterns.
  - Explorer 2: Inspect FastAPI routes, dependencies, existing endpoints, settings/config, and requirements/dependencies for Gemini AI integration.
  - Explorer 3: Inspect `apps/api/` structure, Python version, dependencies (`requirements.txt` or `pyproject.toml`), system dependencies, and Docker environment.

### Phase 1: Milestone 1 — PostgreSQL Migration
- Explorer synthesis & strategy formulation.
- Worker implementation:
  - Update `database.py` to support PostgreSQL connection (configured via `DATABASE_URL` or standard postgres env vars).
  - Verify all SQLAlchemy models are compatible with PostgreSQL (types, UUIDs/IDs, foreign keys, timestamps).
  - Ensure multi-tenant isolation by `organization_id` across models.
  - Set up / verify Postgres instance (e.g., Docker container `postgres:15-alpine` or existing service).
  - Provide database migration verification test script that runs `Base.metadata.create_all()`, inserts mock `Organization` and `User`, and retrieves them.
- Independent Reviewers (x2), Challenger (x2), Forensic Auditor (x1), Gate Evaluation.

### Phase 2: Milestone 2 — AI Insights Engine (Text-to-SQL)
- Explorer synthesis & strategy formulation.
- Worker implementation:
  - Add endpoint in FastAPI backend (e.g. `POST /api/v1/ai/insights` or similar query endpoint).
  - Implement prompt engineering with Gemini API translating natural language to read-only SQL scoped strictly to tenant's `organization_id`.
  - Validate SQL safety: enforce SELECT-only, block destructive keywords (DROP, DELETE, UPDATE, INSERT, ALTER), ensure `organization_id` filtering.
  - Execute read-only query safely against Postgres DB, pass results to Gemini to generate plain-English insight.
  - Implement programmatic test script `test_ai.py` sending natural language query and verifying JSON insight response.
- Independent Reviewers (x2), Challenger (x2), Forensic Auditor (x1), Gate Evaluation.

### Phase 3: Milestone 3 — Backend Dockerization
- Explorer synthesis & strategy formulation.
- Worker implementation:
  - Create `apps/api/Dockerfile` (multi-stage / optimized for Python production & AWS environments).
  - Verify `docker build -t thirdeye-api apps/api` passes with exit code 0.
- Independent Reviewers (x2), Challenger (x2), Forensic Auditor (x1), Gate Evaluation.

### Phase 4: Final Acceptance & Integrated E2E Verification
- Run all acceptance criteria scripts:
  - Postgres `create_all()` + Organization & User mock verification.
  - `test_ai.py` natural language insight query verification.
  - `docker build -t thirdeye-api apps/api` verification.
- Reviewer, Challenger, and Forensic Auditor final attestation.
- Complete state handoff and report to user/parent.
