# Estrategia — etileno mostrado al cliente (sin proceso)

Análisis de `datos_gas_eileno_2.json` + gráfica 12 h (~05:57–17:33) donde **aún se ven picos ~100 ppm** sobre un baseline ~20 ppm.

Referencias previas: `gases_lectura.md`, `gas_cliente.md`, implementación actual en `ethyleneIdleAnomalySanitize.ts` (v2).

---

## Qué muestra la gráfica (cliente)

| Tramo | Comportamiento | Interpretación |
|-------|----------------|----------------|
| ~06:00–07:30 | Sierra / alto ~100 ppm | Regulación o residual de proceso — **mantener** si hay set/proceso |
| ~07:30–09:30 | Bajada suave 100 → ~20 | Tendencia real — **no filtrar** |
| ~09:30–17:30 | Baseline ~18–22 ppm | Idle real |
| ~13:15, ~16:15, ~16:55–17:30 | Palos verticales a ~95–100 ppm y vuelta a ~20 | Anomalías — **el cliente no debería verlos** |

Firma del fallo visual:

```
ambient (~20)  →  meseta fantasma (~95–100)  →  ambient (~20)
```

No es una inyección real: sube y baja en bloque, sin curva de acumulación.

---

## Datos del archivo (`datos_gas_eileno_2.json`)

- ~662 lecturas válidas de `campo_1` (etileno), 2026-07-17 **04:38–17:35 UTC**.
- Muestreo típico ≈ **80–85 s**.
- Tras aplicar el filtro **v2 actual** (isla ≤ 5 puntos + mediana K=5 + pending end):
  - Se ocultan muchos picos cortos (~180 puntos).
  - **Siguen escapando** mesetas flanqueadas por ambient, entre ellas:

| Hora (UTC) | Lecturas en isla | Duración reloj | Max ppm | ¿Por qué v2 falla? |
|------------|------------------|----------------|---------|---------------------|
| **13:12–13:16** | **15** | ~4.1 min | 94.8 | `n=15 > MAX_ISLAND=5` |
| 16:18–16:23 | 6 | ~5.4 min | 97.8 | `n=6 > 5` |
| 17:11–17:16 | 6 | ~5.4 min | 98.4 | `n=6 > 5` |
| 16:25–16:26, 17:19… | 1–3 | corto | ~98 | En simulación pura a veces quedan vecinos rotos tras islas largas; en UI también pueden verse si el filtro no corre |

### Causa raíz del pico grande (~13:15)

Zoom real del JSON:

```
13:11:16  17.9     ← ambient
13:12:37  94.8
13:13:59  94.8
13:15:25  94.8     ← empieza ráfaga
13:15:25  94.8     ← duplicados / Δt de pocos segundos
13:15:33 … 13:16:17  muchos 94.8 seguidos
13:16:41  94.6
13:18:03  17.9     ← vuelve al ambient
```

En **~4 minutos de reloj** el sensor (o el pipeline) mete **15 muestras** casi iguales (~94.8), varias con Δt de **0–10 s** (duplicados / ráfaga).

El filtro v2 cuenta **puntos**, no **tiempo**:

```
MAX_ISLAND = 5  →  isla de 15 puntos se considera “meseta larga” y NO se oculta
```

Pero en reloj es un spike corto (sube y baja en < 6 min). En la gráfica se ve como el “rectángulo” a 100 ppm cerca de las 13:15.

**Conclusión:** no es que la firma sea distinta; es que **el criterio por conteo se rompe con ráfagas densas**. Subir `MAX_ISLAND` a 15 a ciegas es peligroso (podría comer mesetas reales). Hay que mirar **duración temporal** y/o **deduplicar**.

### Otras causas posibles en runtime (además del algoritmo)

1. **App sin rebuild** — el cliente sigue con JS viejo.
2. **`eligible=false`** — seguimiento/panel “activo” sin set real → v2 **no se aplica** y se ven todos los picos.
3. **Vista superadmin** — ve crudo a propósito.
4. Tras una isla larga no filtrada, islas cortas vecinas pueden quedar visualmente unidas en un solo “palo”.

---

## Qué NO debemos filtrar

- Descenso largo de la mañana (decenas–cientos de minutos por encima de 40–100 ppm **sin** volver de golpe al ambient de 20).
- Diente de sierra con **proceso/set activo** (ya hay modulador por setpoint).
- Subidas sostenidas reales (> ~12–15 min sin recuperación al baseline idle).

---

## Estrategias recomendadas (v3)

Orden por impacto / riesgo bajo.

### E1 — Isla por **duración** (prioridad alta)

Cambiar (o complementar) `MAX_ISLAND` (conteo) por:

```
MAX_ISLAND_DURATION_MIN ≈ 12
```

Regla: ocultar si

1. salto ≥ `ABS_JUMP` sobre baseline (mediana K),
2. la isla elevada dura **≤ 12 min** de reloj,
3. el siguiente punto válido vuelve cerca del baseline (`RETURN_TOL`).

Simulación sobre `datos_gas_eileno_2.json`:

- Con duración ≤ 12 min + recuperación → **0 islas fantasma** escapadas en la tarde.
- Se **conservan** los puntos altos de la mañana (tendencia real, ~79 puntos >80 ppm antes de las 08:00).

Esto atrapa el caso 13:12–13:16 (4 min, 15 samples) sin necesitar `MAX_ISLAND=15`.

### E2 — Deduplicar / colapsar ráfagas antes del detector

Antes de contar islas:

- Si dos puntos están a **&lt; 20–30 s** y el valor es casi igual (|Δ| &lt; 1 ppm) → tratar como **una** muestra (quedarse con la última o la mediana del burst).

Efecto en 13:15: 15 samples → ~3–4 samples lógicos → incluso v2 con `MAX_ISLAND=5` bastaría.

### E3 — Detector de flancos (simétrico)

Independiente del largo de la isla:

```
si mediana(izq en ventana W) ≈ ambient
y mediana(der en ventana W) ≈ ambient
y max(centro) ≥ ambient + ABS_JUMP
y duración del centro ≤ MAX_ISLAND_DURATION_MIN
→ null en el centro
```

Más robusto si faltan puntos o hay `null` intercalados.

### E4 — Tope de tasa (ppm/min) en idle

```
si (v - base) / Δt_min ≥ 40 ppm/min  y luego recupera
→ anomalía
```

Un ambient→95 en un intervalo de ~1 min no es física creíble sin inyección/proceso.

### E5 — Asegurar idle real (`eligible`)

Si no hay set de etileno en seguimiento ni sesión Ripening/Manual:

- forzar `eligible=true` aunque el row diga `status=active`,
- no alargar ventanas fantasma hasta `Date.now()`.

Sin esto, E1–E4 no corren y la gráfica cliente sigue igual de mala.

### E6 — Red de seguridad en la serie de la gráfica

Reaplicar el mismo sanitizado idle al construir `buildLast12hChartData` (vista cliente), por si el historial crudo se reusa en otro camino.

### E7 — No tocar tramos con proceso

Todo lo anterior **solo** sin target de proceso en ese timestamp. El sierra 06:00–07:30 con proceso activo sigue a cargo del modulador por set.

---

## Pipeline propuesto (cliente, sin proceso)

```
crudo
  → idle 150 / 150.1
  → (E2) colapsar ráfagas Δt corta
  → (E1) sanitize por duración + baseline mediana + recuperación
  → (E3 opcional) flancos
  → smooth / chart sanitize
  → Recharts (null = hueco, connectNulls)
```

Superadmin: bypass total.

---

## Constantes candidatas v3

| Constante | v2 hoy | v3 propuesta | Rol |
|-----------|--------|--------------|-----|
| `MAX_ISLAND` (conteo) | 5 | 5 (tope secundario) o deprecar | Evita islas enormes sin tiempo |
| `MAX_ISLAND_DURATION_MIN` | — | **12** | Criterio principal |
| `ABS_JUMP_PPM` | 25 | 25 | Salto vs baseline |
| `BASELINE_WINDOW_K` | 5 | 5 | Mediana local |
| `RETURN_TOL_PPM` | 20 | 20 | Recuperación |
| `BURST_MERGE_MAX_SEC` | — | **25** | E2 dedupe |
| `PENDING_END_JUMP_PPM` | 50 | 50 | Pico al final de serie |

---

## Criterios de aceptación (con este JSON)

Vista cliente simulada sobre `datos_gas_eileno_2.json`, tramo idle de la tarde:

- [x] No hay palos a ~95–100 entre ~09:30 y 17:35 (simulación local v3).
- [x] El descenso de la mañana (~100 → ~20) sigue visible.
- [ ] Superadmin sigue viendo los picos crudos (validar en UI).
- [ ] Con proceso/set activo, no se aplica este filtro (validar en UI).

---

## Estado de implementación

Implementado (v3 — E1 + E2):

| Pieza | Archivo |
|-------|---------|
| `IDLE_ETHYLENE_MAX_ISLAND_DURATION_MIN = 12` | `ethyleneIdleAnomalySanitize.ts` |
| `collapseIdleEthyleneBursts` (Δt ≤ 25 s, \|Δ\| ≤ 1 ppm) | idem |
| `timestampsMs` desde historial | `applyEthyleneDisplayPolicyToHistory` |
| Isla salta `null` internos (ráfagas colapsadas) | detector |

Pendiente si aún escapan: **E5** (eligible/proceso fantasma), E3, E6.

Relación con `gases_lectura.md`: allí están v1/v2 (conteo). Este documento fija la **causa del escape en datos densos** y la estrategia v3 centrada en **tiempo de reloj + dedupe**.
