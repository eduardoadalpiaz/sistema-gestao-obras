# Etapa 1: gera os arquivos estáticos do React (vite build)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# a API fica no mesmo endereço do site, sob /api (o Caddy encaminha)
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# Etapa 2: Caddy serve o site e encaminha /api para o back-end (com HTTPS automático)
FROM caddy:2-alpine
# usuário comum (não root) roda o Caddy; a capability deixa ele abrir as portas 80 e 443
RUN apk add --no-cache libcap \
 && addgroup -S -g 10001 app && adduser -S -u 10001 -G app app \
 && setcap cap_net_bind_service=+ep /usr/bin/caddy \
 && mkdir -p /data /config && chown -R app:app /data /config
COPY --chown=app:app --from=build /app/dist /srv
COPY --chown=app:app Caddyfile /etc/caddy/Caddyfile
USER app
