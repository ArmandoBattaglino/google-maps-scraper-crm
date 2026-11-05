# Il servizio del CRM: l'API e l'app (web/dist) sulla porta 5330.
FROM node:22-bookworm-slim AS build
WORKDIR /w
COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci --no-audit --no-fund --loglevel=error
COPY web/ ./web/
RUN cd web && npm run build

FROM node:22-alpine AS crm
WORKDIR /app
ENV NODE_ENV=production PORTA=5330 WEB_DIR=/app/web
COPY --from=build /w/api/node_modules ./node_modules
COPY api/*.mjs api/package.json ./
COPY --from=build /w/web/dist ./web
USER node
EXPOSE 5330
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --start-interval=2s CMD ["node", "-e", "fetch('http://127.0.0.1:5330/salute').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.mjs"]
