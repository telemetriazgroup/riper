Email
demo-flota@riper.local
Contraseña
DemoFlota2026! (o FLEET_DEMO_PASSWORD en el entorno)

user : gourmettrading@ztrack.app  
pass : @gourmet2026!
http://161.132.53.51:18080/
# Mobile Ripening Management System @gourmet2026!


thermoking@riper.local / thermoking2026!

user :thermoking@riper.local 
pass : thermoking2026!


This is a code bundle for Mobile Ripening Management System. The original project is available at https://www.figma.com/design/oz3WSqQWEbB1mKplcS4Weq/Mobile-Ripening-Management-System.

## Running the code

Run `pnpm install` or `npm install` to install the dependencies.

### Login (módulo usuarios)

El acceso usa la **API Ripener** (`/api/v1/auth/login`) contra PostgreSQL. Tras el primer arranque se crea un **superusuario** si no existe:


greenyard@riper.local
greenyard2026!

`, contraseña `greenyard2026!` (o `GREENYARD_PASSWORD`)

- Por defecto (Docker / `.env`): `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` (ej. `superadmin@riper.local` / `changeme123`).
- **Superadmin Madurador**: la API fusiona listados upstream: empresa **amplia** (`SUPERUSER_MADURADOR_WIDE_EMPRESA_IDENTIFICADOR`, default `2001`), empresa pin **3001** con IMEI `PRUEBA_CA000001` si aplica (`SUPERUSER_DEVICE_IMEI`, `*` = todos de esa empresa), **empresa Greenyard** (`SUPERUSER_MADURADOR_GREENYARD_IDENTIFICADOR`, default `4001`; `NONE` o `0` para no cargar) y **empresa 5001** (`SUPERUSER_MADURADOR_5001_IDENTIFICADOR`, default `5001`; `NONE` o `0` para no cargar). Solo el JWT con rol `superadmin` (p. ej. `superadmin@riper.local`) recibe esa fusión.
- **ThermoKing (demo atmósfera controlada)** sembrado en DB: usuario `thermoking@riper.local`, contraseña `thermoking2026!` (o `THERMOKING_PASSWORD`), `identificador` empresa `3001` y la API sirve solo el IMEI `THERMOKING_DEVICE_IMEI` (por defecto `PRUEBA_CA000001`). En el cliente, **Seguimiento** lista solo procesos de ese IMEI y **Recetas** muestra únicamente la(s) receta(s) aplicada(s) en dichos seguimientos (`VITE_THERMOKING_DEVICE_IMEI` debe coincidir).
- **Greenyard** (`identificador` [4001](http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=4001)): usuario `greenyard@riper.local`, contraseña `greenyard2026!` (o `GREENYARD_PASSWORD`), rol **admin**. Solo ve equipos con IMEI `NEWY2001` y `NEWY1001` (`GREENYARD_DEVICE_IMEIS` / `VITE_GREENYARD_DEVICE_IMEIS`). **Control de dispositivos** y **Seguimiento** filtran por esos IMEI. **Recetas**: las tres estándar (`is_system`) más las creadas bajo su cuenta; puede crear recetas. En detalle de equipo, el panel de control abre la pestaña del proceso en curso (sesión panel → `procesoApi` → telemetría). Opcionalmente, `GREENYARD_FILTER_NORMAL_OPERATION=1` restringe a compresión `normal` sin alarmas activas.
- **Gourmet Trading** (`gourmettrading@ztrack.app`, contraseña `@gourmet2026!` o `GOURMET_TRADING_PASSWORD='@gourmet2026!'` entre comillas en `.env`): rol **admin** (recetas y seguimiento). Upstream identificador **5001**; solo IMEI `867856038562796` y `866262036100104`.
- Definir `JWT_SECRET` largo y aleatorio en producción.

Cambiar contraseña y datos desde **Usuarios** (admin) o **Mi perfil** (cada usuario).
greenyard2026!
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

### ztrack.app + `/madurador/` (Apache SSL → Docker en otra IP)

Guía paso a paso (variables, `docker compose`, Apache `ProxyPass` a `http://IP:18080/madurador/`): **[docs/deploy-ztrack-madurador.md](docs/deploy-ztrack-madurador.md)**.

Resumen:

1. En `.env`: `VITE_BASE_PATH=/madurador/` y `VITE_RIPENER_API_URL=/madurador/ripener-api`.
2. `docker compose build --no-cache app && docker compose up -d db api app`.
3. Probar `http://161.132.53.51:18080/madurador/` en el servidor Docker.
4. En Apache (HTTPS): `ProxyPass /madurador/ http://161.132.53.51:18080/madurador/` (misma ruta origen y destino).

El Nginx del contenedor usa `docker/nginx/default-madurador.conf` cuando `VITE_BASE_PATH` es `/madurador/`; si es `/`, usa `default-root.conf`.

#8 datos que se muestran en la parte superior
temp_supply_1 , como "T°Suministro"
return_air , como  "T°Retorno"
campo_1 , como "Nivel Etileno" EN PPM
numero_alarma , como  "Mensajes"
avl , como "Ventilacion" 0 NA , diferente a 0 en CFM
relative_humidity, coo "Nivel Humedad" EN %
co2_reading , como  "Nivel C02" EN %
capacity_load , como  "Potencia " EN %

#datos que se muetsran al poner ver mas


evaporation_coil , como  "T°Evaporador"
condensation_coil , como  "T°Condensador"
compress_coil_1 , como  "T°Conpresor"
ambient_air , como  "T°Externa"
cargo_1_temp , como  "T°Sensor 1"
cargo_2_temp , como  "T°Sensor 2"
cargo_3_temp , como  "T°Sensor 3""
cargo_4_temp , como  "T°Sensor 4"
line_voltage , como  "Voltaje Maquina" en V
line_frequency , como  "Frecuencia Maquina" en Hz
consumption_ph_1 , como  "Fase 1" en A
consumption_ph_2 , como  "Fase 2" en A
consumption_ph_3 , como  "Fase 3" en A
set_point_co2 , como "SP CO2" en %
power_kwh , como  "Consumo Electrico" en kwh
fresh_air_ex_mode , como  "Intercambio Gases" 0 desactivado , 1 Manual , 2 Automatico 
sp_etileno , como "SP Etileno en PPM







  