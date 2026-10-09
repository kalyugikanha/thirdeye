# Backend Dockerization & Verification Environment Survey Report

**Agent**: explorer_survey_3  
**Date**: 2026-09-30  
**Target Subsystem**: `apps/api/` Dockerization, Container Architecture & Verification Environment  
**Workspace**: `d:/Project/Our Product/thirdeye`  
**Parent Mission**: Milestone 2 — PostgreSQL Migration, AI Insights Engine & Backend Dockerization (2026-09-30T17:16:46Z)  

---

## Executive Summary

This survey report provides a rigorous architectural, configuration, and security assessment of the ThirdEye FastAPI backend (`apps/api/`) to guide the creation of a production-ready, AWS-optimized `Dockerfile` and establish the verification environment for PostgreSQL and Docker builds.

### Key Discoveries & Critical Findings:
1. **Existing Dockerfile Flaws (`apps/api/Dockerfile`)**:
   - The current 11-line draft uses a single-stage build (`python:3.11-slim`), runs as `root`, includes `--reload` (development flag), copies the entire directory (`COPY . .`) without exclusions, and lacks caching or non-root security.
2. **Missing `.dockerignore` (High Severity)**:
   - There is currently **no `.dockerignore`** file in `apps/api/` or the repository root.
   - Without `.dockerignore`, `docker build -t thirdeye-api apps/api` will copy `apps/api/venv/` (a massive Windows Python 3.13 virtual environment with native Windows binaries), `thirdeye.db` (local SQLite database), `storage/recordings/` test files, and `__pycache__` directly into the Linux container, corrupting the build and massively inflating image size.
3. **Dependency Deficits in `apps/api/requirements.txt`**:
   - Current `requirements.txt` contains only 6 packages: `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `sqlalchemy`, and `psycopg2-binary`.
   - **Missing critical runtime packages**:
     - `python-jose[cryptography]`: Required by `apps/api/app/auth.py:3` (`from jose import jwt`).
     - `passlib[bcrypt]` and `bcrypt`: Required by `apps/api/app/auth.py:4, 14` (`from passlib.context import CryptContext`).
     - `python-multipart`: Required by `apps/api/app/main.py:4` (`OAuth2PasswordRequestForm`).
     - `email-validator`: Required by `apps/api/app/main.py:19` (`EmailStr`).
     - `google-generativeai>=0.8.0`: Required by Milestone 2 for the Gemini AI Insights Engine.
   - If not added, building the Docker image will succeed, but the container will immediately crash on import or when handling authentication/AI requests.
4. **Base Image Selection**:
   - **Recommended**: `python:3.11-slim-bookworm` or `python:3.12-slim-bookworm`.
   - **Avoid Alpine (`python:*-alpine`)**: PyPI does not provide pre-compiled `musl` wheels for `psycopg2-binary`, `cryptography`, `pydantic-core`, or `bcrypt`. Building on Alpine requires installing `gcc`, `musl-dev`, `libpq-dev`, and `libffi-dev`, resulting in slow builds and increased final layer sizes. Debian Slim provides official pre-compiled `manylinux` wheels with zero compilation overhead.
5. **PostgreSQL Verification Environment**:
   - Root `docker-compose.yml` already defines a PostgreSQL service: `postgres:15-alpine` (`db`) with credentials `POSTGRES_USER=thirdeye`, `POSTGRES_PASSWORD=thirdeye_password`, `POSTGRES_DB=thirdeye_db`, exposed on host port `5432`.
   - A single Docker command (`docker run -d --name thirdeye-postgres -p 5432:5432 ... postgres:15-alpine`) or `docker compose up -d db` satisfies the verification environment requirements cleanly.

---

## 1. Codebase Architecture & `apps/api/` Layout

### 1.1 Directory Tree
Inspection of `apps/api/` reveals the following structure:
```
apps/api/
├── Dockerfile              # Existing basic 11-line draft (needs complete overhaul)
├── main.py                 # Top-level entrypoint proxy (from app.main import app)
├── requirements.txt        # Python dependency manifest (currently incomplete)
├── test_recordings.py      # Co-located session recording test suite (Milestone 1)
├── thirdeye.db             # Local SQLite database (must NOT be baked into image)
├── public/                 # Static assets directory
│   ├── rrweb-record.min.js # Injected rrweb recording client bundle (51.7 KB)
│   └── te.js               # Tracking snippet script (6.1 KB)
├── storage/                # Mock S3 local blob store
│   └── recordings/         # Gzipped JSON session replays (*.json.gz)
├── app/                    # Application source package
│   ├── auth.py             # JWT token handling, hashing, get_current_user
│   ├── database.py         # SQLAlchemy engine, SessionLocal, Base, get_db
│   ├── main.py             # FastAPI instance, route handlers, startup event
│   ├── models.py           # SQLAlchemy declarative models (6 models)
│   ├── api/                # (Empty directory)
│   ├── core/               # (Empty directory)
│   ├── models/             # (Empty directory)
│   └── schemas/            # (Empty directory)
└── venv/                   # Local Windows virtual environment (MUST BE EXCLUDED)
```

### 1.2 Entrypoint Analysis
There are two `main.py` files:
1. `apps/api/main.py`:
   ```python
   from app.main import app
   __all__ = ['app']
   ```
2. `apps/api/app/main.py`:
   Defines the FastAPI application instance at line 71:
   ```python
   app = FastAPI(title='ThirdEye AI Workspace API')
   ```

**In the Docker Container**:
When `WORKDIR /app` is set in the container and the contents of `apps/api` are copied into `/app`:
- Executing `uvicorn app.main:app --host 0.0.0.0 --port 8000` is the most robust and explicit command.
- Production invocation must omit `--reload` to prevent unnecessary filesystem watching processes and memory leaks.
- To support container platforms like AWS ECS, Google Cloud Run, or AWS App Runner where `$PORT` is injected dynamically, the entrypoint can optionally support `sh -c 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'`.

### 1.3 Python Version
- The host virtualenv configuration (`apps/api/venv/pyvenv.cfg`) specifies Python 3.13.15:
  ```ini
  home = C:\Users\AAKASH\AppData\Local\Programs\Python\Python313
  version = 3.13.15
  ```
- For containerized deployments, `python:3.11-slim` or `python:3.12-slim` is optimal and stable across all dependencies (`psycopg2-binary`, `pydantic`, `cryptography`, `google-generativeai`).

### 1.4 Static Files & Storage Mounts
1. **Static Files Mount**:
   `apps/api/app/main.py` line 81:
   ```python
   app.mount('/public', StaticFiles(directory='public'), name='public')
   ```
   Because `directory='public'` is a relative path, when the process runs with `WORKDIR /app`, `/app/public` must exist and contain `te.js` and `rrweb-record.min.js`.
2. **Mock S3 Storage**:
   `apps/api/app/main.py` lines 26-33:
   ```python
   BASE_DIR = Path(__file__).resolve().parent.parent
   ROOT_DIR = BASE_DIR.parent.parent

   STORAGE_DIR_API = BASE_DIR / "storage" / "recordings"
   STORAGE_DIR_ROOT = ROOT_DIR / "storage" / "recordings"

   STORAGE_DIR_API.mkdir(parents=True, exist_ok=True)
   STORAGE_DIR_ROOT.mkdir(parents=True, exist_ok=True)
   ```
   In the container, the application creates and writes recording files to `/app/storage/recordings/`. When running as a non-root user (e.g. `thirdeye`), the directory `/app/storage/recordings` must be pre-created and assigned ownership (`chown -R thirdeye:thirdeye /app/storage`).
   In production AWS deployments (e.g. ECS/EKS), `/app/storage` can also be mounted as an Amazon EFS volume or replaced with real Amazon S3 via boto3.

---

## 2. Dependencies & Runtime Requirements

### 2.1 Audit of Existing `requirements.txt`
Current content of `apps/api/requirements.txt`:
```
fastapi
uvicorn[standard]
pydantic
pydantic-settings
sqlalchemy
psycopg2-binary
```

### 2.2 Missing Dependencies Matrix
| Package | Required By | Code Location | Consequence If Missing in Container |
|---|---|---|---|
| `python-jose[cryptography]` | JWT token encode/decode | `apps/api/app/auth.py:3` | `ImportError: No module named 'jose'` on container startup or auth request |
| `passlib[bcrypt]` | Password hashing context | `apps/api/app/auth.py:4, 14` | `ImportError: No module named 'passlib'` |
| `bcrypt` (<=4.0.1 or compatible) | Password hashing backend | `apps/api/app/auth.py:14` | Password verification/creation failure |
| `python-multipart` | OAuth2 form parser | `apps/api/app/main.py:4, 131` | `400 Bad Request` or `RuntimeError` during `/api/auth/login` |
| `email-validator` | Pydantic email field | `apps/api/app/main.py:19, 106` | Pydantic validation error or fallback to basic string |
| `google-generativeai` | Gemini AI Text-to-SQL | Requirement R2 (`test_ai.py`) | `ImportError` on AI Insights endpoint |
| `httpx` | Test client & HTTP requests | Testing / Integration | Test runner failure |

### 2.3 Proposed Production `apps/api/requirements.txt`
```text
# Web Framework & ASGI Server
fastapi>=0.110.0
uvicorn[standard]>=0.28.0

# Settings & Validation
pydantic>=2.6.0
pydantic-settings>=2.2.0
email-validator>=2.1.0

# Database & ORM
sqlalchemy>=2.0.28
psycopg2-binary>=2.9.9

# Authentication & Cryptography
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
bcrypt>=4.0.0,<4.1.0
python-multipart>=0.0.9

# AI & LLM Engine (Google Gemini)
google-generativeai>=0.8.0

# HTTP & Utilities
httpx>=0.27.0
python-dotenv>=1.0.1
```

---

## 3. The `.dockerignore` Imperative

### 3.1 The Vulnerability
Currently, `apps/api/` does NOT contain a `.dockerignore` file.
Running `docker build -t thirdeye-api apps/api` without `.dockerignore` causes:
1. **Windows Binaries in Linux Container**: The entire `apps/api/venv/` directory (created on Windows with `.pyd` and `.exe` binaries) is sent to the Docker context (~200-300MB) and copied into `/app`.
2. **Stale SQLite DB Copied**: `thirdeye.db` is baked into the image, violating the clean PostgreSQL migration requirement.
3. **Recording Blobs Copied**: Test recording artifacts (`*.json.gz`) in `storage/recordings/` are baked into the image.
4. **Massive Build Latency**: Transferring the unneeded virtualenv slows build context transfer by tens of seconds.

### 3.2 Required `apps/api/.dockerignore` Specification
```dockerignore
# Virtual environments
venv/
.venv/
env/
ENV/

# Python bytecode and caches
__pycache__/
*.py[cod]
*$py.class
.pytest_cache/
.coverage
htmlcov/

# Local database files
*.db
*.sqlite3
thirdeye.db

# Storage payloads & recordings (Mock S3 runtime data)
storage/recordings/*
!storage/recordings/.gitkeep

# Git & IDE metadata
.git/
.gitignore
.idea/
.vscode/

# Local environment secrets
.env
.env.*
!.env.example

# OS metadata
.DS_Store
Thumbs.db
```

---

## 4. Multi-Stage Production Dockerfile Specification

### 4.1 Architectural Rationale
A multi-stage build delivers significant production benefits:
1. **Minimal Attack Surface**: The final runner image contains no build tools, compilers, or wheel caches.
2. **Fast Layer Caching**: Dependency installation is isolated in Stage 1; modifying application code does not invalidate the `pip install` cache.
3. **Strict Non-Root Security**: Running as an unprivileged user (`thirdeye`, UID 10001) adheres to AWS Well-Architected and CIS Docker benchmark standards.
4. **Small Image Footprint**: Final image is under 200MB (compared to >800MB for unoptimized builds).

### 4.2 Complete `apps/api/Dockerfile` Blueprint

```dockerfile
# ==============================================================================
# Stage 1: Build & Dependencies
# ==============================================================================
FROM python:3.11-slim-bookworm AS builder

# Set build-time environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Create isolated virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies into virtual environment
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# ==============================================================================
# Stage 2: Production Runtime
# ==============================================================================
FROM python:3.11-slim-bookworm AS runner

# Set runtime environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8000 \
    DATABASE_URL="postgresql://thirdeye:thirdeye_password@db:5432/thirdeye_db"

WORKDIR /app

# Create dedicated unprivileged user and group
RUN groupadd --system --gid 10001 thirdeye && \
    useradd --system --uid 10001 --gid 10001 --shell /bin/false --no-create-home thirdeye

# Copy pre-built virtual environment from builder stage
COPY --from=builder --chown=thirdeye:thirdeye /opt/venv /opt/venv

# Pre-create required writable storage and static directories with appropriate permissions
RUN mkdir -p /app/storage/recordings /app/public && \
    chown -R thirdeye:thirdeye /app

# Copy application code into container
COPY --chown=thirdeye:thirdeye . /app

# Switch to unprivileged non-root user
USER thirdeye

# Expose standard application port
EXPOSE 8000

# Container Healthcheck (uses native python urllib - zero external package overhead)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

# Production entrypoint running Uvicorn without --reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 5. Verification Environment: Docker & PostgreSQL Setup

### 5.1 Project's Existing `docker-compose.yml`
The root repository already contains a working `docker-compose.yml` file:
```yaml
version: '3.8'

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

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  api:
    build: 
      context: ./apps/api
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./apps/api:/code
    environment:
      - DATABASE_URL=postgresql://thirdeye:thirdeye_password@db:5432/thirdeye_db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 5.2 Standalone PostgreSQL Container Execution
For rapid verification or isolated testing without starting Redis or other services:
```bash
docker run -d \
  --name thirdeye-postgres-test \
  -e POSTGRES_USER=thirdeye \
  -e POSTGRES_PASSWORD=thirdeye_password \
  -e POSTGRES_DB=thirdeye_db \
  -p 5432:5432 \
  postgres:15-alpine
```

### 5.3 Connection URL Specifications
| Environment | Connection URL |
|---|---|
| Host test script to Docker Postgres | `postgresql://thirdeye:thirdeye_password@localhost:5432/thirdeye_db` |
| Containerized API to Compose Postgres | `postgresql://thirdeye:thirdeye_password@db:5432/thirdeye_db` |
| Containerized API to Host Postgres (Mac/Win) | `postgresql://thirdeye:thirdeye_password@host.docker.internal:5432/thirdeye_db` |

---

## 6. Verification Protocol & Acceptance Criteria Alignment

### 6.1 Acceptance Criterion: Docker Build
**Requirement**:
`- [ ] Running docker build -t thirdeye-api apps/api must complete successfully without compilation errors.`

**Execution**:
```bash
docker build -t thirdeye-api apps/api
```

**Verification Steps**:
1. Run `docker build -t thirdeye-api apps/api` from the project root (`d:/Project/Our Product/thirdeye`).
2. Assert return code is `0`.
3. Check image metadata:
   ```bash
   docker image inspect thirdeye-api --format '{{.Config.User}}'
   ```
   Assert output is `thirdeye` (non-root verification).
4. Run container smoke test:
   ```bash
   docker run --rm thirdeye-api python -c "import app.main; print('Import successful!')"
   ```
   Assert output is `Import successful!` and return code is `0`.
5. Run full live container test:
   ```bash
   docker run -d --name thirdeye-api-test -p 8000:8000 thirdeye-api
   ```
   Query root endpoint:
   ```bash
   curl http://localhost:8000/
   ```
   Assert `{"message":"Welcome to ThirdEye API"}` is returned.
   Clean up: `docker rm -f thirdeye-api-test`.

### 6.2 Acceptance Criterion: PostgreSQL Migration Verification
**Requirement**:
`- [ ] A programmatic test script must connect to a PostgreSQL instance, successfully run Base.metadata.create_all(), insert a mock Organization and User, and retrieve them without schema errors.`

**Programmatic Test Architecture (`test_postgres_migration.py`)**:
```python
import os
import sys
import time
from sqlalchemy import create_engine
from app.database import Base, SessionLocal
from app import models, auth

def test_postgres_migration():
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql://thirdeye:thirdeye_password@localhost:5432/thirdeye_db"
    )
    print(f"[*] Testing PostgreSQL connection: {db_url}")
    
    # Retry connection up to 10 seconds (wait for Postgres ready)
    engine = None
    for attempt in range(5):
        try:
            engine = create_engine(db_url)
            with engine.connect() as conn:
                print("[+] Database connection successful!")
                break
        except Exception as e:
            print(f"[-] Connection attempt {attempt + 1} failed: {e}. Retrying...")
            time.sleep(2)
            
    assert engine is not None, "Failed to connect to PostgreSQL instance."
    
    # 1. Run Base.metadata.create_all()
    print("[*] Running Base.metadata.create_all(bind=engine)...")
    Base.metadata.create_all(bind=engine)
    print("[+] All tables created successfully.")
    
    # 2. Insert mock Organization and User
    db = SessionLocal()
    try:
        mock_org = models.Organization(name="Postgres Verification Corp")
        db.add(mock_org)
        db.commit()
        db.refresh(mock_org)
        print(f"[+] Created mock Organization: id={mock_org.id}, name={mock_org.name}")
        
        hashed = auth.get_password_hash("securepass123")
        mock_user = models.User(
            email="postgres_test@thirdeye.io",
            hashed_password=hashed,
            name="Postgres Test User",
            role="ADMIN",
            organization_id=mock_org.id
        )
        db.add(mock_user)
        db.commit()
        db.refresh(mock_user)
        print(f"[+] Created mock User: id={mock_user.id}, email={mock_user.email}")
        
        # 3. Retrieve and assert schema integrity
        retrieved_user = db.query(models.User).filter(models.User.email == "postgres_test@thirdeye.io").first()
        assert retrieved_user is not None, "Failed to retrieve mock user."
        assert retrieved_user.name == "Postgres Test User"
        assert retrieved_user.organization.name == "Postgres Verification Corp"
        print("[+] Schema integrity and multi-tenant relationship verified successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    test_postgres_migration()
```

---

## 7. Concrete Recommendations & Implementation Checklist

For Worker/Implementation Agents:
1. **Create `apps/api/.dockerignore`** containing the specification defined in Section 3.2.
2. **Update `apps/api/requirements.txt`** to include `python-jose[cryptography]`, `passlib[bcrypt]`, `bcrypt`, `python-multipart`, `email-validator`, and `google-generativeai>=0.8.0`.
3. **Rewrite `apps/api/Dockerfile`** with the production multi-stage, non-root user configuration defined in Section 4.2.
4. **Update `apps/api/app/database.py`** to read `DATABASE_URL` dynamically from environment, remove SQLite-only `check_same_thread: False`, and configure production connection pooling (`pool_pre_ping=True`, `pool_size=10`).
5. **Update `apps/api/app/main.py`** to safely guard SQLite-specific trigger/view creation (`if engine.dialect.name == "sqlite":`).
6. **Execute and verify**:
   - `docker build -t thirdeye-api apps/api`
   - Run `postgres:15-alpine` container and execute migration test script.
