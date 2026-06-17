import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import type { mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';
import { processReportRangeEndMs } from '@/app/lib/trackingIntegralReport';
import { formatCaReportTrackingName } from '@/app/lib/caReportDisplay';

export const CA_REPORT_PRUEBA_CA_RECIPE_MATCH = 'PRUEBA CA 19/05/2026';
export const CA_REPORT_PRUEBA_CA_MACHINE_SERIAL = 'CIM1086751';

const AVOCADO_RE = /\b(aguacate|palta|avocado)\b/i;

function norm(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isCaReportPruebaCaRecipe(recipeName: string | null | undefined): boolean {
  const n = norm(String(recipeName || ''));
  if (!n) return false;
  if (n === norm(CA_REPORT_PRUEBA_CA_RECIPE_MATCH)) return true;
  return n.includes('prueba ca') && (n.includes('19/05/2026') || n.includes('19-05-2026'));
}

function payloadBatch(view: ReturnType<typeof mapRowToProcessView>) {
  return (view._row as RipeningProcessRow | undefined)?.payload?.batch as
    | { product?: string; origin?: string; quantity_kg?: number | string }
    | undefined;
}

export function isCaReportAvocadoProduct(
  product: string,
  recipeFruit?: string | null,
  recipeName?: string | null
): boolean {
  const blob = `${product} ${recipeFruit ?? ''} ${recipeName ?? ''}`;
  return AVOCADO_RE.test(blob) || /\bhass\b/i.test(blob);
}

/** Variedad para palta/aguacate; por defecto HASS si no se indica otra en los datos. */
export function resolveCaReportAvocadoVariety(sources: string[]): string | null {
  const combined = sources.filter(Boolean).join(' ');
  if (!AVOCADO_RE.test(combined) && !/\bhass\b/i.test(combined)) return null;
  if (/\bfuerte\b/i.test(combined)) return 'Fuerte';
  if (/\bred\b/i.test(combined) && /\b(palta|aguacate|avocado)\b/i.test(combined)) return 'Red';
  if (/\bhass\b/i.test(combined)) return 'HASS';
  return 'HASS';
}

export function resolveProcessStartIso(view: ReturnType<typeof mapRowToProcessView>): string | null {
  const started = view.scheduleSummary?.startedAt;
  if (started) return String(started);
  const created = view._row?.created_at;
  return created ? String(created) : null;
}

export function resolveProcessEndIso(view: ReturnType<typeof mapRowToProcessView>): string | null {
  const st = String(view.status || '').toLowerCase();
  if (st === 'cancelled' && view.cancelledMeta?.at) {
    return String(view.cancelledMeta.at);
  }
  const est = view.scheduleSummary?.estimatedEndAt;
  if (est && (st === 'completed' || st === 'finalized' || st === 'finished')) {
    return String(est);
  }
  const endMs = processReportRangeEndMs(view);
  if (Number.isFinite(endMs)) return new Date(endMs).toISOString();
  if (est) return String(est);
  return null;
}

export type CaReportProcessTrackingInfo = {
  rows: string[][];
  showAvocadoVariety: boolean;
  showMachineSerial: boolean;
};

export function buildCaReportProcessTrackingInfo(
  view: ReturnType<typeof mapRowToProcessView>,
  deviceId: string,
  t: (k: string, p?: Record<string, string>) => string,
  formatDateTime: (iso: string) => string
): CaReportProcessTrackingInfo {
  const batch = payloadBatch(view);
  const product = String(view.batch?.product ?? batch?.product ?? '—').trim() || '—';
  const origin = String(view.batch?.origin ?? batch?.origin ?? '—').trim() || '—';
  const recipeName = String(view.recipe?.name ?? '—').trim() || '—';
  const recipeFruit = view.recipe?.fruit ? String(view.recipe.fruit) : '';
  const clientName = String(view.client?.name ?? '—').trim() || '—';
  const trackingName = formatCaReportTrackingName(view, deviceId);
  const startIso = resolveProcessStartIso(view);
  const endIso = resolveProcessEndIso(view);
  const isAvocado = isCaReportAvocadoProduct(product, recipeFruit, recipeName);
  const variety = isAvocado ? resolveCaReportAvocadoVariety([product, recipeFruit, recipeName, origin]) : null;
  const qty = batch?.quantity_kg;
  const qtyLabel =
    qty != null && String(qty).trim() !== '' && Number.isFinite(Number(qty)) && Number(qty) > 0
      ? `${Number(qty)} kg`
      : null;

  const rows: string[][] = [
    [t('ca_report_pdf_track_name'), trackingName],
    [t('ca_report_pdf_track_recipe'), recipeName],
    [t('ca_report_pdf_track_fruit'), product],
  ];

  if (variety) {
    rows.push([t('ca_report_pdf_track_variety'), variety]);
  }

  rows.push(
    [t('ca_report_pdf_track_origin'), origin],
    [t('ca_report_pdf_track_client'), clientName],
    [
      t('ca_report_pdf_track_start'),
      startIso ? formatDateTime(startIso) : '—',
    ],
    [
      t('ca_report_pdf_track_end'),
      endIso ? formatDateTime(endIso) : '—',
    ]
  );

  if (qtyLabel) {
    rows.push([t('ca_report_pdf_track_quantity'), qtyLabel]);
  }

  return {
    rows,
    showAvocadoVariety: Boolean(variety),
    showMachineSerial: isCaReportPruebaCaRecipe(recipeName),
  };
}
