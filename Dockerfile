FROM alpine

RUN apk add --no-cache nodejs pnpm

USER 1000:1000

WORKDIR /app

COPY pnpm-lock.yaml ./
COPY package.json ./

RUN pnpm install --frozen-lockfile

FROM alpine

RUN apk add --no-cache nodejs

USER 1000:1000

WORKDIR /app

COPY --from=0 /app/node_modules ./node_modules

COPY server.js ./
COPY public ./public

ENTRYPOINT [ "node", "server.js" ]
