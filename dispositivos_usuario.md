# Dispositivos por usuario — de dónde vienen los datos

Cómo Riper decide **qué equipos ve cada cuenta** y **qué API/link** alimenta la lista, el detalle y el historial.

Detalle de endpoints: `apis.md`. Implementación: `src/app/lib/api.ts` → `fetchDevices` / `fetchDevice` / `fetchDeviceHistory`.

---

## Idea general

Hay dos capas distintas:

| Capa | Qué controla |
|------|----------------|
| **Rol** (`superadmin`, `admin`, `operator`, `viewer`) | Permisos de UI (control, usuarios, archivados…). El rol *Visualizador* = `viewer`. |
| **Email + `identificador` + reglas de flota** | Qué IMEI aparecen en el dashboard |

Flujo típico de flota Madurador:

```text
Login JWT
  → GET {RIPENER}/api/v1/madurador/dispositivos
       → servidor llama upstream:
         GET {MADURADOR}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador={id}
  → front aplica filtros/empaquetado por email (fleetDemo / gourmet / sim)

Historial gráficas:
  → GET …/Madurador/buscar_datos_madurador_rango/?imei={imei}&fecha_inicio=&fecha_fin=
    (vía proxy demo o MADURADOR_DEMO_API_URL; fechas America/Lima)
```

Bases habituales:

| Variable | Uso | Ejemplo |
|----------|-----|---------|
| `VITE_RIPENER_API_URL` | API Ripener (JWT) | `http://localhost:4000` o `/ripener-api` |
| `MADURADOR_API_BASE` | Upstream Madurador (servidor) | `http://161.132.53.51:9051` |
| `VITE_MADURADOR_DEMO_API_URL` | Proxy historial/lista demo | `{RIPENER}/api/v1/madurador-demo` |
| `VITE_API_BASE_URL` | TermoKing legacy | `http://localhost:9055` |

---

## Cuentas del sistema (seed / demos)

### 1) Superadmin — `superadmin@riper.local`

| | |
|--|--|
| **Rol** | `superadmin` |
| **Dispositivos** | Fusión de empresas Madurador **2001** (ancha) + **3001** (pin IMEI, p. ej. `PRUEBA_CA000001`) + **4001** (Greenyard) + **5001** (Gourmet) + **6001** + **7001**. En el front se añaden simulados **`INKA-SIM-01/02/03`**. |
| **Lista** | `GET /api/v1/madurador/dispositivos` → upstream `listar_dispositivos…` por cada empresa |
| **Historial** | `buscar_datos_madurador_rango/?imei=` (proxy demo). Sim Inka: datos locales (`simulatedInkapackingFleet.ts`) |
| **Notas** | Ve crudo de etileno (sin filtro cliente). Override pin: `SUPERUSER_DEVICE_IMEI` (`*` = todos los de 3001). |

---

### 2) Demo Madurador — `demo-madurador@riper.local`

| | |
|--|--|
| **Rol** | `admin` |
| **Contraseña** | `madurador` (o `DEMO_MADURADOR_PASSWORD`) |
| **Empresas** | **6001** + **7001** (lista completa de cada una) |
| **Lista** | `GET /api/v1/madurador/dispositivos` → merge upstream `listar_dispositivos…?identificador=6001` y `…=7001` |
| **Historial** | `buscar_datos_madurador_rango/?imei=` |
| **Env** | `DEMO_MADURADOR_EMPRESA_IDENTIFICADORES=6001,7001` |

### 3) Demo flota — `demo-flota@riper.local`

| | |
|--|--|
| **Rol** | `viewer` |
| **Identificador** | `2001` |
| **Dispositivos** | Equipos de empresa **2001** (IMEI que terminan en `2001` / lista upstream 2001) |
| **Lista** | `GET /api/v1/madurador-demo/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=2001` |
| **Detalle / historial** | Mismo proxy: `…/buscar_datos_madurador_rango/?imei=` |
| **Cliente** | `maduradorFleetDirect.ts` (no usa `/madurador/dispositivos` normal) |

---

### 4) UltraOrganics — `*ultraorganics@riper.local`

Cuentas típicas:

| Email | Rol seed |
|-------|----------|
| `ultraorganics@riper.local` | `admin` |
| `recepcionultraorganics@riper.local` | `admin` |
| `operacionultraorganics@riper.local` | `operator` |
| `calidadultraorganics@riper.local` | `viewer` |

| | |
|--|--|
| **Dispositivos en panel** | `MEX1001`, `MEX2001`, `MEX3001` (empaquetados; etileno/humedad de compañeros físicos) |
| **Físicos asociados** | p. ej. `MEX1001+MEX1002`, `MEX2001+MEX2002`, `MEX3001` |
| **Upstream empresas** | `1001`, `2001`, `3001` |
| **Lista** | `GET /api/v1/madurador/dispositivos` → servidor empaqueta panel |
| **Historial** | `buscar_datos_madurador_rango/?imei=` (IMEI panel o físico según mapeo) |
| **Comandos** | Upstream `GET …/TermoKing/comando_control/{deviceId}?tipo=&dato=` |

---

### 5) ThermoKing — `thermoking@riper.local`

| | |
|--|--|
| **Rol** | `viewer` (seed) |
| **Identificador** | `3001` |
| **Dispositivos** | Un solo IMEI pin: **`PRUEBA_CA000001`** (env: `THERMOKING_DEVICE_IMEI` / `VITE_THERMOKING_DEVICE_IMEI`) |
| **Lista** | `GET /api/v1/madurador/dispositivos` → empresa `3001` filtrada al pin |
| **Historial** | `buscar_datos_madurador_rango/?imei=PRUEBA_CA000001` |

---

### 6) Greenyard — `greenyard@riper.local`

| | |
|--|--|
| **Rol** | `admin` (seed) |
| **Identificador** | `4001` |
| **Dispositivos** | **`NEWY2001`**, **`NEWY1001`** (env: `GREENYARD_DEVICE_IMEIS`) |
| **Lista** | `GET /api/v1/madurador/dispositivos` → empresa `4001` + allowlist |
| **Historial** | `buscar_datos_madurador_rango/?imei=` |
| **Comandos** | `GET …/TermoKing/comando_control/{deviceId}?tipo=&dato=` |

---

### 7) Gourmet Trading — `gourmettrading@ztrack.app`

| | |
|--|--|
| **Rol** | `admin` (seed) |
| **Identificador** | `5001` |
| **Dispositivos visibles** | Agregado **`tunel:TUNEL_GREAT`** + standalone **`866262036100104`**. Las 5 unidades físicas del túnel se ocultan en sesión Gourmet y se empaquetan. |
| **IMEI etileno túnel** | `867856038562796` (historial del túnel usa este IMEI) |
| **Lista** | `GET /api/v1/madurador/dispositivos` → empresa `5001` + `packageGourmetFleetDevices` |
| **Grupo túnel** | `GET /api/v1/tunel/grupo?grupo=TUNEL_GREAT` → upstream `Unidos/leer_grupo_tunel` |
| **Historial** | Rango Madurador; túnel → IMEI etileno `867856038562796` |
| **Comandos** | `GET …/Tunel/comando_control_tunel/{imei}?tipo=&dato=` |
| **Fallback offline** | Si no hay flota Madurador: `data_gourmet.json` + historial sintético (`gourmet.ts`) |

---

### 8) Cliente genérico (cualquier email con `identificador` en BD)

| | |
|--|--|
| **Rol** | el asignado en `app_users` |
| **Dispositivos** | Upstream de **su** `identificador`; en cliente se suelen filtrar IMEI cuyo **sufijo** = identificador (p. ej. ident `1001` → `…1001`) |
| **Lista** | `GET /api/v1/madurador/dispositivos` → `listar_dispositivos…?identificador={id}` |
| **Historial** | `buscar_datos_madurador_rango/?imei=` |
| **Sin identificador** | Lista vacía por Madurador, o fallback TermoKing legacy (`estado_general` / `historial/{mac}`) |

El rol (`admin` / `operator` / `viewer`) **no cambia** la lista de equipos; solo qué puede operar en el panel.

---

## Resumen rápido: usuario → link de datos

| Usuario / flota | Lista de dispositivos | Historial / telemetría |
|-----------------|----------------------|-------------------------|
| Superadmin | Ripener `/api/v1/madurador/dispositivos` (merge 2001+3001+4001+5001+6001+7001) + INKA-SIM | Rango Madurador; sim local |
| demo-madurador | Ripener `/madurador/dispositivos` → merge empresas **6001** + **7001** | Rango Madurador |
| demo-flota | Proxy `/api/v1/madurador-demo/…/listar_dispositivos…?identificador=2001` | Proxy `…/buscar_datos_madurador_rango/?imei=` |
| UltraOrganics | Ripener `/madurador/dispositivos` → panel MEX* | Rango por IMEI |
| ThermoKing | Ripener → pin `PRUEBA_CA000001` | Rango |
| Greenyard | Ripener → NEWY2001, NEWY1001 | Rango |
| Gourmet | Ripener → túnel + standalone; `/api/v1/tunel/grupo` | Rango (IMEI etileno túnel) |
| Cliente con `identificador` | Ripener → empresa de su ident | Rango |
| Legacy / sin Madurador | `{API_BASE}/TermoKing/estado_general/` | `{API_BASE}/TermoKing/historial/{mac}/` |

### Links upstream (servidor → Madurador)

```http
GET {MADURADOR_API_BASE}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador={id}
GET {MADURADOR_API_BASE}/Madurador/buscar_datos_madurador_rango/?imei={imei}&fecha_inicio=…&fecha_fin=…
GET {MADURADOR_API_BASE}/Unidos/leer_grupo_tunel/?grupo=TUNEL_GREAT
GET {MADURADOR_API_BASE}/Tunel/comando_control_tunel/{imei}?tipo=&dato=
GET {MADURADOR_API_BASE}/TermoKing/comando_control/{deviceId}?tipo=&dato=
```

### Links legacy TermoKing (navegador directo)

```http
GET {VITE_API_BASE_URL}/TermoKing/estado_general/
GET {VITE_API_BASE_URL}/TermoKing/historial/{mac}/?fecha_inicio=…&fecha_fin=…
```

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/app/lib/api.ts` | Orquesta lista / detalle / historial |
| `src/app/lib/madurador.ts` | Cliente Madurador + filtros por flota |
| `src/app/lib/fleetDemo.ts` | Emails Ultra / Thermo / Greenyard / demo-flota + IMEI pin |
| `src/app/lib/gourmet.ts` / `gourmetTunnelFleet.ts` | Sesión Gourmet y empaquetado túnel |
| `src/app/lib/maduradorFleetDirect.ts` | Camino demo-flota |
| `src/app/lib/simulatedInkapackingFleet.ts` | INKA-SIM-* (superadmin) |
| `server/src/routes/madurador.js` | Reglas JWT/email → lista |
| `server/src/routes/maduradorDemoProxy.js` | Proxy CORS historial/lista |
| `server/src/seed.js` | Usuarios demo e `identificador` |
| `apis.md` | Catálogo completo de APIs |

---

## Nota sobre roles vs dispositivos

- **Visualizador (`viewer`)** puede ver la misma flota que un admin de la misma empresa/email-familia; no puede operar control.
- Cambiar dispositivos visibles de una cuenta demo: env (`GREENYARD_DEVICE_IMEIS`, `THERMOKING_DEVICE_IMEI`, etc.) o `identificador` en `app_users`.
- Documentación de APIs relacionada: sección Madurador y “Flujo de datos” en `apis.md`.
