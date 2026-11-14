FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates tar \
  && rm -rf /var/lib/apt/lists/*

# Install official Linux dreamina-canvas CLI into /usr/local/bin/dreamina-canvas (non-fatal offline fallback)
RUN set -eux; \
  ARCH="$(uname -m)"; \
  case "$ARCH" in \
    x86_64|amd64) CLI_ARCH="linux_amd64" ;; \
    arm64|aarch64) CLI_ARCH="linux_arm64" ;; \
    *) CLI_ARCH="" ;; \
  esac; \
  if DREAMINA_CANVAS_INSTALL_DIR=/usr/local/bin bash -c 'curl -fsSL https://dreamina.capcut.com/canvas-cli/install.sh | bash' 2>/dev/null; then \
    echo "Installed dreamina-canvas via official canvas-cli/install.sh"; \
  elif DREAMINA_CANVAS_INSTALL_DIR=/usr/local/bin bash -c 'curl -fsSL https://dreamina.capcut.com/cli/install.sh | bash' 2>/dev/null; then \
    echo "Installed dreamina-canvas via cli/install.sh"; \
  elif [ -n "$CLI_ARCH" ] && curl -fsSL "https://dreamina.capcut.com/canvas-cli/install/1_0_0_31/dreamina-canvas_${CLI_ARCH}" -o /usr/local/bin/dreamina-canvas; then \
    echo "Installed dreamina-canvas direct binary (${CLI_ARCH})"; \
  else \
    echo "Warning: offline or unavailable dreamina-canvas download; skipping pre-install"; \
  fi; \
  if [ -f /usr/local/bin/dreamina-canvas ]; then \
    chmod 0755 /usr/local/bin/dreamina-canvas; \
  fi

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
  && mkdir -p /data /data/projects /data/media \
  && mkdir -p /app/apps/web-studio/dist/brands /app/apps/web-studio/dist/media \
  && cp -R /app/apps/web-studio/public/brands/. /app/apps/web-studio/dist/brands/ \
  && if [ -d /app/apps/web-studio/public/media ]; then cp -R /app/apps/web-studio/public/media/. /app/apps/web-studio/dist/media/ || true; fi

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV OPEN_DREAMFLOW_DATA_DIR=/data
ENV DREAMFLOW_DATA_DIR=/data
ENV DREAMFLOW_MEDIA_DIR=/data/media

EXPOSE 3001

CMD ["node", "bin/open-dreamflow.mjs", "start", "--host", "0.0.0.0", "--port", "3001", "--data-dir", "/data"]
