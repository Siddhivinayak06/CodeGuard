FROM node:18

# Install Docker CLI
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /app

# Copy package.json and install deps
COPY package*.json ./
RUN npm install

# Copy rest of the app
COPY . .

EXPOSE 5000
CMD ["node", "src/server.js"]
