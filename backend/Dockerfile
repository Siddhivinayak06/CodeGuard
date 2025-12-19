# Stage 1: Build native modules (node-pty)
FROM node:20-alpine AS builder

# Install build tools for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    linux-headers

WORKDIR /app
COPY package*.json ./
# Install dependencies (only production)
RUN npm install --omit=dev

# Stage 2: Final lightweight runtime
FROM node:20-alpine

# Install ONLY the Docker CLI (instead of the huge docker.io package)
# libc6-compat provides compatibility for native modules built on Alpine
RUN apk add --no-cache \
    docker-cli \
    curl \
    libc6-compat

WORKDIR /app

# Copy only the compiled node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Expose backend port
EXPOSE 5002

# Set environment variables
ENV NODE_ENV=production \
    PORT=5002 \
    WORKSPACE_DIR=/app/workspace

# Create workspace directory
RUN mkdir -p /app/workspace && \
    adduser -D -u 1000 appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user for security
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fs http://localhost:5002/health || exit 1

# Run the server
CMD ["node", "src/server.js"]