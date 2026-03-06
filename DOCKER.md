# Docker - Mobile Ripening Management System

## Requisitos

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Desarrollo (Vite dev server con hot reload)

Levanta el servidor de desarrollo en el puerto **6600**:

```bash
docker compose up app-dev
```

- App: http://localhost:6600
- Los cambios en el código se reflejan al guardar (hot reload).

## Producción (build estático + Nginx)

Construye la imagen y sirve la app en el puerto **8080**:

```bash
docker compose up --build app
```

- App: http://localhost:8080

Solo construir la imagen sin levantar:

```bash
docker compose build app
```

## Comandos útiles

| Acción              | Comando                          |
|---------------------|-----------------------------------|
| Levantar solo dev   | `docker compose up app-dev`       |
| Levantar solo prod  | `docker compose up --build app`   |
| Levantar en segundo plano | `docker compose up -d app-dev` |
| Parar servicios     | `docker compose down`             |
| Ver logs            | `docker compose logs -f app-dev`  |

## Archivos

- **Dockerfile**: build multi-etapa (Node + pnpm → Nginx).
- **.dockerignore**: excluye `node_modules`, `.git`, etc. del contexto de build.
- **docker-compose.yml**: servicios `app-dev` (desarrollo) y `app` (producción).
