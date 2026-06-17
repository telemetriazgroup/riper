import { formatUiDecimal } from '@/app/lib/formatUiNumber';
import type { CaPdfIndicators } from '@/app/lib/caReportAnalysis';
import type { mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';
import { phaseDurationHoursFromStored } from '@/app/lib/ripeningProcessMappers';

type PhaseRaw = Record<string, unknown>;

function phaseLabel(raw: PhaseRaw, idx: number, t: (k: string, p?: Record<string, string>) => string): string {
  const name = String(raw.name ?? '').trim();
  if (name) return name;
  const type = String(raw.type ?? '').trim();
  const key =
    type === 'homogenization'
      ? 'phase_homogenization'
      : type === 'ripening'
        ? 'phase_ripening'
        : type === 'venting'
          ? 'phase_venting'
          : type === 'cooling'
            ? 'phase_cooling'
            : null;
  return key ? t(key) : t('tracking_recipe_phase_n', { n: String(idx + 1) });
}

function fmtCell(value: string | null | undefined): string {
  const v = String(value ?? '').trim();
  return v || '—';
}

function formatPhaseDuration(raw: PhaseRaw, t: (k: string) => string): string {
  const type = String(raw.type ?? '');
  const dur = raw.duration != null ? Number(raw.duration) : NaN;
  if (!Number.isFinite(dur) || dur <= 0) return '—';
  if (type === 'venting') return `${Math.round(dur)} ${t('unit_minutes')}`;
  const h = phaseDurationHoursFromStored(raw);
  if (h > 0) return `${formatUiDecimal(h, 1)} ${t('hours')}`;
  return `${dur} ${t('hours')}`;
}

/** Filas de tabla: objetivos por fase de la receta del seguimiento. */
export function buildCaReportPhaseTargetRows(
  view: ReturnType<typeof mapRowToProcessView>,
  t: (k: string, p?: Record<string, string>) => string,
  formatTemp: (v: number) => string,
  convertTemp: (v: number) => number
): string[][] {
  const rawPhases = view.recipe?.phases ?? [];
  const phases = rawPhases.filter(
    (p): p is PhaseRaw => Boolean(p) && (p as { enabled?: boolean }).enabled !== false
  );
  if (!phases.length) return [];

  return phases.map((raw, idx) => {
    const temp =
      raw.temp != null && Number.isFinite(Number(raw.temp))
        ? formatTemp(convertTemp(Number(raw.temp)))
        : null;
    const humidity =
      raw.humidity != null && Number.isFinite(Number(raw.humidity))
        ? `${formatUiDecimal(Number(raw.humidity), 0)} %`
        : null;
    const co2 =
      raw.co2Limit != null && Number.isFinite(Number(raw.co2Limit))
        ? `${formatUiDecimal(Number(raw.co2Limit))} %`
        : null;
    const eth =
      raw.ethylene != null && Number.isFinite(Number(raw.ethylene))
        ? `${formatUiDecimal(Number(raw.ethylene))} ppm`
        : null;
    return [
      phaseLabel(raw, idx, t),
      fmtCell(temp),
      fmtCell(humidity),
      fmtCell(co2),
      fmtCell(eth),
      formatPhaseDuration(raw, t),
    ];
  });
}

/** Setpoints representativos (mediana) registrados en telemetría durante el período analizado. */
export function buildCaReportTelemetrySetpointRows(
  indicators: CaPdfIndicators,
  t: (k: string) => string,
  formatTemp: (v: number) => string,
  convertTemp: (v: number) => number
): string[][] {
  const rows: string[][] = [];
  if (indicators.medianTempSp != null) {
    rows.push([
      t('ca_report_pdf_var_sp_temp'),
      formatTemp(convertTemp(indicators.medianTempSp)),
    ]);
  }
  if (indicators.medianCo2Sp != null) {
    rows.push([t('ca_report_pdf_var_sp_co2'), `${formatUiDecimal(indicators.medianCo2Sp)} %`]);
  }
  if (indicators.medianO2Sp != null) {
    rows.push([t('ca_report_pdf_var_sp_o2'), `${formatUiDecimal(indicators.medianO2Sp)} %`]);
  }
  return rows;
}

export function hasCaReportProcessTargets(view: ReturnType<typeof mapRowToProcessView>): boolean {
  const phases = view.recipe?.phases ?? [];
  return phases.some((p) => p && (p as { enabled?: boolean }).enabled !== false);
}

/** Objetivos de CO₂/O₂ de la primera fase habilitada; O₂ cae al setpoint telemétrico inicial. */
export function getCaReportInitialGasObjectives(
  view: ReturnType<typeof mapRowToProcessView>,
  fallback: { co2: number | null; o2: number | null }
): { co2: number | null; o2: number | null } {
  const phases = (view.recipe?.phases ?? []).filter(
    (p): p is PhaseRaw => Boolean(p) && (p as { enabled?: boolean }).enabled !== false
  );
  let co2: number | null = null;
  for (const raw of phases) {
    if (raw.co2Limit != null && Number.isFinite(Number(raw.co2Limit))) {
      co2 = Number(raw.co2Limit);
      break;
    }
  }
  return {
    co2: co2 ?? fallback.co2,
    o2: fallback.o2,
  };
}
