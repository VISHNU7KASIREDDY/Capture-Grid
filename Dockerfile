# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:18-alpine AS base
WORKDIR /app

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:18-alpine AS runtime
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=base --chown=appuser:appgroup /app /app

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/healthz || exit 1

CMD ["node", "server/index.js"]
