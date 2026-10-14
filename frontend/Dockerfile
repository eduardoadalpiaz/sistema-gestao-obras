# Etapa 1: gera os arquivos estáticos do React (vite build)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# a API fica no mesmo endereço do site, sob /api (o Caddy encaminha)
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# Etapa 2: Caddy serve o site e encaminha /api para o back-end (com HTTPS automático)
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
