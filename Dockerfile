# ============================================
# Etapa 1: Build de la aplicación Vite + React
# ============================================
FROM node:20-alpine AS builder

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiar dependencias primero (mejor caché de capas)
COPY package.json ./

# Instalar dependencias (pnpm-lock.yaml se usa si existe al hacer COPY . .)
RUN pnpm install

# Copiar el resto del código
COPY . .

# Build de producción
RUN pnpm run build

# ============================================
# Etapa 2: Servir la app con Nginx
# ============================================
FROM nginx:alpine AS production

# Copiar el build desde la etapa anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de Nginx para SPA (fallback a index.html)
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /assets/ { \
        add_header Cache-Control "public, max-age=31536000, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
