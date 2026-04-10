# Despliegue: ztrack.app/madurador/ → servidor Docker (IP:18080/madurador/)

Objetivo:

- La app corre en **`http://161.132.53.51:18080/madurador/`** (mismo subpath que en el dominio público).
- Apache en **ztrack.app** (HTTPS) hace proxy inverso a ese destino.
- El navegador solo ve URLs bajo **`/madurador/`** (assets, SPA, API Ripener).

---

## 1. Requisitos

- Docker y Docker Compose en `161.132.53.51`.
- Apache en el servidor de ztrack.app con `mod_proxy`, `mod_proxy_http` y SSL (`mod_ssl`).
- Puerto **18080** accesible desde el servidor Apache (firewall/red) hacia `161.132.53.51:18080`.

---

## 2. Configurar `.env` en el proyecto (en `161.132.53.51`)

Copia `.env.example` a `.env` y ajusta **como mínimo**:

```env
WEB_PORT=18080

# Build del front: subpath fijo
VITE_BASE_PATH=/madurador/
VITE_RIPENER_API_URL=/madurador/ripener-api

# API TermoKing (telemetría): URL que el navegador usará (HTTPS del dominio o IP pública)
# VITE_API_BASE_URL=https://ztrack.app/...   o http://IP:9055
VITE_API_BASE_URL=http://localhost:9055

JWT_SECRET=tu_cadena_larga_aleatoria
```

- **`VITE_BASE_PATH`** y **`VITE_RIPENER_API_URL`** deben coincidir con el prefijo público `/madurador/`.
- Tras cambiar estas variables hay que **volver a construir** la imagen `app` (van embebidas en el bundle de Vite).

---

## 3. Construir y levantar Docker Compose

En la máquina donde está el código (o el `docker-compose.yml`):

```bash
docker compose build --no-cache app
docker compose up -d db api app
```

Comprueba en el mismo servidor:

- `http://161.132.53.51:18080/madurador/` → debe cargar la SPA (redirección desde `/` a `/madurador/`).
- Login: el navegador debe llamar a `http://161.132.53.51:18080/madurador/ripener-api/api/v1/auth/login` (o similar).

Si algo falla, revisa logs: `docker compose logs -f app api`.

---

## 4. Apache en ztrack.app (`default-ssl.conf` o vhost HTTPS)

Habilita módulos (una vez):

```bash
sudo a2enmod proxy proxy_http headers ssl
sudo systemctl reload apache2
```

Dentro del **VirtualHost :443** de ztrack.app, ejemplo:

```apache
SSLProxyEngine On

# Opcional: si el backend es HTTP y Apache HTTPS
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Port "443"

ProxyPreserveHost On

# Misma ruta en origen y destino (161.132.53.51 = host donde corre docker compose)
ProxyPass        /madurador/ http://161.132.53.51:18080/madurador/
ProxyPassReverse /madurador/ http://161.132.53.51:18080/madurador/
```

- **`ProxyPass` con la misma ruta** `/madurador/` en ambos lados evita reescrituras raras; el Nginx del contenedor ya está preparado para servir todo bajo `/madurador/`.

Recarga Apache:

```bash
sudo apache2ctl configtest && sudo systemctl reload apache2
```

Prueba en el navegador:

- `https://ztrack.app/madurador/`

---

## 5. CORS y API TermoKing

- La **API Ripener** va por el mismo origen (`/madurador/ripener-api`), no suele dar problemas de CORS.
- La **API TermoKing** (`VITE_API_BASE_URL`) si apunta a otro host debe permitir el origen **`https://ztrack.app`** (o usar proxy también en Apache).

En `docker-compose`, el servicio `api` tiene `CORS_ORIGIN: "*"` por defecto; para cookies estrictas puedes acotar al dominio.

---

## 6. Volver a desplegar tras cambios en el front

Cualquier cambio en `VITE_*` requiere rebuild del front:

```bash
docker compose build --no-cache app && docker compose up -d app
```

---

## 7. Desarrollo local con el mismo subpath

En `.env` del host de desarrollo:

```env
VITE_BASE_PATH=/madurador/
VITE_RIPENER_API_URL=/madurador/ripener-api
```

Ajusta `vite.config.ts` si hace falta proxy de `/madurador/ripener-api` hacia `:4000` (o usa URL absoluta al API). Lo habitual es levantar `db` + `api` con Docker y `pnpm dev` con proxy a `http://localhost:4000` solo para la ruta de API; en subpath el proxy de Vite puede requerir reglas extra — para producción usa siempre el flujo Docker descrito arriba.
