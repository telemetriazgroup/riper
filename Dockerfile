# ============================================
# Etapa 1: Build de la aplicación Vite + React
# ============================================
FROM node:20-alpine AS builder

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiar dependencias primero (mejor caché de capas)
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias (pnpm-lock.yaml se usa si existe al hacer COPY . .)
RUN pnpm install

# Copiar el resto del código
COPY . .

# --- Variables de build Vite (deben coincidir con la URL pública donde se sirve la app) ---
# Raíz de la app: "/" en dominio propio, o "/madurador/" si Apache/Nginx publican en un subpath.
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

# API Ripener (login, usuarios): misma ruta pública + /ripener-api (Nginx del contenedor hace proxy al api).
# Ejemplo subpath: VITE_RIPENER_API_URL=/madurador/ripener-api
ARG VITE_RIPENER_API_URL=/ripener-api
ENV VITE_RIPENER_API_URL=$VITE_RIPENER_API_URL

# API TermoKing (telemetría): URL que verá el navegador (completa o relativa según tu proxy).
ARG VITE_API_BASE_URL=http://localhost:9055
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build de producción
RUN pnpm run build

# ============================================
# Etapa 2: Servir la app con Nginx
# ============================================
FROM nginx:alpine AS production

# Copiar el build desde la etapa anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA + proxy hacia servicio api en docker-compose
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
