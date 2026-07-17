# Etileno mostrado al cliente (conversión de lectura)

En Riper, la **lectura cruda del sensor** (ppm) **no se muestra tal cual** al cliente en flota, gráficas ni bitácora cuando hay un **objetivo de etileno programado** en ese instante.

Solo **superadmin** ve el valor crudo (salvo que active «Ver como cliente»).

Implementación principal: `src/app/lib/gourmetEthyleneDisplay.ts` → `modulateGourmetEthyleneDisplayPpm`.

Histórico por hora: `src/app/lib/ethyleneHistoryPolicy.ts` → ventanas de proceso + `resolveClientEthyleneDisplayAtMs`.

Sin proceso: además se ocultan picos esporádicos (sube y baja en ≤5 lecturas; baseline mediana; pico pendiente al final de serie) — ver `gases_lectura.md` y `ethyleneIdleAnomalySanitize.ts`.

---

## Constantes dinámicas (setpoint `T`)

| Concepto | Fórmula | T = 100 | T = 120 |
|----------|---------|---------|---------|
| Tope suave (21 %) | T × **1.21** | 121 ppm | 145.2 ppm |
| Umbral crudo alto | T × **4** | 400 ppm | 480 ppm |
| Meseta alta (cliente) | T × **4** | 400 ppm | 480 ppm |

---

## Reglas con proceso activo (setpoint `T`)

### A — R ≤ T → valor real

### B — T < R < T×4 → escala 21 % del exceso (tope T×1.21)

```
V = min( T + (R − T) × 0.21 ,  T × 1.21 )
```

### C — R ≥ T×4 → meseta T×4

```
V = T × 4
```

---

## Sin proceso de maduración en ese instante

Cuando **no** hay seguimiento ni panel Ripening/Manual con inyección vigente en la hora del dato:

```
Si R ≤ 150  →  V = R
Si R > 150  →  V = 150.1
```

---

## Gráficas (12 h e histórico)

Cada punto usa el **set de etileno del proceso vigente en esa hora**, no solo el proceso actual:

- Seguimientos de maduración (fase ripening de la receta).
- Sesiones de panel Ripening o Manual con inyección programada.

Ventanas temporales: `buildEthyleneProcessWindows` en `ethyleneHistoryPolicy.ts`.

El eje Y de etileno escala automáticamente (hasta 500 ppm en vista cliente) para mostrar mesetas filtradas (p. ej. 400 ppm con set 100).

---

## Ejemplo T = **100 ppm**

| Crudo (R) | Cliente (V) |
|-----------|-------------|
| 1.1 – 100 | real (1.1 … 100) |
| 150 | 110.5 |
| 200 – 399 | **121** |
| **400 – 1350** | **400** |

---

## Ejemplo T = **120 ppm**

| Crudo (R) | Cliente (V) |
|-----------|-------------|
| 120 | 120 |
| 200 | 136.8 |
| ~263 – 479 | **145.2** |
| **480+** | **480** |

---

## Dónde se aplica

- **Flota** (etileno en tarjeta de equipo)
- **Gráfica últimas 12 h**
- **Datos históricos** (modal gráfico y tabla)
- **Bitácora** (columna Etileno)
