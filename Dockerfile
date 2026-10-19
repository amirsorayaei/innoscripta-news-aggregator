# syntax=docker/dockerfile:1

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS base
# Keep in sync with "packageManager" in package.json.
ARG PNPM_VERSION=10.33.0
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY . .
RUN pnpm build:client && pnpm build:server

FROM base AS runtime
ENV NODE_ENV=production \
    NEWS_MODE=demo \
    PORT=8080
COPY package.json pnpm-lock.yaml ./
# Scripts are skipped because dev-only tools such as Husky are not installed.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --store-dir /pnpm/store
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "dist/server/index.js"]
