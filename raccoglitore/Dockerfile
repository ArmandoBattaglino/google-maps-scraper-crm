# Il raccoglitore: Node + Chrome, legge Google Maps e i siti e scrive nel database.
FROM node:24.21.0-bookworm-slim

# Chrome fissato (Chrome for Testing): patchright apre il canale «chrome», cioè /opt/google/chrome/chrome
ARG CHROME=155.0.8059.86
ARG CHROME_SHA256=4262809d09593a334d5c5469d952ff8bc53ac3d9159ea8ed18d40218e6b0ea3b

WORKDIR /app
ENV NODE_ENV=production RACCOLTE_PORTA=5320
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=error && npm cache clean --force
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip fontconfig fonts-liberation \
 && npx patchright install-deps chromium \
 && curl -fsSLo /tmp/chrome.zip "https://storage.googleapis.com/chrome-for-testing-public/$CHROME/linux64/chrome-linux64.zip" \
 && echo "$CHROME_SHA256  /tmp/chrome.zip" | sha256sum -c - \
 && unzip -q /tmp/chrome.zip -d /opt && rm /tmp/chrome.zip \
 && mkdir -p /opt/google/chrome && ln -s /opt/chrome-linux64/chrome /opt/google/chrome/chrome \
 && rm -rf /var/lib/apt/lists/*
COPY . .
USER node
EXPOSE 5320
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD curl -fsS http://127.0.0.1:5320/salute >/dev/null || exit 1
CMD ["node", "raccoglitore.mjs"]
