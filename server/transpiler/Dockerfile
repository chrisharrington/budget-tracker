FROM node:lts
WORKDIR /app
CMD npm install -g bun  && \
    bun install && \
    ./node_modules/.bin/tsc -w