FROM oven/bun:1.3.1-alpine AS deps

WORKDIR /app

# required by better-sqlite3
#RUN apk add --update --no-cache python3 build-base gcc && ln -sf /usr/bin/python3 /usr/bin/python;

COPY package.json .

RUN bun i;

FROM deps AS build

WORKDIR /app

COPY prisma/ prisma
COPY src/ src
COPY swagger.yml .
COPY tsconfig.json .
COPY swagger.yml .

RUN bun db:generate;
RUN bun run build;

FROM oven/bun:1.3.1-alpine AS runner

WORKDIR /app

COPY entrypoint.sh .
COPY prisma/ prisma
COPY --from=build /app/dist/ dist
COPY swagger.yml .
COPY package.json .
COPY prisma.config.ts .
COPY package.json .

RUN bun i --production;

ENV PORT=3000
ENV LOG_LEVEL="info"
ENV DATABASE_URL="file:/app/db/sugarbox.sqlite"

ENTRYPOINT ["/usr/bin/env"]
CMD ["sh", "/app/entrypoint.sh"]
