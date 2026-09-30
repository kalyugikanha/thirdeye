# 🔮 ThirdEye — Universal Intelligence Platform

Welcome to the ThirdEye monorepo! This is an all-in-one platform for API monitoring, UX tracking, DevOps health, Social Media analytics, and an AI RAG Advisor.

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui (in `apps/web`)
- **Backend**: Python FastAPI (in `apps/api`)
- **Database**: PostgreSQL + Redis (via Docker)
- **Monorepo**: pnpm workspaces

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start databases (PostgreSQL & Redis)**:
   ```bash
   docker-compose up -d
   ```

3. **Start the Frontend (Next.js)**:
   ```bash
   cd apps/web
   pnpm dev
   ```

4. **Start the Backend (FastAPI)**:
   ```bash
   cd apps/api
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

## 🌐 Design Concept

ThirdEye is designed around a clean, search-first, minimalist UI (inspired by SuperAGI/Genspark). Instead of overwhelming charts, the focus is on natural language queries powered by the ThirdEye AI Advisor.
