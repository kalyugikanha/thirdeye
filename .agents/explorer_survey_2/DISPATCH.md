# Dispatch for explorer_survey_2

## Mission
Survey the codebase focusing on the AI Insights Engine (Text-to-SQL via Gemini API):
1. Read `d:/Project/Our Product/thirdeye/.agents/ORIGINAL_REQUEST.md` (specifically `## 2026-09-30T17:16:46Z`).
2. Investigate the FastAPI backend structure in `apps/api/`: routers, endpoints, dependencies (auth, tenant context, DB session injection), configuration/settings.
3. Investigate the existing dependencies in `requirements.txt` or `pyproject.toml` in `apps/api/`. What Gemini packages (`google-genai` or `google-generativeai`) or other libraries are present or needed?
4. Investigate how natural language queries should be routed (endpoint path, request/response models).
5. Investigate Text-to-SQL architecture: schema introspection / prompt formatting, prompt injection defense, read-only SQL enforcement, tenant isolation scoping (`WHERE organization_id = :org_id`), query execution against PostgreSQL, and plain-English synthesis of query results.
6. Check how `test_ai.py` can be constructed to verify the endpoint programmatically.

Write your findings and evidence to `d:/Project/Our Product/thirdeye/.agents/explorer_survey_2/report.md` and complete with `handoff.md`.

## 2026-09-30T17:20:00Z
Investigate the API & AI Insights layer:
- Find and inspect FastAPI routers, endpoints, dependency injection (tenant context, DB session), and config in `apps/api/`.
- Inspect `requirements.txt` or package files in `apps/api/` for Gemini API libraries (`google-genai` or `google-generativeai`) and environment variables (`GEMINI_API_KEY`).
- Design the endpoint for AI Insights (Text-to-SQL): route path, request schema, response schema.
- Detail the safe execution workflow: prompt formulation using DB schema, LLM generation of SQL, strict validation (SELECT only, no destructive commands, tenant isolation by `organization_id`), execution against Postgres, and LLM synthesis of plain-English insight.
- Outline the structure of the programmatic verification test script `test_ai.py`.

Document all findings with precise code references in `d:/Project/Our Product/thirdeye/.agents/explorer_survey_2/report.md` and write `handoff.md`. Notify the orchestrator when finished.

