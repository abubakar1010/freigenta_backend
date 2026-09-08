# ─── Build stage ─────────────────────────────────────────────────────────────
# Needs devDependencies (typescript) to compile, so it cannot be the runtime.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copy manifests first so `npm ci` is only re-run when dependencies change,
# not on every source edit.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Production dependencies only — drops typescript, ts-node and nodemon.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist

# s3.service.ts writes here when an S3 upload falls back to local disk, and
# server.ts serves it at /uploads. Mount a volume over it in compose, or the
# files vanish on redeploy.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Drop root. Everything above is owned by root and only read at runtime.
USER node

EXPOSE 8080

# `--init` in compose reaps zombies; node stays PID 1 here so it receives the
# SIGTERM that app.ts's gracefulShutdown handler is waiting for.
CMD ["node", "dist/app.js"]
