import React, { useMemo } from 'react';
import useSWR from 'swr';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2, Atom } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import { formatUiDecimal } from '@/app/lib/formatUiNumber';
import { fetchMaduradorRangoHistoryForImei } from '@/app/lib/madurador';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import type { mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';
import { processReportRangeEndMs, yDomainPadded } from '@/app/lib/trackingIntegralReport';
import {
  buildCaProcessSummary,
  buildDailyCaAnalysis,
  downsampleCaPreparedPoints,
  prepareCaHistoryPoints,
  type DailyCaAnalysis,
} from '@/app/lib/caReportAnalysis';
import { isPruebaCaMonitoringDevice } from '@/app/lib/pruebaCaMonitoringOverrides';
import { clsx } from 'clsx';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ReturnType<typeof mapRowToProcessView>;
};

function chartTick(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return ts;
  }
}

function RangeBadge({ ok, pct }: { ok: boolean; pct: number | null }) {
  const { t } = useSettings();
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
      )}
    >
      {pct != null ? `${pct}% ${t('ca_report_in_range')}` : '—'}
    </span>
  );
}

function DailyTable({ rows }: { rows: DailyCaAnalysis[] }) {
  const { t, formatTemp, convertTemp } = useSettings();
  if (!rows.length) {
    return <p className="text-sm text-gray-500 py-4">{t('ca_report_no_daily')}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide">
          <tr>
            <th className="text-left p-2 font-semibold">{t('ca_report_day')}</th>
            <th className="text-left p-2 font-semibold">CO₂ (%)</th>
            <th className="text-left p-2 font-semibold">O₂ (%)</th>
            <th className="text-left p-2 font-semibold">{t('ethylene')} (ppm)</th>
            <th className="text-left p-2 font-semibold">{t('ca_report_return_air')}</th>
            <th className="text-left p-2 font-semibold">{t('ca_report_day_status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((d) => (
            <tr key={d.dayKey} className="hover:bg-slate-50/80">
              <td className="p-2 align-top">
                <div className="font-medium text-gray-900">{d.dayLabel}</div>
                <div className="text-[10px] text-gray-500">{d.samples} {t('ca_report_readings')}</div>
              </td>
              <td className="p-2 align-top">
                <MetricCell
                  stats={d.co2}
                  fmt={(v) => `${formatUiDecimal(v)}%`}
                  targetFmt={(v) => `${formatUiDecimal(v)}%`}
                />
              </td>
              <td className="p-2 align-top">
                <MetricCell
                  stats={d.o2}
                  fmt={(v) => `${formatUiDecimal(v)}%`}
                  targetFmt={(v) => `${formatUiDecimal(v)}%`}
                />
              </td>
              <td className="p-2 align-top">
                <MetricCell
                  stats={d.ethylene}
                  fmt={(v) => `${formatUiDecimal(v)} ppm`}
                  targetFmt={(v) => `≤ ${formatUiDecimal(v)} ppm`}
                />
              </td>
              <td className="p-2 align-top">
                <MetricCell
                  stats={d.returnAir}
                  fmt={(v) => formatTemp(convertTemp(v))}
                  targetFmt={(v) => formatTemp(convertTemp(v))}
                />
              </td>
              <td className="p-2 align-top">
                {(() => {
                  const pcts = [d.co2.inRangePct, d.o2.inRangePct, d.ethylene.inRangePct, d.returnAir.inRangePct].filter(
                    (v): v is number => v != null
                  );
                  const worst = pcts.length ? Math.min(...pcts) : null;
                  return (
                    <>
                      <RangeBadge ok={d.allInRange} pct={worst} />
                      <p className="text-[10px] text-gray-500 mt-1">
                        {d.allInRange ? t('ca_report_day_ok') : t('ca_report_day_review')}
                      </p>
                    </>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCell({
  stats,
  fmt,
  targetFmt,
}: {
  stats: DailyCaAnalysis['co2'];
  fmt: (v: number) => string;
  targetFmt: (v: number) => string;
}) {
  const { t } = useSettings();
  if (!stats.readings) return <span className="text-gray-400">—</span>;
  return (
    <div className="space-y-1">
      <div className="text-gray-800">
        {stats.min != null && stats.max != null
          ? `${fmt(stats.min)} – ${fmt(stats.max)}`
          : stats.avg != null
            ? fmt(stats.avg)
            : '—'}
      </div>
      {stats.target != null && (
        <div className="text-[10px] text-gray-500">
          {t('ca_report_target')} {targetFmt(stats.target)}
        </div>
      )}
      <RangeBadge ok={stats.inRange} pct={stats.inRangePct} />
    </div>
  );
}

export const ProcessCaReportDialog: React.FC<Props> = ({ open, onOpenChange, view }) => {
  const { t, formatDateTime, language, tempUnit, convertTemp, formatTemp } = useSettings();

  const deviceId = useMemo(() => {
    const p = (view._row as RipeningProcessRow | undefined)?.payload as { deviceId?: string } | undefined;
    return String(p?.deviceId ?? '').trim();
  }, [view._row]);

  const startedAtIso = view.scheduleSummary?.startedAt
    ? String(view.scheduleSummary.startedAt)
    : view._row?.created_at
      ? String(view._row.created_at)
      : null;

  const rangeEndIso = useMemo(() => {
    const end = processReportRangeEndMs(view);
    return new Date(Math.max(end, (startedAtIso ? new Date(startedAtIso).getTime() : 0) + 120_000)).toISOString();
  }, [view, startedAtIso]);

  const swrKey = open && deviceId && startedAtIso ? `ca-report:${deviceId}:${startedAtIso}:${rangeEndIso}` : null;

  const { data, error, isLoading } = useSWR(
    swrKey,
    async () =>
      fetchMaduradorRangoHistoryForImei(deviceId, {
        fecha_inicio: startedAtIso!,
        fecha_fin: rangeEndIso,
        maduradorAmericaLima: true,
        includeRawDatos: false,
      }),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  const analysis = useMemo(() => {
    const points = data?.points ?? [];
    if (!points.length) return null;
    const prepared = prepareCaHistoryPoints(points, deviceId);
    const chartPrepared = downsampleCaPreparedPoints(prepared);
    const daily = buildDailyCaAnalysis(prepared, language, deviceId);
    const summary = buildCaProcessSummary(prepared, daily, deviceId);
    const prueba = isPruebaCaMonitoringDevice(deviceId);

    const gasRows = chartPrepared.map((p) => ({
      tick: chartTick(p.timestamp),
      co2: p.co2,
      o2: p.o2,
      ethylene: p.ethylene,
    }));

    const tempRows = chartPrepared.map((p) => ({
      tick: chartTick(p.timestamp),
      temp: p.return_air != null ? convertTemp(p.return_air) : null,
      setpoint: p.set_point != null ? convertTemp(p.set_point) : null,
    }));

    return { prepared, chartPrepared, daily, summary, gasRows, tempRows, prueba };
  }, [data?.points, deviceId, language, convertTemp]);

  const ethDomain: [number, number] = analysis?.prueba ? [0, 1] : ([...yDomainPadded(analysis?.gasRows.map((r) => r.ethylene) ?? [])] as [number, number]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Atom className="w-5 h-5 text-teal-700" />
            {t('ca_report_title')}
          </DialogTitle>
          <DialogDescription>{t('ca_report_desc')}</DialogDescription>
        </DialogHeader>

        {!deviceId && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t('integral_report_no_device')}
          </div>
        )}
        {deviceId && !startedAtIso && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t('integral_report_no_start')}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-600 py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('ca_report_loading')}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {t('detail_monitoring_fetch_error')}
          </div>
        )}

        {analysis && (
          <div className="space-y-6 pt-2">
            <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-4 text-sm space-y-2">
              <p className="font-semibold text-teal-950">{view.batch?.product ?? '—'} · {view.client?.name ?? '—'}</p>
              <p className="text-teal-900 text-xs">
                {t('integral_report_field_imei')}: <span className="font-mono">{deviceId}</span>
                {' · '}
                {formatDateTime(startedAtIso!)} → {formatDateTime(rangeEndIso)}
              </p>
              <p className="text-teal-800 text-xs leading-relaxed">{t('ca_report_sampling_note', {
                total: String(analysis.summary.totalPoints),
                shown: String(analysis.chartPrepared.length),
              })}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <SummaryTile label="CO₂" pct={analysis.summary.co2GlobalInRangePct} />
              <SummaryTile label="O₂" pct={analysis.summary.o2GlobalInRangePct} />
              <SummaryTile label={t('ethylene')} pct={analysis.summary.ethyleneGlobalInRangePct} />
              <SummaryTile label={t('ca_report_return_air')} pct={analysis.summary.tempGlobalInRangePct} />
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-1">{t('ca_report_gases_chart')}</h3>
              <p className="text-xs text-gray-500">{t('ca_report_gases_hint')}</p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.gasRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="tick" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                    <YAxis yAxisId="pct" domain={[0, 'auto']} fontSize={10} tickFormatter={(v) => formatUiDecimal(Number(v))} />
                    <YAxis yAxisId="ppm" orientation="right" domain={ethDomain} fontSize={10} tickFormatter={(v) => formatUiDecimal(Number(v))} />
                    <Tooltip formatter={(v: number | string) => formatUiDecimal(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="pct" type="monotone" dataKey="co2" name="CO₂ (%)" stroke="#64748b" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="pct" type="monotone" dataKey="o2" name="O₂ (%)" stroke="#0ea5e9" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="ppm" type="monotone" dataKey="ethylene" name={`${t('ethylene')} (ppm)`} stroke="#9333ea" dot={false} strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-1">{t('ca_report_temp_chart')}</h3>
              <p className="text-xs text-gray-500">{t('ca_report_temp_hint')}</p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.tempRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="tick" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={tempUnit === 'F' ? [32, 86] : [0, 30]} fontSize={10} tickFormatter={(v) => formatUiDecimal(Number(v))} />
                    <Tooltip formatter={(v: number | string) => formatUiDecimal(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="temp" name={t('ca_report_return_air')} stroke="#ef4444" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="setpoint" name={t('ca_report_setpoint')} stroke="#94a3b8" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900">{t('ca_report_daily_title')}</h3>
                <p className="text-xs text-gray-500">
                  {t('ca_report_daily_summary', {
                    ok: String(analysis.summary.daysInRange),
                    total: String(analysis.summary.daysAnalyzed),
                  })}
                </p>
              </div>
              <p className="text-xs text-gray-500">{t('ca_report_daily_hint')}</p>
              <DailyTable rows={analysis.daily} />
            </section>
          </div>
        )}

        {!isLoading && !error && deviceId && startedAtIso && data && !analysis && (
          <p className="text-sm text-gray-500 py-6 text-center">{t('integral_report_no_series')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

function SummaryTile({ label, pct }: { label: string; pct: number | null }) {
  const { t } = useSettings();
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[10px] uppercase text-gray-500 font-semibold">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{pct != null ? `${pct}%` : '—'}</p>
      <p className="text-[10px] text-gray-500">{t('ca_report_global_in_range')}</p>
    </div>
  );
}
