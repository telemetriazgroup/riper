# Mobile Ripening Management System

This is a code bundle for Mobile Ripening Management System. The original project is available at https://www.figma.com/design/oz3WSqQWEbB1mKplcS4Weq/Mobile-Ripening-Management-System.

## Running the code

Run `pnpm install` or `npm install` to install the dependencies.

### Login (módulo usuarios)

El acceso usa la **API Ripener** (`/api/v1/auth/login`) contra PostgreSQL. Tras el primer arranque se crea un **superusuario** si no existe:

- Por defecto (Docker / `.env`): `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` (ej. `superadmin@riper.local` / `changeme123`).
- Definir `JWT_SECRET` largo y aleatorio en producción.

Cambiar contraseña y datos desde **Usuarios** (admin) o **Mi perfil** (cada usuario).

Run `pnpm dev` or `npm run dev` to start the development server.

## Stack completo (PostgreSQL + API + frontend en Docker)

El módulo **Usuarios** persiste en PostgreSQL mediante la API en `server/` (Express).

```bash
# Base de datos + API + Nginx con el build del front (http://localhost:18080)
docker compose up --build -d db api app
```

- **Frontend:** http://localhost:18080 (por defecto). Si el puerto está ocupado, en `.env` define `WEB_PORT=otro` y vuelve a `docker compose up`. La sección *Usuarios* llama a `/ripener-api` (Nginx hace proxy al contenedor `api`).
- **API REST:** http://localhost:4000 — rutas bajo `/api/v1/users` (CRUD con baja lógica).
- **PostgreSQL:** desde el host usa el puerto **`15432`** (`localhost:15432`; dentro del contenedor sigue siendo 5432). Usuario/clave/db: `riper` / `riper` / `riper`.

Desarrollo en el host con Vite (puerto 6600) y API en Docker:

```bash
docker compose up -d db api
# Copiar .env.example → .env y usar VITE_RIPENER_API_URL=/ripener-api
pnpm dev
```

Vite reenvía `/ripener-api` a `VITE_RIPENER_API_PROXY_TARGET` (por defecto `http://localhost:4000`).

Contenedor solo con Vite (perfil opcional):

```bash
docker compose --profile dev up app-dev
```

Build clásico del front (sin DB):

```bash
docker compose build app
```

## API y CORS

La URL de la API se configura en **un solo lugar** mediante variables de entorno (ver `.env.example`).

- **`VITE_API_BASE_URL`**: base de la API TermoKing. Por defecto `http://localhost:9055`. Puedes poner la IP/host donde esté la API (ej. `http://192.168.1.10:9055`); en ese caso el backend debe permitir CORS desde el origen del frontend.
- **Evitar CORS en desarrollo**: pon `VITE_API_BASE_URL=/api` y `VITE_API_PROXY_TARGET=http://IP:9055` (la URL real del backend). El servidor de Vite hará proxy de `/api` hacia ese destino, así el navegador hace peticiones al mismo origen y no hay CORS.
- **Producción**: configura CORS en la API para permitir el origen de la app, o sirve frontend y API detrás del mismo proxy inverso (nginx, etc.) con rutas tipo `/api` → backend.

Ejemplo `.env` para desarrollo con API en otra máquina:

```env
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://192.168.1.10:9055
```

## Despliegue y "demasiadas redirecciones"

Si al abrir la app en el hosting (ej. **ztrack.app**) ves "Esta página ha redirigido demasiadas veces", suele deberse a que el build se generó con una ruta base que no coincide con la URL donde se sirve.

- **App en la raíz del dominio** (ej. https://ztrack.app/): no definas `VITE_BASE_PATH` o usa `VITE_BASE_PATH=/`. Es el valor por defecto.
- **App en un subpath** (ej. https://somos.com/beta_ripener/): antes del build define en `.env`:
  ```env
  VITE_BASE_PATH=/beta_ripener/
  ```
  Vuelve a generar el build (`npm run build`) y despliega. En el servidor (Apache/Nginx) el proxy debe apuntar ese subpath al servidor que sirve la app.

  