import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  DialogTitle,
} from '@/app/components/ui/dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import { formatUiDecimal } from '@/app/lib/formatUiNumber';
import { fetchMaduradorRangoHistoryForImei } from '@/app/lib/madurador';
import {
  apiFileUrl,
  fetchRipeningFileBlob,
  type RipeningProcessDocument,
  type RipeningProcessRow,
} from '@/app/lib/ripeningProcessesApi';
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
import { mergeCaReportWithAttachmentPdfs, triggerPdfDownload } from '@/app/lib/caReportPdfMerge';
import {
  formatDocumentBytes,
  isImageDocument,
  isPdfDocument,
} from '@/app/lib/ripeningProcessDocuments';
import {
  buildDomSectionsPdfBytes,
  collectDomPdfSections,
  PDF_A4_CONTENT_WIDTH_PX,
} from '@/app/lib/reportPdfExport';
import { CA_PDF_PAGE_CONTENT_HEIGHT_PX, chunkDailyRowsForPdf } from '@/app/lib/caReportPdfLayout';
import { isPruebaCaMonitoringDevice } from '@/app/lib/pruebaCaMonitoringOverrides';

const CA_PDF_SECTION_ATTR = 'data-ca-pdf-section';
const CA_PDF_WIDTH_PX = PDF_A4_CONTENT_WIDTH_PX;
const ZTRACK_LOGO_SRC = `${import.meta.env.BASE_URL}ztrack-logo.png`;
const CA_HEADER_LOGO_HEIGHT_PX = 36;

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

async function waitForImagesInRoot(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        })
    )
  );
}

const CA_FONT = 'Arial, Helvetica, sans-serif';

function CaPdfHeader({ deviceId, t }: { deviceId: string; t: (k: string) => string }) {
  return (
    <table
      style={{
        width: '100%',
        fontFamily: CA_FONT,
        fontSize: '11px',
        borderCollapse: 'collapse',
        borderBottom: '1px solid #6b7280',
        marginBottom: '16px',
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              width: '130px',
              paddingBottom: '8px',
              paddingRight: '12px',
              verticalAlign: 'middle',
            }}
          >
            <img
              src={ZTRACK_LOGO_SRC}
              alt="ZTRACK"
              style={{
                display: 'block',
                height: `${CA_HEADER_LOGO_HEIGHT_PX}px`,
                width: 'auto',
                maxWidth: '120px',
                objectFit: 'contain',
              }}
            />
          </td>
          <td
            style={{
              paddingBottom: '8px',
              fontWeight: 600,
              color: '#1f2937',
              verticalAlign: 'middle',
            }}
          >
            ZGROUP PERU | {t('ca_report_pdf_doc_title')}
          </td>
          <td
            style={{
              paddingBottom: '8px',
              fontWeight: 600,
              color: '#1f2937',
              textAlign: 'right',
              verticalAlign: 'middle',
              whiteSpace: 'nowrap',
            }}
          >
            {t('ca_report_pdf_code')}: <span style={{ fontFamily: 'monospace' }}>{deviceId}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function CaPdfFooter({
  deviceId,
  generatedAt,
  pageNote,
  t,
}: {
  deviceId: string;
  generatedAt: string;
  pageNote?: string;
  t: (k: string, p?: Record<string, string>) => string;
}) {
  return (
    <div
      style={{
        marginTop: 'auto',
        paddingTop: '10px',
        borderTop: '1px solid #cbd5e1',
        fontFamily: CA_FONT,
        fontSize: '10px',
        color: '#6b7280',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'bottom' }}>
              {t('ca_report_pdf_footer_generated')}: {generatedAt} · {t('integral_report_field_imei')}:{' '}
              {deviceId}
            </td>
            {pageNote ? (
              <td style={{ textAlign: 'right', verticalAlign: 'bottom', whiteSpace: 'nowrap' }}>
                {pageNote}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CaPdfSection({
  section,
  children,
  fillPage = false,
}: {
  section: string;
  children: React.ReactNode;
  fillPage?: boolean;
}) {
  return (
    <div style={{ margin: '0 auto 20px', width: `${CA_PDF_WIDTH_PX}px`, maxWidth: '100%' }}>
      <article
        data-ca-pdf-section={section}
        style={{
          width: `${CA_PDF_WIDTH_PX}px`,
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '24px 28px',
          fontFamily: CA_FONT,
          backgroundColor: '#ffffff',
          color: '#111827',
          border: '1px solid #cbd5e1',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
          ...(fillPage
            ? {
                display: 'flex',
                flexDirection: 'column' as const,
                minHeight: `${CA_PDF_PAGE_CONTENT_HEIGHT_PX}px`,
              }
            : {}),
        }}
      >
        {children}
      </article>
    </div>
  );
}

function CaChartBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '240px', minHeight: '240px', overflow: 'hidden', margin: '12px 0' }}>
      {children}
    </div>
  );
}

function CaSectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <h2
      style={{
        fontFamily: CA_FONT,
        fontSize: '13px',
        fontWeight: 700,
        color: '#111827',
        margin: '16px 0 8px',
      }}
    >
      {n}. {title}
    </h2>
  );
}

function CaSubSectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <h3
      style={{
        fontFamily: CA_FONT,
        fontSize: '12px',
        fontWeight: 700,
        color: '#111827',
        margin: '12px 0 8px',
      }}
    >
      {n} {title}
    </h3>
  );
}

function CaProse({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: CA_FONT,
        fontSize: '11px',
        color: '#1f2937',
        lineHeight: 1.55,
        margin: '0 0 12px',
        textAlign: 'justify',
      }}
    >
      {children}
    </p>
  );
}

const COL_WIDTHS: Record<number, string[]> = {
  2: ['48%', '52%'],
  3: ['24%', '56%', '20%'],
  6: ['17%', '14%', '14%', '14%', '14%', '27%'],
};

function CaTechTable({
  headers,
  rows,
  compact = false,
}: {
  headers: string[];
  rows: string[][];
  compact?: boolean;
}) {
  const cols = headers.length;
  const fs = compact ? '10px' : '11px';
  const colWidths = COL_WIDTHS[cols] ?? headers.map(() => `${Math.floor(100 / cols)}%`);
  return (
    <table
      style={{
        fontFamily: CA_FONT,
        fontSize: fs,
        tableLayout: 'fixed',
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '16px',
      }}
    >
      <colgroup>
        {colWidths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              style={{
                textAlign: 'left',
                fontWeight: 600,
                color: '#111827',
                padding: '6px 6px 6px 0',
                verticalAlign: 'bottom',
                wordBreak: 'break-word',
                borderBottom: '1px solid #6b7280',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.slice(0, cols).map((cell, j) => (
              <td
                key={j}
                style={{
                  padding: '6px 6px 6px 0',
                  verticalAlign: 'top',
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                  fontWeight: j === 0 ? 600 : 400,
                  color: '#111827',
                  borderBottom: '1px solid #e5e7eb',
                }}
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
      style={{
        fontFamily: CA_FONT,
        fontSize: '11px',
        color: '#1f2937',
        lineHeight: 1.55,
        margin: '0 0 12px',
        paddingLeft: '20px',
        listStyleType: 'disc',
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '4px' }}>
          {item}
        </li>
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
      compact
      headers={[t('ca_report_day'), 'CO₂', 'O₂', t('ethylene'), t('ca_report_return_air'), t('ca_report_day_status')]}
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
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const processDocuments = useMemo((): RipeningProcessDocument[] => {
    const raw = (view._row as RipeningProcessRow | undefined)?.payload?.processDocuments;
    return Array.isArray(raw) ? raw : [];
  }, [view._row]);

  const imageDocuments = useMemo(
    () => processDocuments.filter(isImageDocument),
    [processDocuments]
  );

  useEffect(() => {
    if (!open || !imageDocuments.length) {
      setImageUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const doc of imageDocuments) {
        try {
          const blob = await fetchRipeningFileBlob(apiFileUrl(doc.apiPath));
          next[doc.id] = URL.createObjectURL(blob);
        } catch {
          /* omit broken image */
        }
      }
      if (!cancelled) {
        setImageUrls((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
          return next;
        });
      } else {
        Object.values(next).forEach((u) => URL.revokeObjectURL(u));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, imageDocuments]);

  useEffect(() => {
    if (open) return;
    setImageUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return {};
    });
  }, [open]);

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

  const dailyChunks = useMemo(
    () => (analysis ? chunkDailyRowsForPdf(analysis.daily) : []),
    [analysis]
  );

  const handleDownloadPdf = useCallback(async () => {
    if (!analysis) return;
    setPdfBusy(true);
    toast.info(t('ca_report_pdf_generating'));
    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });
    await new Promise((r) => setTimeout(r, 400));
    try {
      const root = printRef.current;
      if (!root) {
        toast.error(t('ca_report_pdf_error'));
        return;
      }
      await waitForImagesInRoot(root);
      window.dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 150));
      const sections = collectDomPdfSections(root, CA_PDF_SECTION_ATTR);
      const filename = `informe_ca_${deviceId}_${formatFileTimestamp()}.pdf`;
      let pdfBytes = await buildDomSectionsPdfBytes({
        root,
        sectionAttr: CA_PDF_SECTION_ATTR,
        sections,
        marginMm: 15,
        scale: 2,
        captureWidthPx: CA_PDF_WIDTH_PX,
        preserveSourceStyles: true,
      });
      pdfBytes = await mergeCaReportWithAttachmentPdfs(pdfBytes, processDocuments);
      triggerPdfDownload(pdfBytes, filename);
      toast.success(t('ca_report_pdf_success'));
    } catch (e) {
      console.error(e);
      toast.error(t('ca_report_pdf_error'));
    } finally {
      setPdfBusy(false);
    }
  }, [analysis, deviceId, formatFileTimestamp, processDocuments, t]);

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
      <DialogContent className="!max-w-[98vw] !w-[98vw] h-[96vh] !max-h-[96vh] flex flex-col gap-0 p-0 overflow-hidden">
        <div className="shrink-0 flex flex-row items-start justify-between gap-3 border-b border-border px-5 py-4 pr-14">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-lg text-left">
              <Atom className="w-5 h-5 text-teal-700 shrink-0" />
              {t('ca_report_title')}
            </DialogTitle>
            <DialogDescription className="text-left mt-1">{t('ca_report_desc')}</DialogDescription>
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
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-300/40 px-3 py-5 sm:px-6">
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
            style={{
              width: `${CA_PDF_WIDTH_PX}px`,
              margin: '0 auto',
              fontFamily: CA_FONT,
            }}
          >
            {/* §1 + §2 — Intro y variables */}
            <CaPdfSection section="intro">
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
              {analysis.prueba && <CaProse>{t('ca_report_prueba_note')}</CaProse>}

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
            </CaPdfSection>

            {/* §3 — Resumen KPI */}
            <CaPdfSection section="summary">
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
            </CaPdfSection>

            {/* §4.1 — Gases */}
            <CaPdfSection section="gases">
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSectionTitle n="4" title={t('ca_report_pdf_s4_title')} />
              <CaSubSectionTitle n="4.1" title={t('ca_report_pdf_s41_title')} />
              <CaProse>{t('ca_report_pdf_s41_intro')}</CaProse>
              <CaChartBox>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.gasRows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="tick" fontSize={9} tickLine={false} interval="preserveStartEnd" stroke="#374151" />
                    <YAxis yAxisId="pct" domain={[0, 'auto']} fontSize={9} tickFormatter={(v) => formatUiDecimal(Number(v))} stroke="#374151" width={36} />
                    <YAxis yAxisId="ppm" orientation="right" domain={ethDomain} fontSize={9} tickFormatter={(v) => formatUiDecimal(Number(v))} stroke="#374151" width={40} />
                    <Tooltip formatter={(v: number | string) => formatUiDecimal(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                    <Line yAxisId="pct" type="monotone" dataKey="co2" name="CO₂ (%)" stroke="#475569" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="pct" type="monotone" dataKey="o2" name="O₂ (%)" stroke="#0284c7" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="ppm" type="monotone" dataKey="ethylene" name={`${t('ethylene')} (ppm)`} stroke="#7c3aed" dot={false} strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </CaChartBox>
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
            </CaPdfSection>

            {/* §4.2 — Temperatura */}
            <CaPdfSection section="temperature">
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSubSectionTitle n="4.2" title={t('ca_report_pdf_s42_title')} />
              <CaProse>{t('ca_report_pdf_s42_intro')}</CaProse>
              <CaChartBox>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.tempRows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="tick" fontSize={9} tickLine={false} interval="preserveStartEnd" stroke="#374151" />
                    <YAxis domain={tempUnit === 'F' ? [32, 86] : [0, 30]} fontSize={9} tickFormatter={(v) => formatUiDecimal(Number(v))} stroke="#374151" width={36} />
                    <Tooltip formatter={(v: number | string) => formatUiDecimal(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                    <Line type="monotone" dataKey="temp" name={t('ca_report_return_air')} stroke="#dc2626" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="setpoint" name={t('ca_report_setpoint')} stroke="#94a3b8" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </CaChartBox>
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
            </CaPdfSection>

            {/* §5 — Análisis diario (paginado por bloques) */}
            {dailyChunks.length === 0 ? (
              <CaPdfSection section="daily-0" fillPage>
                <CaPdfHeader deviceId={deviceId} t={t} />
                <CaSectionTitle n="5" title={t('ca_report_pdf_s5_title')} />
                <CaProse>{t('ca_report_no_daily')}</CaProse>
                <CaPdfFooter
                  deviceId={deviceId}
                  generatedAt={formatDateTime(new Date().toISOString())}
                  t={t}
                />
              </CaPdfSection>
            ) : (
              dailyChunks.map((chunk, idx) => (
                <CaPdfSection key={`daily-${idx}`} section={`daily-${idx}`} fillPage>
                  <CaPdfHeader deviceId={deviceId} t={t} />
                  {idx === 0 ? (
                    <>
                      <CaSectionTitle n="5" title={t('ca_report_pdf_s5_title')} />
                      <CaProse>
                        {t('ca_report_daily_summary', {
                          ok: String(analysis.summary.daysInRange),
                          total: String(analysis.summary.daysAnalyzed),
                        })}
                        {' '}
                        {t('ca_report_daily_hint')}
                      </CaProse>
                    </>
                  ) : (
                    <>
                      <CaSubSectionTitle
                        n="5"
                        title={`${t('ca_report_pdf_s5_title')} — ${t('ca_report_pdf_continued')}`}
                      />
                      <CaProse>{t('ca_report_pdf_s5_continued_note')}</CaProse>
                    </>
                  )}
                  <DailyTable rows={chunk} />
                  <CaPdfFooter
                    deviceId={deviceId}
                    generatedAt={formatDateTime(new Date().toISOString())}
                    t={t}
                    pageNote={
                      dailyChunks.length > 1
                        ? t('ca_report_pdf_page_of', {
                            current: String(idx + 1),
                            total: String(dailyChunks.length),
                          })
                        : undefined
                    }
                  />
                </CaPdfSection>
              ))
            )}

            {/* §6 + §7 — Conclusiones */}
            <CaPdfSection section="conclusions">
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
              <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
                {formatDateTime(new Date().toISOString())} · {t('integral_report_field_imei')}: {deviceId}
              </p>
            </CaPdfSection>

            {/* §8 — Anexos documentales */}
            <CaPdfSection section="attachments">
              <CaPdfHeader deviceId={deviceId} t={t} />
              <CaSectionTitle n="8" title={t('ca_report_pdf_s8_title')} />
              <CaProse>{t('ca_report_pdf_s8_intro')}</CaProse>
              {processDocuments.length === 0 ? (
                <CaProse>{t('ca_report_pdf_no_attachments')}</CaProse>
              ) : (
                <CaTechTable
                  headers={[
                    t('ca_report_pdf_att_desc'),
                    t('ca_report_pdf_att_file'),
                    t('ca_report_pdf_att_type'),
                  ]}
                  rows={processDocuments.map((doc) => [
                    [doc.description || '—', doc.observations || ''].filter(Boolean).join('\n'),
                    doc.name,
                    isPdfDocument(doc)
                      ? t('ca_report_pdf_att_type_pdf')
                      : isImageDocument(doc)
                        ? t('ca_report_pdf_att_type_image')
                        : t('ca_report_pdf_att_type_other'),
                  ])}
                />
              )}
              {processDocuments.some(isPdfDocument) && (
                <CaProse>{t('ca_report_pdf_s8_pdf_note')}</CaProse>
              )}
            </CaPdfSection>

            {imageDocuments.map((doc, idx) =>
              imageUrls[doc.id] ? (
                <CaPdfSection key={doc.id} section={`attachment-image-${doc.id}`}>
                  <CaPdfHeader deviceId={deviceId} t={t} />
                  <CaSubSectionTitle
                    n={`8.${idx + 1}`}
                    title={doc.description || doc.name || t('ca_report_pdf_att_image')}
                  />
                  {doc.observations && <CaProse>{doc.observations}</CaProse>}
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <img
                      src={imageUrls[doc.id]}
                      alt={doc.description || doc.name}
                      crossOrigin="anonymous"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '520px',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        border: '1px solid #e5e7eb',
                      }}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: '10px',
                      color: '#6b7280',
                      marginTop: '8px',
                      textAlign: 'center',
                    }}
                  >
                    {doc.name} · {formatDocumentBytes(doc.size)}
                  </p>
                </CaPdfSection>
              ) : null
            )}
          </div>
        )}

        {!isLoading && !error && deviceId && startedAtIso && data && !analysis && (
          <p className="text-sm text-gray-500 py-6 text-center">{t('integral_report_no_series')}</p>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
