FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Build (if needed)
FROM base AS build
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app .

EXPOSE 3001

CMD ["bun", "run", "start"]
