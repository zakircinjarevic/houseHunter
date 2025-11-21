# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install sqlite3 dependencies
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port (Railway sets PORT automatically)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]

