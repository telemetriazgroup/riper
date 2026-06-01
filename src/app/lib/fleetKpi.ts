import type { Device } from '@/app/data';
import { isManualProcesoLabel } from '@/app/lib/madurador';

/** Mínimo de mensajes/alertas para marcar equipo en rojo en Estado de Flota. */
export const FLEET_ALARM_RED_MIN_COUNT = 2;

/** Cuenta alertas del dispositivo (máximo entre activas API y numero_alarma). */
export function deviceAlertCount(device: Pick<Device, 'numeroAlarmaTotal'>): number {
  return Math.max(0, Math.round(device.numeroAlarmaTotal ?? 0));
}

/** true si el equipo debe mostrarse como alarma crítica (borde rojo) en la flota. */
export function qualifiesForFleetAlarmHighlight(
  device: Pick<Device, 'status' | 'numeroAlarmaTotal'>
): boolean {
  return deviceAlertCount(device) >= FLEET_ALARM_RED_MIN_COUNT;
}

/** Suma de `numero_alarma` por dispositivo (API Madurador / telemetría). */
export function totalNumeroAlarmaFleet(devices: Device[]): number {
  return devices.reduce((acc, d) => acc + deviceAlertCount(d), 0);
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
