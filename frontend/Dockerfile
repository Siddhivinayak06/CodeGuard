# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Run
FROM node:18-alpine
WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "run", "start"]
