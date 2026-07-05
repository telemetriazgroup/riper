# APIs — Rutas de consumo

Referencia de endpoints que usa la aplicación **Riper** (frontend, API Node y upstreams externos).

---

## URLs base

| Capa | Variable / config | Default | Uso |
|------|-------------------|---------|-----|
| **API Ripener** (backend propio) | `VITE_RIPENER_API_URL` | `http://localhost:4000` | Usuarios, recetas, seguimiento, control, etc. |
| **API TermoKing** (legacy) | `VITE_API_BASE_URL` | `http://localhost:9055` | `estado_general`, historial MAC (cuentas sin Madurador) |
| **Upstream Madurador** (servidor) | `MADURADOR_API_BASE` | `http://161.132.53.51:9051` | Telemetría y comandos; el navegador **no** llama aquí directamente salvo demo/proxy |
| **Proxy demo Madurador** | `MADURADOR_DEMO_API_BASE` | `http://161.132.53.51:9051` | Destino del proxy `/api/v1/madurador-demo/*` |
| **Health** | — | `GET /health` | Sin auth; comprueba DB |

En **Docker / Nginx** el front suele llamar a Ripener vía **`/ripener-api`** (proxy → contenedor `api:4000`).

En **desarrollo Vite** (`pnpm dev`):

- `/ripener-api` → `VITE_RIPENER_API_PROXY_TARGET` (default `:4000`)
- `/api` → `VITE_API_PROXY_TARGET` (TermoKing legacy)
- Proxy Madurador demo según `vite.config.ts`

Prefijo común Ripener: **`/api/v1`**

---

## Autenticación

### Login (sin token)

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "...", "password": "..." }
```

Respuesta: `{ "token": "<JWT>", "user": { ... } }`

### Sesión actual

```http
GET /api/v1/auth/me
Authorization: Bearer <JWT>
```

### Resto de rutas Ripener

Header obligatorio (salvo `/auth/login` y `/health`):

```http
Authorization: Bearer <JWT>
```

### Roles (resumen)

| Rol | Notas |
|-----|--------|
| `viewer` | Solo lectura; no inicia control ni seguimiento |
| `operator` | Operación + muestreos; pausa/reanuda seguimiento |
| `admin` | CRUD catálogo, usuarios, recetas; crea seguimientos |
| `superadmin` | Todo + auditoría, archivados, fusión Madurador amplia, export lógica |

Middlewares en servidor: `requireAdmin`, `requireOperatorPlus`, `requireSuperAdmin`, `requireSuperUser`.

---

## API Ripener — `/api/v1`

Cliente frontend principal: módulos en `src/app/lib/*Api.ts` y `auth.ts`.

### Auth — `/api/v1/auth`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/login` | No | Inicio de sesión |
| `GET` | `/me` | Sí | Usuario autenticado |

Cliente: `src/app/lib/auth.ts`

---

### Usuarios — `/api/v1/users`

| Método | Ruta | Rol mín. | Descripción |
|--------|------|----------|-------------|
| `GET` | `/` | Autenticado | Listado usuarios |
| `POST` | `/` | admin | Crear usuario |
| `PATCH` | `/:id` | admin o self | Actualizar perfil / rol |
| `DELETE` | `/:id` | admin | Baja lógica |
| `POST` | `/:id/avatar` | admin o self | Subir foto (`multipart/form-data`, campo `photo`) |
| `GET` | `/:id/avatar` | Autenticado | Descargar avatar |

Cliente: `src/app/lib/usersApi.ts`

---

### Productos — `/api/v1/products`

| Método | Ruta | Rol mín. | Descripción |
|--------|------|----------|-------------|
| `GET` | `/` | Autenticado | Listado |
| `POST` | `/` | admin | Crear |
| `PATCH` | `/:id` | admin | Actualizar |
| `DELETE` | `/:id` | admin | Baja lógica |
| `POST` | `/:id/restore` | superadmin | Restaurar |

Cliente: `src/app/lib/productsApi.ts`

---

### Empresas — `/api/v1/companies`

| Método | Ruta | Rol mín. | Descripción |
|--------|------|----------|-------------|
| `GET` | `/` | Autenticado | Listado |
| `POST` | `/` | admin | Crear |
| `PATCH` | `/:id` | admin | Actualizar |
| `DELETE` | `/:id` | admin | Baja lógica |
| `POST` | `/:id/restore` | superadmin | Restaurar |

Cliente: `src/app/lib/companiesApi.ts`

---

### Recetas — `/api/v1/recipes`

| Método | Ruta | Rol mín. | Descripción |
|--------|------|----------|-------------|
| `GET` | `/` | Autenticado | Listado (filtrado por cuenta en cliente) |
| `GET` | `/:id` | Autenticado | Detalle |
| `POST` | `/` | admin | Crear receta |
| `PATCH` | `/:id` | admin | Actualizar |
| `DELETE` | `/:id` | admin | Baja lógica |
| `POST` | `/:id/restore` | superadmin | Restaurar |

Cliente: `src/app/lib/recipesApi.ts`

---

### Códigos de alarma — `/api/v1/alarm-codes`

| Método | Ruta | Rol mín. | Descripción |
|--------|------|----------|-------------|
| `GET` | `/` | Autenticado | Listado |
| `GET` | `/by-code/:code` | Autenticado | Por código numérico |
| `POST` | `/` | admin | Crear |
| `PATCH` | `/:id` | admin | Actualizar |
| `DELETE` | `/:id` | admin | Baja lógica |
| `POST` | `/:id/restore` | superadmin | Restaurar |

Cliente: `src/app/lib/alarmCodesApi.ts`

---

### Madurador (flota) — `/api/v1/madurador`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/dispositivos` | Sí | Lista de equipos según cuenta JWT (upstream + filtros por flota) |

**Comportamiento por cuenta:**

- **superadmin**: fusiona empresas upstream `2001`, `3001` (pin IMEI), `4001` (Greenyard), `5001` (Gourmet), etc.
- **ultraorganics@…**: identificadores `1001`, `2001`, `3001`; empaqueta panel MEX1001/2001/3001
- **thermoking@…**: empresa `3001`, IMEI pin
- **greenyard@…**: empresa `4001`, IMEI `NEWY2001`, `NEWY1001`
- **gourmettrading@…**: empresa `5001`, IMEI flota Gourmet
- **Resto**: `identificador` del usuario en BD

Respuesta: `{ "data": [ /* filas estilo API Madurador */ ] }`

Cliente: `src/app/lib/madurador.ts` → `fetchMaduradorDevicesFromApi()`

**Superadmin demo:** el cliente añade/reemplaza equipos simulados `INKA-SIM-01/02/03` (`simulatedInkapackingFleet.ts`).

---

### Proxy Madurador demo — `/api/v1/madurador-demo`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/Madurador/*` | Sí | Reenvía GET al upstream `MADURADOR_DEMO_API_BASE` (evita CORS) |

Ejemplos usados por la cuenta demo flota:

```http
GET /api/v1/madurador-demo/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=2001
GET /api/v1/madurador-demo/Madurador/buscar_datos_madurador_rango/?imei=<IMEI>
```

Cliente: `src/app/lib/maduradorFleetDirect.ts`, `MADURADOR_DEMO_API_URL` en `config.ts`

---

### Túnel Gourmet (grupo) — `/api/v1/tunel`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/grupo?grupo=TUNEL_GREAT` | Sí (cuenta Gourmet) | Proxy a `Unidos/leer_grupo_tunel` en upstream |

Cliente: `src/app/lib/tunelUnido.ts`

---

### Sobrenombres de dispositivos — `/api/v1/device-names`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/` | Sí | Mapa `deviceId → displayName` |
| `PUT` | `/:deviceId` | Sí | Guardar alias `{ "displayName": "..." }` |

Cliente: `src/app/lib/deviceNamesApi.ts`

---

### Seguimiento en flota — `/api/v1/device-process-follow`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/list` | Sí | Procesos que el usuario sigue |
| `GET` | `/device/:deviceId` | Sí | Seguimiento de un equipo |
| `DELETE` | `/device/:deviceId` | Sí | Dejar de seguir |
| `POST` | `/sync` | Sí | Sincronizar lista desde vista flota |

Cliente: `src/app/lib/deviceProcessFollowApi.ts`

---

### Seguimiento (procesos de maduración) — `/api/v1/ripening-processes`

| Método | Ruta | Rol mín. | Descripción |
|--------|------|----------|-------------|
| `GET` | `/active-for-device?deviceId=` | Autenticado | Seguimiento activo/pausado del equipo |
| `GET` | `/` | Autenticado | Listado global (`?includeArchived=true` solo superadmin) |
| `GET` | `/:id` | Autenticado | Detalle |
| `GET` | `/:id/files/:filename` | Autenticado | Descargar evidencia |
| `POST` | `/` | admin | Crear seguimiento (`multipart`: campo `data` JSON + `evidence[]`) |
| `POST` | `/:id/sampling` | operator+ | Muestreo (`data` JSON + `evidence[]`) |
| `POST` | `/:id/documents` | operator+ | Documento adjunto (`file`, `description`) |
| `PATCH` | `/:id` | Según estado | Actualizar status / payload |
| `POST` | `/:id/pause` | operator+ | Pausar |
| `POST` | `/:id/resume` | operator+ | Reanudar |
| `POST` | `/:id/reactivate` | superadmin | Extender proceso cancelado/completado |
| `DELETE` | `/:id/documents/:documentId` | operator+ | Quitar documento |
| `DELETE` | `/:id` | admin | Archivar (baja lógica) |

Cliente: `src/app/lib/ripeningProcessesApi.ts`

**Demo sim (superadmin):** IDs `rp-process-9100001`… interceptados en cliente con estado en `localStorage`.

---

### Panel de control — `/api/v1/device-control`

| Método | Ruta | Rol mín. | Descripción |
|--------|------|----------|-------------|
| `GET` | `/active?deviceId=` | Autenticado | Sesión activa del panel (Homogenización, Maduración, etc.) |
| `GET` | `/sessions` | Autenticado | Historial (`?includeArchived=1` solo superadmin) |
| `POST` | `/start` | operator+ | Iniciar proceso `{ deviceId, processType, displayLabel, params, durationHours, startedAt? }` |
| `POST` | `/:id/cancel` | operator+ | Cancelar sesión activa |
| `POST` | `/:id/complete` | operator+ | Completar |
| `PATCH` | `/:id` | operator+ | Editar label / params / duración |
| `DELETE` | `/:id` | admin | Archivar registro |
| `POST` | `/:id/restore` | superadmin | Restaurar archivado |

`processType`: `Homogenization` | `Ripening` | `Ventilation` | `Cooling` | `StopPlan` | `Manual`

Cliente: `src/app/lib/deviceControlProcessApi.ts`

**Automatización servidor:** sesiones Gourmet / Greenyard / UltraOrganics con tipos anteriores (excepto `Manual`) las procesa el poller `gourmetProcessControl.js` cada 30 s.

**Demo sim:** sesiones `sim-control-{deviceId}` en `localStorage` (superadmin).

---

### Comandos túnel (compliance) — `/api/v1/tunnel-commands`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/apply-manual` | Gourmet operator+ | `{ deviceId, commands: { set_point?, humidity_set_point?, ethylene?, fan_speed? } }` |
| `GET` | `/?deviceId=&batchId=&active=1&limit=` | Gourmet | Jobs de cumplimiento de comandos |

Cliente: `src/app/lib/tunnelCommandsApi.ts`

---

### Auditoría — `/api/v1/audit`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/logs?limit=80&beforeId=` | superadmin | Paginación descendente por `id` |

Cliente: `src/app/lib/auditApi.ts`

---

### Lógica de control (export) — `/api/v1/control-logic`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/export` | superuser | JSON especificación TUNEL / TermoKing |

Cliente: `src/app/lib/controlLogicExportApi.ts`

---

### Automatización (config admin) — `/api/v1/control-automation`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/config` | admin | Lee config global (`ripening_co2_ventilation_220`, default `false`) |
| `PUT` | `/config` | admin | Actualiza `{ "ripening_co2_ventilation_220": true\|false }` |

Cliente: `src/app/lib/controlAutomationConfigApi.ts` — UI en **Procesos de control (panel)** para admin/superadmin.

Override opcional en servidor: `RIPENING_CO2_VENTILATION_220=1` fuerza activación.

---

### Notificaciones email — `/api/v1/email-notifications`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/config` | admin+ | Config SMTP / plantillas |
| `PUT` | `/config` | admin+ | Actualizar config |
| `POST` | `/test` | admin+ | Email de prueba |
| `GET` | `/groups` | admin+ | Grupos destinatarios |
| `POST` | `/groups` | admin+ | Crear grupo |
| `PUT` | `/groups/:id` | admin+ | Actualizar grupo |
| `DELETE` | `/groups/:id` | admin+ | Eliminar grupo |

Cliente: `src/app/lib/emailNotificationsApi.ts`

---

### Salud

```http
GET /health
```

Respuesta: `{ "ok": true, "db": true }` o `503` si falla PostgreSQL.

---

## API upstream Madurador (`MADURADOR_API_BASE`)

Llamadas **desde el servidor Ripener** (y proxy demo). Base típica: `http://161.132.53.51:9051`.

### Telemetría / flota

| Método | Ruta upstream | Uso en Riper |
|--------|---------------|--------------|
| `GET` | `/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador={id}` | Flota por empresa; telemetría para control automático |
| `GET` | `/Madurador/buscar_datos_madurador_rango/?imei={imei}&fecha_inicio=…&fecha_fin=…` | Historial gráficas (fechas hora **America/Lima**) |

Implementación cliente historial: `src/app/lib/madurador.ts` → `fetchMaduradorRangoHistoryForImei()`

### Comandos túnel (Gourmet)

| Método | Ruta upstream | Uso |
|--------|---------------|-----|
| `GET` | `/Tunel/comando_control_tunel/{imei}?tipo={n}&dato={v}` | Control automático y manual túnel |

Tipos habituales: `0` lectura etileno, `1` temperatura, `2` humedad, `3` CO₂, `5` dosis etileno, `6` ventilación, `10` stop plan.

Cliente servidor: `server/src/tunelControlClient.js`

### Comandos TermoKing (Greenyard / UltraOrganics)

| Método | Ruta upstream | Uso |
|--------|---------------|-----|
| `GET` | `/TermoKing/comando_control/{deviceId}?tipo={n}&dato={v}` | Control equipos NEWY*, MEX* |

Cliente servidor: `server/src/termokingControlClient.js`

### Grupo túnel unido

| Método | Ruta upstream | Uso |
|--------|---------------|-----|
| `GET` | `/Unidos/leer_grupo_tunel/?grupo=TUNEL_GREAT` | Vista agregada túnel Gourmet |

Proxy Ripener: `GET /api/v1/tunel/grupo`

---

## API TermoKing legacy (`VITE_API_BASE_URL`)

Usada cuando la cuenta **no** pasa por `/api/v1/madurador/dispositivos` (p. ej. mock / TermoKing puro).

| Método | Ruta | Cliente |
|--------|------|---------|
| `GET` | `/TermoKing/estado_general/` | `src/app/lib/api.ts` → `fetchDevices()` |
| `GET` | `/TermoKing/historial/{mac}/?fecha_inicio=…&fecha_fin=…` | `fetchDeviceHistory()` |

---

## Flujo de datos en el frontend

```text
Dashboard / Detalle
    │
    ├─► GET /api/v1/madurador/dispositivos     → madurador.ts
    │       └─► upstream listar_dispositivos… (servidor)
    │
    ├─► GET /api/v1/ripening-processes         → ripeningProcessesApi.ts
    ├─► GET /api/v1/device-control/sessions    → deviceControlProcessApi.ts
    │
    ├─► GET /api/v1/ripening-processes/active-for-device?deviceId=
    └─► GET /api/v1/device-control/active?deviceId=

Historial gráficas
    └─► buscar_datos_madurador_rango (directo demo o vía madurador.ts)

Cuenta demo flota (identificador 2001)
    └─► /api/v1/madurador-demo/Madurador/…     → maduradorFleetDirect.ts
```

---

## Convenciones de respuesta Ripener

- Éxito JSON: `{ "data": … }` o `{ "token", "user" }` en login.
- Error: `{ "error": "<código>", "message": "…" }` con HTTP 4xx/5xx.
- Subidas: `multipart/form-data` con campos documentados en cada ruta.
- Archivados: query `includeArchived=true` o `includeArchived=1` (solo superadmin donde aplique).

---

## Variables de entorno relacionadas

| Variable | Ámbito | Descripción |
|----------|--------|-------------|
| `JWT_SECRET` | API | Firma del token |
| `MADURADOR_API_BASE` | API | Upstream Madurador / TermoKing / Tunel |
| `MADURADOR_DEMO_API_BASE` | API | Upstream del proxy demo |
| `SUPERUSER_MADURADOR_WIDE_EMPRESA_IDENTIFICADOR` | API | Default `2001` |
| `SUPERUSER_MADURADOR_GREENYARD_IDENTIFICADOR` | API | Default `4001` |
| `SUPERUSER_MADURADOR_5001_IDENTIFICADOR` | API | Default `5001` |
| `GREENYARD_DEVICE_IMEIS` | API | Default `NEWY2001,NEWY1001` |
| `GOURMET_TRADING_DEVICE_IMEIS` | API | IMEI flota Gourmet |
| `VITE_RIPENER_API_URL` | Front | Base API Ripener |
| `VITE_API_BASE_URL` | Front | TermoKing legacy |
| `VITE_MADURADOR_DEMO_API_URL` | Front | Override proxy demo |

Ver también `README.md` y `.env.example` para credenciales de cuentas demo.
