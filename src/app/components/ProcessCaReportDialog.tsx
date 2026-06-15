import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { Loader2, Atom, Download } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { toast } from 'sonner';
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
import { processReportRangeEndMs } from '@/app/lib/trackingIntegralReport';
import { CHART_ETHYLENE_MAX_PPM } from '@/app/lib/historySeriesSanitize';
import {
  buildCaPdfIndicators,
  buildCaProcessSummary,
  buildDailyCaAnalysis,
  CA_CO2_TOLERANCE_PCT,
  CA_O2_TOLERANCE_PCT,
  CA_TEMP_TOLERANCE_C,
  downsampleCaPreparedPoints,
  formatCaGasTargetLabel,
  formatCaReportPeriodDate,
  prepareCaHistoryPoints,
  type CaPdfIndicators,
  type DailyCaAnalysis,
} from '@/app/lib/caReportAnalysis';
import { collectDomPdfSections, downloadDomSectionsAsPdf } from '@/app/lib/reportPdfExport';
import { isPruebaCaMonitoringDevice } from '@/app/lib/pruebaCaMonitoringOverrides';
import { clsx } from 'clsx';

const CA_PDF_SECTION_ATTR = 'data-ca-pdf-section';

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

function pctLabel(count: number, total: number): string {
  if (total <= 0) return '—';
  return `${count} de ${total} (${formatUiDecimal((count / total) * 100, 1)}%)`;
}

function CaPdfHeader({ deviceId, t }: { deviceId: string; t: (k: string) => string }) {
  return (
    <div
      className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-400 pb-2 mb-4 text-[11px] font-semibold text-gray-800 tracking-wide"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <span>ZGROUP PERU | {t('ca_report_pdf_doc_title')}</span>
      <span>
        {t('ca_report_pdf_code')}: <span className="font-mono">{deviceId}</span>
      </span>
    </div>
  );
}

function CaSectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <h2
      className="text-[13px] font-bold text-gray-900 mt-4 mb-2 first:mt-0"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {n}. {title}
    </h2>
  );
}

function CaSubSectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <h3
      className="text-[12px] font-bold text-gray-900 mt-3 mb-2"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {n} {title}
    </h3>
  );
}

function CaProse({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] text-gray-800 leading-relaxed mb-3 text-justify"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {children}
    </p>
  );
}

function CaTechTable({
  headers,
  rows,
}: {
  headers: [string, string] | [string, string, string];
  rows: string[][];
}) {
  const cols = headers.length;
  return (
    <table
      className="w-full text-[11px] border-collapse mb-4"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <thead>
        <tr className="border-b border-gray-400">
          {headers.map((h) => (
            <th key={h} className="text-left py-1.5 pr-3 font-semibold text-gray-900">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-gray-200 align-top">
            {row.slice(0, cols).map((cell, j) => (
              <td
                key={j}
                className={clsx('py-1.5 pr-3', j === 0 && 'font-medium text-gray-900')}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CaBulletList({ items }: { items: string[] }) {
  return (
    <ul
      className="text-[11px] text-gray-800 leading-relaxed mb-3 list-disc pl-5 space-y-1"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
function metricCell(
  stats: DailyCaAnalysis['co2'],
  fmt: (v: number) => string,
  gasPercent = false
): string {
  const range =
    stats.min != null && stats.max != null
      ? `${fmt(stats.min)} – ${fmt(stats.max)}`
      : stats.avg != null
        ? fmt(stats.avg)
        : '—';
  const target =
    stats.target != null
      ? gasPercent && stats.tolerance != null
        ? formatCaGasTargetLabel(stats.target, stats.tolerance, '%')
        : fmt(stats.target)
      : null;
  const pct = stats.inRangePct != null ? `${stats.inRangePct}%` : '—';
  return [range, target ? `meta ${target}` : null, pct].filter(Boolean).join('\n');
}

function DailyTable({ rows }: { rows: DailyCaAnalysis[] }) {
  const { t, formatTemp, convertTemp } = useSettings();
  if (!rows.length) {
    return <p className="text-sm text-gray-500 py-4">{t('ca_report_no_daily')}</p>;
  }
  return (
    <CaTechTable
      headers={[t('ca_report_day'), 'CO₂ (%)', 'O₂ (%)', `${t('ethylene')} (ppm)`, t('ca_report_return_air'), t('ca_report_day_status')]}
      rows={rows.map((d) => {
        const pcts = [d.co2.inRangePct, d.o2.inRangePct, d.ethylene.inRangePct, d.returnAir.inRangePct].filter(
          (v): v is number => v != null
        );
        const worst = pcts.length ? Math.min(...pcts) : null;
        return [
          `${d.dayLabel}\n(${d.samples} ${t('ca_report_readings')})`,
          metricCell(d.co2, (v) => `${formatUiDecimal(v)}%`, true),
          metricCell(d.o2, (v) => `${formatUiDecimal(v)}%`, true),
          metricCell(d.ethylene, (v) => `${formatUiDecimal(v)} ppm`),
          metricCell(d.returnAir, (v) => formatTemp(convertTemp(v))),
          d.allInRange
            ? `${t('ca_report_day_ok')}${worst != null ? ` (${worst}%)` : ''}`
            : `${t('ca_report_day_review')}${worst != null ? ` (${worst}%)` : ''}`,
        ];
      })}
    />
  );
}

function buildKpiRows(
  t: (k: string, p?: Record<string, string>) => string,
  summary: ReturnType<typeof buildCaProcessSummary>,
  indicators: CaPdfIndicators,
  periodStart: string,
  periodEnd: string,
  formatTemp: (v: number) => string,
  convertTemp: (v: number) => number
): string[][] {
  const fmtPct = (c: number, total: number) => pctLabel(c, total);
  const fmtMinMax = (min: number | null, max: number | null, unit: string) =>
    min != null && max != null ? `${formatUiDecimal(min)}${unit} – ${formatUiDecimal(max)}${unit}` : '—';

  return [
    [t('ca_report_pdf_ind_total'), String(summary.totalPoints)],
    [t('ca_report_pdf_ind_period'), `${periodStart} al ${periodEnd}`],
    [t('ca_report_pdf_ind_chart_pts'), String(summary.chartPoints)],
    [
      t('ca_report_pdf_ind_co2_range', { tol: String(CA_CO2_TOLERANCE_PCT) }),
      fmtPct(indicators.co2InRangeCount, indicators.co2Evaluated),
    ],
    [
      t('ca_report_pdf_ind_o2_range', { tol: String(CA_O2_TOLERANCE_PCT) }),
      fmtPct(indicators.o2InRangeCount, indicators.o2Evaluated),
    ],
    [t('ca_report_pdf_ind_eth_range'), fmtPct(indicators.ethInRangeCount, indicators.ethEvaluated)],
    [t('ca_report_pdf_ind_temp_range'), fmtPct(indicators.tempInRangeCount, indicators.tempEvaluated)],
    [t('ca_report_pdf_ind_co2_minmax'), fmtMinMax(indicators.co2Min, indicators.co2Max, '%')],
    [t('ca_report_pdf_ind_o2_minmax'), fmtMinMax(indicators.o2Min, indicators.o2Max, '%')],
    [
      t('ca_report_pdf_ind_temp_minmax'),
      indicators.tempMin != null && indicators.tempMax != null
        ? `${formatTemp(convertTemp(indicators.tempMin))} – ${formatTemp(convertTemp(indicators.tempMax))}`
        : '—',
    ],
    [
      t('ca_report_pdf_ind_days_ok'),
      `${summary.daysInRange} / ${summary.daysAnalyzed}`,
    ],
  ];
}

export const ProcessCaReportDialog: React.FC<Props> = ({ open, onOpenChange, view }) => {
  const { t, formatDateTime, formatFileTimestamp, language, tempUnit, convertTemp, formatTemp } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const deviceId = useMemo(() => {
    const p = (view._row as RipeningProcessRow | undefined)?.payload as { deviceId?: string } | undefined;
    return String(p?.deviceId ?? '').trim();
  }, [view._row]);

  const trackingName = view.batch?.lotNumber ?? view.id ?? '—';
  const productName = view.batch?.product ?? '—';
  const clientName = view.client?.name ?? '—';

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
    const indicators = buildCaPdfIndicators(prepared, deviceId);
    const prueba = isPruebaCaMonitoringDevice(deviceId);

    const periodStart = formatCaReportPeriodDate(startedAtIso ?? points[0]!.timestamp, language);
    const periodEnd = formatCaReportPeriodDate(rangeEndIso, language);

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

    const gasesOk =
      (summary.co2GlobalInRangePct ?? 0) >= 85 &&
      (summary.o2GlobalInRangePct ?? 0) >= 85;
    const tempOk = (summary.tempGlobalInRangePct ?? 0) >= 85;

    return {
      prepared,
      chartPrepared,
      daily,
      summary,
      indicators,
      gasRows,
      tempRows,
      prueba,
      periodStart,
      periodEnd,
      gasesOk,
      tempOk,
      kpiRows: buildKpiRows(t, summary, indicators, periodStart, periodEnd, formatTemp, convertTemp),
    };
  }, [data?.points, deviceId, language, convertTemp, formatTemp, startedAtIso, rangeEndIso, t]);

  const ethDomain: [number, number] = [0, CHART_ETHYLENE_MAX_PPM];

  const handleDownloadPdf = useCallback(async () => {
    if (!analysis) return;
    setPdfBusy(true);
    toast.info(t('ca_report_pdf_generating'));
    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });
    await new Promise((r) => setTimeout(r, 600));
    try {
      const root = printRef.current;
      if (!root) {
        toast.error(t('ca_report_pdf_error'));
        return;
      }
      const sections = collectDomPdfSections(root, CA_PDF_SECTION_ATTR);
      const idShort = view.id ? String(view.id).replace(/-/g, '').slice(0, 8) : 'ca';
      await downloadDomSectionsAsPdf({
        root,
        sectionAttr: CA_PDF_SECTION_ATTR,
        sections,
        filename: `informe_ca_${deviceId}_${formatFileTimestamp()}.pdf`,
        marginMm: 12,
        scale: 1.6,
      });
      toast.success(t('ca_report_pdf_success'));
    } catch (e) {
      console.error(e);
      toast.error(t('ca_report_pdf_error'));
    } finally {
      setPdfBusy(false);
    }
  }, [analysis, deviceId, formatFileTimestamp, t, view.id]);

  const varRows = analysis
    ? [
        [t('ca_report_pdf_var_co2'), t('ca_report_pdf_var_co2_desc'), '%'],
        [t('ca_report_pdf_var_o2'), t('ca_report_pdf_var_o2_desc'), '%'],
        [t('ca_report_pdf_var_eth'), t('ca_report_pdf_var_eth_desc'), 'ppm'],
        [t('ca_report_pdf_var_return'), t('ca_report_pdf_var_return_desc'), `°${tempUnit}`],
        [t('ca_report_pdf_var_sp_co2'), t('ca_report_pdf_var_sp_co2_desc'), '%'],
        [t('ca_report_pdf_var_sp_o2'), t('ca_report_pdf_var_sp_o2_desc'), '%'],
        [t('ca_report_pdf_var_sp_temp'), t('ca_report_pdf_var_sp_temp_desc'), `°${tempUnit}`],
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-start justify-between gap-3 pr-8">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Atom className="w-5 h-5 text-teal-700" />
              {t('ca_report_title')}
            </DialogTitle>
            <DialogDescription>{t('ca_report_desc')}</DialogDescription>
          </div>
          {analysis && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-2"
              disabled={pdfBusy}
              onClick={() => void handleDownloadPdf()}
            >
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t('ca_report_download_pdf')}
            </Button>
          )}
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
          <div
            ref={printRef}
            className="ca-report-document bg-white text-gray-900 pt-2 space-y-0"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            {/* §1 + §2 — Intro y variables */}
            <article
              data-ca-pdf-section="intro"
              className="ca-pdf-section px-6 py-5 border border-gray-200 rounded-lg mb-4 bg-white"
            >
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSectionTitle n="1" title={t('ca_report_pdf_s1_title')} />
              <CaProse>
                {t('ca_report_pdf_s1_body', {
                  deviceId,
                  tracking: String(trackingName),
                  product: productName,
                  client: clientName,
                  start: analysis.periodStart,
                  end: analysis.periodEnd,
                })}
              </CaProse>
              <CaProse>{t('ca_report_pdf_s1_highlights')}</CaProse>
              {analysis.prueba && (
                <CaProse>{t('ca_report_prueba_note')}</CaProse>
              )}

              <CaSectionTitle n="2" title={t('ca_report_pdf_s2_title')} />
              <CaProse>{t('ca_report_pdf_s2_intro')}</CaProse>
              <CaTechTable
                headers={[t('ca_report_pdf_col_variable'), t('ca_report_pdf_col_description'), t('ca_report_pdf_col_unit')]}
                rows={varRows}
              />
              <CaProse>
                {t('ca_report_pdf_criteria_note', {
                  co2Tol: String(CA_CO2_TOLERANCE_PCT),
                  tempTol: String(CA_TEMP_TOLERANCE_C),
                })}
              </CaProse>
            </article>

            {/* §3 — Resumen KPI */}
            <article
              data-ca-pdf-section="summary"
              className="ca-pdf-section px-6 py-5 border border-gray-200 rounded-lg mb-4 bg-white"
            >
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSectionTitle n="3" title={t('ca_report_pdf_s3_title')} />
              <CaProse>
                {t('ca_report_pdf_s3_intro', {
                  total: String(analysis.summary.totalPoints),
                  shown: String(analysis.summary.chartPoints),
                  daysOk: String(analysis.summary.daysInRange),
                  daysTotal: String(analysis.summary.daysAnalyzed),
                })}
              </CaProse>
              <CaTechTable
                headers={[t('ca_report_pdf_col_indicator'), t('ca_report_pdf_col_value')]}
                rows={analysis.kpiRows}
              />
            </article>

            {/* §4.1 — Gases */}
            <article
              data-ca-pdf-section="gases"
              className="ca-pdf-section px-6 py-5 border border-gray-200 rounded-lg mb-4 bg-white"
            >
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSectionTitle n="4" title={t('ca_report_pdf_s4_title')} />
              <CaSubSectionTitle n="4.1" title={t('ca_report_pdf_s41_title')} />
              <CaProse>{t('ca_report_pdf_s41_intro')}</CaProse>
              <div className="h-72 w-full my-3 border border-gray-100 rounded bg-white">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.gasRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="tick" fontSize={10} tickLine={false} interval="preserveStartEnd" stroke="#374151" />
                    <YAxis yAxisId="pct" domain={[0, 'auto']} fontSize={10} tickFormatter={(v) => formatUiDecimal(Number(v))} stroke="#374151" />
                    <YAxis yAxisId="ppm" orientation="right" domain={ethDomain} fontSize={10} tickFormatter={(v) => formatUiDecimal(Number(v))} stroke="#374151" />
                    <Tooltip formatter={(v: number | string) => formatUiDecimal(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="pct" type="monotone" dataKey="co2" name="CO₂ (%)" stroke="#475569" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="pct" type="monotone" dataKey="o2" name="O₂ (%)" stroke="#0284c7" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="ppm" type="monotone" dataKey="ethylene" name={`${t('ethylene')} (ppm)`} stroke="#7c3aed" dot={false} strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <CaProse>
                {t('ca_report_pdf_s41_interp', {
                  interp: analysis.gasesOk
                    ? t('ca_report_pdf_s41_interp_ok')
                    : t('ca_report_pdf_s41_interp_review', {
                        co2: String(analysis.summary.co2GlobalInRangePct ?? '—'),
                        o2: String(analysis.summary.o2GlobalInRangePct ?? '—'),
                      }),
                })}
              </CaProse>
            </article>

            {/* §4.2 — Temperatura */}
            <article
              data-ca-pdf-section="temperature"
              className="ca-pdf-section px-6 py-5 border border-gray-200 rounded-lg mb-4 bg-white"
            >
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSubSectionTitle n="4.2" title={t('ca_report_pdf_s42_title')} />
              <CaProse>{t('ca_report_pdf_s42_intro')}</CaProse>
              <div className="h-72 w-full my-3 border border-gray-100 rounded bg-white">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.tempRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="tick" fontSize={10} tickLine={false} interval="preserveStartEnd" stroke="#374151" />
                    <YAxis domain={tempUnit === 'F' ? [32, 86] : [0, 30]} fontSize={10} tickFormatter={(v) => formatUiDecimal(Number(v))} stroke="#374151" />
                    <Tooltip formatter={(v: number | string) => formatUiDecimal(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="temp" name={t('ca_report_return_air')} stroke="#dc2626" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="setpoint" name={t('ca_report_setpoint')} stroke="#94a3b8" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <CaProse>
                {analysis.tempOk
                  ? t('ca_report_pdf_s42_interp_ok', {
                      pct: String(analysis.summary.tempGlobalInRangePct ?? '—'),
                      tol: String(CA_TEMP_TOLERANCE_C),
                    })
                  : t('ca_report_pdf_s42_interp_review', {
                      pct: String(analysis.summary.tempGlobalInRangePct ?? '—'),
                    })}
              </CaProse>
            </article>

            {/* §5 — Análisis diario */}
            <article
              data-ca-pdf-section="daily"
              className="ca-pdf-section px-6 py-5 border border-gray-200 rounded-lg mb-4 bg-white"
            >
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSectionTitle n="5" title={t('ca_report_pdf_s5_title')} />
              <CaProse>
                {t('ca_report_daily_summary', {
                  ok: String(analysis.summary.daysInRange),
                  total: String(analysis.summary.daysAnalyzed),
                })}
                {' '}
                {t('ca_report_daily_hint')}
              </CaProse>
              <DailyTable rows={analysis.daily} />
            </article>

            {/* §6 + §7 — Conclusiones y recomendaciones */}
            <article
              data-ca-pdf-section="conclusions"
              className="ca-pdf-section px-6 py-5 border border-gray-200 rounded-lg mb-4 bg-white"
            >
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSectionTitle n="6" title={t('ca_report_pdf_s6_title')} />
              <CaProse>
                {t('ca_report_pdf_s6_1', {
                  total: String(analysis.summary.totalPoints),
                  days: String(analysis.summary.daysAnalyzed),
                  co2: String(analysis.summary.co2GlobalInRangePct ?? '—'),
                  o2: String(analysis.summary.o2GlobalInRangePct ?? '—'),
                  eth: String(analysis.summary.ethyleneGlobalInRangePct ?? '—'),
                  temp: String(analysis.summary.tempGlobalInRangePct ?? '—'),
                })}
              </CaProse>
              <CaProse>
                {analysis.summary.daysInRange === analysis.summary.daysAnalyzed && analysis.summary.daysAnalyzed > 0
                  ? t('ca_report_pdf_s6_2_ok')
                  : t('ca_report_pdf_s6_2_partial', {
                      ok: String(analysis.summary.daysInRange),
                      total: String(analysis.summary.daysAnalyzed),
                    })}
              </CaProse>

              <CaSectionTitle n="7" title={t('ca_report_pdf_s7_title')} />
              <CaBulletList
                items={[
                  t('ca_report_pdf_rec_1'),
                  t('ca_report_pdf_rec_2'),
                  t('ca_report_pdf_rec_3'),
                  t('ca_report_pdf_rec_4'),
                ]}
              />
              <p className="text-[10px] text-gray-500 mt-4 border-t border-gray-200 pt-2">
                {formatDateTime(new Date().toISOString())} · {t('integral_report_field_imei')}: {deviceId}
              </p>
            </article>
          </div>
        )}

        {!isLoading && !error && deviceId && startedAtIso && data && !analysis && (
          <p className="text-sm text-gray-500 py-6 text-center">{t('integral_report_no_series')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
