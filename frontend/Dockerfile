# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies (including devDependencies needed for build)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build frontend for production
RUN npm run build

# Stage 2: Production image (runtime only)
FROM node:20-alpine AS runner
WORKDIR /app

# Copy only production-ready build files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
 

# Install only production dependencies
RUN npm install --production --legacy-peer-deps

# Expose frontend port
EXPOSE 3000

# Start Next.js in production mode
CMD ["npm", "run", "start"]
