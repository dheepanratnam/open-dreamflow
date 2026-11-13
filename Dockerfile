FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/provider-sdk/package.json ./packages/provider-sdk/
COPY packages/mcp-client/package.json ./packages/mcp-client/
COPY apps/web-studio/package.json ./apps/web-studio/

RUN npm install

COPY packages ./packages
COPY apps ./apps
COPY extensions ./extensions
COPY bin ./bin
COPY scripts ./scripts

RUN npm run build:sdk \
  && npm run build:mcp \
  && npm run build \
  && mkdir -p /app/.dreamflow-data.nosync/projects \
  && cp -R /app/apps/web-studio/public/media /app/apps/web-studio/dist/media || true

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

CMD ["node", "bin/open-dreamflow.mjs", "start", "--host", "0.0.0.0", "--port", "3001"]
