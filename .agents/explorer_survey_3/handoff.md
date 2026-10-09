# Handoff Report: Backend Dockerization & Verification Environment Survey

**Agent**: explorer_survey_3  
**Date**: 2026-09-30  
**Target**: Orchestrator (`parent`), Worker Agents  
**Scope**: `apps/api/` Dockerization, Container Security, Dependency Manifests, Verification Environment Setup  

---

## 1. Observation

### 1.1 Existing Dockerfile
- **File**: `apps/api/Dockerfile` (lines 1–11):
  ```dockerfile
  FROM python:3.11-slim

  WORKDIR /code

  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt

  COPY . .

  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
  ```
  **Direct Observations**:
  - Base image is `python:3.11-slim`.
  - Runs entirely as `root`.
  - Single-stage build without builder isolation.
  - `CMD` includes `--reload` (development flag unsuitable for production).
  - `COPY . .` copies all files indiscriminately.

### 1.2 Missing `.dockerignore`
- Searching for `*dockerignore*` via `find_by_name` across `d:/Project/Our Product/thirdeye` returned `0 results`.
- In `apps/api/`, the following directories and files currently reside on disk:
  - `apps/api/venv/`: Windows virtualenv (Python 3.13.15) containing native `.pyd` binaries (`_cffi_backend.cp313-win_amd64.pyd`), Windows executables, and hundreds of megabytes of site-packages.
  - `apps/api/thirdeye.db`: 77,824 bytes SQLite file.
  - `apps/api/storage/recordings/`: Multiple `.json.gz` recording files.
  - `apps/api/__pycache__/`: Bytecode files.

### 1.3 Missing Critical Dependencies in `requirements.txt`
- **File**: `apps/api/requirements.txt` (lines 1–7):
  ```text
  fastapi
  uvicorn[standard]
  pydantic
  pydantic-settings
  sqlalchemy
  psycopg2-binary
  ```
- **File**: `apps/api/app/auth.py` lines 3–4, 14:
  ```python
  from jose import jwt
  from passlib.context import CryptContext
  ...
  pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
  ```
  Imports `jose` and `passlib` with `bcrypt`. Neither `python-jose`, `passlib`, nor `bcrypt` are listed in `requirements.txt`.
- **File**: `apps/api/app/main.py` lines 4, 19:
  ```python
  from fastapi.security import OAuth2PasswordRequestForm
  ...
  from pydantic import EmailStr
  ```
  `OAuth2PasswordRequestForm` requires `python-multipart` to parse form-encoded credentials. `EmailStr` requires `email-validator`. Neither are listed in `requirements.txt`.
- **Requirement R2 (ORIGINAL_REQUEST.md line 48)**:
  "uses the official Google Gemini API to translate the query into SQL based on the PostgreSQL schema"
  `google-generativeai` is required and not present in `requirements.txt`.

### 1.4 Entrypoint & Static / Storage Paths
- **Entrypoints**:
  - `apps/api/main.py:1`: `from app.main import app`
  - `apps/api/app/main.py:71`: `app = FastAPI(title='ThirdEye AI Workspace API')`
- **Static files mount** (`apps/api/app/main.py:81`):
  `app.mount('/public', StaticFiles(directory='public'), name='public')`
  Resolves relative to working directory.
- **Storage directory** (`apps/api/app/main.py:26–33`):
  Creates `storage/recordings` relative to `BASE_DIR`. Needs write permissions for the running user.

### 1.5 System Environment & PostgreSQL Service
- **File**: `docker-compose.yml` lines 3–15:
  ```yaml
  services:
    db:
      image: postgres:15-alpine
      environment:
        POSTGRES_USER: thirdeye
        POSTGRES_PASSWORD: thirdeye_password
        POSTGRES_DB: thirdeye_db
      ports:
        - "5432:5432"
      volumes:
        - postgres_data:/var/lib/postgresql/data
      restart: unless-stopped
  ```
  Docker Compose defines `postgres:15-alpine` accessible on `localhost:5432` with database `thirdeye_db`, user `thirdeye`, password `thirdeye_password`.

---

## 2. Logic Chain

1. **Premise 1 (Build Integrity)**: `docker build -t thirdeye-api apps/api` executes `COPY . .` from the build context.
   - *Observation*: `apps/api/` contains `venv/` (Windows binaries) and `thirdeye.db`.
   - *Inference*: Without `.dockerignore`, Windows binaries and local databases will be baked into the Linux image, inflating image size by >250MB, causing cross-platform pollution and potentially corrupting Python's Linux environment.
   - *Deduction*: An `apps/api/.dockerignore` file excluding `venv/`, `thirdeye.db`, `__pycache__/`, and `storage/recordings/*` is strictly required before running `docker build`.

2. **Premise 2 (Runtime Stability)**: Python imports fail at runtime if imported packages are not installed in the container environment.
   - *Observation*: `apps/api/app/auth.py` imports `jose` and `passlib`, and uses `bcrypt`. `apps/api/app/main.py` uses `OAuth2PasswordRequestForm` (`python-multipart`) and `EmailStr` (`email-validator`). Requirement R2 requires the Gemini SDK (`google-generativeai`).
   - *Observation*: Current `requirements.txt` only lists `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `sqlalchemy`, and `psycopg2-binary`.
   - *Inference*: A container built strictly from current `requirements.txt` will build cleanly but will fail immediately on runtime startup or first API call.
   - *Deduction*: `requirements.txt` must be updated with `python-jose[cryptography]`, `passlib[bcrypt]`, `bcrypt`, `python-multipart`, `email-validator`, and `google-generativeai>=0.8.0`.

3. **Premise 3 (Base Image & Multi-Stage Architecture)**: Production containers must be minimal, secure, and fast to build.
   - *Observation*: Alpine (`python:*-alpine`) lacks pre-compiled wheels on PyPI for `psycopg2-binary`, `cryptography`, and `pydantic-core`, requiring heavy C build dependencies (`gcc`, `musl-dev`, `libpq-dev`).
   - *Inference*: `python:3.11-slim-bookworm` provides glibc `manylinux` pre-compiled wheels, installing in seconds without build tools.
   - *Deduction*: A two-stage Dockerfile (`builder` and `runner`) using `python:3.11-slim-bookworm` with a non-root user (`thirdeye`, UID 10001) satisfies production best practices and minimizes footprint (<200MB).

4. **Premise 4 (Verification Readiness)**: The team must verify both `docker build -t thirdeye-api apps/api` and PostgreSQL migrations.
   - *Observation*: `docker-compose.yml` already contains a fully specified `postgres:15-alpine` service.
   - *Deduction*: PostgreSQL can be run via `docker compose up -d db` or `docker run -d --name thirdeye-postgres -p 5432:5432 -e POSTGRES_USER=thirdeye -e POSTGRES_PASSWORD=thirdeye_password -e POSTGRES_DB=thirdeye_db postgres:15-alpine`. A programmatic script connecting to `postgresql://thirdeye:thirdeye_password@localhost:5432/thirdeye_db` will independently verify migration and data retrieval.

---

## 3. Caveats

1. **System Command Permissions**: Direct execution of `run_command` for `docker` commands on the host machine may require user authorization or may be constrained in certain headless environments. All Docker commands and configurations have been designed to be fully standard and portable.
2. **PostgreSQL Service State**: It is assumed that Docker is installed and running on the host system to launch the `postgres:15-alpine` container, or that an external PostgreSQL instance is reachable via `DATABASE_URL`.
3. **Gemini API Key Availability**: Verification of the AI Insights endpoint requires `GEMINI_API_KEY` set in the environment as noted in `ORIGINAL_REQUEST.md`.

---

## 4. Conclusion

The existing `apps/api/` configuration requires three primary modifications to achieve production-ready Dockerization and pass acceptance criteria:
1. **Add `apps/api/.dockerignore`** to block `venv/`, `thirdeye.db`, and runtime artifacts from polluting the Docker context.
2. **Update `apps/api/requirements.txt`** to include missing runtime libraries (`python-jose[cryptography]`, `passlib[bcrypt]`, `bcrypt`, `python-multipart`, `email-validator`, `google-generativeai`).
3. **Rewrite `apps/api/Dockerfile`** as a multi-stage, non-root (`USER thirdeye`), production-grade image that exposes port 8000, runs `uvicorn app.main:app`, and includes a healthcheck.

The verification environment for PostgreSQL is completely mapped and ready via `docker-compose.yml` (`postgres:15-alpine`) on `localhost:5432`.

---

## 5. Verification Method

### 5.1 Docker Build Verification
Execute from workspace root:
```bash
docker build -t thirdeye-api apps/api
```
**Success Conditions**:
- Exit code: `0`.
- Output confirms successful multi-stage build without compilation errors.
- Image inspect confirms non-root user:
  ```bash
  docker image inspect thirdeye-api --format '{{.Config.User}}'
  ```
  Expected output: `thirdeye` (or UID `10001`).

### 5.2 Container Smoke & Runtime Test
```bash
docker run --rm thirdeye-api python -c "import app.main; print('Import OK')"
```
**Success Condition**: Prints `Import OK` with exit code `0`.

### 5.3 PostgreSQL Verification Test
Start Postgres container:
```bash
docker run -d --name thirdeye-postgres -p 5432:5432 -e POSTGRES_USER=thirdeye -e POSTGRES_PASSWORD=thirdeye_password -e POSTGRES_DB=thirdeye_db postgres:15-alpine
```
Execute programmatic migration test script (`python test_postgres_migration.py`):
- Connects to `postgresql://thirdeye:thirdeye_password@localhost:5432/thirdeye_db`.
- Executes `Base.metadata.create_all(bind=engine)`.
- Inserts mock `Organization` and `User`.
- Queries them back and asserts relationship matches.
- Exit code: `0`.
