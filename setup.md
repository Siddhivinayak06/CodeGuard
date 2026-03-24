# CodeGuard - Local Setup Guide

CodeGuard is a full-stack platform consisting of a Next.js Frontend, a Node.js/Express Backend, and a PostgreSQL database powered by Supabase. Code execution is isolated securely using ephemeral Docker containers.

This guide will help you set up CodeGuard on your local machine for development.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
*   **[Node.js](https://nodejs.org/)** (v18 or higher)
*   **[npm](https://www.npmjs.com/)** or **[yarn](https://yarnpkg.com/)**
*   **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Must be running for code isolation to work)
*   **[Git](https://git-scm.com/)**

---

## 1. Clone the Repository

```bash
git clone https://github.com/Siddhivinayak06/CodeGuard.git
cd CodeGuard
```

---

## 2. Environment Variables Setup

You need to set up environment variables for both the **Frontend** and the **Backend**. 
Create `.env` files from their respective templates.

### Frontend Environment Variables
Navigate to the `frontend` directory and copy the `.env.example` file:

```bash
cd frontend
cp .env.example .env.local
```
*Open `frontend/.env.local` and populate your Supabase project URL and anon key. (You can create a free account at [Supabase](https://supabase.com) if you don't have one).*

### Backend Environment Variables
Navigate to the `backend` directory and copy the `.env.example` file:

```bash
cd ../backend
cp .env.example .env
```
*Open `backend/.env` and ensure `AI_PROVIDER=gemini` and paste your Gemini API Key. It defaults to connecting to a local Redis and overriding Docker socket proxy.*

---

## 3. Database Setup (Supabase)

CodeGuard relies on Supabase for Auth, Database (PostgreSQL), and Realtime features.

1.  Create a new project in your Supabase Dashboard.
2.  Navigate to the **SQL Editor** in Supabase and execute the schema migrations located in the `supabase/migrations/` folder of this repository (execute them in chronological order).
3.  Ensure your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` map correctly to your fresh project.

*(Optional: If you want to use Supabase CLI for local development, run `npx supabase start` in the project root instead).*

---

## 4. Running the Project

You can either run the entire stack instantly via Docker Compose, or run the services manually.

### Method A: Docker Compose (Recommended)
This is the easiest method. It spins up the frontend, backend, isolated docker-socket-proxy, redis, and idle runner containers automatically.

Ensure Docker is running, then execute from the root of the repository:
```bash
docker-compose up --build
```
*   **Frontend Check:** Open [http://localhost:3000](http://localhost:3000)
*   **Backend Check:** Open [http://localhost:5002/health](http://localhost:5002/health)

### Method B: Manual Development Mode

If you are actively developing and want Hot Module Replacement (HMR) without restarting docker containers, run the services locally.

**1. Start Support Services (Redis & Runtimes)**
Even in manual mode, the backend needs Redis and the Docker Socket proxy.
```bash
docker-compose up redis docker-socket-proxy python-runtime java-runtime c-runtime -d
```

**2. Start Backend**
```bash
cd backend
npm install
npm run dev
```
*(Backend runs on [http://localhost:5002](http://localhost:5002))*

**3. Start Frontend**
Open a new terminal tab:
```bash
cd frontend
npm install
npm run dev
```
*(Frontend runs on [http://localhost:3000](http://localhost:3000))*

---

## Troubleshooting

*   **Code execution fails / `ECONNREFUSED` / Socket Proxy Errors:** Ensure `docker-socket-proxy` is running. If you are running the backend manually (Method B), ensure `DOCKER_HOST=tcp://localhost:2375` is exported, as the proxy port-forwards the socket via TCP.
*   **`ENOTFOUND redis` Check:** The backend expects a Redis server. If developing locally outside of Docker, ensure you have Redis installed locally (`brew install redis` and `brew services start redis`) and change `REDIS_URL` to `redis://localhost:6379`.
*   **Database connection fails:** Verify your Supabase API keys in `.env` and `.env.local`.

---

🎉 **You're all set!** Happy coding on CodeGuard.
