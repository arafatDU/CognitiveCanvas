# CognitiveCanvas

A sophisticated memory management and conversational AI platform that intelligently captures, organizes, and retrieves information through interactive conversations. Memolet combines advanced LLM capabilities with structured memory management to provide users with a powerful knowledge base that grows smarter with every interaction.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

## Overview

Memolet is designed to enhance how users interact with AI while maintaining a persistent, searchable memory of their conversations. Unlike traditional chatbots, Memolet:

- **Captures Knowledge**: Automatically extracts and stores important information as "Memolets" (memory capsules)
- **Manages Context**: Maintains conversation history with smart retrieval of relevant past interactions
- **Ensures Accuracy**: Provides citation tracking and conflict detection across stored memories
- **Supports Multiple LLMs**: Routes queries to optimal language models based on requirements
- **Enables Collaboration**: Builds comprehensive knowledge graphs that improve over time

## Features

### Core Features

- **User Authentication**: Secure JWT-based authentication with username/password registration
- **Intelligent Chat**: Multi-turn conversations with context awareness and memory integration
- **Memolet System**: Structured memory storage with semantic embeddings for intelligent retrieval
- **Conversation Management**: Organize and manage multiple conversation threads
- **Chat Memory Persistence**: Save and load entire conversations for future reference
- **Message Citations**: Track and display source citations for AI responses

### Advanced Features

- **Trust Score System**: Evaluate confidence and reliability of stored information
- **Conflict Detection**: Identify contradictions in stored knowledge
- **Semantic Retrieval**: Vector-based search using sentence transformers
- **Graph-based Organization**: Neo4j integration for relationship mapping between memories
- **Multi-Model Support**: Support for multiple LLM providers (Gemini, Groq, etc.) via LiteLLM
- **Sandbox Environment**: Safe space for testing and experimentation
- **BM25 Hybrid Search**: Combines semantic and traditional keyword search
- **Async Task Processing**: Celery-based background task handling

## Technology Stack

### Backend
- **Framework**: FastAPI 0.136.1+
- **Language**: Python 3.12+
- **Primary Database**: PostgreSQL with pgvector extension (vector embeddings)
- **Graph Database**: Neo4j 5.19.0+ (relationship and knowledge graph management)
- **Cache Layer**: Redis 5.0.3+
- **Task Queue**: Celery 5.3.6+
- **ORM**: SQLAlchemy 2.0.29+
- **Embedding Model**: sentence-transformers (all-MiniLM-L6-v2, 384 dimensions)
- **LLM Routing**: LiteLLM (multi-provider LLM support)
- **LLM Framework**: LlamaIndex (RAG and indexing)
- **Ranking**: Rank-BM25 (hybrid search)
- **Authentication**: JWT with python-jose, passlib, bcrypt
- **Migration**: Alembic 1.13.1+
- **ML/Data**: scikit-learn 1.4.2+

### Frontend
- **Framework**: Next.js 16.2.4
- **UI Library**: React 19.2.4
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS 4 with typography plugin
- **State Management**: Zustand 5.0.12
- **HTTP Client**: Axios 1.15.2
- **Animation**: Framer Motion 12.38.0
- **Graph Visualization**: @xyflow/react 12.10.2
- **Markdown**: react-markdown with remark-gfm
- **Icons**: lucide-react 1.12.0
- **Linting**: ESLint 9
- **Type Safety**: TypeScript strict mode

## Project Structure

```
memolet/
├── backend/                      # FastAPI backend application
│   ├── app/                      # Application source code
│   │   ├── main.py              # FastAPI app initialization
│   │   ├── __init__.py
│   │   ├── api/                 # API routes and dependencies
│   │   │   ├── routes/          # Route definitions
│   │   │   │   ├── auth.py      # Authentication endpoints
│   │   │   │   ├── chat.py      # Chat endpoints
│   │   │   │   ├── memories.py  # Memolet management
│   │   │   │   └── sandbox.py   # Sandbox environment
│   │   │   └── deps.py          # Dependency injection
│   │   ├── core/                # Core configuration and security
│   │   │   ├── config.py        # Pydantic settings and env vars
│   │   │   ├── logger.py        # Logging configuration
│   │   │   └── security.py      # JWT and password utilities
│   │   ├── db/                  # Database connections
│   │   │   ├── session.py       # SQLAlchemy session management
│   │   │   ├── neo4j.py         # Neo4j connector
│   │   │   └── redis.py         # Redis client
│   │   ├── models/              # SQLAlchemy ORM models
│   │   │   ├── base.py          # Base model with common fields
│   │   │   └── memolet.py       # User, Conversation, ChatMessage, Memolet models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   │   ├── user.py          # User schemas
│   │   │   ├── chat.py          # Chat schemas
│   │   │   ├── memolet.py       # Memolet schemas
│   │   │   └── sandbox.py       # Sandbox schemas
│   │   ├── services/            # Business logic and external integrations
│   │   │   ├── chunking.py      # Text chunking utilities
│   │   │   ├── graphrag.py      # GraphRAG operations
│   │   │   ├── llm_router.py    # LLM selection and routing
│   │   │   ├── reinforcement.py # Reinforcement learning logic
│   │   │   ├── retrieval.py     # Memory retrieval service
│   │   │   ├── sandbox_service.py # Sandbox execution
│   │   │   └── trust_service.py # Trust scoring
│   │   └── worker/              # Celery tasks
│   │       ├── celery_app.py    # Celery initialization
│   │       └── tasks.py         # Async task definitions
│   ├── alembic/                 # Database migrations
│   │   ├── env.py               # Migration environment
│   │   ├── script.py.mako       # Migration template
│   │   └── versions/            # Individual migration files
│   ├── tests/                   # Test suite
│   │   ├── conftest.py          # Pytest configuration
│   │   ├── api/                 # API tests
│   │   └── services/            # Service tests
│   ├── pyproject.toml           # Poetry/setuptools configuration
│   ├── alembic.ini              # Alembic configuration
│   └── README.md                # Backend documentation
│
├── frontend/                     # Next.js frontend application
│   ├── app/                      # Next.js app directory
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page
│   │   ├── login/               # Authentication pages
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── workspace/           # Main application workspace
│   │       └── page.tsx
│   ├── components/              # Reusable React components
│   │   ├── auth/                # Authentication components
│   │   │   └── AuthGuard.tsx    # Protected route wrapper
│   │   ├── Canvas/              # Visualization components
│   │   │   ├── MemoletNodeComponent.tsx
│   │   │   └── SandboxCanvas.tsx
│   │   ├── Sidebar/             # Layout components
│   │   │   ├── LeftSidebar.tsx
│   │   │   ├── RightSidebar.tsx
│   │   │   └── DocViewer.tsx
│   │   └── Workspace/           # Workspace-specific components
│   │       ├── ChatOverlay.tsx
│   │       └── GetMemoryOverlay.tsx
│   ├── lib/                      # Utility functions and API client
│   │   ├── api.ts               # Axios API client
│   │   └── utils.ts             # Helper utilities
│   ├── store/                    # Zustand state management
│   │   ├── useAuthStore.ts      # Auth state
│   │   └── useMemoletStore.ts   # Memolet state
│   ├── public/                   # Static assets
│   ├── package.json             # Dependencies and scripts
│   ├── tsconfig.json            # TypeScript configuration
│   ├── tailwind.config.ts       # Tailwind CSS configuration
│   ├── next.config.ts           # Next.js configuration
│   ├── eslint.config.mjs        # ESLint configuration
│   └── README.md                # Frontend documentation
│
└── README.md                     # This file

```

## Prerequisites

Before you begin, ensure you have the following installed:

### Backend Requirements
- Python 3.12 or higher
- PostgreSQL 13+ with pgvector extension
- Redis 6+
- Neo4j 5+
- pip or Poetry (for dependency management)

### Frontend Requirements
- Node.js 18+ and npm
- npm or yarn

### Optional
- Docker and Docker Compose (for containerized setup)
- Alembic (database migrations)

## Installation

### Backend Setup

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Create a Python virtual environment**
   ```bash
   python3.12 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -e ".[dev]"
   ```

4. **Set up environment variables** (see Configuration section)

5. **Run database migrations**
   ```bash
   alembic upgrade head
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (see Configuration section)

## Configuration

### Backend Configuration

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Database
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/memolet_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password

# LLM Configuration (choose at least one)
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key

# JWT Security
JWT_SECRET=your_super_secret_key_change_this_in_production
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# Application
PROJECT_NAME=Memolet Backend
```

### Frontend Configuration

Create a `.env.local` file in the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Running the Application

### Backend

1. **Start the FastAPI server**
   ```bash
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`
   - API Documentation (Swagger UI): `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`
   - Health Check: `http://localhost:8000/health`

2. **Start Celery worker** (in a separate terminal)
   ```bash
   celery -A app.worker.celery_app worker --loglevel=info
   ```

3. **Optional: Start Celery Flower** (task monitoring)
   ```bash
   celery -A app.worker.celery_app flower
   ```
   Access at `http://localhost:5555`

### Frontend

1. **Start the development server**
   ```bash
   cd frontend
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

2. **Build for production**
   ```bash
   npm run build
   npm start
   ```

3. **Run linting**
   ```bash
   npm run lint
   ```

## Backend Architecture

### API Structure

The backend follows a layered architecture with clear separation of concerns:

```
Routes Layer (API Endpoints)
    ↓
Dependency Injection (FastAPI Dependencies)
    ↓
Request/Response Schemas (Pydantic Validation)
    ↓
Service Layer (Business Logic)
    ↓
Database & External Services
    ↓
Models (SQLAlchemy ORM)
```

### Core Components

#### 1. **Authentication Service** (`core/security.py`)
- JWT token generation and validation
- Password hashing with bcrypt
- Access token management with configurable expiration

#### 2. **Database Layer** (`db/`)
- **Session Management**: SQLAlchemy async session handling
- **Redis**: Caching and session storage
- **Neo4j**: Graph database for relationship mapping
- **PostgreSQL**: Primary relational database with pgvector for embeddings

#### 3. **Models** (`models/`)
- **User**: User accounts with authentication
- **Conversation**: Group related chat messages
- **ChatMessage**: Individual messages with role tracking
- **Memolet**: Semantic memory units with embeddings (384-dim vectors)

#### 4. **Service Layer** (`services/`)

| Service | Purpose |
|---------|---------|
| **llm_router** | Routes queries to optimal LLM based on requirements |
| **retrieval** | Semantic and keyword-based memory retrieval |
| **graphrag** | Graph-based RAG operations for relationship extraction |
| **trust_service** | Calculates confidence scores for stored information |
| **chunking** | Text preprocessing and chunking for embeddings |
| **sandbox_service** | Isolated execution environment for testing code |
| **reinforcement** | Feedback-based learning mechanisms |

#### 5. **API Routes** (`api/routes/`)

| Route | Endpoints | Purpose |
|-------|-----------|---------|
| **auth.py** | POST /login, /register | User authentication |
| **chat.py** | GET /models, POST /chat, POST /memories | Core chat and memory operations |
| **memories.py** | GET/POST/DELETE memories, search | Memolet management |
| **sandbox.py** | Sandbox environment | Safe execution and testing |

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Conversations Table
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    user_id UUID FOREIGN KEY REFERENCES users(id),
    title VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Chat Messages Table
```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID FOREIGN KEY REFERENCES conversations(id),
    role VARCHAR ('user' or 'ai'),
    content TEXT,
    citations JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Memolets Table
```sql
CREATE TABLE memolets (
    id UUID PRIMARY KEY,
    conversation_id UUID FOREIGN KEY REFERENCES conversations(id),
    text VARCHAR,
    weight FLOAT DEFAULT 1.0,
    keywords JSONB,
    embedding vector(384),  -- pgvector extension
    pos_x FLOAT,
    pos_y FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Data Flow

```
User Input
    ↓
[Authentication] → JWT Validation
    ↓
[Routing] → API Endpoint Selection
    ↓
[Schema Validation] → Pydantic Validation
    ↓
[Service Layer] → Business Logic Execution
    ├─→ Database Query (PostgreSQL)
    ├─→ Cache Check (Redis)
    ├─→ Embedding Generation (SentenceTransformers)
    ├─→ Vector Search (pgvector)
    └─→ LLM Inference (LiteLLM)
    ↓
[Response Schema] → Serialization
    ↓
Client Response
```

## Frontend Architecture

### Component Hierarchy

```
App (layout.tsx)
├── Root Layout
│   ├── Navigation
│   └── Routes
├── Page Routes
│   ├── / (Home)
│   ├── /login
│   ├── /register
│   └── /workspace
│       ├── LeftSidebar
│       │   ├── Conversation List
│       │   └── Navigation
│       ├── Main Canvas
│       │   ├── ChatOverlay
│       │   ├── MemoletNodeComponent (Graph Visualization)
│       │   └── SandboxCanvas
│       └── RightSidebar
│           ├── DocViewer
│           └── Properties Panel
```

### State Management

Uses Zustand for lightweight, scalable state management:

- **useAuthStore**: Authentication state, JWT tokens, user info
- **useMemoletStore**: Memolet data, graph state, UI state

### Key Features

1. **Responsive Design**: Tailwind CSS grid/flex layout
2. **Graph Visualization**: @xyflow/react for interactive memolet networks
3. **Real-time Updates**: Optimistic UI updates with error recovery
4. **Authentication Guard**: Protected routes via AuthGuard component
5. **Markdown Support**: Server-side markdown rendering with GFM

## API Documentation

### Authentication Endpoints

#### Register
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "user123",
  "password": "secure_password"
}

Response (200):
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "username": "user123"
  }
}
```

#### Login
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "user123",
  "password": "secure_password"
}

Response (200):
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

### Chat Endpoints

#### Get Available Models
```
GET /api/v1/chat/models
Authorization: Bearer {token}

Response (200):
{
  "models": ["gpt-4", "gemini-pro"],
  "default": "gpt-4"
}
```

#### Send Chat Message
```
POST /api/v1/chat/chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "What do you know about embeddings?",
  "active_memolet_ids": ["uuid1", "uuid2"],
  "model": "gpt-4",
  "conversation_id": "uuid-or-null"
}

Response (200):
{
  "reply": "Embeddings are...",
  "sentences": ["Embeddings are...", "They work by..."],
  "confidence_heatmap": [0.95, 0.87],
  "citations": [["source1", "source2"]],
  "conflict_warning": false,
  "conversation_id": "uuid"
}
```

#### Save Chat to Memory
```
POST /api/v1/chat/memories
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversation_id": "uuid",
  "messages": [
    {"user": "Question?", "ai": "Answer."}
  ]
}
```

### Memory Endpoints

#### Get All Memolets
```
GET /api/v1/memories
Authorization: Bearer {token}

Response (200):
{
  "memolets": [
    {
      "id": "uuid",
      "text": "Important fact",
      "weight": 1.0,
      "keywords": ["fact", "important"]
    }
  ]
}
```

#### Search Memolets
```
POST /api/v1/memories/search
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "machine learning",
  "limit": 10
}

Response (200):
{
  "results": [...]
}
```

#### Create Memolet
```
POST /api/v1/memories
Authorization: Bearer {token}
Content-Type: application/json

{
  "text": "Important information",
  "keywords": ["tag1", "tag2"],
  "weight": 1.5
}

Response (201):
{
  "id": "uuid",
  "text": "...",
  "embedding": [...]
}
```

#### Delete Memolet
```
DELETE /api/v1/memories/{memolet_id}
Authorization: Bearer {token}

Response (204): No Content
```

## Testing

### Backend Tests

Run the test suite:
```bash
cd backend
pytest tests/ -v
```

Run specific test:
```bash
pytest tests/api/test_auth.py -v
```

Run with coverage:
```bash
pytest tests/ --cov=app --cov-report=html
```

Test files:
- `test_auth.py`: Authentication endpoints
- `test_chat_sandbox.py`: Chat and sandbox operations
- `test_main.py`: Application initialization

### Frontend Tests

Run ESLint:
```bash
npm run lint
```

## Environment Variables Reference

### Backend (.env)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| DATABASE_URL | string | - | PostgreSQL connection string |
| REDIS_HOST | string | localhost | Redis host |
| REDIS_PORT | int | 6379 | Redis port |
| NEO4J_URI | string | - | Neo4j connection URI |
| NEO4J_USERNAME | string | - | Neo4j username |
| NEO4J_PASSWORD | string | - | Neo4j password |
| GEMINI_API_KEY | string | - | Google Gemini API key |
| GROQ_API_KEY | string | - | Groq API key |
| JWT_SECRET | string | - | JWT secret key |
| ACCESS_TOKEN_EXPIRE_MINUTES | int | 10080 | Token expiration (minutes) |

### Frontend (.env.local)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| NEXT_PUBLIC_API_URL | string | - | Backend API base URL |

## Performance Optimization

### Backend
- **Vector Caching**: Redis caching for frequently accessed embeddings
- **Database Indexing**: Indexes on frequently queried fields (username, conversation_id)
- **Async Operations**: Celery for heavy computations (embedding generation, LLM calls)
- **Connection Pooling**: SQLAlchemy with optimized pool settings

### Frontend
- **Code Splitting**: Automatic route-based code splitting in Next.js
- **Image Optimization**: Next.js Image component for responsive images
- **State Optimization**: Zustand for minimal re-renders
- **Memoization**: React.memo and useMemo for expensive computations

## Deployment

### Docker Deployment

Build and run with Docker Compose:
```bash
docker-compose up -d
```

### Production Checklist

- [ ] Set strong JWT_SECRET in environment
- [ ] Configure production database
- [ ] Set up proper CORS origins
- [ ] Enable HTTPS
- [ ] Configure proper logging
- [ ] Set up monitoring and alerts
- [ ] Run migrations: `alembic upgrade head`
- [ ] Build frontend: `npm run build`
- [ ] Use production HTTP server (Gunicorn for FastAPI)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- **Backend**: Follow PEP 8, use type hints, write docstrings
- **Frontend**: Follow ESLint rules, use TypeScript strict mode

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support & Contact

For questions, issues, or contributions, please open an issue in the repository.

---

**Version**: 0.1.0  
**Last Updated**: 2026  
**Status**: Active Development
