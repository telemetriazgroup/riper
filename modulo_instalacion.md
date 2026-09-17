# Módulo de instalación de balón de etileno

**Fecha:** 2026-09-17  
**Estado:** I0–I4 implementados (2026-09-17) — `npm run migrate` + reiniciar API  
**Ubicación en producto:** pestaña **Instalación** en el detalle de cada dispositivo (junto a Operación / Monitoreo / Bitácora).

---

## 1. Requisito (cliente)

Cada vez que se cambia o ajusta un **balón de gas de etileno**, el usuario necesita:

1. **Documentar el evento** con evidencia fotográfica:
   - Foto del balón / tanque  
   - Foto del flujómetro  
   - Foto del valor de apertura (LPM) del flujómetro  
   - Descripción opcional  
2. **Modo prueba / calibración:** programar un objetivo de **10–50 ppm**.  
   El sistema inyecta solo etileno (sin proceso de maduración completo):
   - Primera dosis **2 ppm** (tipo 5)  
   - Luego dosis **proporcionales** hasta el set (misma lógica que Ripening)  
   - Al llegar al objetivo: **deja de inyectar**, avisa al entrar al dispositivo y muestra un **reporte**  
3. El reporte incluye: fotos, descripción, segundos de inyección, horas de cada dosis, tiempo hasta el set.  
4. Histórico consultable y **descarga** del reporte (PDF/HTML).

---

## 2. Validación contra el sistema actual

| Necesidad | ¿Existe hoy? | Dónde reutilizar |
|-----------|--------------|------------------|
| Dosis inicial 2 → proporcional | Sí | `ethyleneReading.js` (`computeInitialEthyleneDose`, `computeProportionalEthyleneDose`) |
| Envío tipo 5 + multiplier por equipo | Sí | `ethyleneDeviceConfig.js` → `sendEthyleneDoseWithDeviceConfig` |
| Job etileno (sin temp/CO₂) | Sí (casi) | `tunnelCommandCompliance.js` → `dispatchTunnelEthylene` / apply-manual |
| Proceso Ripening completo | Sí — **no usar** para el test | `gourmetProcessControl.js` |
| Subida de fotos | Sí (patrón) | multer en `ripeningProcesses.js` + `RipeningSamplingModal.tsx` |
| Aviso al entrar al dispositivo | Sí (otro caso) | patrón `EthyleneSupplyWarningDialog` |
| Documentar balón / flujómetro / LPM | **No** | módulo nuevo |
| Tabla / API de instalaciones | **No** | módulo nuevo |

**Conclusión:** el test de inyección debe reutilizar la **lógica pura de etileno** (y el job túnel), **no** iniciar `processType: 'Ripening'`. La documentación fotográfica es un dominio nuevo.

---

## 3. Flujo de usuario

```text
Detalle equipo → pestaña Instalación
        │
        ├─ Historial de instalaciones / pruebas (lista + descarga reporte)
        │
        └─ Nueva instalación
              ① Registrar evento
                 · fotos: balón, flujómetro, LPM (obligatorias o mín. 1+1+1)
                 · LPM numérico (opcional, además de foto)
                 · notas / descripción
                 · → estado: documented
              ② Iniciar prueba de inyección (opcional pero recomendada)
                 · set 10–50 ppm
                 · → estado: testing (dosis 2 → proporcional)
              ③ Objetivo alcanzado
                 · → estado: completed
                 · banner/toast al reentrar al dispositivo
                 · reporte listo para ver / descargar
```

Estados del registro:

| Estado | Significado |
|--------|-------------|
| `draft` | Fotos a medias / no guardado |
| `documented` | Evidencia guardada; sin test o test pendiente |
| `testing` | Calibración en curso |
| `completed` | Test OK (o cerrado sin test con flag `skipped_test`) |
| `failed` / `cancelled` | Abortado por usuario o error de comando |

---

## 4. Modelo de datos

```sql
CREATE TABLE app_ethylene_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(128) NOT NULL,
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'documented',
  -- Evidencia
  notes TEXT NULL,
  flowmeter_lpm NUMERIC(8,2) NULL,          -- valor declarado (además de foto)
  -- Prueba
  test_target_ppm NUMERIC(6,2) NULL,        -- 10..50
  test_started_at TIMESTAMPTZ NULL,
  test_completed_at TIMESTAMPTZ NULL,
  test_elapsed_seconds INT NULL,
  test_total_injection_seconds NUMERIC(12,2) NULL DEFAULT 0,
  test_baseline_ppm NUMERIC(8,2) NULL,
  test_final_ppm NUMERIC(8,2) NULL,
  test_summary JSONB NOT NULL DEFAULT '{}'::jsonb,  -- timeline dosis, lecturas
  notified_at TIMESTAMPTZ NULL,              -- aviso “calibrado listo” visto
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eth_install_device_time
  ON app_ethylene_installations (device_id, created_at DESC);
CREATE INDEX idx_eth_install_status
  ON app_ethylene_installations (status, updated_at DESC);

CREATE TABLE app_ethylene_installation_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES app_ethylene_installations(id) ON DELETE CASCADE,
  kind VARCHAR(32) NOT NULL,  -- 'cylinder' | 'flowmeter' | 'flowmeter_lpm' | 'other'
  file_path VARCHAR(1024) NOT NULL,
  original_name VARCHAR(512) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_ethylene_installation_doses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES app_ethylene_installations(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dose_ppm NUMERIC(8,2) NOT NULL,           -- dato lógico tipo 5
  physical_dato NUMERIC(8,2) NULL,          -- tras multiplier
  reading_before NUMERIC(8,2) NULL,
  reading_after NUMERIC(8,2) NULL,
  injection_seconds NUMERIC(10,2) NULL,     -- si el comando reporta duración; si no, estimado
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

Archivos en disco: `uploads/ethylene-installations/{installationId}/…` (mismo estilo que ripening).

---

## 5. API propuesta

Base: `/api/v1/ethylene-installations` (auth JWT).

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/?deviceId=` | Historial del equipo |
| `GET` | `/:id` | Detalle + fotos + dosis |
| `POST` | `/` multipart | Crear registro (notes, lpm, evidence[]) |
| `PATCH` | `/:id` | Notas / cerrar sin test |
| `POST` | `/:id/photos` | Añadir fotos |
| `POST` | `/:id/test/start` | `{ targetPpm: 10..50 }` → arranca calibración |
| `POST` | `/:id/test/cancel` | Abortar test |
| `GET` | `/:id/report` | JSON del reporte (cliente genera PDF) |
| `GET` | `/pending-notice?deviceId=` | Avisos completed no notificados al entrar |

Respuesta listado liviana (sin blobs); fotos por URL firmada o path estático autenticado.

---

## 6. Motor de prueba (solo gas)

**No** llamar a `POST /device-control/start` con Ripening.

Opciones (preferida **A**):

### A) Job dedicado `ethylene_installation_test`

1. `POST …/test/start` valida: equipo en línea (≤30 min), sin test activo, target ∈ [10, 50].  
2. Crea/usa un batch de tunnel jobs **solo etileno** (reutilizar `dispatchTunnelEthylene` o loop propio).  
3. Loop:
   - Leer `campo_1` (poll tipo 0)  
   - Si primera dosis: `computeInitialEthyleneDose` → **2**  
   - Luego: `computeProportionalEthyleneDose`  
   - `sendEthyleneDoseWithDeviceConfig(deviceId, dose)`  
   - Insert en `app_ethylene_installation_doses` (hora, ppm, lectura)  
4. Condición de fin: `lectura >= target - 0.5` (misma tolerancia que Ripening).  
5. Marca `completed`, calcula `test_elapsed_seconds`, `test_total_injection_seconds`, `test_summary`.  
6. Bitácora: evento `ethylene_installation_test_completed` en `app_control_bitacora`.

### B) Wrapper sobre apply-manual

`commands: { ethylene: targetPpm }` y vigilar el job hasta `completed`, copiando steps al registro de instalación. Más rápido de cablear; menos control del reporte fino.

**Recomendación:** A con funciones compartidas de `ethyleneReading.js` (cero duplicar la fórmula).

Reglas de seguridad:

- Bloquear test si flota `degraded` o `last_seen` > 30 min (misma regla que control).  
- Un solo test `testing` por `device_id`.  
- No interferir si hay sesión Ripening activa con etileno (rechazar o avisar).

---

## 7. UI

### 7.1 Pestaña Instalación (`DeviceDetail` / `TunnelDeviceDetail`)

- Lista cronológica de instalaciones (fecha, usuario, status, target, duración).  
- Botón **Nueva instalación**.  
- Al abrir un registro completed → vista reporte + **Descargar PDF**.

### 7.2 Wizard “Nueva instalación”

1. **Evidencia:** 3 slots de foto (balón / flujómetro / LPM) + input LPM + notas.  
2. **Prueba:** slider/input 10–50 ppm + “Iniciar calibración”.  
3. **Progreso:** lectura actual, última dosis, tiempo transcurrido (poll SWR 5–10 s).  
4. **Listo:** resumen + enlace a reporte.

### 7.3 Aviso al entrar al dispositivo

Si existe instalación `completed` con `notified_at IS NULL`:

- Dialog (patrón supply warning): *“Calibración de etileno finalizada — ver reporte”*  
- Al cerrar → `PATCH` marca `notified_at`.

### 7.4 PDF

Cliente: `jspdf` / html2canvas (ya usados en Dashboard / reportes de proceso).  
Contenido: metadatos, fotos, tabla de dosis (hora, ppm, lectura), totales, tiempo a objetivo.

---

## 8. i18n (claves previstas)

- `nav_installation` / tab `Instalación`  
- `install_new`, `install_photos_*`, `install_test_start`, `install_test_target`  
- `install_completed_notice`, `install_download_report`  
- `install_history_empty`, errores de rango / equipo offline  

---

## 9. Fases de implementación

| Fase | Qué | Resultado |
|------|-----|-----------|
| **I0** | Migración tablas + `ethyleneInstallation.js` | Persistencia |
| **I1** | Rutas CRUD + upload fotos | Documentar cambio de balón |
| **I2** | Motor test 10–50 ppm (dosis 2 → proporcional) | Calibración automática |
| **I3** | Pestaña UI + wizard + progreso | Operación en dispositivo |
| **I4** | Aviso al entrar + reporte PDF + histórico | Cierre del ciclo |

Orden: **I0 → I1 → I3 (solo evidencia)** ya aporta valor; **I2 + I4** completan la calibración.

---

## 10. Criterios de aceptación

- [x] Desde el detalle del equipo se puede registrar un cambio de balón con 3 fotos + notas + LPM.  
- [x] Se puede lanzar un test 10–50 ppm sin iniciar Ripening/Cooling.  
- [x] Primera dosis lógica = 2; siguientes proporcionales; respeta `injection_multiplier` del equipo.  
- [x] Al alcanzar el set, deja de inyectar y el registro pasa a `completed`.  
- [x] Al volver a entrar al dispositivo aparece aviso de calibración terminada.  
- [x] Reporte muestra fotos, descripción, cada inyección (hora + ppm) y tiempo total.  
- [x] Histórico filtrable por dispositivo y descargable.  
- [x] No permite test si el equipo lleva >30 min sin dato en vivo / flota degradada.

---

## 11. Fuera de alcance (v1)

- Inventario de balones / stock multipunto.  
- Lectura automática de LPM por cámara (OCR).  
- Sustituir el aviso de “falta de suministro” (`EthyleneSupplyWarning`); conviven.  
- Calibración > 50 ppm (usar proceso Ripening normal).

---

## 12. Resumen

| Hoy | Con el módulo |
|-----|----------------|
| Cambio de balón sin evidencia formal | Registro con fotos + LPM en Ripener |
| Calibración solo vía Ripening/manual | Test dedicado 10–50 ppm, misma matemática de dosis |
| Sin historial de instalaciones | Consulta + PDF por evento |

**Próximo paso:** implementar **I0 + I1** (tablas + API + upload) y luego **I2–I4**.
