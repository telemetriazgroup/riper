# Módulo de alarmas Thermo King MP4000

Catálogo **interno** en base de datos (`app_alarm_codes`), editable desde la app.

## Datos iniciales

Al arrancar la API, si la tabla está vacía, se importan los 53 códigos desde `server/src/data/thermoKingMp4000Alarms.json` (copia embebida en la imagen Docker del servicio `api`). El frontend mantiene una copia en `src/app/data/` como respaldo offline.

## API

| Método | Ruta | Rol |
|--------|------|-----|
| GET | `/api/v1/alarm-codes` | autenticado |
| GET | `/api/v1/alarm-codes/by-code/:code` | autenticado |
| POST | `/api/v1/alarm-codes` | admin / superadmin |
| PATCH | `/api/v1/alarm-codes/:id` | admin / superadmin |
| DELETE | `/api/v1/alarm-codes/:id` | admin / superadmin (archiva) |
| POST | `/api/v1/alarm-codes/:id/restore` | superadmin |

## UI

- **Alarmas TK** (menú): CRUD del catálogo (búsqueda, crear, editar, archivar).
- **Detalle dispositivo → Monitoreo**: solo **nombre** de la alarma + **Ver más** para descripción/acción correctiva.

## Interpretación API Madurador

- `numero_alarma` → **cantidad** de alarmas activas (no es un código).
- `alarma_01`, `alarma_02`, … → **nombres de campo**; el código está en el valor (`numero` dentro del objeto, o valor escalar).
- `ultima_alarmas` → historial con `{ alarma_0N: { numero: 203, desde, hasta } }`.

## Regenerar JSON semilla (opcional)

```bash
node scripts/scrapeThermoKingAlarms.mjs
# Reiniciar API para re-sembrar solo si la tabla está vacía
```
