# Stage 1: Build the application
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build essentials for native modules (like better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies for building
# Using --legacy-peer-deps to avoid potential conflicts in different environments
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Build the frontend and the backend server
RUN npm run build

# Stage 2: Production environment
FROM node:20-bookworm-slim

WORKDIR /app

# Install production build essentials and runtime libs for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Only install production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Create a directory for the database
RUN mkdir -p /app/data && chmod 777 /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/id_cards.db

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
