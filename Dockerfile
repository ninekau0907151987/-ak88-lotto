# ==========================================
# 1. Build Stage
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source tree and compile (Vite Frontend + Node Backend)
COPY . .
RUN npm run build

# ==========================================
# 2. Production Runner Stage
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production curl/wget for health check
RUN apk --no-cache add curl

# Copy runtime assets and compiled bundles
COPY package*.json ./
COPY firebase-applet-config*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Expose internal HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/api/v1/health || exit 1

# Start AK88 Lotto Production Engine
CMD ["node", "dist/server.cjs"]
