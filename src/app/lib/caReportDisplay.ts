import { isPruebaCaMonitoringDevice } from '@/app/lib/pruebaCaMonitoringOverrides';

export const CA_REPORT_PRUEBA_TRACKING_NAME = 'PRUEBA THERMOKING CA';

/** Código de equipo visible en informes CA (sin prefijo interno de prueba). */
export function formatCaReportDeviceCode(deviceId: string | null | undefined): string {
  const id = String(deviceId || '').trim();
  if (!id) return '—';
  if (isPruebaCaMonitoringDevice(id)) return 'CA000001';
  return id;
}

type TrackingView = {
  display_name?: string | null;
  batch?: { origin?: string; product?: string };
};

/** Nombre legible del seguimiento para el informe (no usar ID interno). */
export function formatCaReportTrackingName(view: TrackingView, deviceId: string | null | undefined): string {
  if (isPruebaCaMonitoringDevice(deviceId)) {
    return CA_REPORT_PRUEBA_TRACKING_NAME;
  }
  const displayName = String(view.display_name || '').trim();
  if (displayName) return displayName;
  const origin = String(view.batch?.origin || '').trim();
  if (origin && origin !== '—') return origin;
  const product = String(view.batch?.product || '').trim();
  if (product && product !== '—') return product;
  return '—';
}
