# ============================================
# Etapa 1: Build de la aplicación Vite + React
# ============================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install

COPY . .

# --- Variables de build Vite ---
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

ARG VITE_RIPENER_API_URL=/ripener-api
ENV VITE_RIPENER_API_URL=$VITE_RIPENER_API_URL

ARG VITE_API_BASE_URL=http://localhost:9055
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm run build

# Colocar estáticos bajo /madurador/ o en raíz, y elegir nginx.conf
RUN mkdir -p /artifact/html && \
    B="${VITE_BASE_PATH:-/}" && \
    case "$B" in \
      /madurador/|/madurador) \
        mkdir -p /artifact/html/madurador && cp -a /app/dist/. /artifact/html/madurador/ && \
        cp /app/docker/nginx/default-madurador.conf /artifact/nginx.conf ;; \
      *) \
        cp -a /app/dist/. /artifact/html/ && \
        cp /app/docker/nginx/default-root.conf /artifact/nginx.conf ;; \
    esac

# ============================================
# Etapa 2: Nginx
# ============================================
FROM nginx:alpine AS production

COPY --from=builder /artifact/html /usr/share/nginx/html
COPY --from=builder /artifact/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
