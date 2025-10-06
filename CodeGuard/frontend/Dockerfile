# Stage 1: Build
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y python3 build-essential git && rm -rf /var/lib/apt/lists/*
ENV PYTHON=/usr/bin/python3

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Pass environment variables for build-time (Supabase, etc.)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Build Next.js
RUN npm run build

# Stage 2: Production
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Copy production build files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Copy environment variables for runtime
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Expose port
EXPOSE 3000

# Start Next.js in production
CMD ["npm", "run", "start"]
