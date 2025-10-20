# syntax=docker/dockerfile:1

############################################
# Stage 1 — Builder
############################################
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install build dependencies (python/build-essential/git)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential git \
  && rm -rf /var/lib/apt/lists/*

ENV PYTHON=/usr/bin/python3

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build-time args (mark as Build Variables in Coolify)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL

# Promote build args to env so Next.js build can access them
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=${NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL}

# Build Next.js app
RUN npm run build

############################################
# Stage 2 — Runner (smaller production image)
############################################
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Create non-root user
ARG UID=1001
ARG GID=1001
RUN groupadd -g ${GID} appgroup \
  && useradd -m -u ${UID} -g appgroup appuser

# Copy production dependencies
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# COPY other required files if needed
# COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/app/api/run/reference ./app/api/run/reference

# Set runtime environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Optional: expose public vars at runtime
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=${NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL}

# Ensure correct ownership
RUN chown -R appuser:appgroup /app

# Use non-root user
USER appuser

# Expose port
EXPOSE 3000

# Start Next.js in production
CMD ["npm", "run", "start"]
