# Etileno mostrado al cliente (conversión de lectura)

En Riper, la **lectura cruda del sensor** (ppm) **no se muestra tal cual** al cliente en flota, gráficas ni bitácora cuando hay un **objetivo de etileno programado**.

Solo **superadmin** ve el valor crudo.

Implementación: `src/app/lib/gourmetEthyleneDisplay.ts` → `modulateGourmetEthyleneDisplayPpm`.

---

## Constantes dinámicas (setpoint `T`)

| Concepto | Fórmula | T = 100 | T = 120 |
|----------|---------|---------|---------|
| Tope suave (21 %) | T × **1.21** | 121 ppm | 145.2 ppm |
| Umbral crudo alto | T × **4** | 400 ppm | 480 ppm |
| Meseta alta (cliente) | T × **4** | 400 ppm | 480 ppm |

---

## Reglas

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
- **Bitácora** (columna Etileno)

Todo pasa por la misma función `modulateGourmetEthyleneDisplayPpm`.
