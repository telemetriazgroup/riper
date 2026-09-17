# Error de gas — relé de etileno pegado / inyección descontrolada

**Fecha:** 2026-09-17  
**Estado:** implementado (G0–G4)  
**Origen del requisito:** `modulo_instalacion.md` (implicancia de inyección de etileno)  
**Contexto relacionado:** `gases_lectura.md` (picos de sensor sin proceso — otro problema), `Logica_AUTOMATICO.md` / `Logica_comandos.md`

---

## 1. Problema de negocio

En Ripening el comando **tipo 5** activa el **relé de inyección** durante `dato` segundos (`UNIT111_RELE(1, N)`).

Caso crítico observado en operación:

1. Se programa set (ej. **150 ppm**).  
2. El sistema envía una dosis (ej. **5** → relé ~5 s) porque estaba en ~141.  
3. A veces el **relé queda pegado** (no se abre al terminar el tiempo).  
4. El gas sigue entrando **sin nuevos comandos**.  
5. La lectura sube muy por encima del set (161 → 181 → …).  
6. Riesgo de sobreinyección, alarma de proceso y producto comprometido.

Hoy el control **solo actúa si la lectura está por debajo del set** (`effective < target - 0.5`). **No hay rama de sobrepaso / runaway.**

---

## 2. Validación contra el proceso de control actual

### 2.1 Semántica real del comando

| Capa | Comportamiento |
|------|----------------|
| Hardware / API túnel | `tipo: 5, dato: N` → relé ON **N segundos** |
| Código (`ethyleneReading`, gourmet, compliance) | Llama “ppm” a `N`, pero en la práctica **1 unidad ≈ 1 s** de inyección |
| Multiplier (`app_device_ethylene_config`) | `dato_físico = clamp(lógico × multiplier, 1..120)` |

**Implicancia para el pulso de despegue:** un “1 segundo” de seguridad debe ser **`dato` físico = 1`**, no `sendEthyleneDose(1)` si el multiplier es p. ej. 6 (enviaría 6 s).

### 2.2 Dónde vive la dosificación normal

| Función | Archivo | Rol |
|---------|---------|-----|
| `tickEthyleneSteadyMonitor` | `gourmetProcessControl.js` | Monitor en steady: si debajo del set → dosis 2 / proporcional / fallback |
| `tickEthyleneCycle` | idem | Primera subida del ciclo |
| `dispatchTunnelEthylene` | `tunnelCommandCompliance.js` | Jobs manuales apply-manual |
| `resolveEthyleneReading` | `ethyleneReading.js` | Filtra ceros espurios tras dosis |

Umbrales existentes (útiles, no suficientes):

| Constante | Valor | Uso hoy |
|-----------|-------|---------|
| Tolerancia set | **0.5** ppm | “llegó al objetivo” |
| `ETHYLENE_MAX_READING` | **300** | saturación / ignore |
| `ETHYLENE_RECENT_DOSE_MS` | **10 min** | no escalar si no hay incremento |
| `ETHYLENE_MAX_DOSE` | **120** | tope de un comando |
| Steady poll | **3 min** | ritmo de vigilancia |

**No existen:** `target × 1.20`, umbral **270**, pulso de 1 s anti-relé, ventilación de emergencia 15 min AVL 200.

### 2.3 Avisos que ya existen (otro fallo)

`ethyleneSupplyWarning` / dialog: detectan **falta de gas** (inyecta y no sube). Es el problema **inverso**. El runaway por relé pegado es **sobreinyección**.

### 2.4 Ventilación ya usada en Ripening

- Tipo **6** = AVL (CFM).  
- Hoy CO₂ alto / Ventilation usan **AVL 220**, no 200.  
- Es un **setpoint**, no un temporizador: el “15 minutos” debe ser **estado propio** (`ventUntil`), no del comando.

---

## 3. Comportamiento deseado (máquina de seguridad)

### 3.1 Constantes propuestas

```text
ETHYLENE_OVERSHOOT_RATIO     = 1.20      # 150 → dispara a ≥ 180
ETHYLENE_STUCK_PULSE_DATO    = 1         # 1 s físico tipo 5
ETHYLENE_STUCK_WATCH_MS      = 10 * 60s  # vigilar tendencia alcista
ETHYLENE_RUNAWAY_PPM         = 270       # ventilación de emergencia
ETHYLENE_VENT_AVL            = 200       # CFM durante emergencia
ETHYLENE_VENT_DURATION_MS    = 15 * 60s
# Salida de ventilación: lectura ≤ target * OVERSHOOT_RATIO (o ≤ target + margen)
```

### 3.2 Fases

```text
                    ┌─────────────────────────────────────────┐
  Ripening steady   │  NORMAL (tickEthyleneSteadyMonitor)     │
                    └───────────────┬─────────────────────────┘
                                    │ lectura > target × 1.20
                                    │ (y hubo dosis reciente o tendencia post-dosis)
                                    ▼
                           ┌─────────────────┐
                           │  PULSE_UNSTICK  │  tipo 5, dato=1 (físico)
                           │  suspende dosis │
                           └────────┬────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │  WATCH_RISE     │  hasta 10 min
                           │  sin dosis      │  normales
                           │  proporcionales │
                           └────────┬────────┘
                     tendencia↓ OK  │  sigue subiendo
                     → NORMAL       │  desproporcionada
                                    ▼
                           otro PULSE_UNSTICK (1 s)
                                    │
                    lectura > 270 ──┼──────────────────┐
                                    │                  ▼
                                    │         ┌─────────────────┐
                                    │         │  EMERGENCY_VENT │
                                    │         │  AVL=200, 15 min│
                                    │         │  (o hasta ≤120% │
                                    │         │   del set)      │
                                    │         └────────┬────────┘
                                    │                  │
                                    └──────────────────┘
                                              ▼
                                         NORMAL
```

### 3.3 Reglas detalladas

**A) Entrada a seguridad (overshoot)**

- Condición: `effective >= target * 1.20`  
  (ej. set 150 → umbral 180).  
- Preferible exigir: existe `lastDoseAt` en la sesión **o** subida clara desde la última dosis sin nuevo comando (el síntoma del relé pegado).  
- Acción inmediata:
  1. Marcar `auto.ethyleneSafety.phase = 'pulse'`.  
  2. **No** enviar dosis proporcionales/normales.  
  3. Enviar **pulso físico** `tipo=5, dato=1` (bypass multiplier).  
  4. Bitácora: `ethylene_safety_unstick_pulse` + lectura/set.  
  5. Pasar a `watch_rise` con `watchUntil = now + 10 min`, guardar `readingAtPulse`.

**B) Vigilancia 10 minutos**

- En cada tick de etileno (o poll más frecuente, p. ej. 1–2 min mientras safety activo):
  - Si `effective` **baja o se estabiliza** hacia el set → salir a NORMAL.  
  - Si **sigue alcista de forma desproporcionada** (ej. Δ ≥ +X ppm desde `readingAtPulse`, o sigue > target×1.20 y pendiente positiva) → otro pulso de 1 s y reiniciar reloj de 10 min (con tope de pulsos, p. ej. 3, para no martillar el relé).  
- Mientras tanto: **suspendido** el control normal de etileno (no `computeProportionalEthyleneDose`).

**C) Emergencia ≥ 270 ppm**

- Si en cualquier fase `effective > 270` (o ≥ 270):
  1. `phase = 'ventilate'`.  
  2. Enviar **AVL = 200** (tipo 6) a las unidades del adapter.  
  3. `ventUntil = now + 15 min`.  
  4. Bitácora: `ethylene_safety_emergency_vent`.  
  5. Poll cada 1–2 min; **no** inyectar etileno.  
  6. Salida cuando:
     - `effective <= target * 1.20` **y** (opcional) `now >= ventUntil`, **o**  
     - `now >= ventUntil` y lectura ya bajó de 270 con tendencia no alcista.  
  7. Restaurar AVL al valor de proceso / steady (si había política de ventilación Ripening) y volver a NORMAL.

**D) Prioridad**

```text
EMERGENCY_VENT  >  PULSE/WATCH  >  dosificación normal  >  otros ajustes etileno
```

Cooling intervention / StopPlan: si el proceso no es Ripening, este módulo **no aplica**.  
Si hay `interventionActive` en Cooling, no mezclar.

---

## 4. Implicancias (riesgos y diseño)

| Tema | Implicancia | Mitigación |
|------|-------------|------------|
| Multiplier de inyección | `sendEthyleneDose(1)` puede mandar 6 s | Pulso de seguridad con `sendCommand(imei, 5, 1)` **físico** |
| Falso positivo (spike sensor) | Lectura 300 espuria (ver `gases_lectura.md`) puede disparar vent | Exigir **2 lecturas consecutivas** > umbral, o cruzar con `resolveEthyleneReading` + historial no-cero; no actuar solo con un 0→300→50 |
| Falso positivo post-dosis legítima | Sube 141→161 en 3 min con dosis 5 s puede ser gas real | Overshoot gate a **1.20× set**, no a “cualquier subida”; el pulso 1 s es barato si el relé estaba bien |
| Suspender control | Si no se limpia el flag, el set nunca se mantiene | Timeouts claros + bitácora + UI “modo seguridad etileno” |
| AVL 200 vs 220 | Difiere del vent CO₂ actual | Constante propia `ETHYLENE_VENT_AVL=200`; documentar en export de lógica |
| Jobs manuales concurrentes | apply-manual puede seguir inyectando | Gate también en `tunnelCommandCompliance` / rechazar ethylene jobs si safety activo |
| Reinicio horario Ripening | `hourly_review_restart` puede borrar automation | Persistir `ethyleneSafety` o re-derivar si lectura aún > 1.20× set |
| Alarma / correo | Operador debe enterarse | `fireEmailNotification` + evento bitácora + banner en DeviceDetail |
| Instalación / test 10–50 | Mismo hardware de relé | Reutilizar el mismo `ethyleneSafety.js` en el tick de instalación (umbral = target del test) |

---

## 5. Cómo implementarlo

### 5.1 Módulo nuevo

`server/src/ethyleneSafety.js`

- Constantes.  
- `evaluateEthyleneSafety({ target, reading, ethMeta, safetyState, now })` → `{ nextState, actions[] }`.  
- Acciones: `pulse_unstick`, `start_vent`, `end_vent`, `clear`, `noop`.  
- Helpers: `isRisingTrend(samples)`, `overshootThreshold(target)`.

Estado en `params.processAutomation.ethyleneSafety`:

```json
{
  "phase": "watch_rise",
  "enteredAt": "...",
  "watchUntil": "...",
  "ventUntil": null,
  "readingAtEnter": 181,
  "targetPpm": 150,
  "pulseCount": 1,
  "lastPulseAt": "...",
  "reason": "overshoot_1_20"
}
```

### 5.2 Integración en Ripening

Archivo: `gourmetProcessControl.js`

```text
tickEthyleneSteadyMonitor / tickEthyleneCycle:
  1. resolveEthyleneReading(...)
  2. safety = tickEthyleneSafety(ctx, auto, reading, target)   // NUEVO
  3. if (safety.suspendNormalDosing) return { auto, events }  // sin dosis normal
  4. ... lógica actual debajo del set ...
```

Ejecución de acciones:

- Pulso: `adapter.sendCommand(unitId, 5, 1)` (todas las unidades fan-out si aplica).  
- Vent: `fanOutSend(ctx, 6, 200)`.  
- Eventos → `tunnelEventLog` / `queueBitacoraEvent`.

### 5.3 Jobs manuales

En `tunnelCommandCompliance.js` / start de job ethylene:

- Si sesión activa con `ethyleneSafety.phase` ≠ null → **no** despachar dosis (o cancelar job con error `ethylene_safety_active`).

### 5.4 Cliente / UI

- Banner en ControlPanel / DeviceDetail si `phase` activo: *“Seguridad etileno: posible relé pegado — control de dosis suspendido”*.  
- Bitácora ya muestra acciones nuevas vía `summarizeProcessEventParts` (añadir i18n).  
- Opcional: email `ethylene_runaway` a grupos del dispositivo.

### 5.5 Export / documentación operativa

Actualizar `controlLogicExport.js` y una sección en `Logica_AUTOMATICO.md` con umbrales 120 % / 270 / AVL 200 / 15 min.

---

## 6. Ejemplo numérico (del requisito)

| Tiempo | Lectura | Qué hace el sistema hoy | Qué haría con seguridad |
|--------|---------|-------------------------|-------------------------|
| t0 | 141 | Dosis 5 s (hacia 150) | Igual |
| t0+3 min | 161 | Nada (ya ≥ set−0.5) | Nada aún (&lt; 180) |
| t0+… | 181 | Nada | **≥ 180** → pulso 1 s, suspende normal, watch 10 min |
| sigue ↑ | 200 | Nada | Si tendencia alcista en la ventana → otro pulso 1 s |
| | 275 | Nada | **> 270** → AVL 200, ventilar ~15 min hasta ≤ 180 (o estable) |
| | ≤ 180 | — | Limpia safety → vuelve monitor normal |

---

## 7. Fases de implementación

| Fase | Qué | Resultado |
|------|-----|-----------|
| **G0** | `ethyleneSafety.js` + constantes + tests unitarios de umbrales/tendencia | Lógica pura |
| **G1** | Hook en `tickEthyleneSteadyMonitor` / cycle + bitácora | Protege Ripening automático |
| **G2** | Pulso físico `dato=1` + fase `watch_rise` | Anti-relé pegado |
| **G3** | Emergencia ventilación AVL 200 / 15 min + restore | Contención >270 |
| **G4** | Gate jobs manuales + UI banner + email + i18n | Operación completa |
| **G5** | Reutilizar en test de instalación | Misma protección en calibración |

Orden recomendado: **G0 → G1 → G2 → G3** (mínimo viable de seguridad); luego G4–G5.

---

## 8. Criterios de aceptación

- [x] Con set 150, si `campo_1` efectivo ≥ 180 tras una dosis, se envía **un** comando tipo 5 con **dato físico 1** y se deja de dosificar en modo normal.  
- [x] Si en los siguientes 10 min la lectura sigue subiendo sin nuevos comandos de dosis normal, se repite el pulso 1 s (con tope de repeticiones).  
- [x] Si la lectura supera **270**, se abre ventilación AVL **200** ~15 min (o hasta bajar a ≤ 120 % del set) y no se inyecta etileno.  
- [x] Al estabilizar, el control Ripening normal se reanuda sin reiniciar el proceso completo.  
- [x] Eventos visibles en bitácora; operador ve aviso en UI.  
- [x] Spikes de un solo punto (sensor) no disparan ventilación de 15 min (doble confirmación).  
- [x] Multiplier del equipo **no** alarga el pulso de seguridad a N segundos.

---

## 9. Fuera de alcance (v1)

- Diagnóstico hardware del relé / mantenimiento.  
- Cierre automático de válvula mecánica distinta del relé tipo 5.  
- Sustituir el aviso de “falta de suministro” (sigue siendo independiente).  
- Filtrar picos idle de gráfica (`gases_lectura.md`) — complementary, no este módulo.

---

## 10. Resumen

| Hoy | Con este módulo |
|-----|-----------------|
| Solo inyecta si está **bajo** el set | También **contiene** si se pasa del set por relé pegado |
| Sobrepaso → nada | ≥120 % set → pulso 1 s + vigilancia 10 min |
| Lecturas >270 sin acción de vent etileno | Ventilación AVL 200 de emergencia |
| Riesgo de runaway silencioso | Prioridad a estabilidad de gases + bitácora/alerta |

**Próximo paso de código:** G5 opcional — reutilizar en test de instalación (`ethyleneInstallation`).
