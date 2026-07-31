import type { Device } from '@/app/data';
import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { inferCurrentNextPhase, mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';

/** Equipo en fase de enfriamiento: telemetría o sesión activa de panel tipo Cooling. */
export function isFleetDeviceInCoolingProcess(
  device: Device,
  panelActiveSession?: DeviceControlSessionRow | null
): boolean {
  if (device.telemetry?.stateProcess === 'Cooling') return true;
  if (panelActiveSession?.status === 'active' && panelActiveSession.process_type === 'Cooling') return true;
  return false;
}

/**
 * Temperatura final programada del enfriamiento (°C), si se puede inferir:
 * parámetros del panel, o fase `cooling` de la receta en seguimiento.
 */
export function getFleetCoolingFinalTempCelsius(
  device: Device,
  panelActiveSession: DeviceControlSessionRow | null | undefined,
  trackingProcess: RipeningProcessRow | null | undefined,
  trackingProgressPct: number | null | undefined
): number | null {
  if (panelActiveSession?.status === 'active' && panelActiveSession.process_type === 'Cooling') {
    const sp = panelActiveSession.params?.setPoint;
    if (typeof sp === 'number' && Number.isFinite(sp)) return sp;
  }
  if (trackingProcess?.payload) {
    let pct = trackingProgressPct;
    if (pct == null || !Number.isFinite(pct)) {
      const v = mapRowToProcessView(trackingProcess);
      pct = typeof v.progress === 'number' ? v.progress : 0;
    }
    const safePct = Math.min(100, Math.max(0, pct));
    const info = inferCurrentNextPhase(trackingProcess.payload, safePct);
    const raw = info.phasesMeta[info.currentIndex]?.raw as { type?: string; temp?: number } | undefined;
    if (raw?.type === 'cooling' && typeof raw.temp === 'number' && Number.isFinite(raw.temp)) return raw.temp;

    const phases = (
      trackingProcess.payload.recipe as { phases?: { type?: string; temp?: number; enabled?: boolean }[] } | undefined
    )?.phases;
    if (Array.isArray(phases) && device.telemetry?.stateProcess === 'Cooling') {
      const c = phases.find((p) => p && p.enabled !== false && p.type === 'cooling');
      if (c && typeof c.temp === 'number' && Number.isFinite(c.temp)) return c.temp;
    }
  }
  return null;
}

/** Temperatura principal (actual) y consigna mostrada en tarjeta / exportación de flota. */
export function getFleetCardTemperatureDisplay(
  device: Device,
  panelActiveSession: DeviceControlSessionRow | null | undefined,
  trackingProcess: RipeningProcessRow | null | undefined,
  trackingProgressPct: number | null | undefined
): { primaryC: number; setpointC: number; inCooling: boolean } {
  const inCooling = isFleetDeviceInCoolingProcess(device, panelActiveSession);
  const finalC = getFleetCoolingFinalTempCelsius(
    device,
    panelActiveSession,
    trackingProcess,
    trackingProgressPct
  );
  const rawPrimary = device.telemetry.return_air;
  const primaryC =
    rawPrimary != null && Number.isFinite(Number(rawPrimary)) ? Number(rawPrimary) : Number.NaN;
  /** En enfriamiento la flota muestra el objetivo programado (ej. 4 °C), no la consigna enviada (ej. 2 °C). */
  const setpointC =
    inCooling && finalC != null && Number.isFinite(finalC) ? finalC : device.telemetry.set_point;
  return { primaryC, setpointC, inCooling };
}
