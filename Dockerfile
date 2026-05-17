# Stage 1: Build the application
FROM node:20 AS builder

WORKDIR /app

# Install build essentials for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install ALL dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Environment variables for build
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Run build steps separately for better error identification
RUN npm run lint
RUN npx vite build
RUN npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs

# Stage 2: Production environment
FROM node:20-slim

WORKDIR /app

# Install production runtime libs
RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
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
