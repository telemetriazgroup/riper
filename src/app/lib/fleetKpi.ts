import type { Device } from '@/app/data';
import { isManualProcesoLabel } from '@/app/lib/madurador';

/** Suma de `numero_alarma` por dispositivo (API Madurador / telemetría). */
export function totalNumeroAlarmaFleet(devices: Device[]): number {
  return devices.reduce((acc, d) => acc + (d.numeroAlarmaTotal ?? 0), 0);
}

/**
 * Equipos con proceso en curso. **Manual** no cuenta.
 * Criterio: hay ventana fecha_inicio/hasta en `process` y no es Manual, o `stateProcess` distinto de None sin etiqueta Manual.
 */
export function countProcesosEnCurso(devices: Device[]): number {
  return devices.filter((d) => {
    const label = d.procesoApi ?? d.process?.name ?? '';
    if (isManualProcesoLabel(label)) return false;
    if (d.process?.startTime) return true;
    const st = d.telemetry?.stateProcess;
    if (st && st !== 'None') return true;
    return false;
  }).length;
}
