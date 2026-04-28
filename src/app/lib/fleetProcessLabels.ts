import { isManualProcesoLabel } from '@/app/lib/madurador';
import type { ControlProcessType } from '@/app/lib/deviceControlProcessApi';

type T = (k: string) => string;

/** Etiqueta legible en flota (ES/EN) a partir de `proceso` API Madurador. */
export function getFleetProcesoMaduradorLabel(procesoApi: string | null | undefined, t: T): string {
  const raw = String(procesoApi ?? '').trim();
  if (!raw) return t('process_unknown');
  if (isManualProcesoLabel(raw)) return t('process_manual_name');

  const p = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (p.includes('homogen') || p.includes('homog')) return t('homogenization');
  if (p.includes('ventil') || p.includes('ventilacion')) return t('ventilation');
  if (p.includes('madur') || p.includes('ripen') || p.includes('maturation')) return t('ripening');
  if (p.includes('enfri') || p.includes('cool') || p.includes('refrig') || p.includes('frio')) return t('cooling');
  if (p.includes('integral') || p.includes('automatic')) return t('process_integral');
  return raw;
}

export function getControlProcessTypeLabel(processType: string | null | undefined, t: T): string {
  const p = String(processType ?? '').trim() as ControlProcessType | '';
  switch (p) {
    case 'Homogenization':
      return t('homogenization');
    case 'Ripening':
      return t('ripening');
    case 'Ventilation':
      return t('ventilation');
    case 'Cooling':
      return t('cooling');
    case 'StopPlan':
      return t('stop_plan_process_short');
    default:
      return p || t('process');
  }
}

/** Título de proceso en tarjeta: prioriza `displayLabel`, si no el tipo. */
export function getPanelControlProcessTitle(
  processType: string,
  displayLabel: string,
  t: T
): string {
  const d = String(displayLabel ?? '').trim();
  if (d) return d;
  return getControlProcessTypeLabel(processType, t);
}

