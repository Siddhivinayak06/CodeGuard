# 🧠 CodeGuard – Online Code Evaluation Platform

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-success)
![Docker](https://img.shields.io/badge/docker-supported-blue)

**CodeGuard** is a production-ready, full-stack web application designed for **secure, real-time code execution and evaluation**. It provides a robust environment for coding practice, assessments, and classroom management, powered by isolated Docker containers and an optimized pooling system to eliminate cold starts.

---

## 🚀 Features

### Core Execution
- **⚡ Zero-Latency Execution** – "Pre-warmed" container pools ensure code runs instantly without cold start delays.
- **🔒 Secure Sandboxing** – All code executes in isolated, resource-constrained Docker containers (Alpine Linux) to prevent malicious activity.
- **📝 Advanced Editor** – Monaco-based rich text editor with glassmorphism UI, smart language switching, and smooth resizing capabilities.
- **📶 Interactive Terminal** – WebSocket-based terminal facilitating real-time partial output streaming, infinite loop protection, and interactive input.

### Student Experience
- **🔄 Smart Reattempt System** – Automated handling of practical reattempts with integrated approval workflow for failed submissions.
- **📱 Adaptive Navigation** – Mobile-optimized subject filtering and horizontal scroll views for efficient access on any device.
- **📈 Real-time Progress** – Instant feedback on submissions with detailed test case analysis and execution metrics.

### AI & Intelligence
- **🤖 Clinical AI Intelligence** – Integrated Gemini AI for smart error diagnostics, code explanation, and automated hints.

### User Experience
- **✨ Premium UI** – Modern glassmorphism design with fluid animations and responsive layouts.
- **📱 Fully Responsive** – Mobile-first design with card/table hybrid views that adapt to any screen size.
- **⏳ Skeleton Loaders** – High-fidelity skeleton components for instant page rendering without blocking loaders.

### Administration
- **👩‍🏫 Faculty & Admin Dashboards** – Specialized interfaces for managing classes, students, and system resources.
- **📊 Detailed Analytics** – Track submission history, performance metrics, and automated grading results.
- **📥 Bulk User Import** – Import users from CSV or Excel files with drag-and-drop support.

---

## 🧩 Tech Stack

| Domain | Technologies |
|:---|:---|
| **Frontend** | **Next.js 16**, React 19, TypeScript, Tailwind CSS, Framer Motion, ShadCN UI |
| **Backend** | **Node.js**, Express.js 5, WebSocket (ws), BullMQ, Redis, Zod |
| **Infrastructure** | **Docker**, Docker Compose, Supabase (PostgreSQL + Auth) |
| **AI** | **Google Gemini 1.5** (Flash model) for error analysis and coding assistance |
| **Runtimes** | Python 3.12, OpenJDK 21, GCC (C/C++) on Alpine Linux |

---

## 🗄️ Database Setup (Supabase)

CodeGuard relies on a robust PostgreSQL schema protected by **44 Row Level Security (RLS) policies**.

1.  **Locate the Schema**: The initialization script is located at [`database/init_schema.sql`](database/init_schema.sql).
2.  **Initialize Database**:
    - Go to your **Supabase Dashboard** → **SQL Editor**.
    - Copy & paste the contents of `database/init_schema.sql`.
    - Click **Run**.
3.  **Structure**:
    - **Tables**: Users, Practicals, Submissions, Test Cases, Grades, etc.
    - **Security**: Granular RLS policies ensure strict data isolation between Students, Faculty, and Admins.

---

## 🛠️ Instant Setup (Docker Compose)

The easiest way to run CodeGuard is using Docker Compose. This brings up the frontend, backend, Redis, and all language runtime environments automatically.

### Prerequisites
- Docker & Docker Compose
- Supabase credentials (for Auth/DB)

### 1. Configure Environment
Create a `.env` file in the root directory:
```env
# --- Application ---
# Environment mode
NODE_ENV=development
# Frontend URL (for CORS)
CORS_ORIGIN=http://localhost:3000
# Backend API URL (used by Frontend)
NEXT_PUBLIC_API_URL=http://localhost:5002

# --- Supabase & Auth ---
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# JWT Secret for internal signing
JWT_SECRET=super_secret_value

# --- AI Integration (Gemini) ---
AI_API_KEY=your_gemini_api_key
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash

# --- Infrastructure ---
REDIS_URL=redis://redis:6379

# --- Docker Execution Limits ---
DOCKER_MEMORY_LIMIT=128m
DOCKER_CPU_LIMIT=0.5
DOCKER_POOL_SIZE_PYTHON=2
EXECUTION_TIMEOUT=15
```

### Auth Behavior by Environment
- `NODE_ENV=development`: `/auth/register` is available.
- `NODE_ENV=production`: `/auth/register` is blocked by middleware and redirects to `/auth/login`.
- In production, the login page also hides the **Create an Account** action.

### 2. Launch
```bash
docker-compose up --build
```
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5002

---

## 💻 Manual Development Setup

If you prefer running services individually for development:

### Backend
1. Ensure **Docker** is running locally and **Redis** is available (default `localhost:6379`).
2. Navigate to `backend/` and install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Start the server (Development mode with hot-reload):
   ```bash
   npm run dev
   ```

### Frontend
1. Navigate to `frontend/`:
   ```bash
   cd frontend
   npm install
   ```
2. Start Next.js:
   ```bash
   npm run dev
   ```

### 🧪 Testing & Linting
- **Run Tests**: `npm test`
- **Lint Code**: `npm run lint`

---

## 🧱 Architecture Overview

```mermaid
flowchart LR
   U[User Browser]

   subgraph FE[Frontend Layer]
      N[Next.js App]
      MW[Edge Middleware\nAuth + Route Guards]
      ED[Monaco Editor + Terminal UI]
   end

   subgraph BE[Backend Layer]
      API[Express API]
      WS[WebSocket Gateway]
      Q[BullMQ Workers]
   end

   subgraph EX[Execution Layer]
      RP[Runtime Pool Manager]
      PY[(Python Container Pool)]
      JV[(Java Container Pool)]
      CC[(C/C++ Container Pool)]
   end

   subgraph DATA[Data & Services]
      SB[(Supabase\nPostgreSQL + Auth)]
      RD[(Redis)]
      AI[Gemini AI]
   end

   U -->|HTTP| N
   U <-->|WebSocket| WS
   N --> MW
   MW -->|Session validation| SB
   N -->|API calls| API
   ED -->|Run / submit code| API

   API -->|Auth + data ops| SB
   API -->|Enqueue jobs| RD
   RD -->|Dispatch| Q
   Q --> RP

   RP --> PY
   RP --> JV
   RP --> CC

   PY -->|Execution result| API
   JV -->|Execution result| API
   CC -->|Execution result| API

   API -->|Hints / diagnostics| AI
   API -->|Live output| WS
   WS -->|Stream output| U
```

---

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request for review.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


