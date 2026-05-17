# Stage 1: Build the application
FROM node:20 AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend and the backend server
RUN npm run build

# Stage 2: Production environment
FROM node:20-slim

WORKDIR /app

# Install production dependencies only
# better-sqlite3 requires native build tools, so we might need them even for install
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Create a directory for the database to ensure it's predictable
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
