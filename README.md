# 🧠 CodeGuard – Online Code Evaluation Platform

CodeGuard is a full-stack web application that allows users to **write, execute, and evaluate code securely in real-time**.  
Built using **Next.js**, **Node.js**, **Express.js**, **Supabase**, **Docker**, **Python**, and **C**, it provides a safe, isolated, and scalable environment for coding practice and assessments.

---

## 🚀 Features

- 📝 **Code Editor** – Write and run code directly in the browser.  
- ⚙️ **Multi-Language Support** – Supports C and Python code execution.  
- 🔒 **Secure Execution** – Runs code in Docker containers for isolation and safety.  
- ✅ **Automated Evaluation** – Executes code against test cases to verify correctness.  
- 👤 **User Authentication** – Integrated Supabase for signup, login, and user management.  
- 📊 **Submission History** – Stores and displays users’ past submissions and results.  
- 🌐 **Responsive Design** – Modern UI built with Next.js for seamless experience across devices.

---

## 🧩 Tech Stack

| Category | Technologies |
|-----------|---------------|
| **Frontend** | Next.js, React, Tailwind CSS |
| **Backend** | Node.js, Express.js |
| **Database & Auth** | Supabase |
| **Code Execution** | Docker, Python, C |
| **Version Control** | Git & GitHub |

---

## 🛠️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/Siddhivinayak06/CodeGuard.git
cd codeguard
```

### 2. Install dependencies
```bash
npm install
```
### 3. Set up environment variables
Create a .env.local file and add the following:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### 4. Run the development server
```bash
npm run dev
```
The app will be live at http://localhost:3000

---

## 🧱 Project Structure
```bash
CodeGuard/
├── app/                  # Next.js App Router
├── src/
│   ├── components/       # Reusable UI components
│   ├── server/           # Express backend
│   ├── utils/            # Helper functions and Docker scripts
├── public/               # Static assets
├── Dockerfile            # Docker configuration for isolated code execution
├── package.json
└── README.md
```

## 🧪 How It Works
- User writes code in the online editor.
- The backend sends the code to a Docker container.
- The container compiles/runs the code (C/Python).
- The result and output are returned to the user in real-time.
- Submissions are stored securely in Supabase for later viewing.
