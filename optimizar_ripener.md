# Optimizar Ripener — carga de sesiones de control (`/sessions`)

**Fecha:** 2026-09-17  
**Síntoma observado:** al abrir el panel / flota, `GET /api/v1/device-control/sessions` descarga ~**71–72 MB** (≈23–27 s por request). En Network aparecen **dos** llamadas casi idénticas → ~**150 MB** transferidos en una sola carga. Recursos en memoria del navegador ~**225 MB**.

---

## 1. Qué está fallando (diagnóstico)

### 1.1 Endpoint culpable

| Pieza | Detalle |
|--------|---------|
| Ruta | `GET /api/v1/device-control/sessions` |
| Archivo | `server/src/routes/deviceControl.js` |
| Query | `SELECT s.* … FROM app_device_control_sessions … LIMIT 500` |
| Respuesta | `{ data: DeviceControlSessionRow[] }` con **`params` JSONB completo** |

`s.*` incluye la columna `params` (JSONB). Ahí vive casi todo el peso:

- `params.tunnelEventLog` — hasta **500 eventos** por sesión (`appendTunnelEventLog` → `slice(-500)` en `server/src/tunnelEventLog.js`)
- Cada evento puede traer `urls`, `decisionTrace`, `analysisEs`, lecturas USDA, cargos, fingerprints, etc.
- `params.processAutomation` — para Cooling incluye `coolingDecisionLog` (hasta **100** trazas en `gourmetProcessControl.js`)
- `params.tunnelJobs` — snapshots de jobs de cumplimiento (manual / túnel)

Con decenas o cientos de sesiones históricas **no archivadas**, el listado multiplica:

```
~500 sesiones × (hasta 500 eventos × payload rico)  →  decenas de MB fáciles de alcanzar
```

El caso medido (**~72 MB / 500 filas**) implica **~140 KB promedio por sesión** si todas vienen llenas; unas pocas sesiones “gordas” (Cooling/Ripening largos) bastan para dominar el tamaño.

### 1.2 Por qué el cliente pide ese payload (y dos veces)

| Caller | Archivo | Qué necesita realmente | Qué descarga |
|--------|---------|------------------------|--------------|
| Flota (dashboard) | `useFleetActiveControlMap.ts` | Solo sesiones **`active`**, indexadas por `device_id` | **Todas** las no archivadas (hasta 500) + params completos |
| Panel / bitácora / charts | `useControlSessionsList.ts` | A menudo 1 dispositivo o listado admin | Mismo endpoint completo |
| Ethylene display en flota | `src/app/lib/api.ts` → `finalizeClientFleetEthylene` / `finalizeGourmetClientDevice` | Objetivos de etileno programados | **Otra** llamada a `listControlSessions()` **fuera de SWR** |

Eso explica la captura de Network:

1. SWR de flota o de panel → `sessions` ~72 MB  
2. `fetchDevices` / finalize ethylene → **segundo** `sessions` ~72 MB  

Ambos usan claves SWR distintas (`fleet-active-control-sessions` vs `['device-control-sessions', false]`) **y** además `api.ts` llama al fetch directo, sin compartir caché.

Refresh: Gourmet / UltraOrganics / Greenyard revalidan cada **30 s** → el problema se repite en background.

### 1.3 Otros endpoints pesados (misma sesión de carga)

En la misma captura aparece:

| Request | Tamaño | Nota |
|---------|--------|------|
| `ripening-processes` | ~6.3 MB | Listados/payloads de seguimiento (revisar en fase 2) |
| `dispositivos` | ~1.7 MB | Lista Madurador (aceptable pero mejorable) |

El cuello de botella **#1** es `sessions`.

### 1.4 Efecto en el hilo principal (stack `setTimeout` / `Promise.then`)

Tras bajar 70+ MB de JSON, el navegador:

1. Parsea JSON enorme  
2. React/SWR actualiza estado  
3. Componentes como `EventLog` recorren **todas** las sesiones para armar bitácora (`processActionLogEntriesForDevice(deviceId, sessions, …)`)  

Eso encaja con el stack repetitivo (`setTimeout` → `Promise.then` → scheduler React) en el bundle minificado: no es un bucle infinito de red, es **trabajo asíncrono pesado** sobre un payload gigante.

---

## 2. Qué se puede hacer (plan de optimización)

Prioridad: **impacto / esfuerzo**. Implementar en este orden.

> **Dirección acordada (ver §6):** sacar la bitácora de `params` a **tabla + módulo propios**.  
> En el detalle solo **últimas 12 h**; el histórico largo se consulta **por rango de fechas**.  
> Lo de abajo (P0–P2) sigue siendo válido como pasos intermedios / complementarios.

### P0 — Respuesta ligera para listados (alto impacto)

**Objetivo:** que flota y panel no descarguen `tunnelEventLog` / `coolingDecisionLog` / `tunnelJobs` en el listado.

1. **Nuevo shape de listado** (o query param):
   - `GET /sessions?view=summary` (default para flota)
   - Campos mínimos: `id`, `device_id`, `process_type`, `display_label`, `status`, `started_at`, `estimated_end_at`, `duration_hours`, `user_name`, `user_email`, `archived_at`
   - De `params`, solo un resumen:
     - `setPoint` / `humidity` / `ethylene` / `co2` / `durationHours`
     - `processAutomation.phase`, `interventionActive`, `mode`
     - `tunnelOverallStatus`, `tunnelSyncedAt`
     - **sin** `tunnelEventLog`, **sin** `coolingDecisionLog`, **sin** `tunnelJobs` completos

2. **Detalle bajo demanda:**
   - `GET /sessions/:id` o `GET /active?deviceId=` ya existente → devolver params completos solo para el dispositivo abierto
   - Bitácora: `GET /sessions/:id/events?limit=100` (o últimos N del `tunnelEventLog`)

3. **SQL:** no seleccionar `params` crudo; usar expresiones JSONB:

```sql
SELECT id, device_id, process_type, display_label, status,
       started_at, estimated_end_at, duration_hours, archived_at,
       jsonb_build_object(
         'setPoint', params->'setPoint',
         'ethylene', COALESCE(params->'ethylene', params->'ethylene_injection_programmed'),
         'processAutomation', jsonb_build_object(
           'phase', params#>'{processAutomation,phase}',
           'mode', params#>'{processAutomation,mode}',
           'interventionActive', params#>'{processAutomation,interventionActive}'
         ),
         'tunnelOverallStatus', params->'tunnelOverallStatus',
         'tunnelSyncedAt', params->'tunnelSyncedAt'
       ) AS params_summary
FROM app_device_control_sessions
WHERE …
LIMIT 500;
```

**Meta P0:** listado &lt; **200–500 KB** (ideal &lt; 100 KB), no &gt; 70 MB.

### P0b — Eliminar descarga duplicada (rápido)

1. Unificar SWR: flota y panel deben usar **la misma key** (o que `api.ts` use `mutate`/`useSWR` cache, no `fetch` suelto).
2. En `finalizeClientFleetEthylene` / `finalizeGourmetClientDevice`: **no** llamar `listControlSessions()`; pasar sesiones desde el hook de flota o un endpoint mínimo `GET /sessions/ethylene-targets`.
3. Deduplicar: si Dashboard monta `useFleetActiveControlMap` y Detail monta `useControlSessionsList`, ambos no deben pegarle al mismo payload gordo.

### P1 — Acotar almacenamiento en `params`

Aunque el listado se aligere, la DB y el detalle siguen creciendo.

| Cambio | Dónde | Efecto |
|--------|--------|--------|
| Bajar cap de `tunnelEventLog` de 500 → **100–150** | `tunnelEventLog.js`, idle poll | Menos JSON por sesión |
| Cap más agresivo en Cooling (`cooling_eval` ruidoso) | `gourmetProcessControl.js` | Menos eventos “sin comando” |
| Cap `coolingDecisionLog` 100 → **30** | `gourmetProcessControl.js` | Menos trazas técnicas |
| No embeber `urls` completas / `decisionTrace` gigante en cada evento de listado | al append | Eventos más chicos |
| Mover historial largo a tabla `app_control_event_log` (session_id, at, action, payload) | migración | `params` liviano; bitácora paginada |

### P1b — Filtrar por uso en el servidor

| Caso | Query sugerida |
|------|----------------|
| Flota | `WHERE status = 'active' AND archived_at IS NULL` (pocas filas) |
| Admin historial | paginación `?cursor=&limit=50` + `includeArchived` |
| Bitácora de un equipo | `WHERE device_id = $1 ORDER BY started_at DESC LIMIT 20` |

Hoy la flota pide 500 historiales solo para pintar badges de proceso activo.

### P2 — Compresión y caché HTTP

1. Asegurar **gzip/brotli** en Nginx/`api` para JSON (71 MB → suele bajar a ~5–15 MB; ayuda, **no sustituye** P0).
2. ETag / `304` ya aparece en algunas respuestas; el listado summary debe ser estable y cacheable unos segundos.
3. Evitar `refreshInterval: 30_000` con payload grande; con summary se puede mantener 30 s.

### P2b — `ripening-processes` (~6 MB)

Revisar en segunda oleada (mismo patrón: payload completo en listados). Aplicar `view=summary` + detalle por id.

---

## 3. Cambios concretos por archivo (checklist de implementación)

### Backend

- [ ] `server/src/routes/deviceControl.js` — `GET /sessions` summary por defecto; query `?view=full` solo admin/detalle
- [ ] `server/src/routes/deviceControl.js` — `GET /:id` o ampliar `/active` con events
- [ ] `server/src/tunnelEventLog.js` — reducir `slice(-500)` → `slice(-120)` (o env `TUNNEL_EVENT_LOG_MAX`)
- [ ] `server/src/gourmetProcessControl.js` — reducir `coolingDecisionLog` cap; omitir meta redundante en eventos de listado
- [ ] (Opcional) migración `app_control_event_log` + backfill desde `params.tunnelEventLog`

### Frontend

- [ ] `src/app/lib/deviceControlProcessApi.ts` — `listControlSessions({ view: 'summary' })`
- [ ] `src/app/hooks/useFleetActiveControlMap.ts` — consumir solo summary / solo `active`
- [ ] `src/app/hooks/useControlSessionsList.ts` — summary; DeviceControlAdmin pide full o pagina
- [ ] `src/app/lib/api.ts` — **quitar** `listControlSessions()` de finalize flota; usar datos ya cargados o endpoint mínimo
- [ ] `src/app/components/EventLog.tsx` — no depender del listado global; `fetchActiveControlSession(deviceId)` + eventos del tracking activo
- [ ] `src/app/components/ControlPanel.tsx` / `TelemetryCharts.tsx` — misma regla: no listar 500 sesiones para un device

### Ops / verificación

- [ ] Medir en Network: `sessions` &lt; 500 KB en flota
- [ ] Confirmar **una sola** request de sesiones por carga de dashboard
- [ ] Abrir detalle de Cooling/Ripening: bitácora sigue completa vía endpoint de detalle
- [ ] Documentar en README / deploy: rebuild `api` + `app`

---

## 6. Plan de acción — Bitácora en módulo y base de datos propios

**Decisión de diseño:** la bitácora **deja de vivir dentro de** `params.tunnelEventLog` / `payload.tunnelEventLog`. Pasa a una **tabla dedicada** + **API propia** + **UI de consulta**.  
Así la carga de equipos / sesiones **no arrastra** el historial de acciones.

### 6.1 Objetivo de producto

| Vista | Qué muestra | Origen de datos |
|-------|-------------|-----------------|
| Detalle del equipo (bitácora rápida) | Solo lo hecho en las **últimas 12 horas** | `GET …/bitacora?deviceId=&since=now-12h` |
| Módulo “Bitácora / historial” | Consulta por **rango de fechas** (y opcionalmente IMEI, tipo de acción, proceso) | `GET …/bitacora?from=&to=&deviceId=` paginado |
| Flota / sesiones / dispositivos | **Sin** eventos de bitácora | Sessions summary + Madurador list |

Regla: **cargar equipos ≠ cargar bitácora**. La bitácora se pide en paralelo o bajo demanda, nunca embebida en `/sessions`.

### 6.2 Modelo de datos propuesto

Nueva tabla (PostgreSQL, misma DB Ripener):

```sql
CREATE TABLE app_control_bitacora (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   TIMESTAMPTZ NOT NULL,
  device_id     VARCHAR(128) NOT NULL,
  session_id    UUID NULL REFERENCES app_device_control_sessions(id) ON DELETE SET NULL,
  tracking_id   UUID NULL REFERENCES app_ripening_processes(id) ON DELETE SET NULL,
  source        VARCHAR(64) NOT NULL DEFAULT 'control',
  -- process_automation | intervention | tunnel_job | tracking | manual | …
  action        VARCHAR(96) NOT NULL,
  -- cooling_setpoint | ethylene_tipo5_* | intervention_started | …
  kind          VARCHAR(64) NULL,
  -- temperature | ethylene | humidity | …
  process_type  VARCHAR(32) NULL,
  -- Cooling | Ripening | …
  summary       TEXT NULL,
  -- texto corto para UI (analysisEs / summaryEs)
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- detail técnico: urls, dato, target, decisionTrace, etc.
  user_email    VARCHAR(320) NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bitacora_device_time
  ON app_control_bitacora (device_id, occurred_at DESC);
CREATE INDEX idx_bitacora_time
  ON app_control_bitacora (occurred_at DESC);
CREATE INDEX idx_bitacora_session
  ON app_control_bitacora (session_id, occurred_at DESC)
  WHERE session_id IS NOT NULL;
CREATE INDEX idx_bitacora_action
  ON app_control_bitacora (action, occurred_at DESC);
```

Opcional más adelante: partición por mes o retención (p. ej. archivar &gt; 1 año a cold storage).

### 6.3 API del módulo (nueva)

Prefijo sugerido: `/api/v1/bitacora`

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/bitacora?deviceId=&hours=12` | Bitácora del detalle (default **12 h**) |
| `GET` | `/bitacora?deviceId=&from=&to=&cursor=&limit=100` | Módulo de consulta por rango |
| `GET` | `/bitacora/:id` | Detalle de un evento (payload completo) |
| (interno) | insert al escribir eventos | No expuesto; lo usan process control / túnel |

Respuesta listado (liviana):

```json
{
  "data": [
    {
      "id": "…",
      "occurred_at": "2026-09-17T12:00:00.000Z",
      "device_id": "ZGRU…",
      "action": "cooling_setpoint",
      "kind": "temperature",
      "process_type": "Cooling",
      "summary": "Set_point 6 → 5 °C…",
      "source": "process_automation"
    }
  ],
  "nextCursor": "…"
}
```

El `payload` pesado solo en `GET /:id` o con `?includePayload=1` en rangos acotados.

### 6.4 Escritura: dejar de embeber en `params`

Hoy: `appendTunnelEventLog` → mete el evento en `params.tunnelEventLog` (máx. 500) y guarda todo el JSONB de la sesión.

**Nuevo flujo:**

1. `appendBitacoraEvent({ deviceId, sessionId?, trackingId?, action, … })`  
   → `INSERT` en `app_control_bitacora`.
2. La sesión **ya no** acumula el array (o solo guarda un puntero opcional `lastBitacoraAt`).
3. Los mismos call sites actuales se reorientan:

| Origen actual | Archivo(s) | Cambio |
|---------------|------------|--------|
| Automatización Gourmet | `gourmetProcessControl.js` (`appendLog`) | Insert bitácora |
| Intervención Cooling | `coolingIntervention.js` | Insert bitácora |
| Jobs túnel / sync | `tunnelControlHistory.js` | Insert por step de job |
| Tracking maduración | `ripeningTrackingControl.js` | Insert bitácora (no en `payload.tunnelEventLog`) |
| Start/cancel sesión | `deviceControl.js` | Insert bitácora |
| Idle ethylene poll | `deviceEthyleneIdlePoll.js` | Insert bitácora |

Compatibilidad temporal (fase dual): escribir en **tabla +** (opcional) en JSON viejo solo si `BITACORA_DUAL_WRITE=1`, hasta validar UI.

### 6.5 Traslado de la información que ya tenemos (migración)

**Fuente A — sesiones de control**

- Tabla: `app_device_control_sessions`
- Campo: `params->'tunnelEventLog'` (array)

**Fuente B — seguimientos**

- Tabla: `app_ripening_processes`
- Campo: `payload->'tunnelEventLog'` (y a veces `controlAutomation` sin log)

**Script de migración (una vez, idempotente):**

1. Leer cada sesión / proceso con log no vacío.  
2. Por cada elemento del array:
   - `occurred_at` ← `ev.at` (o `created_at` de la sesión si falta)
   - `device_id` ← sesión / payload
   - `session_id` / `tracking_id` según origen
   - `action`, `source`, `kind`, `process_type`
   - `summary` ← `analysisEs` / `summaryEs` / texto i18n-ready
   - `payload` ← resto del evento (sin duplicar campos de columna)
3. Clave de idempotencia: `(device_id, occurred_at, action, coalesce(ev.key, md5(payload)))`  
   o columna `legacy_key` UNIQUE para no duplicar al re-ejecutar.
4. Orden: migrar → verificar conteos → activar lectura desde tabla → apagar dual-write → **purgar** `tunnelEventLog` de `params`/`payload` (dejar `{}` o eliminar la clave).

**Verificación:**

```sql
-- Eventos migrados por dispositivo vs longitud del array JSON (spot-check)
SELECT device_id, COUNT(*) FROM app_control_bitacora GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```

### 6.6 UI — dos superficies

#### A) Bitácora en detalle del equipo (últimas 12 h)

- Componente actual `EventLog.tsx`: **deja de** usar `useControlSessionsList()` (500 sesiones).
- Nuevo hook: `useDeviceBitacora(deviceId, { hours: 12 })` → endpoint liviano.
- Misma presentación (FECHA, TIPO, DESCRIPCIÓN, T°, HR%, ETILENO, CO₂).
- Refresh independiente (p. ej. 60 s), **sin bloquear** telemetría ni `/sessions`.

#### B) Módulo “Consulta de bitácora”

- Nueva entrada de menú (operador+/admin): **Bitácora**.
- Filtros: dispositivo (IMEI), **desde / hasta**, tipo de acción, proceso.
- Tabla paginada + export CSV opcional.
- Por defecto: últimas 24–48 h; el usuario elige rango (máx. razonable, p. ej. 90 días por query).

### 6.7 Fases de implementación (orden recomendado)

| Fase | Qué | Resultado | Riesgo |
|------|-----|-----------|--------|
| **B0** | Tabla + índices + `appendBitacoraEvent` + dual-write | Eventos nuevos ya en DB | Bajo |
| **B1** | Migración one-shot de JSON → tabla | Histórico conservado | Medio (tiempo batch) |
| **B2** | `GET /bitacora` 12 h + cablear `EventLog` | Detalle deja de depender de `/sessions` | Bajo |
| **B3** | `/sessions` summary **sin** `tunnelEventLog` | Flota carga en segundos | Bajo si B2 listo |
| **B4** | Módulo UI consulta por fechas | Historial largo bajo demanda | Bajo |
| **B5** | Quitar dual-write; limpiar JSON embebido | Params livianos para siempre | Medio (backup antes) |

**Importante:** B3 (aligerar `/sessions`) puede hacerse en paralelo a B0–B2, pero la bitácora del detalle **debe** leer ya de la tabla (B2) antes de borrar el array del JSON (B5).

### 6.8 Qué no debe interrumpir la carga de equipos

Al terminar el plan:

| Carga | Endpoints | Contiene bitácora? |
|-------|-----------|-------------------|
| Dashboard flota | `/madurador/dispositivos`, `/sessions?view=summary` | **No** |
| Detalle equipo (operación) | telemetría + `/sessions/active` + charts | **No** (bitácora aparte) |
| Pestaña / bloque Bitácora | `/bitacora?hours=12` | Sí, acotado |
| Módulo historial | `/bitacora?from=&to=` | Sí, bajo demanda |

Así un fallo o lentitud del módulo de bitácora **no frena** el mapa de equipos ni el panel de control.

### 6.9 Checklist de entrega

- [x] Migración `app_control_bitacora` en `migrate.js`
- [x] Servicio `server/src/bitacora.js` (insert + query 12h + rango)
- [x] Rutas `/api/v1/bitacora`
- [x] Script `server/src/migrateBitacora.js` (`npm run migrate:bitacora`)
- [x] Dual-write desde `appendTunnelEventLog` / reemplazo
- [x] `EventLog` → solo últimas 12 h vía API bitácora
- [ ] Página/módulo consulta por rango de fechas + i18n
- [x] `/sessions` deja de devolver `tunnelEventLog` (view=summary)
- [ ] Purga JSON legado tras validación en staging (`migrate:bitacora --purge`)
- [ ] Medir Network: flota sin MB de bitácora; bitácora 12 h &lt; ~200–500 KB típico

### 6.10 Resumen del cambio para el equipo

1. **Hoy:** bitácora dentro del JSON de cada sesión → hincha `/sessions` (~72 MB) y bloquea la UI.  
2. **Mañana:** bitácora en **su tabla y módulo**; equipos cargan liviano.  
3. **En el detalle:** solo **últimas 12 horas**.  
4. **Histórico largo:** módulo de consulta **por fechas**.  
5. **Datos actuales:** se **migran** una vez desde `tunnelEventLog` embebido; no se pierden.

---

## 7. Resumen ejecutivo (actualizado)

**Causa raíz:** historial de control (`tunnelEventLog`) embebido en `params` de hasta 500 sesiones, descargado (a menudo **dos veces**) al cargar flota/panel.

**Dirección correcta (acordada):**

1. Bitácora → **DB + módulo propios**.  
2. Vista rápida → **solo 12 h**.  
3. Más historia → **consulta por rango de fechas**.  
4. `/sessions` y lista de equipos → **sin bitácora**.  
5. Migrar el JSON existente a la nueva tabla y luego limpiarlo.

Eso elimina la espera de ~70 MB y separa responsabilidades: telemetría/equipos vs auditoría de acciones.
