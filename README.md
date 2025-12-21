# 🧠 CodeGuard – Online Code Evaluation Platform

CodeGuard is a full-stack web application designed for **secure, real-time code execution and evaluation**. It provides a robust environment for coding practice, assessments, and classroom management, powered by isolated Docker containers and an optimized pooling system.

---

## 🚀 Features

- 📝 **Advanced Code Editor** – Rich text editor with syntax highlighting for C, C++, Python, and Java.
- ⚙️ **Multi-Language Support** – Securely execute multiple languages in isolated environments.
- 🔒 **Sandboxed Execution** – Code runs in resource-limited Docker containers to ensure security and prevent system access.
- ⚡ **Interactive Mode** – Real-time code execution via WebSockets with an integrated terminal.
- 🏭 **Container Pooling** – Optimized "pre-warmed" container system to eliminate cold start latency.
- 👩‍🏫 **Faculty Dashboard** – Comprehensive tools for faculty to manage classes, create assignments, and view student analytics.
- 🍱 **Bento Admin Dashboard** – A modern, dense, and visually rich layout for system-wide overview and management.
- ✅ **Automated Evaluation** – Automatic grading against test cases with detailed feedback.
- 📶 **Interactive Terminal** – Full terminal experience inside the browser with support for interactive I/O.
- 🛠️ **Error Diagnostics** – Enhanced Python traceback parsing for cleaner, more readable error messages.
- 📊 **Submission History** – Detailed logs of past submissions and performance metrics.
- 🛡️ **Role-Based Access** – Secure authentication via Supabase with distinct roles (Student, Faculty, Admin).

---

## 🧩 Tech Stack

| Category | Technologies |
|-----------|---------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, Framer Motion, ShadCN UI |
| **Backend** | Node.js, Express.js (v5), WebSocket, BullMQ, Redis, Zod |
| **Database & Auth** | Supabase (PostgreSQL) |
| **Runtime** | Docker (Alpine Linux), C/C++, Python 3.12, Java 21 |
| **AI Integration** | Google Gemini (for insights and error parsing) |

---

## 🛠️ Installation & Setup

CodeGuard requires **Docker** to be running for code execution.

### 1. Clone the repository
```bash
git clone https://github.com/Siddhivinayak06/CodeGuard.git
cd CodeGuard
```

### 2. Backend Setup
The backend handles code execution and API requests.

```bash
cd backend

# Install dependencies
npm install

# Start the server (ensure Docker is running)
npm start
# OR for development
npm run dev
```
*The backend runs on http://localhost:5002*

### 3. Frontend Setup
The frontend provides the user interface.

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
*The frontend runs on http://localhost:3000*

### 4. Environment Variables
Create a `.env` file in the root directory (refer to `.env` in the root for a full list):

```bash
# Core Configuration
NEXT_PUBLIC_API_URL=http://localhost:5002
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Docker Execution Limits
DOCKER_MEMORY_LIMIT=128m
DOCKER_CPU_LIMIT=0.5
DOCKER_PIDS_LIMIT=128
DOCKER_JAVA_MEMORY_LIMIT=256m

# Container Pool (Pre-initialized hot containers)
DOCKER_POOL_SIZE_CPP=2
DOCKER_POOL_SIZE_PYTHON=2
DOCKER_POOL_SIZE_JAVA=1
DOCKER_POOL_SIZE_C=2
```

---

## 🧱 Project Structure

```bash
CodeGuard/
├── README.md
├── docker-compose.yml        # Multi-container orchestration
├── backend/                  # Node.js/Express Backend
│   ├── src/
│   │   ├── services/         # Core logic (Docker, Pool, AI, Sockets)
│   │   ├── routes/           # API Endpoints
│   │   ├── controllers/      # Request handlers
│   │   └── server.js         # Entry point
│   ├── runners/              # Language-specific wrappers
│   ├── Dockerfile.*          # Language-specific Dockerfiles
│   └── package.json
│
└── frontend/                 # Next.js 16 Frontend
    ├── app/                  # App Router
    │   ├── admin/            # Admin Bento Dashboard
    │   ├── faculty/          # Faculty Management UI
    │   ├── compiler/         # Interactive Editor
    │   └── auth/             # Supabase Auth logic
    ├── components/           # Reusable UI & Layouts
    ├── lib/                  # Hooks, Utils, & Supabase Client
    └── package.json
```
