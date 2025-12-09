# 🧠 CodeGuard – Online Code Evaluation Platform

CodeGuard is a full-stack web application designed for **secure, real-time code execution and evaluation**. It provides a robust environment for coding practice, assessments, and classroom management, powered by isolated Docker containers.

---

## 🚀 Features

- 📝 **Advanced Code Editor** – Rich text editor with syntax highlighting for C, Python, and Java.
- ⚙️ **Multi-Language Support** – Securely execute C, Python, and Java code.
- 🔒 **Sandboxed Execution** – Code runs in isolated Docker containers to ensure security and prevent system access.
- ⚡ **Interactive Mode** – Real-time code execution with immediate feedback for interactive learning.
- 👩‍🏫 **Faculty Dashboard** – Comprehensive tools for faculty to manage classes, create assignments, and view student analytics.
- 📁 **File Integrations** – Support for uploading CSV and Excel files for data-driven assignments.
- ✅ **Automated Evaluation** – Automatic grading against test cases.
- 📊 **Submission History** – detailed logs of past submissions and performance.
- 🛡️ **Role-Based Access** – Secure authentication via Supabase with distinct roles (Student, Faculty, Admin).

---

## 🧩 Tech Stack

| Category | Technologies |
|-----------|---------------|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS, ShadCN UI |
| **Backend** | Node.js, Express.js, WebSocket, Zod |
| **Database & Auth** | Supabase |
| **Runtime** | Docker (Alpine Linux), C, Python, Java |
| **Validation** | Zod (Schema Validation) |

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
*The backend runs on http://localhost:5000*

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
Create a `.env` file in the `frontend` root:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

And a `.env` file in the `backend` root:
```bash
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
```

---

## 🧱 Project Structure

```bash
CodeGuard/
├── README.md
├── docker-compose.yml
├── backend/                  # Node.js/Express Backend
│   ├── src/
│   │   ├── server.js         # Entry point
│   │   ├── routes/           # API Routes
│   │   ├── runners/          # Docker Execution Logic
│   │   └── interactive_wrapper.c # Interactive execution wrapper
│   ├── Dockerfile.*          # Language-specific Dockerfiles
│   └── package.json
│
└── frontend/                 # Next.js 16 Frontend
    ├── app/                  # App Router Pages
    │   ├── faculty/          # Dashboard Routes
    │   ├── compiler/         # Code Editor Page
    │   └── page.tsx          # Landing Page
    ├── components/           # Reusable UI Components
    ├── lib/                  # Utilities & Supabase Client
    └── package.json
```
