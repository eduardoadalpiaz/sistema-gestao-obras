# Imagem da API (Node + Express)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# instala só as dependências de produção
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY sql ./sql
# roda sem ser root
USER node
EXPOSE 3001
# confere o /health a cada 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "src/server.js"]
