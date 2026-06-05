# Shared runtime image for both server processes. The `api` (Express) and
# `mail` (IMAP listener) services build from this single image and differ only
# by the command set in docker-compose.yml (`bun run api:run` vs
# `bun run mail:run`).
FROM oven/bun:latest AS runtime

WORKDIR /app

# Install dependencies first so the layer caches well and the anonymous
# /app/node_modules volume in docker-compose.yml initializes with deps.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . /app

ENV NODE_ENV=production

EXPOSE 9999

# Re-run install on each start so package.json / bun.lock changes from the
# bind mount land in the anonymous /app/node_modules volume. Near no-op when
# the lock already matches what's installed. NODE_ENV is forced to development
# for the install step so devDependencies come along even though the image's
# default NODE_ENV is production. The command (api:run / mail:run) is provided
# by compose and lands in "$0"/"$@".
ENTRYPOINT ["sh", "-c", "NODE_ENV=development bun install --frozen-lockfile && exec \"$0\" \"$@\""]
