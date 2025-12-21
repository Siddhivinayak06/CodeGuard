# syntax=docker/dockerfile:1

############################################
# Stage 1 — Builder
############################################
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies required for building (if any native deps are needed)
# libc6-compat is often needed for Next.js/SWC on Alpine
RUN apk add --no-cache libc6-compat

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build-time args
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
ARG SUPABASE_SERVICE_ROLE_KEY

# Promote build args to env
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=${NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
# SKIP_ENV_VALIDATION helps preventing build errors if some env vars are missing during build time
ENV SKIP_ENV_VALIDATION=1

# Build Next.js app
RUN npm run build

############################################
# Stage 2 — Runner (smaller production image)
############################################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for healthcheck
RUN apk add --no-cache curl libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy package files and install production dependencies
COPY --from=builder /app/package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev

# Copy build output and public assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Start Next.js production server
CMD ["npm", "run", "start"]
