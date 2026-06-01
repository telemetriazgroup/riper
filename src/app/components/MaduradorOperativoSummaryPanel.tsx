import React from 'react';
import type { MaduradorHistorialTramo, MaduradorOperativoSummary } from '@/app/data';
import { useSettings } from '@/app/contexts/SettingsContext';

function asTramoRows(rows: MaduradorHistorialTramo[] | undefined): MaduradorHistorialTramo[] {
  return Array.isArray(rows) ? rows : [];
}

function tramoValorNumber(r: MaduradorHistorialTramo): number | null {
  const v = r.valor;
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Resumen operativo: solo tramos con SP humedad en [50, 99] (%). */
function historialHumiditySetPointVisible(rows: MaduradorHistorialTramo[] | undefined): MaduradorHistorialTramo[] {
  return asTramoRows(rows).filter((r) => {
    const n = tramoValorNumber(r);
    return n != null && n >= 50 && n <= 99;
  });
}

/** Resumen operativo: solo tramos con SP CO₂ en [0, 20]. */
function historialSetPointCo2Visible(rows: MaduradorHistorialTramo[] | undefined): MaduradorHistorialTramo[] {
  return asTramoRows(rows).filter((r) => {
    const n = tramoValorNumber(r);
    return n != null && n >= 0 && n <= 20;
  });
}

function TramosTable({
  title,
  rows,
  fmtDate,
  t,
}: {
  title: string;
  rows?: MaduradorHistorialTramo[];
  fmtDate: (iso: string | undefined) => string;
  t: (key: string) => string;
}) {
  const safe = asTramoRows(rows);
  if (!safe.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{title}</h4>
      <div className="border rounded-md overflow-x-auto max-h-44 overflow-y-auto text-xs">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-2">{t('tramo_col_value')}</th>
              <th className="text-left p-2">{t('tramo_col_from')}</th>
              <th className="text-left p-2">{t('tramo_col_to')}</th>
              <th className="text-left p-2">{t('tramo_col_state')}</th>
            </tr>
          </thead>
          <tbody>
            {safe.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="p-2 font-mono">{r.valor ?? '—'}</td>
                <td className="p-2 font-mono whitespace-nowrap">{fmtDate(r.desde)}</td>
                <td className="p-2 font-mono whitespace-nowrap">{fmtDate(r.hasta)}</td>
                <td className="p-2">{r.estado ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** La API a veces envía `ultima_alarmas` como objeto único en lugar de arreglo. */
function formatUltimaAlarmas(entries: unknown, fmtDate: (iso: string | undefined) => string): React.ReactNode {
  const list: unknown[] = Array.isArray(entries)
    ? entries
    : entries != null && typeof entries === 'object'
      ? [entries]
      : [];
  return list.map((entry, i) => {
    if (!entry || typeof entry !== 'object') return <li key={i}>{String(entry)}</li>;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
      if (v && typeof v === 'object' && 'numero' in (v as object)) {
        const o = v as { numero?: unknown; desde?: string; hasta?: string };
        parts.push(
          `${k}: #${o.numero ?? '—'} (${fmtDate(o.desde)} → ${fmtDate(o.hasta)})`
        );
      } else {
        parts.push(`${k}: ${JSON.stringify(v)}`);
      }
    }
    return (
      <li key={i} className="bg-gray-50 p-2 rounded text-xs font-mono">
        {parts.join(' · ')}
      </li>
    );
  });
}

/** Etiqueta traducible del modo ventilación (fresh_air_ex_mode). */
function ventModeLabel(mode: number | undefined, t: (key: string) => string): string {
  const m = mode ?? 0;
  if (m === 0) return t('gas_ex_off');
  if (m === 1) return t('gas_ex_manual');
  if (m === 2) return t('gas_ex_auto');
  return `${t('operativo_code')} ${m}`;
}

interface MaduradorOperativoSummaryPanelProps {
  summary: MaduradorOperativoSummary;
  ultimaFechaEncendido?: string | null;
}

export const MaduradorOperativoSummaryPanel: React.FC<MaduradorOperativoSummaryPanelProps> = ({
  summary: s,
  ultimaFechaEncendido,
}) => {
  const { formatDateTime, t } = useSettings();
  const fmtDate = (iso: string | undefined) => (iso == null || iso === '' ? '—' : formatDateTime(iso));
  const alarmas = s.alarmas as {
    numero_alarma?: number;
    activas?: unknown[];
    ultima_alarmas?: unknown;
  } | undefined;

  const activasCount = Array.isArray(alarmas?.activas) ? alarmas!.activas!.length : 0;

  const cc = s.compressCoilHealth;

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm md:col-span-2">
      <h3 className="font-semibold mb-4 text-gray-800">{t('operativo_summary_title')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
        <div className="sm:col-span-2 lg:col-span-3 border-b border-gray-100 pb-3 mb-1">
          <span className="text-gray-500 block text-xs uppercase tracking-wide">{t('operativo_vent_mode')}</span>
          <p className="font-medium text-gray-900 mt-0.5">
            {ventModeLabel(s.modoVentilacion, t)}
            {s.modoVentilacion != null ? (
              <span className="text-gray-400 font-normal text-xs ml-2">({t('operativo_code')} {s.modoVentilacion})</span>
            ) : null}
          </p>
        </div>
        <div className="border-b border-gray-50 pb-2">
          <span className="text-gray-500 text-xs">{t('madurador_last_on')}</span>
          <p className="font-mono text-xs mt-0.5">{fmtDate(ultimaFechaEncendido ?? undefined)}</p>
        </div>
        <div className="border-b border-gray-50 pb-2">
          <span className="text-gray-500 text-xs">{t('madurador_last_off')}</span>
          <p className="font-mono text-xs mt-0.5">{fmtDate(s.ultima_fecha_apagado ?? undefined)}</p>
        </div>
        {cc && (
          <div className="border-b border-gray-50 pb-2 sm:col-span-2 lg:col-span-1">
            <span className="text-gray-500 text-xs">{t('operativo_compressor_health')}</span>
            <p className="font-mono text-xs mt-0.5">
              <span className="font-semibold capitalize">{String(cc.estado ?? '—')}</span>
              {cc.valor_actual != null ? (
                <span className="text-gray-600"> · {String(cc.valor_actual)} °C</span>
              ) : null}
            </p>
          </div>
        )}
      </div>

      {alarmas ? (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">{t('operativo_alarms')}</h4>
          <p className="text-xs text-gray-600 mb-2">
            {t('operativo_alarm_api_number')}{' '}
            <span className="font-mono">{alarmas.numero_alarma ?? '—'}</span>
          </p>
          <p className="text-xs font-medium text-red-800 mb-1">
            {t('operativo_alarms_active')} {activasCount}
          </p>
          {activasCount > 0 ? (
            <pre className="text-xs bg-red-50/80 border border-red-100 p-2 rounded overflow-x-auto max-h-28 mb-3">
              {JSON.stringify(alarmas.activas, null, 2)}
            </pre>
          ) : null}
          <p className="text-xs font-medium text-gray-800 mb-1">{t('operativo_last_alarms')}</p>
          <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
            {formatUltimaAlarmas(alarmas.ultima_alarmas, fmtDate)}
          </ul>
        </div>
      ) : null}

      <TramosTable title={t('operativo_hist_ethylene_sp')} rows={s.historial_sp_etileno} fmtDate={fmtDate} t={t} />
      <TramosTable title={t('operativo_hist_temp_sp')} rows={s.historico_set_point} fmtDate={fmtDate} t={t} />
      <TramosTable title={t('operativo_hist_humidity_sp')} rows={historialHumiditySetPointVisible(s.historial_humidity_set_point)} fmtDate={fmtDate} t={t} />
      <TramosTable title={t('operativo_hist_co2_sp')} rows={historialSetPointCo2Visible(s.historial_set_point_co2)} fmtDate={fmtDate} t={t} />
      <TramosTable title={t('operativo_hist_power')} rows={s.historial_power_state} fmtDate={fmtDate} t={t} />
    </div>
  );
};
