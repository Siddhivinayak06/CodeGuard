# Deploying CodeGuard with Coolify

This guide explains how to deploy the entire CodeGuard stack (Next.js Frontend, Node.js Backend, Redis, and Code Sandbox Runners) using [Coolify](https://coolify.io/), an open-source, self-hostable alternative to Vercel/Heroku.

Since CodeGuard relies on Docker to create ephemeral sandboxes for student code execution, Coolify is a perfect fit because it natively supports running Docker Compose stacks with Docker socket access.

## Prerequisites

1.  **A Virtual Private Server (VPS):**
    *   **Minimum Requirements:** 4 vCPUs, 8GB RAM, 50GB SSD (to support a concurrent pool of isolated student containers).
    *   **Recommended Providers:** Hetzner, DigitalOcean, Linode, AWS EC2, or Google Cloud Compute Engine.
    *   **OS:** Ubuntu 22.04 LTS (recommended).
2.  **Domains:**
    *   A domain or subdomain for the frontend (e.g., `codeguard.yourdomain.com`).
    *   A subdomain for the backend API (e.g., `api.codeguard.yourdomain.com`).
3.  **Supabase Account:** (Hosted Supabase is strongly recommended over self-hosting the database for production reliability).

---

## Step 1: Install Coolify on your Server

SSH into your fresh VPS as the `root` user and run the official Coolify installation script:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Once the installation finishes:
1.  Open your browser and navigate to `http://<your-server-ip>:8000`.
2.  Create your first admin account and login.
3.  Navigate to **Servers** and ensure `localhost` is validated and reachable.

---

## Step 2: Create a New Project

1.  In the Coolify dashboard, go to **Projects** -> **Add New Project**.
2.  Name it `CodeGuard` and select a Production environment.
3.  Click **+ Add Resource** -> select **Docker Compose**.
4.  You have two options to pull your code:
    *   **Connect Git Repository:** Link your GitHub account and point it to the CodeGuard repository.
    *   **Paste Compose File directly:** Select "Raw Docker Compose" and paste the contents of your `docker-compose.yml`.

*(We recommend connecting your Git Repository so you can trigger automatic deployments on push).*

---

## Step 3: Configure Environment Variables

Before deploying, navigate to the **Environment Variables** tab of your new Coolify resource. You must populate the following `.env` values required by the CodeGuard stack:

```env
# Server Configuration
NODE_ENV=production
CORS_ORIGIN=https://codeguard.yourdomain.com
BACKEND_DOMAIN=api.codeguard.yourdomain.com
FRONTEND_DOMAIN=codeguard.yourdomain.com

# Supabase Credentials (from your Supabase Dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1Ni...
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://codeguard.yourdomain.com/auth/callback

# API Connections
NEXT_PUBLIC_API_URL=https://api.codeguard.yourdomain.com

# AI Provider (Google Gemini for speed at scale)
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your_gemini_api_key_here

# CodeRunner Configuration
MAX_CONCURRENT_JOBS=250
WORKERS_PER_CONTAINER=20

# Pool Sizes
DOCKER_POOL_SIZE_PYTHON=10
DOCKER_POOL_SIZE_JAVA=5
DOCKER_POOL_SIZE_CPP=10
DOCKER_POOL_SIZE_C=10
```

> [!IMPORTANT]
> Make sure to replace `yourdomain.com` with your actual domain name, and paste your real Supabase/Gemini keys.

---

## Step 4: Configure Domains and Routing

Because the `docker-compose.yml` is already optimized with Traefik labels, Coolify will automatically map your services to domains if the environment variables are set correctly:

1. In the Coolify Dashboard, click on the **frontend** service in your stack.
2. In the **General** settings, ensure the **Domains** field is set to: `https://codeguard.yourdomain.com`.
3. Go back and click on the **backend** service. Ensure its **Domains** field is set to `https://api.codeguard.yourdomain.com`.
4. Ensure your DNS provider (e.g., Cloudflare, Route53) has `A` records pointing `codeguard.yourdomain.com` and `api.codeguard.yourdomain.com` to your VPS IP address.

---

## Step 5: Adjust Docker Socket Permissions

CodeGuard relies on the `docker-socket-proxy` service to allow the backend to spin up compilation containers securely. The `docker-compose.yml` maps `/var/run/docker.sock` directly into the proxy container:

```yaml
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

Coolify supports this natively. However, to ensure the backend can communicate with it, make sure the network created by Coolify allows TCP traffic between `backend` and `docker-socket-proxy`. 

CodeGuard handles this internally via:
`DOCKER_HOST=tcp://docker-socket-proxy:2375` (This is already in your `docker-compose.yml`).

---

## Step 6: Deploy

1.  Click the purple **Deploy** button in the top right corner of the Coolify dashboard.
2.  Coolify will read your `docker-compose.yml`, pull/build the necessary Next.js and Node.js images, start Redis, and spin up the runtime containers (`c-runtime`, `java-runtime`, `python-runtime`).
3.  Click on the "Deployment Logs" to watch the real-time progress. The initial build might take 5-10 minutes as Next.js creates its optimized production bundle.

## Step 7: Post-Deployment Verification

Once deployed, run these checks to ensure everything is working:

1.  **Frontend:** Navigate to `https://codeguard.yourdomain.com` and attempt to log in.
2.  **WebSockets:** Open a practical in Interactive mode. Open your browser's network tab and verify the standard WebSocket connection upgrades successfully to `api.codeguard.yourdomain.com`.
3.  **Compilers:** Submit a Python or C code snippet to verify that the backend can successfully reach out to the Docker proxy and execute the compiler containers.

### Troubleshooting Code Execution Issues
If code compilation fails immediately with an internal server error:
* Check the **Backend** logs in Coolify.
* If you see `ENOTFOUND redis`, ensure the redis service started before the backend.
* If you see `ECONNREFUSED docker-socket-proxy`, ensure that docker socket is properly bound to `/var/run/docker.sock:ro` in the proxy container.
