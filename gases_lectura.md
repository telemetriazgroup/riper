# Lecturas de etileno sin proceso — anomalías esporádicas

Documento de diseño a partir de `etileno_observacion.json` (≈3 h de `campo_1`, 2026-07-17 06:24–09:14 UTC).

---

## Hallazgo en la secuencia real

Hay **dos comportamientos distintos** en la misma ventana:

### 1) Tendencia real (válida)

Descenso suave y continuo:

- ~111 ppm → ~35 ppm (06:24–07:47)
- luego ~34 → ~18 ppm (07:47–09:12)

Eso es una curva creíble: el sensor baja de forma gradual. **No se filtra.**

### 2) Anomalías esporádicas (incorrectas para el cliente)

Picos que **salen del nivel local y vuelven en 1–3 lecturas** (~1–3 min). El usuario ve un “pico y caída” que arruina la gráfica.

| Hora (UTC) | Patrón | Lecturas | Contexto |
|------------|--------|----------|----------|
| 07:19 | 51.8 → **306.8** → 49.8 | 1 punto | Spike ~300 sobre tendencia ~50 |
| 07:23–07:24 | 48.3 → **303.7, 303.1** → 46.1 | 2 puntos | Idem |
| 07:29 | 45.0 → **300.3** → 43.7 | 1 punto | Idem |
| 07:31 | 43.7 → **298.6** → 42.0 | 1 punto | Idem |
| 07:38 | 39.9 → **295.1** → 38.4 | 1 punto | Idem |
| 08:34–08:37 | 26.3 → **102.3…101.4** → 24.4 | 3 puntos | Spike ~100 sobre ambient ~25 |
| 08:38–08:40 | 24.4 → **100.8, 100.3** → 23.3 | 2 puntos | Idem |
| 08:44 | 22.7 → **99.0** → 22.3 | 1 punto | Idem |
| 08:53 | 20.5 → **97.0** → 20.0 | 1 punto | Idem |
| 08:57 | 19.9 → **96.5** → 19.6 | 1 punto | Idem |
| 09:04 | 18.8 → **95.7** → 18.5 | 1 punto | Idem |
| 09:13–09:14 | 17.9 → **94.6, 94.5** | 2 puntos | Fin de serie (sin confirmación de bajada aún) |

Firma común:

```
nivel estable A  →  salto brusco a B (Δ grande)  →  en ≤ N lecturas vuelve a ≈ A
```

No es una inyección real ni un proceso: el sensor se recupera solo. Con proceso activo ya existe el regulador de display (`modulateGourmetEthyleneDisplayPpm` + set). **Este filtro solo aplica cuando no hay proceso vigente en ese timestamp.**

---

## Alcance

| Quién | Comportamiento |
|-------|----------------|
| **Cliente / vista cliente** | No mostrar puntos anómalos (hueco / `null` en la serie; la línea no dibuja el pico). |
| **Superadmin (crudo)** | Serie completa, sin este filtro. |
| **Con proceso activo en esa hora** | No aplicar este detector; sigue la política de set/modulación. |
| **Sin proceso en esa hora** | Aplicar detector de anomalías **después** de la regla idle (real ≤150 / tope 150.1). |

Orden de pipeline (cliente, sin proceso):

1. Lectura cruda del punto.
2. Regla idle: R ≤ 150 → R; R > 150 → 150.1 (puede convertir un 300 en 150.1; el detector de spike sigue siendo necesario porque 150.1 o 95 también “pican” la gráfica).
3. **Nuevo:** `sanitizeIdleEthyleneAnomalies` sobre la serie temporal del tramo sin proceso.
4. Suavizado / saneamiento de gráfica existente.

---

## Qué se implementará

### Función nueva

`sanitizeIdleEthyleneAnomalies(values, timestamps?)` en algo como `src/app/lib/ethyleneIdleAnomalySanitize.ts` (o junto a `ethyleneHistoryPolicy.ts`).

Entrada: serie ordenada por tiempo (`number | null`).  
Salida: misma longitud; puntos anómalos → `null` (no se inventa valor; no se interpola al cliente).

Integración:

- Solo en tramos / puntos donde `resolveEthyleneTargetAtMs(...) == null` (sin ventana de proceso).
- Llamada desde `applyEthyleneDisplayPolicyToHistory` (12 h e histórico).
- Superadmin / `showsUnfilteredTelemetry` → bypass total.

### Criterio de detección (isla de spike con recuperación)

Un tramo contiguo `i … j-1` se marca anómalo si se cumplen **todas**:

1. **Salto de subida** respecto al punto anterior válido `base`:
   - `values[i] - base ≥ ABS_JUMP_PPM` (propuesto: **25 ppm**).
2. **Isla corta**: longitud `n = j - i` con `1 ≤ n ≤ MAX_ISLAND` (propuesto: **3** lecturas; ~3–5 min con muestreo ~1–1.5 min).
3. **Recuperación**: el primer punto después de la isla (`values[j]`) vuelve cerca del nivel previo:
   - `|values[j] - base| ≤ RETURN_TOL_PPM` (propuesto: **20 ppm**),
   - o bien caída brusca desde el pico hacia el baseline (`values[j] ≤ base + RETURN_TOL` y `values[i] - values[j] ≥ ABS_JUMP`).
4. Mientras dura la isla, los puntos siguen **elevados** respecto a `base` (p. ej. `≥ base + ABS_JUMP * 0.6`), para no cortar un ascenso real lento.

Efecto en la muestra observada (simulación con esos umbrales):

- Elimina los 11 spikes documentados (15 puntos).
- **Conserva** el descenso largo 111 → 35 ppm (tendencia real).
- El tramo final 09:13–09:14 (94.6 / 94.5) **no se elimina** hasta que llegue una lectura de recuperación → ver consideraciones.

### Constantes propuestas (ajustables)

| Constante | Valor inicial | Motivo |
|-----------|---------------|--------|
| `ABS_JUMP_PPM` | 25 | Cubre saltos ~76 (ambient→~100) y ~255 (→~300); no corta ruido de ±5 en ambient. |
| `MAX_ISLAND` | 3 | En el JSON los picos malos son 1–3 puntos; una meseta real dura mucho más. |
| `RETURN_TOL_PPM` | 20 | La tendencia baja ~0.5–2 ppm entre muestras; al volver, queda cerca del `base`. |
| `ISLAND_HOLD_RATIO` | 0.6 | Exige que la isla se mantenga claramente por encima del baseline. |

No usar un umbral fijo tipo “todo > 40 es malo”: en el mismo archivo hay ~80 min por encima de 40 ppm que son tendencia real.

---

## Consideraciones

1. **Solo sin proceso**  
   Con proceso, el set y la modulación ya regulan lo que ve el cliente. Filtrar spikes ahí podría ocultar inyecciones reales o mesetas del proceso.

2. **No interpolar al cliente**  
   Sustituir el pico por el promedio “inventa” datos. Mejor `null` + `connectNulls` en la gráfica: la línea salta el hueco y la tendencia se lee limpia.

3. **Confirmación por recuperación (causalidad)**  
   Un pico solo se oculta cuando ya se vio la bajada. Si la serie termina en medio del spike (caso 09:13–09:14), opciones:
   - **A (recomendada):** dejar visible hasta la siguiente lectura; al refrescar, si recuperó, ocultar el tramo.
   - **B:** ocultar provisionalmente si el salto desde `base` es enorme (≥ 50) y aún no hay siguiente punto (más agresivo; puede ocultar un inicio real de gas).

4. **Idle 150 / 150.1 vs detector**  
   Un 306 sin proceso ya se caparía a 150.1; aun así el cliente vería 26 → 150.1 → 24. El detector de islas ataca la forma “sube y baja”, no solo el tope absoluto.

5. **No confundir con descenso lento**  
   111 → 35 en ~80 min nunca cumple “isla corta + recuperación al base anterior”. El algoritmo mira saltos locales, no el valor absoluto.

6. **Flota (último valor)**  
   Opcional en una segunda fase: si el último crudo es un spike aislado respecto a las N lecturas previas, mostrar el último valor “estable” al cliente. Fuera del alcance mínimo de gráficas 12 h / histórico.

7. **Bitácora**  
   Misma política por timestamp si se muestra etileno al cliente; superadmin crudo.

8. **Datos crudos**  
   API y DB no se alteran. Solo capa de display cliente.

---

## Pseudo-código

```
function sanitizeIdleEthyleneAnomalies(values):
  out = copy(values)
  i = 1
  while i < len(values):
    if values[i] is null or values[i-1] is null:
      i += 1; continue
    base = values[i-1]
    if values[i] - base < ABS_JUMP:
      i += 1; continue
    j = i
    while j < len(values) and values[j] != null and values[j] >= base + ABS_JUMP * 0.6:
      j += 1
    n = j - i
    if n < 1 or n > MAX_ISLAND:
      i = j; continue
    if j >= len(values):           # sin recuperación aún
      break                        # opción A: no marcar
    if abs(values[j] - base) <= RETURN_TOL:
      for k in i .. j-1:
        out[k] = null              # ocultar al cliente
    i = j
  return out
```

---

## Criterios de aceptación

- Con la serie de `etileno_observacion.json` (simulada sin proceso): el cliente **no** ve los picos ~95–102 ni ~295–307; sí ve el descenso continuo.
- Superadmin ve todos los puntos.
- Con ventana de proceso activa en esas horas: este filtro **no** corre; aplica set/modulación.
- Una subida real sostenida (> 3 lecturas sin volver al baseline) **sigue visible** (tras idle 150/150.1 si aplica).

---

## Archivos previstos (implementación siguiente)

| Archivo | Cambio |
|---------|--------|
| `src/app/lib/ethyleneIdleAnomalySanitize.ts` | Detector de islas (nuevo) |
| `src/app/lib/ethyleneDisplayPolicy.ts` | Aplicar solo en puntos sin target de proceso |
| `gas_cliente.md` | Enlace a este documento |
| Tests unitarios opcionales | Casos: spike 1/2/3 pts, tendencia lenta, fin de serie |

## Estado de implementación

Implementado (v1):

- `src/app/lib/ethyleneIdleAnomalySanitize.ts` → `sanitizeIdleEthyleneAnomalies`
- Cableado en `applyEthyleneDisplayPolicyToHistory` (`ethyleneDisplayPolicy.ts`), solo índices sin proceso (`eligible`)
- Superadmin / vista sin filtrar: bypass (no entra a esta política)

Implementado (v2 — R1 + R2 + R5):

| Refuerzo | Cambio |
|----------|--------|
| **R1** | `IDLE_ETHYLENE_MAX_ISLAND = 5` |
| **R2** | Baseline = mediana de últimos `K=5` valores válidos (`resolveIdleBaselineMedian`) |
| **R5** | Si el tramo termina en salto ≥ `PENDING_END_JUMP_PPM` (50) sin recuperación → ocultar isla pendiente |

Pendiente si aún escapan: R3, R4, R6, R7.

---

## Observación post-despliegue (gráfica 12 h)

Captura de cliente (~00:48–12:27):

| Tramo | Aspecto | ¿Filtrar? |
|-------|---------|-----------|
| ~02:00–06:30 | Diente de sierra ~90–105 ppm | **No** — típico de regulación con proceso/set activo |
| ~06:30–09:30 | Bajada suave ~100 → ~20 ppm | **No** — tendencia real |
| ~09:30–12:27 | Baseline ~20 ppm + **2 picos verticales a ~100 ppm** (~11:17–12:00) | **Sí** — misma firma esporádica (sube y vuelve) |

Esos dos picos al final son exactamente el patrón v1 (ambient → ~100 → ambient). Si aún se ven en cliente, no es que “falte inventar valores”: o el filtro no corrió en esos puntos, o hay que **endurecer** v1.

### Por qué pueden “escaparse” todavía

1. **Vista superadmin / sin rebuild** — el crudo siempre muestra picos; hace falta rebuild del `app` y entrar como cliente (o “Ver como cliente”).
2. **Ventana de proceso mal cerrada** — si el seguimiento/panel sigue “activo” en DB hasta después de las 11:xx, `eligible=false` y **v1 no toca** esos puntos (el regulador de proceso asume set; sin set real el cliente ve el crudo modulado o casi crudo).
3. **Isla > 3 lecturas** — si el sensor se queda en ~100 durante 4–5 muestras (~5–8 min) antes de bajar, `MAX_ISLAND=3` deja pasar el pico.
4. **Pico al borde del refresh** — opción A: sin lectura de recuperación aún, el pico sigue visible hasta el siguiente poll.
5. **Baseline solo = punto anterior** — si hay un null o un micro-ruido justo antes, el salto relativo puede no cumplir el umbral (caso raro).

---

## Qué más podemos hacer (refuerzos v2 — solo sin proceso)

Orden sugerido de impacto / riesgo:

### R1 — Subir `MAX_ISLAND` (3 → 5)

- Cubre picos que duran 4–5 lecturas (~5–8 min) y luego vuelven al ambient.
- Riesgo bajo: una inyección real sin proceso casi nunca es un “rectángulo” de pocos minutos que vuelve solo al mismo baseline.

### R2 — Baseline móvil (mediana de últimos K puntos estables)

En lugar de `base = punto anterior` únicamente:

```
base = mediana(últimos K valores válidos del tramo idle), K = 5
```

Un spike se compara contra el **nivel reciente estable**, no contra un solo sample ruidoso. Mejora detección cuando hay huecos/`null` intercalados.

### R3 — Detector simétrico por vecinos (Hampel / flancos bajos)

Además de la isla con recuperación:

```
si value[i] ≥ mediana(vecinos ±W) + ABS_JUMP
y ambos flancos (izq/der en ventana de tiempo, p.ej. 8 min) están cerca del ambient
→ null
```

Atrapa el “palo vertical” aunque la isla se cuente mal (puntos faltantes, timestamps irregulares).

### R4 — Tope de tasa de subida en idle (ppm / minuto)

Sin proceso, el etileno **no debería saltar** 70+ ppm en un solo intervalo (~1–2 min).

```
si (v[i] - v[prev]) / Δt_min ≥ RATE_MAX   (p.ej. 40 ppm/min)
y luego vuelve cerca del baseline en ≤ MAX_ISLAND
→ null
```

Complementa el umbral absoluto: un salto 20→100 en 1 min es anómalo aunque la isla tenga forma rara.

### R5 — Opción B suave al final de serie

Si el último tramo es un salto ≥ 50 ppm sobre la mediana idle reciente y **aún no hay recuperación**:

- ocultar provisionalmente esos puntos al cliente, **o**
- no dibujar el último punto hasta confirmar (flota / punta de la 12 h).

Evita el pico “pegado” al extremo derecho de la gráfica (muy visible). Riesgo: retrasar 1 sample un alza real; aceptable sin proceso.

### R6 — Asegurar `eligible` (proceso realmente cerrado)

Auditoría / fix de ventanas:

- Si no hay fase ripening ni sesión Ripening/Manual con set, **forzar idle** aunque el row de seguimiento siga `status=active` por error.
- No extender `endMs` a `Date.now()` de procesos “fantasma” sin set de etileno.

Sin esto, R1–R5 no corren en horas donde la UI ya “se ve” idle.

### R7 — Segunda pasada en `sanitizeEthylenePpmSeries` (gráfica)

El saneamiento de chart ya suaviza picos cortos entre vecinos. Reforzar **solo etileno en vista cliente** con la misma lógica de isla (cinturón y tirantes): aunque falle la política de historial, la serie de Recharts no dibuja el palo.

### R8 — No tocar el diente de sierra con proceso

El tramo 02:00–06:30 **no** es anomalía de sensor idle: es regulación. Cualquier refuerzo debe seguir gated por `eligible` / sin target. Suavizar eso haría mentir al cliente sobre el proceso.

---

## Plan recomendado (siguientes pasos)

1. Rebuild `app` y validar gráfica 12 h como cliente (baseline post-09:30 sin palos a 100).
2. Si aún escapan: **R3 + R4**.
3. En paralelo revisar **R6** si hay seguimientos “activos” sin set real.
4. Opcional **R7** como red de seguridad en construcción de la 12 h.

Constantes candidatas v2:

| Constante | v1 | v2 propuesta |
|-----------|----|--------------|
| `MAX_ISLAND` | 3 | **5** |
| `ABS_JUMP_PPM` | 25 | 25 (igual) |
| `RETURN_TOL_PPM` | 20 | 20 (igual) |
| `BASELINE_WINDOW_K` | 1 (prev) | **5** (mediana) |
| `PENDING_END_JUMP_PPM` | — | **50** (opción B suave) |
| `RATE_MAX_PPM_PER_MIN` | — | **40** (R4, si hace falta) |

Criterio visual de éxito en esta gráfica: baseline post-09:30 **plano ~20 ppm**, sin palos a 100 entre 11:00 y 12:30; el sierra 02:00–06:30 se mantiene si hubo proceso.
