FROM oven/bun:1.3.1-alpine AS deps

WORKDIR /app

# required by better-sqlite3
#RUN apk add --update --no-cache python3 build-base gcc && ln -sf /usr/bin/python3 /usr/bin/python;

COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/
COPY packages/extension/package.json packages/extension/

RUN bun i --frozen-lockfile;

FROM deps AS build

WORKDIR /app/packages/server

COPY packages/server/prisma ./prisma
COPY packages/server/src ./src
COPY packages/server/swagger.yml .
COPY packages/server/tsconfig.json .

RUN bun db:generate;
RUN SKIP_ENV_VALIDATION=1 bun run build;

FROM oven/bun:1.3.1-alpine AS prod_deps

WORKDIR /app

RUN mkdir -p /app/db;

COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/
COPY packages/extension/package.json packages/extension/

RUN bun i --frozen-lockfile --production;

FROM prod_deps AS runner

WORKDIR /app/packages/server

COPY packages/server/prisma ./prisma
COPY packages/server/swagger.yml .
COPY packages/server/prisma.config.ts .
COPY packages/server/package.json .

COPY --from=build /app/packages/server/dist/ ./dist

ENV PORT=3000
ENV LOG_LEVEL="info"
ENV DATABASE_URL="file:/app/db/sugarbox.sqlite"

ENTRYPOINT ["/usr/bin/env"]
CMD ["sh", "-c", "bun run db:migrate && bun run dist/index.js"]