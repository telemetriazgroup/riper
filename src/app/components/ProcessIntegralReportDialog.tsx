import React, { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, FileBarChart2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/Button';
import { AuthedImage } from '@/app/components/AuthedImage';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useSettings } from '@/app/contexts/SettingsContext';
import { formatUiDecimal, formatUiPercent } from '@/app/lib/formatUiNumber';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { fetchMaduradorRangoHistoryForImei } from '@/app/lib/madurador';
import {
  buildPhaseScheduleForModal,
  payloadForRecipeModal,
} from '@/app/lib/ripeningProcessMappers';
import {
  buildParameterEvolutionSeries,
  getSamplingEventsChronological,
  hasAnyChartPoint,
  type ProcessView,
} from '@/app/lib/ripeningProcessReport';
import {
  averageAvlRaw,
  buildPhaseTimeWindows,
  computeTempHumidityStats,
  cumulativeCo2WeightedVentilation,
  deltaFirstLast,
  filterHistoryPointsInRange,
  filterRawDatosInRange,
  numFromPhase,
  processReportRangeEndMs,
  yDomainPadded,
  type PhaseTimeWindow,
} from '@/app/lib/trackingIntegralReport';
import { CHART_ETHYLENE_MAX_PPM } from '@/app/lib/historySeriesSanitize';
import {
  cumulativeVentilationFt3FromRawRows,
  energyKwhDeltaFromPoints,
  ft3ToM3,
} from '@/app/lib/deviceMonitoringMetrics';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ProcessView;
};

function trackingStatusLabel(status: string, t: (k: string) => string) {
  const s = String(status || '').toLowerCase();
  if (s === 'cancelled') return t('status_ripening_cancelled');
  if (s === 'completed') return t('status_ripening_completed');
  if (s === 'paused') return t('status_ripening_paused');
  if (s === 'active') return t('in_process');
  return status || '—';
}

function IntegralTrackingSummary({
  view,
  deviceId,
  t,
  formatDateTime,
}: {
  view: ProcessView;
  deviceId: string;
  t: (k: string, opts?: Record<string, string | number>) => string;
  formatDateTime: (input: string | number | Date | null | undefined, withSeconds?: boolean) => string;
}) {
  const sched = view.scheduleSummary as {
    startedAt?: string;
    estimatedEndAt?: string | null;
    totalDurationHours?: number | string;
  } | undefined;
  const clientName =
    view.client && typeof view.client === 'object' && 'name' in view.client
      ? String((view.client as { name?: string }).name ?? '').trim()
      : '';
  const sup = view.supervisor;
  const supLine =
    sup?.name != null ? [String(sup.name), sup.email ? String(sup.email) : ''].filter(Boolean).join(' · ') : '—';
  const started = sched?.startedAt ? formatDateTime(sched.startedAt) : '—';
  const estEnd = sched?.estimatedEndAt ? formatDateTime(sched.estimatedEndAt) : '—';
  const totalH =
    sched?.totalDurationHours != null && Number(sched.totalDurationHours) > 0
      ? Number(sched.totalDurationHours)
      : Number(view.recipe?.duration_hours) || 0;
  const targets = view.recipe?.targets;
  const fruit = view.recipe?.fruit;
  const qty = view.batch?.quantity_kg;

  const rows: { label: string; value: string }[] = [
    { label: t('integral_report_field_process_id'), value: view.id ? String(view.id) : '—' },
  ];
  if (view.display_name) {
    rows.push({ label: t('process_display_name'), value: String(view.display_name) });
  }
  rows.push(
    { label: t('detail_tracking_client'), value: clientName || '—' },
    { label: t('detail_tracking_product'), value: String(view.batch?.product ?? '—') },
    { label: t('lot_origin'), value: String(view.batch?.origin ?? '—') },
    { label: t('detail_tracking_recipe'), value: String(view.recipe?.name ?? '—') }
  );
  if (fruit) {
    rows.push({ label: t('recipe_modal_product'), value: String(fruit) });
  }
  if (qty != null && String(qty).trim() !== '') {
    rows.push({ label: t('quantity_kg'), value: String(qty) });
  }
  rows.push(
    {
      label: t('detail_tracking_targets'),
      value: targets
        ? `Brix ${targets.brix} · ${t('detail_tracking_firmness_short')} ${targets.firmness} · ${t('detail_tracking_color_short')} ${targets.color}`
        : '—',
    },
    { label: t('detail_tracking_progress'), value: `${view.progress ?? 0}%` },
    { label: t('detail_tracking_phase_now'), value: String(view.phase ?? '—') },
    { label: t('integral_report_field_status'), value: trackingStatusLabel(String(view.status ?? ''), t) },
    { label: t('field_supervisor'), value: supLine },
    { label: t('integral_report_field_imei'), value: deviceId || '—' },
    { label: t('integral_report_plan_start'), value: started },
    { label: t('integral_report_plan_end'), value: estEnd },
    {
      label: t('detail_tracking_total_hours'),
      value: totalH > 0 ? `${totalH} h` : '—',
    }
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">
        {t('integral_report_tracking_summary')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map((row, i) => (
          <div
            key={`${row.label}-${i}`}
            className="flex flex-col sm:flex-row sm:gap-2 border-b border-gray-100 pb-1.5 sm:border-0 sm:pb-0"
          >
            <span className="text-gray-500 shrink-0 sm:w-[40%]">{row.label}</span>
            <span className="font-medium text-gray-900 break-words">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** html2canvas no parsea oklch/lab; Tailwind v4 los usa en hojas de estilo. */
function resolveCssColorForCanvas(value: string, mode: 'color' | 'background'): string {
  const v = value.trim();
  if (!v || !/oklch|lch\(|lab\(/i.test(v)) return v;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
  if (mode === 'background') probe.style.background = v;
  else probe.style.color = v;
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = mode === 'background' ? cs.backgroundColor : cs.color;
  probe.remove();
  if (out && !/oklch|lch\(|lab\(/i.test(out)) return out;
  return mode === 'background' ? '#ffffff' : '#111827';
}

const PDF_INLINE_PROPS: string[] = [
  'color',
  'background-color',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'outline',
  'outline-color',
  'box-shadow',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'text-align',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'display',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-content',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'overflow',
  'opacity',
  'visibility',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'z-index',
  'box-sizing',
  'white-space',
  'text-decoration',
  'text-decoration-color',
  'vertical-align',
];

function stripUnsupportedPdfStylesFromClone(clonedDoc: Document) {
  clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
    n.parentNode?.removeChild(n);
  });
  try {
    (clonedDoc as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets = [];
  } catch {
    /* ignore */
  }
}

/**
 * html2canvas copia computed styles a inline (`copyCSSStyles`) antes de onclone; incluye propiedades
 * con oklch que su parser no entiende. Resuelve o elimina cualquier declaración oklch/lab/lch.
 */
function resolveCssValueWithProbe(prop: string, val: string): string {
  const v = val.trim();
  if (!v || !/oklch|lch\(|lab\(/i.test(v)) return v;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;left:-9999px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none;opacity:0;';
  try {
    probe.style.setProperty(prop, v);
  } catch {
    probe.remove();
    return '';
  }
  document.body.appendChild(probe);
  let resolved = '';
  try {
    resolved = getComputedStyle(probe).getPropertyValue(prop).trim();
  } finally {
    probe.remove();
  }
  if (resolved && !/oklch|lch\(|lab\(/i.test(resolved)) return resolved;
  if (/shadow/i.test(prop)) return 'none';
  if (
    /color|fill|stroke|stop/i.test(prop) ||
    prop === 'background-color' ||
    prop === 'outline-color' ||
    prop === 'caret-color' ||
    prop === 'accent-color'
  ) {
    return '#111827';
  }
  return '';
}

function sanitizeHtml2CanvasCopiedStylesInSubtree(root: HTMLElement) {
  const nodes: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const node of nodes) {
    if (node instanceof HTMLElement) {
      node.removeAttribute('class');
      const props = new Set<string>();
      for (let i = 0; i < node.style.length; i++) {
        props.add(node.style.item(i));
      }
      for (const prop of props) {
        const val = node.style.getPropertyValue(prop).trim();
        if (!val || !/oklch|lch\(|lab\(/i.test(val)) continue;
        const fixed = resolveCssValueWithProbe(prop, val);
        if (fixed && !/oklch|lch\(|lab\(/i.test(fixed)) {
          node.style.setProperty(prop, fixed);
        } else {
          node.style.removeProperty(prop);
        }
      }
    }
    if (node instanceof SVGElement) {
      node.removeAttribute('class');
      for (const attr of ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'] as const) {
        const v = node.getAttribute(attr);
        if (v && /oklch|lch\(|lab\(/i.test(v)) {
          node.setAttribute(attr, resolveCssColorForCanvas(v, 'color'));
        }
      }
      const st = node.getAttribute('style');
      if (st && /oklch|lch\(|lab\(/i.test(st)) {
        const kept = st
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((decl) => !/oklch|lch\(|lab\(/i.test(decl));
        if (kept.length) node.setAttribute('style', kept.join('; '));
        else node.removeAttribute('style');
      }
    }
  }
}

function inlinePdfCloneStyles(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const maybeSanitize = (prop: string, val: string): string => {
    if (!/oklch|lch\(|lab\(/i.test(val)) return val;
    if (
      prop === 'border' ||
      prop === 'outline' ||
      prop === 'box-shadow' ||
      (prop.startsWith('border-') && !prop.includes('radius'))
    ) {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
      try {
        probe.style.setProperty(prop, val);
      } catch {
        return val;
      }
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).getPropertyValue(prop);
      probe.remove();
      if (resolved && !/oklch|lch\(|lab\(/i.test(resolved)) return resolved.trim();
    }
    const colorish =
      prop.includes('color') ||
      prop === 'text-decoration' ||
      prop === 'text-decoration-color';
    if (!colorish) return val;
    if (prop === 'background-color') return resolveCssColorForCanvas(val, 'background');
    return resolveCssColorForCanvas(val, 'color');
  };

  const walk = (src: Element, dst: Element) => {
    if (src instanceof HTMLElement && dst instanceof HTMLElement) {
      dst.removeAttribute('class');
      const cs = window.getComputedStyle(src);
      for (const prop of PDF_INLINE_PROPS) {
        let val = cs.getPropertyValue(prop).trim();
        if (!val) continue;
        val = maybeSanitize(prop, val);
        try {
          dst.style.setProperty(prop, val);
        } catch {
          /* ignore */
        }
      }
    } else if (src instanceof SVGElement && dst instanceof SVGElement) {
      dst.removeAttribute('class');
      try {
        const cs = window.getComputedStyle(src);
        const fill = cs.getPropertyValue('fill').trim();
        const stroke = cs.getPropertyValue('stroke').trim();
        if (fill && fill !== 'none') {
          dst.setAttribute('fill', /oklch|lch\(|lab\(/i.test(fill) ? resolveCssColorForCanvas(fill, 'color') : fill);
        }
        if (stroke && stroke !== 'none') {
          dst.setAttribute(
            'stroke',
            /oklch|lch\(|lab\(/i.test(stroke) ? resolveCssColorForCanvas(stroke, 'color') : stroke
          );
        }
      } catch {
        /* ignore */
      }
    }

    const sc = Array.from(src.children);
    const dc = Array.from(dst.children);
    for (let i = 0; i < Math.min(sc.length, dc.length); i++) {
      walk(sc[i]!, dc[i]!);
    }
  };

  walk(sourceRoot, cloneRoot);
}

function appendCanvasToPdfMultiPage(pdf: jsPDF, canvas: HTMLCanvasElement, marginMm: number): void {
  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const pageInnerH = pdfH - 2 * marginMm;
  const imgW = pdfW - 2 * marginMm;
  const imgH = (canvas.height * imgW) / canvas.width;
  let heightLeft = imgH;
  pdf.addImage(imgData, 'PNG', marginMm, marginMm, imgW, imgH);
  heightLeft -= pageInnerH;
  while (heightLeft > 0) {
    const y = marginMm - (imgH - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', marginMm, y, imgW, imgH);
    heightLeft -= pageInnerH;
  }
}

function chartTick(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return ts;
  }
}

function resolveEvidencePhoto(img: { url?: string; desc?: string }): {
  alt: string;
  apiPath: string | null;
  directSrc: string | null;
} {
  const alt = (img.desc && String(img.desc).trim()) || 'evidence';
  const raw = img.url != null ? String(img.url) : '';
  if (!raw) return { alt, apiPath: null, directSrc: null };
  if (raw.includes('/ripening-processes/')) {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        return { alt, apiPath: new URL(raw).pathname, directSrc: null };
      } catch {
        return { alt, apiPath: raw, directSrc: null };
      }
    }
    return { alt, apiPath: raw, directSrc: null };
  }
  return { alt, apiPath: null, directSrc: raw };
}

function TempRhDualChart({
  rows,
  t,
  tempLabel,
  rhLabel,
  tempDomain: tempDomainFixed,
  rhDomain: rhDomainFixed,
}: {
  rows: { tick: string; temp: number; rh: number }[];
  t: (k: string) => string;
  tempLabel: string;
  rhLabel: string;
  /** Informe integral: eje temperatura fijo (p. ej. 0–30 °C). */
  tempDomain?: [number, number];
  /** Informe integral: eje humedad fijo 0–100 %. */
  rhDomain?: [number, number];
}) {
  if (!rows.length) return <p className="text-sm text-gray-500 py-4">{t('integral_report_no_series')}</p>;
  const tDom: [number, number] =
    tempDomainFixed ?? ([...yDomainPadded(rows.map((r) => r.temp))] as [number, number]);
  const hDom: [number, number] =
    rhDomainFixed ?? ([...yDomainPadded(rows.map((r) => r.rh))] as [number, number]);
  const decUi = (v: number) => formatUiDecimal(v);
  return (
    <div className="h-64 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="tick" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            yAxisId="temp"
            domain={tDom}
            tick={{ fontSize: 10, fill: '#fca5a5' }}
            tickFormatter={decUi}
            width={44}
            label={{ value: tempLabel, angle: -90, position: 'insideLeft', fill: '#fca5a5', fontSize: 10 }}
          />
          <YAxis
            yAxisId="rh"
            orientation="right"
            domain={hDom}
            tick={{ fontSize: 10, fill: '#c4b5fd' }}
            tickFormatter={decUi}
            width={44}
            label={{ value: rhLabel, angle: 90, position: 'insideRight', fill: '#c4b5fd', fontSize: 10 }}
          />
          <Tooltip formatter={(v: number | string) => decUi(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temp"
            name={tempLabel}
            stroke="#fca5a5"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="rh"
            type="monotone"
            dataKey="rh"
            name={rhLabel}
            stroke="#c4b5fd"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function GasDualChart({
  rows,
  t,
  co2Domain = [0, 5],
  ethDomain = [0, CHART_ETHYLENE_MAX_PPM],
}: {
  rows: { tick: string; co2: number; eth: number | null }[];
  t: (k: string) => string;
  co2Domain?: [number, number];
  ethDomain?: [number, number];
}) {
  if (!rows.length) return <p className="text-sm text-gray-500 py-4">{t('integral_report_no_series')}</p>;
  const decUi = (v: number) => formatUiDecimal(v);
  return (
    <div className="h-64 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="tick" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            yAxisId="co2"
            domain={co2Domain}
            tick={{ fontSize: 10 }}
            width={40}
            tickFormatter={decUi}
            label={{ value: 'CO₂ %', angle: -90, position: 'insideLeft', fontSize: 10 }}
          />
          <YAxis
            yAxisId="eth"
            orientation="right"
            domain={ethDomain}
            tick={{ fontSize: 10 }}
            width={44}
            tickFormatter={decUi}
            label={{
              value: `${t('integral_report_ethylene_axis')} (ppm)`,
              angle: 90,
              position: 'insideRight',
              fontSize: 9,
            }}
          />
          <Tooltip formatter={(v: number | string | null) => (v == null ? '—' : decUi(Number(v)))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="co2"
            type="monotone"
            dataKey="co2"
            name="CO₂ %"
            stroke="#57534e"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="eth"
            type="monotone"
            dataKey="eth"
            name={t('integral_report_ethylene_axis')}
            stroke="#ea580c"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CargoCoolingChart({
  rows,
  t,
}: {
  rows: {
    tick: string;
    c1: number | null;
    c2: number | null;
    c3: number | null;
    c4: number | null;
  }[];
  t: (k: string) => string;
}) {
  if (!rows.length) return <p className="text-sm text-gray-500 py-4">{t('integral_report_no_series')}</p>;
  const all = rows.flatMap((r) => [r.c1, r.c2, r.c3, r.c4]);
  const dom = yDomainPadded(all);
  return (
    <div className="h-72 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="tick" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={dom} tick={{ fontSize: 10 }} width={44} label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="c1" name={t('integral_report_sensor_n', { n: '1' })} stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="c2" name={t('integral_report_sensor_n', { n: '2' })} stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="c3" name={t('integral_report_sensor_n', { n: '3' })} stroke="#a855f7" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="c4" name={t('integral_report_sensor_n', { n: '4' })} stroke="#14b8a6" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-xs">
      {items.map((it) => (
        <div key={it.label} className="rounded-md border border-gray-100 bg-white px-2 py-1.5">
          <div className="text-gray-500">{it.label}</div>
          <div className="font-mono font-semibold text-gray-900">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export const ProcessIntegralReportDialog: React.FC<Props> = ({ open, onOpenChange, view }) => {
  const { t, formatDateTime, formatFileTimestamp, tempUnit, convertTemp, formatTemp } = useSettings();
  const integralReportTempDomain: [number, number] = tempUnit === 'F' ? [32, 86] : [0, 30];
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    const root = printRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll('[data-integral-pdf-section]')).filter(
      (n): n is HTMLElement => n instanceof HTMLElement
    );
    if (sections.length === 0) {
      toast.error(t('integral_report_pdf_error'));
      return;
    }
    setPdfBusy(true);
    toast.info(t('integral_report_pdf_generating'));
    await new Promise((r) => setTimeout(r, 450));
    const margin = 10;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      let firstSection = true;
      for (const section of sections) {
        const canvas = await html2canvas(section, {
          scale: 1.55,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: section.scrollWidth,
          windowHeight: section.scrollHeight,
          onclone: (clonedDoc, clonedEl) => {
            stripUnsupportedPdfStylesFromClone(clonedDoc);
            const cloneRoot =
              clonedEl instanceof HTMLElement
                ? clonedEl
                : (clonedDoc.querySelector('[data-integral-pdf-section]') as HTMLElement | null);
            if (cloneRoot instanceof HTMLElement) {
              inlinePdfCloneStyles(section, cloneRoot);
            }
            const host =
              cloneRoot instanceof HTMLElement
                ? cloneRoot
                : clonedDoc.documentElement instanceof HTMLElement
                  ? clonedDoc.documentElement
                  : (clonedDoc.body ?? undefined);
            if (host instanceof HTMLElement) {
              sanitizeHtml2CanvasCopiedStylesInSubtree(host);
            }
          },
        });
        if (!firstSection) pdf.addPage();
        firstSection = false;
        appendCanvasToPdfMultiPage(pdf, canvas, margin);
      }
      const idShort = view.id ? String(view.id).replace(/-/g, '').slice(0, 8) : 'report';
      pdf.save(`integral_${idShort}_${formatFileTimestamp()}.pdf`);
      toast.success(t('integral_report_pdf_success'));
    } catch (e) {
      console.error(e);
      toast.error(t('integral_report_pdf_error'));
    } finally {
      setPdfBusy(false);
    }
  }, [formatFileTimestamp, t, view.id]);

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

  const payload = useMemo(() => payloadForRecipeModal(view), [view]);
  const schedulePlan = useMemo(
    () => buildPhaseScheduleForModal(payload, t, { convertTemp, tempUnit }),
    [payload, t, convertTemp, tempUnit]
  );

  const enabledPhases = useMemo(() => {
    const raw = (view.recipe as { phases?: Record<string, unknown>[] })?.phases;
    return Array.isArray(raw) ? raw.filter((p) => p && (p as { enabled?: boolean }).enabled !== false) : [];
  }, [view.recipe]);

  const phaseWindows = useMemo(
    () => buildPhaseTimeWindows(schedulePlan.phases, enabledPhases, schedulePlan.startedAt),
    [schedulePlan.phases, schedulePlan.startedAt, enabledPhases]
  );

  const swrKey =
    open && deviceId && startedAtIso ? `integral-report:${deviceId}:${startedAtIso}:${rangeEndIso}` : null;

  const { data, error, isLoading } = useSWR(
    swrKey,
    async () =>
      fetchMaduradorRangoHistoryForImei(deviceId, {
        fecha_inicio: startedAtIso!,
        fecha_fin: rangeEndIso,
        maduradorAmericaLima: true,
        includeRawDatos: true,
      }),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  const points = data?.points ?? [];
  const rawDatos = data?.rawDatos ?? [];

  const evolution = useMemo(() => {
    const ev = getSamplingEventsChronological(view.timeline ?? []);
    return buildParameterEvolutionSeries(ev);
  }, [view.timeline]);

  const objectivesChart = hasAnyChartPoint(evolution);

  const renderPhaseChapter = (w: PhaseTimeWindow): React.ReactElement | React.ReactElement[] => {
    const slicePts = filterHistoryPointsInRange(points, w.startMs, w.endMs);
    const sliceRaw = filterRawDatosInRange(rawDatos, w.startMs, w.endMs);
    const typ = w.type.toLowerCase();

    const tempSp = numFromPhase(w.rawPhase, 'temp');
    const humSp = numFromPhase(w.rawPhase, 'humidity');

    const phaseSectionHeading = (headingText: string) => (
      <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1 mt-0">
        {w.order}. {headingText}{' '}
        <span className="font-normal text-gray-500 text-xs">
          ({formatDateTime(new Date(w.startMs).toISOString())} → {formatDateTime(new Date(w.endMs).toISOString())})
        </span>
      </h3>
    );

    if (typ === 'homogenization') {
      const stats = computeTempHumidityStats(slicePts, tempSp, humSp);
      const rows = slicePts.map((p) => ({
        tick: chartTick(p.timestamp),
        temp: convertTemp(p.return_air),
        rh: p.relative_humidity,
      }));
      return (
        <div
          key={`${w.order}-hom`}
          data-integral-pdf-section={`phase-${w.order}-homogenization`}
          className="integral-pdf-section space-y-3 rounded-lg border border-gray-100 bg-white p-4 mb-6"
        >
          {phaseSectionHeading(t('integral_report_pdf_phase_homogenization_heading'))}
          <TempRhDualChart
            rows={rows}
            t={t}
            tempLabel={`${t('detail_monitoring_pulp')} (°${tempUnit})`}
            rhLabel={`${t('relative_humidity')} (%)`}
            tempDomain={integralReportTempDomain}
            rhDomain={[0, 100]}
          />
          <StatGrid
            items={[
              { label: t('integral_report_avg_temp'), value: stats.avgTemp != null ? formatTemp(stats.avgTemp) : '—' },
              { label: t('integral_report_min_temp'), value: stats.minTemp != null ? formatTemp(stats.minTemp) : '—' },
              { label: t('integral_report_max_temp'), value: stats.maxTemp != null ? formatTemp(stats.maxTemp) : '—' },
              { label: t('integral_report_avg_rh'), value: stats.avgRh != null ? formatUiPercent(stats.avgRh) : '—' },
              { label: t('integral_report_min_rh'), value: stats.minRh != null ? formatUiPercent(stats.minRh) : '—' },
              { label: t('integral_report_max_rh'), value: stats.maxRh != null ? formatUiPercent(stats.maxRh) : '—' },
              {
                label: t('integral_report_minutes_to_setpoint'),
                value: stats.minutesToSetpoint != null ? `${Math.round(stats.minutesToSetpoint)} min` : '—',
              },
            ]}
          />
          {stats.setpointReached && (
            <p className="mt-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {t('integral_report_setpoint_ok')}
            </p>
          )}
        </div>
      );
    }

    if (typ === 'ripening') {
      const statsTh = computeTempHumidityStats(slicePts, tempSp, humSp);
      const rowsTh = slicePts.map((p) => ({
        tick: chartTick(p.timestamp),
        temp: convertTemp(p.return_air),
        rh: p.relative_humidity,
      }));
      const ft3 = cumulativeVentilationFt3FromRawRows(sliceRaw);
      const m3v = ft3ToM3(ft3);
      const co2W = cumulativeCo2WeightedVentilation(sliceRaw);
      const kwh = energyKwhDeltaFromPoints(slicePts);
      const gasRows = slicePts.map((p) => {
        const rawEth = p.ethylene != null ? Number(p.ethylene) : null;
        const eth =
          rawEth != null && Number.isFinite(rawEth) && rawEth <= CHART_ETHYLENE_MAX_PPM ? rawEth : null;
        const cRaw = p.co2_reading != null ? Number(p.co2_reading) : null;
        return {
          tick: chartTick(p.timestamp),
          co2: cRaw != null && Number.isFinite(cRaw) && cRaw !== 0 ? cRaw : null,
          eth,
        };
      });

      return [
        <div
          key={`${w.order}-rip-env`}
          data-integral-pdf-section={`phase-${w.order}-ripening-env`}
          className="integral-pdf-section space-y-3 rounded-lg border border-gray-100 bg-white p-4 mb-6"
        >
          {phaseSectionHeading(t('integral_report_pdf_phase_ripening_env_heading'))}
          <h4 className="text-xs font-bold uppercase text-gray-600">{t('integral_report_ripening_env')}</h4>
          <TempRhDualChart
            rows={rowsTh}
            t={t}
            tempLabel={`${t('detail_monitoring_pulp')} (°${tempUnit})`}
            rhLabel={`${t('relative_humidity')} (%)`}
            tempDomain={integralReportTempDomain}
            rhDomain={[0, 100]}
          />
          <StatGrid
            items={[
              { label: t('integral_report_avg_temp'), value: statsTh.avgTemp != null ? formatTemp(statsTh.avgTemp) : '—' },
              { label: t('integral_report_avg_rh'), value: statsTh.avgRh != null ? formatUiPercent(statsTh.avgRh) : '—' },
              {
                label: t('integral_report_minutes_to_setpoint'),
                value: statsTh.minutesToSetpoint != null ? `${Math.round(statsTh.minutesToSetpoint)} min` : '—',
              },
            ]}
          />
          {statsTh.setpointReached && (
            <p className="mt-2 text-xs font-semibold text-emerald-700">{t('integral_report_setpoint_ok')}</p>
          )}
        </div>,
        <div
          key={`${w.order}-rip-gas`}
          data-integral-pdf-section={`phase-${w.order}-ripening-gases`}
          className="integral-pdf-section space-y-3 rounded-lg border border-gray-100 bg-white p-4 mb-6"
        >
          {phaseSectionHeading(t('integral_report_pdf_phase_ripening_gases_heading'))}
          <StatGrid
            items={[
              { label: t('integral_report_vent_ft3'), value: `${ft3.toFixed(0)} ft³` },
              { label: t('integral_report_vent_m3'), value: `${formatUiDecimal(m3v)} m³` },
              { label: t('integral_report_co2_weighted_vol'), value: formatUiDecimal(co2W) },
              { label: t('integral_report_energy_kwh'), value: kwh != null ? formatUiDecimal(kwh) : '—' },
              { label: t('integral_report_ethylene_injected'), value: t('integral_report_na_future') },
            ]}
          />
          <GasDualChart rows={gasRows} t={t} />
        </div>,
      ];
    }

    if (typ === 'venting') {
      const avgAvl = averageAvlRaw(sliceRaw);
      const dEth = deltaFirstLast(slicePts, 'ethylene');
      const dCo2 = deltaFirstLast(slicePts, 'co2_reading');
      return (
        <div
          key={`${w.order}-vent`}
          data-integral-pdf-section={`phase-${w.order}-venting`}
          className="integral-pdf-section space-y-3 rounded-lg border border-gray-100 bg-white p-4 mb-6"
        >
          {phaseSectionHeading(t('integral_report_pdf_phase_ventilation_heading'))}
          <StatGrid
            items={[
              { label: t('integral_report_avg_avl'), value: avgAvl != null ? `${formatUiDecimal(avgAvl)} CFM` : '—' },
              {
                label: t('integral_report_ethylene_drop'),
                value: dEth.delta != null ? formatUiDecimal(dEth.delta) : '—',
              },
              {
                label: t('integral_report_co2_drop'),
                value: dCo2.delta != null ? formatUiPercent(dCo2.delta) : '—',
              },
            ]}
          />
        </div>
      );
    }

    if (typ === 'cooling') {
      const rows = slicePts.map((p) => ({
        tick: chartTick(p.timestamp),
        c1: p.cargo_1_temp != null ? convertTemp(p.cargo_1_temp) : null,
        c2: p.cargo_2_temp != null ? convertTemp(p.cargo_2_temp) : null,
        c3: p.cargo_3_temp != null ? convertTemp(p.cargo_3_temp) : null,
        c4: p.cargo_4_temp != null ? convertTemp(p.cargo_4_temp) : null,
      }));
      const rowAvg = (row: (typeof rows)[0]) => {
        const v = [row.c1, row.c2, row.c3, row.c4].filter((x): x is number => x != null);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      const avgStart = rows.length ? rowAvg(rows[0]) : null;
      const avgEnd = rows.length ? rowAvg(rows[rows.length - 1]) : null;
      const deltaAvg = avgStart != null && avgEnd != null ? avgEnd - avgStart : null;

      return (
        <div
          key={`${w.order}-cool`}
          data-integral-pdf-section={`phase-${w.order}-cooling`}
          className="integral-pdf-section space-y-3 rounded-lg border border-gray-100 bg-white p-4 mb-6"
        >
          {phaseSectionHeading(t('integral_report_pdf_phase_cooling_heading'))}
          <CargoCoolingChart rows={rows} t={t} />
          <StatGrid
            items={[
              {
                label: t('integral_report_cooling_avg_change'),
                value: deltaAvg != null ? `${deltaAvg > 0 ? '+' : ''}${formatUiDecimal(deltaAvg)} °${tempUnit}` : '—',
              },
            ]}
          />
        </div>
      );
    }

    return (
      <div
        key={`${w.order}-oth`}
        data-integral-pdf-section={`phase-${w.order}-other`}
        className="integral-pdf-section space-y-3 rounded-lg border border-gray-100 bg-white p-4 mb-6"
      >
        {phaseSectionHeading(`${w.label} — ${t('integral_report_chapter_other')}`)}
        <p className="text-xs text-gray-500">{t('integral_report_phase_generic_hint')}</p>
      </div>
    );
  };

  const samplingChrono = getSamplingEventsChronological(view.timeline ?? []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[min(96vw,1280px)] max-h-[min(92vh,960px)] overflow-y-auto overflow-x-hidden text-gray-900 p-6">
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pr-8">
            <div className="space-y-1.5 text-left min-w-0">
              <DialogTitle className="flex items-center gap-2 text-left">
                <FileBarChart2 className="h-5 w-5 shrink-0 text-blue-600" />
                {t('integral_report_title')}
              </DialogTitle>
              <DialogDescription className="text-left">{t('integral_report_desc')}</DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 self-start"
              disabled={pdfBusy || isLoading || !deviceId || !startedAtIso}
              onClick={handleDownloadPdf}
            >
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t('integral_report_download_pdf')}
            </Button>
          </div>
        </DialogHeader>

        <div ref={printRef} data-integral-pdf-root="" className="space-y-4 text-sm">
          <div
            data-integral-pdf-section="cover"
            className="integral-pdf-section space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
              {t('integral_report_pdf_cover_title')}
            </h2>
            <IntegralTrackingSummary view={view} deviceId={deviceId} t={t} formatDateTime={formatDateTime} />

            {!deviceId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {t('integral_report_no_device')}
              </div>
            )}

            {deviceId && !startedAtIso && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">{t('integral_report_no_start')}</div>
            )}

            {deviceId && startedAtIso && isLoading && (
              <div className="flex items-center gap-2 text-gray-600 py-8 justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
                {t('integral_report_loading')}
              </div>
            )}

            {deviceId && startedAtIso && error && (
              <p className="text-red-600 text-sm">{t('detail_monitoring_fetch_error')}</p>
            )}

            {deviceId && startedAtIso && !isLoading && !error && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">{t('recipe_modal_phases_title')}</h3>
                <ul className="mt-1 space-y-1 text-xs">
                  {phaseWindows.map((w) => (
                    <li key={w.order} className="flex flex-wrap gap-x-2 border-b border-gray-50 pb-1">
                      <span className="font-semibold">
                        {w.order}. {w.label}
                      </span>
                      <span className="text-gray-500">
                        {formatDateTime(new Date(w.startMs).toISOString())} — {formatDateTime(new Date(w.endMs).toISOString())}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {deviceId && startedAtIso && !isLoading && !error && (
            <div
              data-integral-pdf-section="objectives-evolution"
              className="integral-pdf-section space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
                {t('integral_report_objectives_evolution')}
              </h2>
              {objectivesChart ? (
                <div className="h-56 w-full mt-2 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="index" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => formatUiDecimal(Number(v))}
                        width={40}
                      />
                      <Tooltip formatter={(v: number) => formatUiDecimal(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="brix" name="Brix" stroke="#f97316" dot strokeWidth={2} isAnimationActive={false} />
                      <Line
                        type="monotone"
                        dataKey="firmness"
                        name={t('detail_tracking_firmness_short')}
                        stroke="#2563eb"
                        dot
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="color"
                        name={t('detail_tracking_color_short')}
                        stroke="#16a34a"
                        dot
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 text-xs py-2">{t('integral_report_no_objectives_series')}</p>
              )}
            </div>
          )}

          {deviceId && startedAtIso && !isLoading && !error && (
            <>
              {phaseWindows.flatMap((w) => {
                const rendered = renderPhaseChapter(w);
                return Array.isArray(rendered) ? rendered : [rendered];
              })}

              <div className="mt-2 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1">{t('integral_report_samples_title')}</h3>
                {samplingChrono.length === 0 ? (
                  <div
                    data-integral-pdf-section="samples-empty"
                    className="integral-pdf-section rounded-lg border border-gray-200 bg-white p-6 text-gray-500 text-sm"
                  >
                    {t('integral_report_no_samples')}
                  </div>
                ) : (
                  samplingChrono.map((ev) => (
                    <div
                      key={ev.id}
                      data-integral-pdf-section={`sample-${String(ev.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                      className="integral-pdf-section rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-2"
                    >
                      <div className="border-b border-gray-100 pb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('integral_report_pdf_sample_page_title')}</p>
                        <div className="flex flex-wrap justify-between gap-2 mt-1">
                          <span className="font-semibold text-gray-900">{ev.title}</span>
                          <span className="text-xs text-gray-500">{formatDateTime(ev.timestamp)}</span>
                        </div>
                      </div>
                      {ev.description && <p className="text-xs text-gray-600">{ev.description}</p>}
                      {ev.data && ev.data.length > 0 && (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {ev.data.map((d, i) => (
                            <li key={i} className="bg-blue-50/80 rounded px-2 py-1.5">
                              <span className="text-blue-800">{d.name}</span>: <span className="font-mono">{d.value}</span> {d.unit}
                            </li>
                          ))}
                        </ul>
                      )}
                      {ev.images && ev.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {ev.images.map((img, i) => {
                            const r = resolveEvidencePhoto(img);
                            return (
                              <div key={i} className="w-28 h-28 rounded border border-gray-200 overflow-hidden shrink-0">
                                {r.apiPath ? (
                                  <AuthedImage apiPath={r.apiPath} alt={r.alt} className="w-full h-full object-cover" />
                                ) : r.directSrc ? (
                                  <ImageWithFallback src={r.directSrc} alt={r.alt} className="w-full h-full object-cover" />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
