FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json app.json ./
COPY api-server/package.json api-server/package.json
COPY bean-travel/package.json bean-travel/package.json
COPY lib-db/package.json lib-db/package.json

RUN corepack pnpm install --no-frozen-lockfile

COPY api-server api-server
COPY bean-travel bean-travel
COPY lib-db lib-db
COPY .easignore .easignore

RUN corepack pnpm run build:deploy

ENV NODE_ENV=production
ENV WEB_DIST_DIR=/app/bean-travel/dist

EXPOSE 3001

CMD ["node", "--enable-source-maps", "api-server/dist/index.mjs"]
