# Use lightweight Node.js base image
FROM node:20-alpine

WORKDIR /app

# Install Docker CLI (needed for dockerrunner.js to run docker inside container)
RUN apk add --no-cache docker-cli

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["node", "src/server.js"]

