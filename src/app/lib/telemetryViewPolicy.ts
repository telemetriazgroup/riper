import { isUnfilteredEthyleneViewer } from '@/app/lib/ethyleneDisplayPolicy';

export type TelemetryViewOptions = {
  /** Superadmin: simular vista del cliente (filtros de etileno y humedad). */
  viewAsClient?: boolean;
};

/** Superadmin sin toggle: telemetría cruda. Resto de cuentas o toggle activo: filtros de cliente. */
export function showsUnfilteredTelemetry(opts?: TelemetryViewOptions): boolean {
  if (opts?.viewAsClient) return false;
  return isUnfilteredEthyleneViewer();
}

export function useClientTelemetryFilters(opts?: TelemetryViewOptions): boolean {
  return !showsUnfilteredTelemetry(opts);
}
