# Mobile Ripening Management System

This is a code bundle for Mobile Ripening Management System. The original project is available at https://www.figma.com/design/oz3WSqQWEbB1mKplcS4Weq/Mobile-Ripening-Management-System.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

```bash
docker compose up app-dev
docker compose up --build app
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

  