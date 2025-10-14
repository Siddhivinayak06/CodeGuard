# Use a lightweight Node.js runtime
FROM node:20-slim

# Install build tools for native modules and Docker CLI
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency manifests first for caching
COPY package*.json ./

# Install dependencies (this will build node-pty correctly)
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

# Expose ports for both services
EXPOSE 5000

# Set environment variables defaults (can be overridden via docker-compose)
ENV NODE_ENV=production
ENV PORT=5000
ENV WORKSPACE_DIR=/app/workspace

# Create workspace directory if it doesn't exist
RUN mkdir -p /app/workspace

# Run the combined server (Express + WebSocket)
CMD ["node", "src/server.js"]
