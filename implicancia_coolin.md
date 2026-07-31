# Implicancia — Cooling (enfriamiento)

Comparación entre el **Cooling actual** en Riper y la lógica deseada en `logica_enfriamiento.md`, más los cambios a realizar.

---

## 1. Cómo funciona Cooling hoy

### Arranque

- Panel: proceso `Cooling` con `setPoint` (objetivo producto, 0–20 °C) + duración.
- Seguimiento / receta: fase `cooling` → mismo automatismo (`ripeningTrackingControl.js` → `tickGourmetControlContext`).
- Aplica a equipos automatizados (Gourmet túnel, Greenyard, UltraOrganics).

### Decisión de temperatura (única regla)

Archivo: `server/src/gourmetProcessControl.js` → `coolingCommandTempC` / `resolveCommandTempC`  
Espejo front: `src/app/lib/coolingCommandTemp.ts`

```text
objetivo = setPoint programado del proceso
si return_air − objetivo > 3 °C:
    comando = objetivo − 3     // agresivo
si no:
    comando = objetivo − 2     // normal
```

Ejemplo: objetivo **6 °C**, retorno **12 °C** → se envía **3 °C** (agresivo).  
Si retorno **8 °C** → se envía **4 °C**.

### Sensores usados hoy

| Sensor | ¿En la decisión Cooling? |
|--------|---------------------------|
| `return_air` | **Sí** — único input dinámico |
| `set_point` (telemetría) | **Sí** — verificar que el comando se aplicó (±0.35 °C) |
| `evaporation_coil` | No |
| `cargo_1..4_temp` | No |
| `temp_supply_1` | No |

### Comandos

| Tipo | Uso actual en Cooling |
|------|------------------------|
| **tipo 1** (temperatura) | Sí — único comando |
| **tipo 8** (defrost) | **No existe** en el automatismo |

Upstream (según flota):

- TermoKing: `{MADURADOR_API_BASE}/TermoKing/comando_control/{imei}?tipo=1&dato=…`
- Túnel Gourmet: `…/Tunel/comando_control_tunel/{imei}?tipo=1&dato=…`

### Cadencia

| Qué | Valor |
|-----|--------|
| Poller general | ~30 s (`GOURMET_PROCESS_POLL_MS`) |
| Tras envío (verificar set) | 2 min |
| Tras match / mantenimiento Cooling | **10 min** (`TEMP_HUMIDITY_MAINTENANCE_MS`) |
| Intentos máx. de ajuste | 3, luego skip |

**No** se consulta `ultimo_control`. El espaciado es local (`nextActionAt` / contadores).

### Trazabilidad (implementada)

En bitácora (`tunnelEventLog`) al actuar o evaluar con cambio de sensores:

- `cooling_setpoint` / `cooling_defrost`: incluyen `decisionTrace` con
  - `reasonCode` + `analysisEs` (por qué)
  - `change` (`fromC` → `toC` o defrost tipo 8)
  - `inputs` (objetivo, set, retorno, supply, evap, cargos, cargoAvg)
  - `timing` (ms desde último set / defrost) y `ultimoControl`
  - `summaryEs` legible para bitácora y análisis
- `cooling_eval`: solo si no hubo comando y la telemetría **sí** cambió (no spam por fingerprint idéntico).
- En `processAutomation.coolingDecisionLog`: últimas ~100 decisiones de set/defrost (JSON en detalle técnico).

### Resumen del modelo actual

Cooling = **consigna fija con offset** respecto al objetivo, solo mirando retorno.  
La flota muestra el **objetivo programado**, no el set enviado a máquina.

---

## 2. Qué pide `logica_enfriamiento.md` (deseado)

Objetivo: **bajar el set dinámicamente** para llegar al objetivo de producto lo antes posible, protegiendo evaporador (defrost) y evitando spam de comandos.

### Sensores

1. **Primero** `evaporation_coil` (ramas &lt; −5.9 / −9.9 / −14.9 / &gt; −4).
2. **Temperatura interna:** promedio de `cargo_1..4_temp` válidos (−20…40 °C), 1 decimal; si ninguno → `return_air`.
3. También se monitorean `set_point`, `temp_supply_1`, `return_air`.

### Último cambio de set

```http
GET http://161.132.53.51:9050/TermoKing/ultimo_control/{imei}
```

- `dato` = último set enviado.
- `fecha_ejecucion` (o `fecha_creacion`) = timing.
- Cooldowns: **5 min** / **10 min** según rama; defrost también con ≥ 5 min.

### Ramas (esquema)

```text
evaporation_coil < -5.9
  → set ≠ objetivo → set = objetivo (si último cambio ≥ 5 min)
  → si no → set = return_air (≥ 5 min)

evaporation_coil < -9.9
  → set ≠ objetivo → set = return_air
  → si set = objetivo y set > return_air → DEFROST (tipo 8)
  → si no → set = return_air

evaporation_coil < -14.9
  → si defrost hace ≥ 5 min → reenviar DEFROST

evaporation_coil > -4
  → set > objetivo → set = objetivo
  → set = objetivo → set = objetivo − 1
  → set < objetivo → si último cambio ≥ 10 min → set = set − 1
```

Complemento: si promedio interno está **&gt; objetivo + 5 °C**, forzar set hacia objetivo; tras ~30 min en objetivo, guardar promedio en trazabilidad y seguir comparando.

### Comandos nuevos / reforzados

| Acción | Link |
|--------|------|
| Temperatura | `…/comando_control/{imei}?tipo=1&dato={°C}` (o tunel) |
| Defrost | `…?tipo=8&dato=1` |

### Anti-spam

- Si la telemetría **no cambió** respecto al último análisis (~1 min) → **no** decidir de nuevo.
- Siempre consultar `ultimo_control` antes de otro set o defrost.

---

## 3. Diferencias clave (actual vs deseado)

| Tema | Actual | Deseado |
|------|--------|---------|
| Estrategia de set | Offset fijo −2 / −3 | Dinámico por evaporador + cargo + tiempos |
| Sensor principal | `return_air` | `evaporation_coil` |
| Cargo 1–4 | No usados | Promedio interno (fallback retorno) |
| Defrost tipo 8 | No | Sí, con umbrales de coil |
| Fuente del “último set” | Local (`nextActionAt`) | API `ultimo_control` (:9050) |
| Cadencia | 2–10 min fijos | Al cambiar telemetría + cooldowns 5/10 min |
| Trazabilidad | check/send + offset | Decisiones + promedios + defrost + 30 min |
| Objetivo ≥ 0 | UI 0–20 | Explícito en lógica |

**Conclusión:** no es un ajuste del −2/−3; es **reemplazar / extender** el camino `tickCooling` → `ensureTemperature` → `resolveCommandTempC`.

---

## 4. Cambios que se realizarán

### 4.1 Núcleo de decisión (servidor)

Sustituir (o envolver) la regla `coolingCommandTempC` por un evaluador estructurado, p. ej. `evaluateCoolingDecision(telemetry, objetivo, ultimoControl, lastDefrostAt)` en algo como:

- `server/src/coolingControlLogic.js` (nuevo), llamado desde `tickCooling` / `ensureTemperature` solo cuando `processType === 'Cooling'`.

Pasos del tick Cooling nuevo:

1. Leer telemetría: `set_point`, `temp_supply_1`, `return_air`, `cargo_*`, `evaporation_coil`.
2. Calcular **promedio interno** (cargos válidos −20…40; si vacío → `return_air`).
3. Si snapshot de sensores = último analizado → **skip** (sin comando).
4. `GET ultimo_control/{imei}` → último set + timestamp.
5. Evaluar ramas de `evaporation_coil` (+ regla cargo &gt; objetivo + 5).
6. Si hay acción y cumple cooldown → enviar tipo 1 o tipo 8.
7. Registrar decisión en trazabilidad; actualizar “último análisis”.

### 4.2 Cliente HTTP nuevo

- Cliente `ultimo_control` (base distinta **:9050**, no solo :9051).
- Extender adaptador de comandos con **tipo 8** (TermoKing + Tunel), hoy ausente en Cooling.

### 4.3 Constantes / estado en automatismo

Guardar en `params` / estado de automatización:

- `lastCoolingTelemetryFingerprint` (o hash de campos).
- `lastCoolingDecisionAt`, `lastDefrostAt`.
- Snapshots de promedio interno (p. ej. al alcanzar objetivo y a +30 min).
- Mantener `objetivo` (= `setPoint` programado) separado del set de máquina.

### 4.4 Front / flota

- Seguir mostrando **objetivo programado** en tarjetas (no el set agresivo de máquina).
- Actualizar espejo `coolingCommandTemp.ts` o deprecarlo si la decisión es 100 % servidor.
- Bitácora: `cooling_setpoint` / `cooling_defrost` / `cooling_eval` con `decisionTrace` + `summaryEs`; log `coolingDecisionLog` en automatismo.

### 4.5 Documentación / export

- Actualizar `controlLogicExport` / docs para describir ramas de evaporador (dejar de documentar solo −2/−3).
- Mantener `logica_enfriamiento.md` como especificación; este archivo como impacto.

### 4.6 Alcance de flotas

Misma lógica para equipos automatizados que ya usan Cooling (Greenyard TermoKing, UltraOrganics, Gourmet túnel), con la URL de comando que ya elige `processControlAdapter`.

---

## 5. Qué NO cambia (salvo que se pida)

- Arranque del proceso Cooling (UI / receta / sesión panel).
- Validación de params: sigue habiendo un `setPoint` = **objetivo de producto**.
- Poller global ~30 s (la decisión interna decide si actúa o no).
- Otros modos (Ripening, Homogenization, Manual) — solo Cooling.

---

## 6. Riesgos y consideraciones

1. **Base :9050** para `ultimo_control` vs comandos en :9051 — configurar env (`TERMOKING_ULTIMO_CONTROL_BASE` o similar) y CORS/proxy si el front no debe llamarlo (solo servidor).
2. **Defrost agresivo** mal calibrado puede ciclar — respetar ≥ 5 min y loguear.
3. **Set &lt; objetivo** (objetivo−1, set−1) baja potencia de cámara: validar límites (p. ej. no bajar de un mínimo seguro).
4. Compatibilidad: durante el desarrollo, flag `COOLING_DYNAMIC_LOGIC=1` para activar la nueva lógica y poder rollback al offset −2/−3.
5. Si `ultimo_control` es `null`, usar fallback local (último comando enviado por Riper) para no spamear.

---

## 7. Orden sugerido de implementación

1. Promedio cargo + lectura evaporador + fingerprint telemetría (sin enviar aún).
2. Cliente `ultimo_control` + cooldowns.
3. Ramas de decisión → tipo 1.
4. Tipo 8 defrost + trazabilidad.
5. Regla cargo &gt; objetivo+5 y snapshots 30 min.
6. Flag de activación + pruebas Greenyard/Gourmet.
7. Actualizar export/docs y retirar dependencia del offset −2/−3 en Cooling.

---

## 8. Reglas añadidas en implementación

1. **Cargo vs return_air:** si `avg(cargo*) > return_air` → el promedio usado es `return_air`.
2. **Glitch all-zero:** si `set_point`, `temp_supply_1`, `return_air` y `evaporation_coil` son **0 a la vez** → ignorar; flota y procesos usan último valor bueno por IMEI.

## 9. Estado de implementación (v1)

| Pieza | Estado |
|-------|--------|
| `telemetrySanity.js` / `telemetrySanity.ts` (glitch + hold + cargo avg) | Hecho |
| `ultimoControlClient.js` | Hecho |
| `coolingControlLogic.js` (ramas evaporador + cargo+5) | Hecho |
| `tickCooling` dinámico + tipo 8 defrost | Hecho |
| Flota: hold en `mapMaduradorRowToDevice` | Hecho |
| Flag `COOLING_DYNAMIC_LOGIC=0` → legacy −2/−3 | Hecho |
| Tests automáticos | Pendiente |
| Ajuste fino umbrales en campo | Pendiente |

## 10. Archivos involucrados

| Archivo | Rol hoy |
|---------|---------|
| `server/src/gourmetProcessControl.js` | `coolingCommandTempC`, `tickCooling`, `ensureTemperature` |
| `src/app/lib/coolingCommandTemp.ts` | Espejo offset −2/−3 |
| `server/src/processControlAdapter.js` | TermoKing vs Tunel |
| `server/src/termokingControlClient.js` / `tunelControlClient.js` | Envío tipo 1 |
| `server/src/ripeningTrackingControl.js` | Cooling desde receta |
| `logica_enfriamiento.md` | Especificación deseada |

Archivos previstos al implementar: `coolingControlLogic.js`, cliente `ultimo_control`, extensión tipo 8, cambios en `tickCooling`.
