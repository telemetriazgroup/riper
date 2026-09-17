# Equipos en línea — registro local y fallback sin API upstream

**Fecha:** 2026-09-17  
**Estado:** E0–E4 implementados (2026-09-17) — migrar DB + reiniciar API  
**Síntoma:** si falla la API Madurador/TermoKing que lista dispositivos, la flota queda **vacía** y el usuario cree que “desaparecieron” los equipos.

---

## 1. Validación de la estructura actual

### 1.1 Flujo real (hoy)

```text
API Madurador (listar_dispositivos_proceso_identificador_empresa)
        │
        ▼
Ripener  GET /api/v1/madurador/dispositivos
  · filtros por JWT / flota (Gourmet, Greenyard, UltraOrganics, ThermoKing, …)
  · si upstream falla → 502 (muchas flotas) o lista parcial (superadmin)
        │
        ▼
Cliente  madurador.ts + maduradorCache (solo memoria, TTL 25 s)
        │
        ▼
api.ts → fetchDevices() → useDevices (SWR) → Dashboard / DeviceCard
```

| Capa | Qué guarda | ¿Resiste reinicio / caída upstream? |
|------|------------|-------------------------------------|
| `maduradorCache.ts` | Lista en RAM 25 s | No |
| `app_user_device_names` | Solo sobrenombres | No (no es inventario) |
| `app_device_control_sessions` | Procesos de control | Parcial (no telemetría de flota) |
| `app_control_bitacora` | Acciones de control | Sí, pero no lista de equipos |
| Histórico Madurador rango | Upstream en vivo | No si upstream cae |

**Conclusión:** no existe un **registro propio de equipos**. La flota es 100 % dependiente del listado upstream en cada poll. Por eso, ante 502/timeout, el cliente cae a `[]` y “desaparecen” las tarjetas.

### 1.2 Qué sí tenemos (reutilizar)

| Concepto | Código | Umbral |
|----------|--------|--------|
| En línea | `maduradorConnection.js` / timestamps UI | último dato ≤ **30 min** |
| Espera / standby | idem | 30 min – **12 h** |
| Offline | idem | > **12 h** |
| Comandos bloqueados por telemetría vieja | `COMMAND_STALE_TELEMETRY_MINUTES` | **10 min** (hoy) |
| Histórico por defecto en charts | `fetchDeviceHistory` / rango Madurador | **últimas 12 h** |
| Bitácora de control | `app_control_bitacora` | últimas 12 h en detalle |

Tu regla de negocio encaja casi 1:1:

- **Ver / operar lectura** con última info + 12 h de historial → fallback local.  
- **Control limitado** si no hay “conexión del equipo” en los **últimos 30 min** → alinear con `CONNECTION_STANDBY_MINUTES` (y opcionalmente endurecer comandos a 30 min en modo degradado).

### 1.3 Dónde “desaparecen” los equipos

1. Server responde **502** (`madurador.js` ThermoKing / Greenyard / Gourmet / usuario con identificador).  
2. Cliente `fetchDevices` hace **catch → `[]`**.  
3. Caché en memoria vacía (cold start o TTL vencido sin éxito previo).  
4. Flotas con merge parcial: un IMEI que no vino en el último listado **se omite** (no se conserva).

Offline ≠ desaparecido: un equipo con telemetría vieja **sí** se muestra como offline. El bug es **ausencia en el listado**, no el badge de estado.

---

## 2. Objetivo de producto

1. Ripener mantiene una **base local** de dispositivos vistos (IMEI + último payload + fechas de conexión).  
2. Si **no hay acceso a la API upstream**, servir el **último snapshot** conocido.  
3. El usuario sigue viendo flota, última telemetría y **últimas 12 h** de funcionamiento (histórico local o último rango cacheado).  
4. Módulos de lectura (dashboard, detalle, charts, bitácora) siguen disponibles en modo degradado.  
5. **Control** queda limitado si el equipo no tiene dato en vivo / última conexión en los **últimos 30 minutos**.  
6. UI debe dejar claro: *datos en respaldo / sin enlace a la API remota* — no fingir que todo está online.

---

## 3. Diseño propuesto

### 3.1 Tablas nuevas (PostgreSQL Ripener)

```sql
-- Inventario + último estado conocido por IMEI
CREATE TABLE app_device_registry (
  device_id VARCHAR(128) PRIMARY KEY,          -- IMEI / id canónico
  empresa_identificador VARCHAR(64) NULL,      -- 2001, 5001, …
  fleet_keys TEXT[] NOT NULL DEFAULT '{}',      -- etiquetas lógicas (gourmet, greenyard, …)
  display_name VARCHAR(255) NULL,               -- último nombre visto (no sobrenombre de usuario)
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,   -- fila Madurador sanitizada / Device-like
  last_seen_at TIMESTAMPTZ NULL,                -- último dato del equipo (telemetría)
  last_online_at TIMESTAMPTZ NULL,              -- última vez que age ≤ 30 min
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  upstream_fetched_at TIMESTAMPTZ NOT NULL,     -- cuándo se obtuvo este snapshot de la API
  source VARCHAR(64) NOT NULL DEFAULT 'madurador',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_registry_empresa ON app_device_registry (empresa_identificador);
CREATE INDEX idx_device_registry_last_seen ON app_device_registry (last_seen_at DESC);
CREATE INDEX idx_device_registry_fetched ON app_device_registry (upstream_fetched_at DESC);

-- Histórico de telemetría propio (respaldo 12–24 h, no sustituye Madurador a largo plazo)
CREATE TABLE app_device_telemetry_samples (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(128) NOT NULL REFERENCES app_device_registry(device_id) ON DELETE CASCADE,
  sampled_at TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,  -- temp, hr, etileno, co2, …
  source VARCHAR(64) NOT NULL DEFAULT 'madurador_list',
  UNIQUE (device_id, sampled_at, source)
);

CREATE INDEX idx_telemetry_device_time
  ON app_device_telemetry_samples (device_id, sampled_at DESC);
```

**Retención:** job / al insertar: borrar samples con `sampled_at < now() - interval '24 hours'` (servir UI con ventana **12 h**; guardar 24 h de margen).

**No mezclar** con `app_user_device_names` (aliases por usuario).

### 3.2 Escritura (cuando la API sí responde)

En `GET /api/v1/madurador/dispositivos`, **después** de un fetch exitoso y sanitizado:

1. Por cada fila (IMEI):
   - `UPSERT` en `app_device_registry` (`payload`, `last_seen_at`, `upstream_fetched_at`, `empresa_identificador`).
   - Si age ≤ 30 min → actualizar `last_online_at = now()` (o = `last_seen_at`).
2. Insertar 1 sample en `app_device_telemetry_samples` si cambió el timestamp o cada N minutos (evitar spam).
3. Opcional: en éxito de `buscar_datos_madurador_rango`, upsert de puntos del rango (refuerza el histórico local).

Módulo sugerido: `server/src/deviceRegistry.js`  
- `upsertDevicesFromMaduradorRows(rows, meta)`  
- `listRegistryForScope(scope)`  
- `getRegistryDevice(deviceId)`  
- `listTelemetrySamples(deviceId, { hours: 12 })`

### 3.3 Lectura (cuando la API falla o viene vacía)

En las ramas 502 / timeout / JSON inválido de `madurador.js`:

```text
try upstream
  → OK: upsert registry + return live (+ header X-Ripener-Source: live)
  → FAIL: load registry filtrado por el mismo scope (empresa / allowlist / role)
           → 200 + data snapshot
           → meta: { degraded: true, source: 'registry', upstream_fetched_at, stale_seconds }
```

**Nunca** devolver lista vacía si el registry del scope tiene filas (salvo usuario sin permisos).

Filtros de flota (Gourmet IMEI allowlist, etc.) se aplican **igual** sobre el registry.

### 3.4 Histórico 12 h en modo degradado

| Situación | Fuente de charts |
|-----------|------------------|
| Upstream rango OK | Madurador (igual que hoy) |
| Upstream rango falla | `app_device_telemetry_samples` últimas 12 h |
| Sin samples locales | Al menos 1 punto sintético desde `payload` del registry (última foto) |

Endpoint nuevo o extensión:

`GET /api/v1/devices/:deviceId/telemetry?hours=12`  
→ intenta upstream; si falla → samples locales.

Cliente: `fetchDeviceHistory` ya tiene catch; priorizar respuesta Ripener local antes que vacío/mock.

### 3.5 Control limitado (regla 30 min)

Estado derivado por equipo:

| Condición | UI / API |
|-----------|----------|
| `last_seen_at` age ≤ 30 min **y** upstream live reciente | Control normal |
| Modo `degraded` (lista desde registry) **o** age > 30 min | **Control limitado**: no enviar comandos nuevos / deshabilitar start/intervención |
| age > 12 h | Offline visual; solo lectura (última info + bitácora/histórico local) |

Implementación:

- Server: en rutas de `device-control` / tunnel commands, rechazar si `!isDeviceCommandAllowed(deviceId)` cuando:
  - registry dice age > 30 min, **o**
  - request llega con flota en `degraded` y no hay telemetría fresca.
- Cliente: `ControlPanel` / botones de proceso: `canControl = !degradedFleet && connectionAgeMinutes <= 30`.
- Mensaje i18n claro: *“Sin enlace en vivo al equipo (últimos 30 min). Solo consulta.”*

Alinear umbral de comandos: hoy `COMMAND_STALE_TELEMETRY_MINUTES = 10`. En modo degradado usar **30** (o unificar a 30 para “conexión de equipo” y dejar 10 solo para telemetría “en vivo” cuando upstream OK). Recomendación:  

- **Live:** seguir 10 min para comandos.  
- **Degraded / sin API:** exigir ≤ 30 min de `last_seen_at` **y** además bloquear si `upstream_fetched_at` del registry es viejo sin confirmación live — en la práctica: **bloquear todo control en `degraded: true`**, excepto superadmin override opcional.

### 3.6 Señales en la UI

- Banner en Dashboard: *“Mostrando último estado conocido — API de dispositivos no disponible.”*  
- Badge en DeviceCard: `Respaldo` / `Última vez en línea: …`.  
- Detalle: telemetría con watermark de `upstream_fetched_at`.  
- No usar `MOCK_DEVICES` para flotas reales cuando hay registry.

---

## 4. Flujo objetivo

```text
                    ┌── upstream OK ──► upsert registry + samples ──► respuesta live
GET /dispositivos ──┤
                    └── upstream FAIL ─► SELECT registry (scope) ──► respuesta degraded
                                              │
                                              ▼
                                    UI flota + última telemetría
                                    charts ← samples 12 h
                                    bitácora ← app_control_bitacora (ya local)
                                    control ← bloqueado si >30 min / degraded
```

---

## 5. Fases de implementación

| Fase | Qué | Resultado | Riesgo |
|------|-----|-----------|--------|
| **E0** | Migración `app_device_registry` + `app_device_telemetry_samples` + `deviceRegistry.js` | Tablas listas | Bajo |
| **E1** | Upsert en cada listado Madurador exitoso | Empieza a llenarse el inventario | Bajo |
| **E2** | Fallback 200 degraded en lugar de 502/`[]` | Flota no desaparece | Medio (probar scopes) |
| **E3** | Histórico local 12 h + `fetchDeviceHistory` fallback | Charts en degradado | Bajo |
| **E4** | Gate de control 30 min + banner UI + i18n | Control seguro sin engañar | Bajo |
| **E5** | Retención 24 h + métricas (`degraded` rate) | Operación estable | Bajo |

Orden: **E0 → E1 → E2** es el mínimo para eliminar el “desaparecen”. E3–E4 completan la experiencia que pediste.

---

## 6. Puntos de inserción en código

| Archivo | Cambio |
|---------|--------|
| `server/src/migrate.js` | SQL tablas |
| `server/src/deviceRegistry.js` | **nuevo** módulo |
| `server/src/routes/madurador.js` | upsert OK + fallback FAIL |
| `server/src/routes/deviceTelemetry.js` | **nuevo** (opcional) historial local |
| `server/src/maduradorConnection.js` | helpers `isWithinOnlineWindow` / `canControlDevice` |
| `server/src/routes/deviceControl.js` | gate control en degraded / >30 min |
| `src/app/lib/api.ts` | no vaciar flota si API Ripener devolvió degraded |
| `src/app/lib/madurador.ts` | tipar `meta.degraded` |
| `src/app/hooks/useDevices.ts` | exponer `degraded` al Dashboard |
| `src/app/components/Dashboard.tsx` / `DeviceCard.tsx` | banner + badge |
| `src/app/components/ControlPanel.tsx` | deshabilitar acciones |
| `SettingsContext.tsx` | i18n ES/EN |

---

## 7. Contrato API (respuesta degradada)

```json
{
  "data": [ /* mismos rows shape Madurador / Device */ ],
  "meta": {
    "source": "registry",
    "degraded": true,
    "reason": "upstream_unavailable",
    "upstream_fetched_at": "2026-09-17T12:00:00.000Z",
    "registry_count": 42
  }
}
```

Live:

```json
{
  "data": [ … ],
  "meta": { "source": "live", "degraded": false }
}
```

Compatibilidad: clientes viejos ignoran `meta` y siguen usando `data`.

---

## 8. Criterios de aceptación

- [ ] Con Madurador caído (simular timeout), Dashboard muestra los **mismos IMEI** vistos en la última sync exitosa.  
- [ ] Cada tarjeta muestra última telemetría conocida + indicador de respaldo.  
- [ ] Charts del detalle muestran ≥ última foto y, si hubo sync previa, curva ~12 h local.  
- [ ] Bitácora de control (módulo propio) sigue funcionando (ya es DB local).  
- [ ] Botones de iniciar/cancelar proceso / comandos túnel **deshabilitados** si age > 30 min o `degraded`.  
- [ ] Al volver upstream, `source: live` y datos se refrescan sin acción manual rara.  
- [ ] Usuarios de flota restringida **no** ven IMEI fuera de su allowlist vía registry.

---

## 9. Fuera de alcance (por ahora)

- Reemplazar Madurador como fuente de verdad a largo plazo.  
- Histórico > 24–48 h en Ripener (eso sigue siendo Madurador/TermoKing).  
- Réplica multi-región / offline-first en el navegador (IndexedDB): el respaldo es **servidor Ripener**, no solo el browser.  
- Sobreescribir sobrenombres de usuario con el registry.

---

## 10. Resumen ejecutivo

| Hoy | Mañana |
|-----|--------|
| Flota = echo del listado upstream | Flota = upstream **o** último inventario Ripener |
| 502 → pantalla vacía | 200 degraded → última info + 12 h locales |
| Control según telemetría 10 min (si hay lista) | Control limitado sin conexión de equipo ≤ 30 min / sin API |
| Caché 25 s en browser | Persistencia PostgreSQL + samples |

**Próximo paso de implementación:** fase **E0 + E1 + E2** (tabla + upsert + fallback en `/dispositivos`).
