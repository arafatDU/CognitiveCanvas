# CognitiveCanvas: A GraphRAG-Powered Interactive Workspace for Reusable AI Conversational Memories

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js: 16](https://img.shields.io/badge/Next.js-16.2+-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React: 19](https://img.shields.io/badge/React-19.2+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Neo4j](https://img.shields.io/badge/Neo4j-GraphRAG-008CC1.svg?logo=neo4j&logoColor=white)](https://neo4j.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791.svg?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Docker](https://img.shields.io/badge/Docker-Compose_Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

---

## 📌 Executive Summary & Academic Foundations

**CognitiveCanvas** is an advanced cognitive workspace system that transforms fragmented, disposable chatbot conversations into persistent, interactive, and verifiable **Memory Objects (Memolets)**. 

Rooted in the peer-reviewed research paper ***"Memolet: Reifying the Reuse of User-AI Conversational Memories"*** (ACM UIST '24), CognitiveCanvas significantly expands the original paradigm by introducing:
1. **Multi-Layer GraphRAG Engine**: Deep knowledge traversal via **Neo4j** concept graphs combined with **pgvector** dense semantic embeddings.
2. **Interactive Sensemaking Sandbox**: A 2D spatial canvas built on `@xyflow/react` where memory node positioning, sizing, and clustering dynamically calibrate LLM attention weights (*Instructed RAG*).
3. **Sentence-Level Trace Verification & Heatmaps**: Transparent, fine-grained provenance linking individual claims in AI responses back to source memory nodes, accompanied by an interactive modal confidence heatmap.
4. **Debounced Real-Time Context Suggestion**: Sub-second memory suggestion triggered organically by keystrokes in the prompt input.
5. **Temporal Memory Auditor**: LLM-as-a-judge verification that detects and flags time-sensitive or stale context to eliminate temporal hallucinations.
6. **Cross-Platform Ingestion Pipeline**: Asynchronous conversation extraction (via Celery & Jina Reader) supporting shared chat URLs from ChatGPT, Gemini, and Claude.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT BROWSER                                  │
│   Next.js 16 (React 19) · Tailwind CSS · Zustand Store · @xyflow/react      │
│   [2D Sandbox Canvas]  [Resizable Chat Overlay]  [Confidence Heatmap Modal] │
└───────────────────────┬─────────────────────────────▲───────────────────────┘
                        │ HTTPS / REST (JSON)         │ SSE / Streamed Output
                        ▼                             │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FASTAPI BACKEND GATEWAY                             │
│   Auth & Session (Clerk / JWT)  ·  Pydantic V2  ·  Spatial Prompt Compiler  │
└───────┬───────────────────┬─────────────────────┬───────────────────┬───────┘
        │                   │                     │                   │
        ▼                   ▼                     ▼                   ▼
┌──────────────┐    ┌──────────────┐      ┌──────────────┐    ┌───────────────┐
│  PostgreSQL  │    │ Neo4j Graph  │      │ Redis Queue  │    │    LiteLLM    │
│  (pgvector)  │    │  (GraphRAG)  │      │   & Celery   │    │ Unified Router│
│ ──────────── │    │ ──────────── │      │ ──────────── │    │ ───────────── │
│ Users, Chats │    │ Concepts,    │      │ Background   │    │ Gemini Flash  │
│ Dense Vector │    │ Relational   │      │ Ingestion &  │    │ Groq / LLaMA  │
│ Embeddings   │    │ Subgraphs    │      │ Verification │    │ Local Ollama  │
└──────────────┘    └──────────────┘      └──────────────┘    └───────────────┘
```

---

## 🌟 Key Functional Features

### 1. Multi-Layer Memory Engine (GraphRAG)
- **Conceptual Subgraph Traversal**: Executes Cypher queries in Neo4j to recover semantically linked concepts even when surface keywords differ.
- **Hybrid Search**: Combines BM25 keyword matching with sentence-transformer embeddings (`all-MiniLM-L6-v2`) via reciprocal rank fusion (RRF).

### 2. 2D Interactive Sensemaking Sandbox
- **Spatial Weight Calibration**: Expanding a memory node increases its prompt weighting tier (`High` priority for area $\ge 1.75\times$), while shrinking reduces its attention weight (`Low` priority for area $\le 0.65\times$).
- **Semantic Clustering & Voronoi Regions**: Nodes are categorized into broad, domain-agnostic themes (*Core Architecture*, *Knowledge & Concepts*, *State & Logic*, *Tasks & Integration*) with interactive Voronoi visual boundaries.
- **Lineage Tracing**: Visual directed edges represent lineage relationships when sub-memories are derived from parents.

### 3. Trust & Sentence-Level Verification
- **Fine-Grained Citations**: Inline badges (`[[1_0]]`, `[[1_1]]`) embedded directly within individual sentences of the AI response.
- **Confidence Heatmap Modal**: Interactive visual audit window displaying sentence-by-sentence confidence scores, citation sources, and contextual grounding metrics.

### 4. Real-Time Debounced Suggestion Engine
- Evaluates user prompt keystrokes with a 300ms debounce.
- Extracts meaningful keywords and queries the memory store in the background, presenting ranked relevant memory cards for instant 1-click injection.

### 5. Deprecated Memory Auditor
- Flags time-sensitive memories (software versions, dynamic parameters, dates).
- Alerts users prior to prompt execution if a selected memory node is outdated or presents temporal contradiction risks.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16.2 (Turbopack), React 19, TypeScript, Tailwind CSS, Zustand, @xyflow/react, Lucide Icons |
| **Backend** | Python 3.12, FastAPI 0.136+, SQLAlchemy 2.0, Alembic, Pydantic V2, LiteLLM |
| **Databases** | PostgreSQL 16 with `pgvector` (Dense vectors), Neo4j 5.19+ (Knowledge Graph) |
| **Async Broker** | Redis 7, Celery 5.3+ (distributed task queue) |
| **Authentication** | Clerk Authentication (Production) with fallback JWT provider |
| **DevOps / Container**| Docker, Docker Compose, Astral `uv` |

---

## 🚀 Quickstart: Docker Compose (Recommended)

The entire application stack (Backend, Worker, Frontend, and optional databases) is containerized following production Docker best practices.

### 1. Clone the Repository
```bash
git clone https://github.com/arafatDU/memolet.git
cd memolet
```

### 2. Configure Environment Variables
Copy the root `.env.example` template:
```bash
cp .env.example .env
```
Fill in your credentials (API keys for Gemini/Groq, Clerk Auth, and your cloud database URIs).

### 3. Launch with Docker Compose

#### Mode A: Cloud-Backed Mode (Default & Recommended)
If you are using managed cloud services (Neon Postgres, Neo4j AuraDB, Redis Cloud / Upstash):
```bash
docker compose up --build
```

#### Mode B: 100% Local Self-Hosted Mode
If you prefer running local PostgreSQL (`pgvector`) and local Redis inside Docker containers:
```bash
docker compose --profile local-infra up --build
```

### 4. Access the Application
- **Frontend Workspace**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 💻 Manual Local Development Setup

If you wish to develop without Docker containers, you can run the services natively using `uv` and `npm`.

### Prerequisites
- Python 3.12+ and [uv](https://github.com/astral-sh/uv) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Node.js 20+ and npm
- Running PostgreSQL (with pgvector), Redis, and Neo4j instances

### 1. Backend Setup
```bash
cd backend

# Copy environment template
cp .env.example .env
# Edit .env with your database URIs and LLM API keys

# Install dependencies and sync virtualenv
uv sync

# Apply database migrations
uv run alembic upgrade head

# Start FastAPI development server (with hot reload)
uv run fastapi dev app/main.py --port 8000
```

In a separate terminal, launch the Celery background worker:
```bash
cd backend
uv run celery -A app.worker.celery_app.celery_app worker --loglevel=info
```

### 2. Frontend Setup
```bash
cd frontend

# Copy environment template
cp .env.example .env.local
# Edit .env.local with your Clerk keys and API URL

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Free Cloud Deployment Guide

CognitiveCanvas is architected with a clean separation of concerns:
- **Frontend**: Deployed on **Vercel** (Free Tier).
- **Backend API & Worker**: Deployed on **Render / Koyeb / Fly.io** (Free Tier).
- **Data Stores**: 100% Managed Cloud Free Tiers (Neon, Neo4j Aura, Upstash/Redis Cloud, Clerk).

### Step 1: Set Up Free Cloud Data Stores (5 Minutes)
1. **PostgreSQL + pgvector**: Create a free project on [Neon.tech](https://neon.tech) (0.5 GB free storage, pgvector pre-installed). Copy your connection string (`DATABASE_URL`).
2. **Neo4j Graph Database**: Create a free instance on [Neo4j AuraDB](https://neo4j.com/cloud/platform/aura-graph-database/) (Free tier: 200k nodes). Save the URI (`NEO4J_URI`), username, and password.
3. **Redis & Celery Broker**: Create a free database on [Upstash Redis](https://upstash.com/) or [Redis Cloud](https://redis.io/cloud/) (30 MB free). Save the host, port, and password.
4. **Authentication**: Create an application on [Clerk.com](https://clerk.com/) (10,000 free monthly active users). Copy the Publishable Key and Secret Key.

---

### Step 2: Deploy the Backend (Render or Koyeb Free Tier)

#### Option A: Deploy on Render.com (Recommended)
1. Log in to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Connect your GitHub repository `arafatDU/memolet`.
3. Configure the settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install uv && uv sync --frozen && uv run alembic upgrade head`
   - **Start Command**: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. In **Environment Variables**, add:
   - `DATABASE_URL`: *(Neon connection URL)*
   - `NEO4J_URI`: *(Neo4j AuraDB URI)*
   - `NEO4J_USERNAME`: *(Neo4j username)*
   - `NEO4J_PASSWORD`: *(Neo4j password)*
   - `REDIS_HOST`: *(Redis host)*
   - `REDIS_PORT`: *(Redis port)*
   - `REDIS_PASSWORD`: *(Redis password)*
   - `GEMINI_API_KEY`: *(Google AI Studio key)*
   - `GROQ_API_KEY`: *(Groq key)*
   - `CLERK_SECRET_KEY`: *(Clerk secret key)*
   - `CLERK_PUBLISHABLE_KEY`: *(Clerk publishable key)*
   - `CORS_ORIGINS`: `https://*.vercel.app,http://localhost:3000`
5. Click **Create Web Service**. Once deployed, Render provides your public URL:
   `https://cognitivecanvas-backend.onrender.com`

---

### Step 3: Deploy the Frontend on Vercel

1. Log in to [Vercel](https://vercel.com/) and click **Add New...** → **Project**.
2. Select your repository `arafatDU/memolet`.
3. In the project configuration:
   - **Root Directory**: Click *Edit* and select **`frontend`**.
   - **Framework Preset**: `Next.js` (automatically detected).
4. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_API_URL`: `https://cognitivecanvas-backend.onrender.com/api/v1`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: `pk_test_...`
   - `CLERK_SECRET_KEY`: `sk_test_...`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/login`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: `/register`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`: `/workspace`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`: `/workspace`
5. Click **Deploy**. Vercel will build and assign your domain:
   `https://cognitivecanvas.vercel.app`

---

## 📂 Repository Directory Structure

```
memolet/
├── docker-compose.yml           # Production multi-service container orchestration
├── .env.example                 # Unified root environment template
├── README.md                    # Academic & technical documentation
├── RESEARCH.md                  # Comprehensive empirical and theoretical study
│
├── backend/                     # FastAPI Application Service
│   ├── Dockerfile               # Multi-stage Python 3.12 image with Astral uv
│   ├── pyproject.toml           # PEP 621 dependency definitions
│   ├── uv.lock                  # Deterministic dependency lockfile
│   ├── alembic/                 # SQLAlchemy database schema migrations
│   ├── app/
│   │   ├── main.py              # Application entrypoint & CORS middleware
│   │   ├── api/                 # REST routing layer
│   │   │   ├── routes/
│   │   │   │   ├── chat.py      # LLM inference & spatial prompt compilation
│   │   │   │   ├── memories.py  # Memolet CRUD & semantic retrieval
│   │   │   │   ├── sandbox.py   # Canvas synchronization & Voronoi clustering
│   │   │   │   └── auditor.py   # Temporal deprecation verification
│   │   ├── core/                # Configuration & security settings
│   │   ├── db/                  # SQLAlchemy engine & session management
│   │   ├── models/              # Relational models (Users, Memolets, Chats)
│   │   ├── services/            # Core business logic (GraphRAG, Trust, Spatial)
│   │   └── worker/              # Celery task definitions & broker setup
│
└── frontend/                    # Next.js 16 Web Application
    ├── Dockerfile               # Multi-stage production container
    ├── package.json             # NPM dependencies & scripts
    ├── public/
    │   └── logo.png             # Official CognitiveCanvas branding logo
    ├── app/
    │   ├── page.tsx             # Interactive research landing page
    │   ├── layout.tsx           # Global layout & metadata icons
    │   ├── workspace/           # 2D Sensemaking canvas & chat workspace
    │   ├── login/               # Clerk authentication sign-in
    │   └── register/            # Clerk authentication sign-up
    ├── components/
    │   ├── Canvas/              # React Flow 2D workspace & Voronoi layers
    │   ├── Workspace/           # Chat overlay, citations & heatmap modal
    │   ├── Sidebar/             # Document viewer & memory drawer
    │   └── Theme/               # Dynamic theme provider & toggles
    ├── store/                   # Zustand state store with user persistence
    └── lib/                     # API client, spatial compiler & utilities
```

---

## 🧪 Testing & Quality Assurance

### Backend Unit & Integration Tests
```bash
cd backend
uv run pytest tests/ -v
```

### Frontend Build & Lint Verification
```bash
cd frontend
npm run lint
npm run build
```

---

## 📑 Research Citation

If you use or build upon the concepts of CognitiveCanvas in academic research or engineering projects, please cite the underlying foundational paper:

```bibtex
@inproceedings{memolet2024,
  title     = {Memolet: Reifying the Reuse of User-AI Conversational Memories},
  author    = {Research Authors},
  booktitle = {Proceedings of the 37th Annual ACM Symposium on User Interface Software and Technology (UIST '24)},
  year      = {2024},
  publisher = {Association for Computing Machinery},
  doi       = {10.1145/3654777.3676450}
}
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
