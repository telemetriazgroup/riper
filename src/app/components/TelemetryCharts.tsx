import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceArea, LabelList, TooltipProps,
} from 'recharts';
import { useDeviceHistory } from '@/app/hooks/useDevices';
import { fetchDeviceHistory } from '@/app/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Loader2, History, Calendar as CalendarIcon, Filter, Table2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { clsx } from 'clsx';
import { format, subHours, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

/** Etiquetas en español para cada campo de la gráfica histórica */
export const CHART_METRIC_LABELS: Record<string, string> = {
  temp_supply_1: 'Suministro',
  return_air: 'Retorno',
  evaporation_coil: 'Evaporador',
  condensation_coil: 'Condensador',
  compress_coil_1: 'Compresor',
  ambient_air: 'Ambiente Externo',
  cargo_1_temp: 'Sensor 1',
  cargo_2_temp: 'Sensor 2',
  cargo_3_temp: 'Sensor 3',
  cargo_4_temp: 'Sensor 4',
  relative_humidity: 'Humedad',
  avl_pct: 'Ventilación %',
  line_voltage: 'Voltaje',
  line_frequency: 'Frecuencia',
  co2_reading: 'CO2',
  o2_reading: 'O2',
  set_point: 'Set Temperatura',
  capacity_load: 'Capacidad',
  humidity_set_point: 'Set Humedad',
  set_point_o2: 'Set O2',
  set_point_co2: 'Set CO2',
  sp_ethyleno: 'Set Etileno',
  ethylene: 'Etileno',
};

const CHART_METRIC_KEYS = Object.keys(CHART_METRIC_LABELS);

/** Segmentos contiguos donde value === 1 para sombreado (power_state / iCtrlRip). Incluye índices para recortar al rango visible. */
function computeOnSegments(
  data: { timeStr: string }[],
  getValue: (i: number) => number
): { x1: string; x2: string; startIndex: number; endIndex: number }[] {
  const segments: { x1: string; x2: string; startIndex: number; endIndex: number }[] = [];
  let start: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (getValue(i) === 1) {
      if (start === null) start = i;
    } else {
      if (start !== null) {
        segments.push({ x1: data[start].timeStr, x2: data[i - 1].timeStr, startIndex: start, endIndex: i - 1 });
        start = null;
      }
    }
  }
  if (start !== null)
    segments.push({ x1: data[start].timeStr, x2: data[data.length - 1].timeStr, startIndex: start, endIndex: data.length - 1 });
  return segments;
}

/** Tipo de sombreado: solo encendido (power_state=1), solo inyección (iCtrlRip=1), o ambos en 1. */
type ShadingSegmentType = 'power' | 'injection' | 'both';

/** Segmentos combinados por estado: encendido = verde, inyección = azul, ambos = violeta. Solo se sombrea donde el valor es 1. */
function computeCombinedShadingSegments(
  data: { timeStr: string; power_state?: number; iCtrlRip?: number }[]
): { startIndex: number; endIndex: number; type: ShadingSegmentType }[] {
  const segments: { startIndex: number; endIndex: number; type: ShadingSegmentType }[] = [];
  if (!data.length) return segments;
  const getType = (i: number): ShadingSegmentType | null => {
    const p = data[i].power_state === 1 ? 1 : 0;
    const inj = data[i].iCtrlRip === 1 ? 1 : 0;
    if (p && inj) return 'both';
    if (p) return 'power';
    if (inj) return 'injection';
    return null;
  };
  let start: number | null = null;
  let currentType: ShadingSegmentType | null = null;
  for (let i = 0; i < data.length; i++) {
    const t = getType(i);
    if (currentType !== null && start !== null && t !== currentType) {
      segments.push({ startIndex: start, endIndex: i - 1, type: currentType });
    }
    if (t !== null) {
      if (t !== currentType) {
        start = i;
        currentType = t;
      }
    } else {
      start = null;
      currentType = null;
    }
  }
  if (currentType !== null && start !== null) {
    segments.push({ startIndex: start, endIndex: data.length - 1, type: currentType });
  }
  return segments;
}

/** Colores por métrica para la leyenda */
const METRIC_COLORS: Record<string, string> = {
  temp_supply_1: '#ef4444',
  return_air: '#f97316',
  evaporation_coil: '#3b82f6',
  condensation_coil: '#8b5cf6',
  compress_coil_1: '#ec4899',
  ambient_air: '#64748b',
  cargo_1_temp: '#06b6d4',
  cargo_2_temp: '#14b8a6',
  cargo_3_temp: '#22c55e',
  cargo_4_temp: '#84cc16',
  relative_humidity: '#0ea5e9',
  avl_pct: '#6366f1',
  line_voltage: '#a855f7',
  line_frequency: '#d946ef',
  co2_reading: '#78716c',
  o2_reading: '#57534e',
  set_point: '#dc2626',
  capacity_load: '#ea580c',
  humidity_set_point: '#2563eb',
  set_point_o2: '#4f46e5',
  set_point_co2: '#7c3aed',
  sp_ethyleno: '#059669',
  ethylene: '#10b981',
};

/** Interpola valor entre prev y next; si no hay vecinos, devuelve def. */
function interpolate(prev: number | null, next: number | null, def: number): number {
  if (prev != null && next != null) return (prev + next) / 2;
  if (prev != null) return prev;
  if (next != null) return next;
  return def;
}

/** Detecta lecturas erróneas (ej. 70→0→72) y las reemplaza por interpolación de tendencia (70, 71, 72). */
function regularizeSeries(values: (number | null)[], options: { lowThreshold?: number; highThreshold?: number } = {}): number[] {
  const { lowThreshold = 20, highThreshold = 50 } = options;
  const out: (number | null)[] = values.map((v) => v);
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (v === null) {
      const prev = i > 0 ? out[i - 1] : null;
      const next = i < out.length - 1 ? out[i + 1] : null;
      out[i] = interpolate(prev, next, 0);
      continue;
    }
    const prev = i > 0 ? out[i - 1] : null;
    const next = i < out.length - 1 ? out[i + 1] : null;
    const prevHigh = prev != null && prev >= highThreshold;
    const nextHigh = next != null && next >= highThreshold;
    if (v < lowThreshold && (prevHigh || nextHigh)) {
      out[i] = interpolate(prev, next, v);
    }
  }
  return out.map((x) => x ?? 0);
}

/**
 * Segundo filtro para etileno: corrige errores de lectura del sensor (picos imposibles).
 * Ej: 35.1, 290, 285, 36 en 2 min → 35.1, 35.4, 35.7, 36.
 * Si la tendencia es real (35, 70, 170, 230) no se corrige.
 * Criterio: salto máximo razonable entre lecturas consecutivas; si hay un "bache" que vuelve al nivel anterior en pocos puntos, se interpola.
 */
function correctEthyleneSensorErrors(values: number[]): number[] {
  if (values.length <= 2) return values;
  const out = [...values];
  const maxStep = 35;
  const maxRunToCorrect = 6;

  for (let i = 1; i < out.length - 1; i++) {
    const prev = out[i - 1], curr = out[i], next = out[i + 1];
    if (Math.abs(curr - prev) > maxStep && Math.abs(curr - next) > maxStep && Math.abs(prev - next) <= maxStep)
      out[i] = (prev + next) / 2;
  }

  let i = 1;
  while (i < out.length - 1) {
    const prev = out[i - 1];
    if (Math.abs(out[i] - prev) <= maxStep) { i++; continue; }
    let j = i;
    while (j < out.length && Math.abs(out[j] - prev) > maxStep) j++;
    if (j < out.length && (j - i) <= maxRunToCorrect && (j - i) >= 1) {
      const vStart = out[i - 1], vEnd = out[j];
      for (let k = i; k < j; k++)
        out[k] = vStart + (vEnd - vStart) * (k - (i - 1)) / (j - (i - 1));
    }
    i = j > i ? j + 1 : i + 1;
  }
  return out;
}

/**
 * Humedad: trata 0 como dato erróneo (sensor) y lo reemplaza por interpolación.
 * Ej: 88, 0, 90 → 88, 89, 90; 88, 0, 88 → 88, 88, 88. Evita distorsionar la gráfica.
 */
function regularizeHumiditySeries(values: (number | null)[]): number[] {
  const out: (number | null)[] = values.map((v) => {
    if (v == null) return null;
    if (v === 0) return null;
    return v;
  });
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== null) continue;
    let prev: number | null = null;
    let next: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (out[j] != null && out[j] !== 0) { prev = out[j] as number; break; }
    }
    for (let j = i + 1; j < out.length; j++) {
      if (out[j] != null && out[j] !== 0) { next = out[j] as number; break; }
    }
    out[i] = interpolate(prev, next, 85);
  }
  return out.map((x) => x ?? 85);
}

/** Regulariza cualquier serie: reemplaza outliers (saltos bruscos) por interpolación lineal. */
function regularizeSeriesSmooth(values: (number | null)[], maxJumpRatio = 0.5): number[] {
  const out = values.map((v) => v ?? NaN);
  for (let i = 0; i < out.length; i++) {
    if (Number.isNaN(out[i])) {
      let prev = i > 0 ? out[i - 1] : NaN;
      let next = NaN;
      for (let j = i + 1; j < out.length; j++) {
        if (!Number.isNaN(out[j])) { next = out[j]; break; }
      }
      out[i] = Number.isNaN(prev) && Number.isNaN(next) ? 0 : (Number.isNaN(prev) ? next : Number.isNaN(next) ? prev : (prev + next) / 2);
      continue;
    }
    const prev = i > 0 ? out[i - 1] : out[i];
    const next = i < out.length - 1 ? out[i + 1] : out[i];
    const prevVal = Number.isNaN(prev) ? out[i] : prev;
    const nextVal = Number.isNaN(next) ? out[i] : next;
    const avg = (prevVal + nextVal) / 2;
    const jump = Math.abs(out[i] - avg);
    const range = Math.max(Math.abs(prevVal - nextVal), 1);
    if (jump > range * (1 + maxJumpRatio)) {
      out[i] = avg;
    }
  }
  return out;
}

interface TelemetryChartsProps {
  deviceId?: string;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ deviceId }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  
  const [timeRange] = useState<'12h' | '24h' | '7d'>('12h');
  const { history, isLoading } = useDeviceHistory(deviceId || null);

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-2 h-[400px] flex items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </Card>
    );
  }

  const raw = (history ?? []).map((h: any) => ({
    rawDate: new Date(h.timestamp),
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tempRaw: h.temp_supply_1 != null ? Number(convertTemp(h.temp_supply_1)) : null,
    humidityRaw: h.relative_humidity != null ? Number(h.relative_humidity) : null,
    ethyleneRaw: h.ethylene != null ? Number(h.ethylene) : null,
    co2Raw: h.co2_reading != null ? Number(h.co2_reading) : null,
  }));
  const temp = regularizeSeriesSmooth(raw.map((d: any) => d.tempRaw)).map((v) => Number(v.toFixed(2)));
  const humidity = regularizeHumiditySeries(raw.map((d: any) => d.humidityRaw)).map((v) => Number(v.toFixed(2)));
  const ethyleneRaw = regularizeSeries(raw.map((d: any) => d.ethyleneRaw), { lowThreshold: 20, highThreshold: 50 });
  const ethylene = correctEthyleneSensorErrors(ethyleneRaw);
  const co2 = regularizeSeriesSmooth(raw.map((d: any) => d.co2Raw)).map((v) => Number(v.toFixed(2)));
  const data = raw.map((d: any, i: number) => ({
    ...d,
    temp: temp[i],
    humidity: humidity[i],
    ethylene: ethylene[i],
    co2: co2[i],
  }));

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{t('last_12_hours')}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            {t('historical_data')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsTableModalOpen(true)}>
            <Table2 className="h-4 w-4 mr-2" />
            {t('historical_data_table')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                yAxisId="left" 
                stroke="#ef4444" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => val.toFixed(2)}
                label={{ value: `Temp (°${tempUnit})`, angle: -90, position: 'insideLeft', fill: '#ef4444' }} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#10b981" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => val.toFixed(2)}
                label={{ value: 'PPM / %', angle: 90, position: 'insideRight', fill: '#10b981' }} 
              />
              <Tooltip 
                formatter={(value: number) => [value.toFixed(2), ""]}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px' }}
                labelStyle={{ color: '#374151', marginBottom: '0.25rem', fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line yAxisId="left" type="monotone" dataKey="temp" name={`${t('temperature')} (°${tempUnit})`} stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="humidity" name={`${t('humidity')} (%)`} stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="ethylene" name={`${t('ethylene')} (PPM)`} stroke="#10b981" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="co2" name={`${t('co2')} (%)`} stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>

      <HistoricalDataModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        deviceId={deviceId}
      />
      <HistoricalDataTableModal 
        isOpen={isTableModalOpen} 
        onClose={() => setIsTableModalOpen(false)} 
        deviceId={deviceId}
      />
    </Card>
  );
};

// --- Historical Data Modal Component ---

const HistoricalDataModal = ({ isOpen, onClose, deviceId }: { isOpen: boolean, onClose: () => void, deviceId?: string }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  
  // Initialize range to last 12 hours
  const [dateRange, setDateRange] = useState({ 
    start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"), 
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm") 
  });
  
  const defaultMetrics = ['temp_supply_1', 'return_air', 'relative_humidity', 'ethylene', 'co2_reading', 'set_point'];
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(defaultMetrics);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metricColors, setMetricColors] = useState<Record<string, string>>({});
  const [zoomRange, setZoomRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [showLabelsByMetric, setShowLabelsByMetric] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    defaultMetrics.forEach((k) => { o[k] = true; });
    return o;
  });
  const [showPowerShading, setShowPowerShading] = useState(true);
  const [showInjectionShading, setShowInjectionShading] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pinchStartRef = useRef<{ distance: number; startIndex: number; endIndex: number } | null>(null);
  const dragStartRef = useRef<{ clientX: number; startIndex: number; endIndex: number } | null>(null);
  const touchPanRef = useRef<{ clientX: number; startIndex: number; endIndex: number } | null>(null);
  const getLineColor = (key: string) => metricColors[key] ?? METRIC_COLORS[key] ?? '#64748b';
  const toggleLabels = (key: string) => setShowLabelsByMetric((prev) => ({ ...prev, [key]: !(prev[key] !== false) }));

  const tempKeys = ['temp_supply_1', 'return_air', 'evaporation_coil', 'condensation_coil', 'compress_coil_1', 'ambient_air', 'cargo_1_temp', 'cargo_2_temp', 'cargo_3_temp', 'cargo_4_temp', 'set_point'];
  /** Eje Y2: porcentaje 0–100 (sombreados y humedad, ventilación, capacidad) */
  const percentKeys = ['relative_humidity', 'avl_pct', 'capacity_load', 'humidity_set_point'];
  /** Eje Y3: escala dinámica 0–200+ para etileno, voltaje, frecuencia, CO2, O2 */
  const dynamicKeys = ['ethylene', 'line_voltage', 'line_frequency', 'co2_reading', 'o2_reading', 'set_point_co2', 'sp_ethyleno', 'set_point_o2'];

  const generateData = async () => {
    if (!deviceId) return;
    setIsLoading(true);
    try {
      const startStr = dateRange.start.length === 16 ? dateRange.start + ':00' : dateRange.start;
      const endStr = dateRange.end.length === 16 ? dateRange.end + ':00' : dateRange.end;
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (start.getTime() >= end.getTime()) {
        setChartData([]);
        return;
      }
      const history = await fetchDeviceHistory(deviceId, { fecha_inicio: startStr, fecha_fin: endStr });
      const data = history.map((h: any, i: number) => {
        const d = new Date(h.timestamp);
        const timeStr = format(d, 'dd/MM HH:mm');
        const prevDay = i > 0 ? new Date(history[i - 1].timestamp) : null;
        const sameDay = prevDay && format(d, 'yyyy-MM-dd') === format(prevDay, 'yyyy-MM-dd');
        const timeAxisLabel = sameDay ? format(d, 'HH:mm') : format(d, "d MMM 'a las' HH:mm", { locale: es });
        const row: any = { timeStr, timeAxisLabel, timestamp: d.getTime(), power_state: h.power_state ?? 0, iCtrlRip: h.iCtrlRip ?? 0 };
        CHART_METRIC_KEYS.forEach((key) => {
          let v = h[key];
          if (v == null && (key.startsWith('cargo_') || key === 'set_point_o2')) { row[key] = null; return; }
          if (key === 'ethylene') {
            row[key] = v != null ? Number(v) : null;
            return;
          }
          v = Number(v ?? 0);
          if (tempKeys.includes(key)) row[key] = Number(convertTemp(v).toFixed(2));
          else row[key] = Number(v.toFixed(2));
        });
        return row;
      });
      const ethyleneSeries = regularizeSeries(data.map((d: any) => d.ethylene), { lowThreshold: 20, highThreshold: 50 });
      const ethyleneCorrected = correctEthyleneSensorErrors(ethyleneSeries);
      const humiditySeries = regularizeHumiditySeries(data.map((d: any) => d.relative_humidity ?? null));
      const normalized = data.map((row: any, i: number) => ({
        ...row,
        ethylene: ethyleneCorrected[i],
        relative_humidity: humiditySeries[i],
      }));
      setChartData(normalized);
      setZoomRange({ startIndex: 0, endIndex: normalized.length - 1 });
    } catch (e) {
      console.error(e);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const combinedShadingSegments = useMemo(
    () => (chartData.length ? computeCombinedShadingSegments(chartData) : []),
    [chartData]
  );

  /** Recorta segmentos al rango visible y usa timeStr del slice para que ReferenceArea dibuje (x1/x2 deben existir en data del chart). */
  const clipSegmentsToVisible = useCallback(
    (
      segments: { startIndex: number; endIndex: number; type: ShadingSegmentType }[],
      brushStart: number,
      brushEnd: number
    ): { x1: string; x2: string; type: ShadingSegmentType }[] => {
      if (!chartData.length) return [];
      return segments
        .map((seg) => {
          const vStart = Math.max(seg.startIndex, brushStart);
          const vEnd = Math.min(seg.endIndex, brushEnd);
          if (vStart > vEnd) return null;
          return {
            x1: chartData[vStart].timeStr,
            x2: chartData[vEnd].timeStr,
            type: seg.type,
          };
        })
        .filter((s): s is { x1: string; x2: string; type: ShadingSegmentType } => s != null);
    },
    [chartData]
  );

  /** Dominio eje temperatura (Y1) a partir de las métricas de temp seleccionadas */
  const leftDomain = useMemo(() => {
    if (!chartData.length) return undefined;
    const keys = selectedMetrics.filter((k) => tempKeys.includes(k));
    let lo = Infinity, hi = -Infinity;
    chartData.forEach((row) => {
      keys.forEach((key) => {
        const v = row[key];
        if (typeof v === 'number' && !Number.isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      });
    });
    if (lo === Infinity) return undefined;
    const pad = Math.max((hi - lo) * 0.1, 1);
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }, [chartData, selectedMetrics]);

  /** Dominio eje dinámico (Y3): al menos 0–200, crece si los datos son mayores */
  const y3Domain = useMemo(() => {
    if (!chartData.length) return [0, 200];
    const keys = selectedMetrics.filter((k) => dynamicKeys.includes(k));
    let maxVal = 0;
    chartData.forEach((row) => {
      keys.forEach((key) => {
        const v = row[key];
        if (typeof v === 'number' && !Number.isNaN(v)) maxVal = Math.max(maxVal, v);
      });
    });
    const top = Math.max(200, Math.ceil(maxVal * 1.1));
    return [0, top];
  }, [chartData, selectedMetrics]);

  const getYAxisId = (key: string) => {
    if (tempKeys.includes(key)) return 'left';
    if (percentKeys.includes(key)) return 'percent';
    return 'right';
  };

  useEffect(() => {
    if (isOpen) {
      setDateRange({
        start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"),
        end: format(new Date(), "yyyy-MM-dd'T'HH:mm")
      });
      setChartData([]);
      setZoomRange(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (chartData.length > 0 && zoomRange === null)
      setZoomRange({ startIndex: 0, endIndex: chartData.length - 1 });
  }, [chartData.length, zoomRange]);

  const resetZoom = useCallback(() => {
    if (chartData.length > 0)
      setZoomRange({ startIndex: 0, endIndex: chartData.length - 1 });
  }, [chartData.length]);

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]);
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const row = payload?.[0]?.payload as { power_state?: number; iCtrlRip?: number } | undefined;
    const powerOn = row && row.power_state === 1;
    const injOn = row && row.iCtrlRip === 1;
    const shadingReason =
      powerOn && injOn
        ? 'Encendido + Inyección gas'
        : powerOn
          ? 'Encendido'
          : injOn
            ? 'Inyección gas'
            : null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[180px]">
        <p className="text-xs font-semibold text-gray-700 border-b pb-2 mb-2">{label}</p>
        {shadingReason && (
          <p className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded shrink-0"
              style={{
                backgroundColor:
                  shadingReason === 'Encendido + Inyección gas'
                    ? '#7c3aed'
                    : shadingReason === 'Encendido'
                      ? '#86efac'
                      : '#93c5fd',
              }}
            />
            {shadingReason}
          </p>
        )}
        <ul className="space-y-1">
          {payload.map((entry) => (
            <li key={entry.dataKey} className="flex justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{CHART_METRIC_LABELS[String(entry.dataKey)] ?? entry.dataKey}</span>
              <span className="font-mono font-medium">{entry.value != null ? Number(entry.value).toFixed(2) : '—'}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const dataLen = chartData.length;
  const brushStart = zoomRange?.startIndex ?? 0;
  const brushEnd = zoomRange?.endIndex ?? Math.max(0, chartData.length - 1);
  const isZoomed = chartData.length > 1 && (brushStart > 0 || brushEnd < chartData.length - 1);
  const brushRef = useRef({ start: brushStart, end: brushEnd, len: chartData.length });
  brushRef.current = { start: brushStart, end: brushEnd, len: chartData.length };

  const applyZoom = useCallback((factor: number) => {
    const { start, end, len } = brushRef.current;
    if (len <= 1) return;
    const span = end - start + 1;
    const center = (start + end) / 2;
    const newSpan = Math.max(5, Math.min(len, Math.round(span * factor)));
    const half = (newSpan - 1) / 2;
    let newStart = Math.round(center - half);
    let newEnd = Math.round(center + half);
    if (newStart < 0) { newEnd -= newStart; newStart = 0; }
    if (newEnd >= len) { newStart -= newEnd - (len - 1); newEnd = len - 1; }
    newStart = Math.max(0, newStart);
    newEnd = Math.min(len - 1, newEnd);
    setZoomRange({ startIndex: newStart, endIndex: newEnd });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (chartData.length <= 1) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.85 : 1 / 0.85;
    applyZoom(factor);
  }, [chartData.length, applyZoom]);

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    return Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
  };
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && chartData.length > 1) {
      pinchStartRef.current = {
        distance: getTouchDistance(e.touches),
        startIndex: brushRef.current.start,
        endIndex: brushRef.current.end,
      };
      touchPanRef.current = null;
    } else if (e.touches.length === 1 && chartData.length > 1) {
      touchPanRef.current = {
        clientX: e.touches[0].clientX,
        startIndex: brushRef.current.start,
        endIndex: brushRef.current.end,
      };
      pinchStartRef.current = null;
    }
  }, [chartData.length]);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchPanRef.current) {
      e.preventDefault();
      handleTouchMovePan(e.touches[0].clientX);
      return;
    }
    const pinch = pinchStartRef.current;
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const dist = getTouchDistance(e.touches);
    if (dist <= 0) return;
    const scale = dist / pinch.distance;
    const span = pinch.endIndex - pinch.startIndex + 1;
    const center = (pinch.startIndex + pinch.endIndex) / 2;
    const newSpan = Math.max(5, Math.min(chartData.length, Math.round(span * scale)));
    const half = (newSpan - 1) / 2;
    let newStart = Math.round(center - half);
    let newEnd = Math.round(center + half);
    newStart = Math.max(0, Math.min(newStart, chartData.length - 1));
    newEnd = Math.max(0, Math.min(newEnd, chartData.length - 1));
    if (newStart > newEnd) [newStart, newEnd] = [newEnd, newStart];
    setZoomRange({ startIndex: newStart, endIndex: newEnd });
    pinchStartRef.current = { ...pinch, distance: dist };
  }, [chartData.length]);
  const handleTouchEnd = useCallback(() => {
    pinchStartRef.current = null;
    touchPanRef.current = null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (chartData.length <= 1) return;
    dragStartRef.current = {
      clientX: e.clientX,
      startIndex: brushRef.current.start,
      endIndex: brushRef.current.end,
    };
  }, [chartData.length]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragStartRef.current;
    if (!drag || chartData.length <= 1) return;
    const width = chartContainerRef.current?.offsetWidth ?? 400;
    const span = drag.endIndex - drag.startIndex + 1;
    const shift = Math.round(((e.clientX - drag.clientX) / width) * span);
    const len = chartData.length;
    const newStart = Math.max(0, Math.min(len - span, drag.startIndex - shift));
    const newEnd = newStart + span - 1;
    setZoomRange({ startIndex: newStart, endIndex: newEnd });
  }, [chartData.length]);

  const handleMouseUp = useCallback(() => { dragStartRef.current = null; }, []);
  const handleMouseLeave = useCallback(() => { dragStartRef.current = null; }, []);

  const handleTouchMovePan = useCallback((clientX: number) => {
    const pan = touchPanRef.current;
    if (!pan || chartData.length <= 1) return;
    const width = chartContainerRef.current?.offsetWidth ?? 400;
    const span = pan.endIndex - pan.startIndex + 1;
    const shift = Math.round(((clientX - pan.clientX) / width) * span);
    const len = chartData.length;
    const newStart = Math.max(0, Math.min(len - span, pan.startIndex - shift));
    const newEnd = newStart + span - 1;
    setZoomRange({ startIndex: newStart, endIndex: newEnd });
  }, [chartData.length]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[98vw] w-[98vw] sm:!max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col p-3 gap-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 py-2">
          <DialogTitle>{t('historical_data')}</DialogTitle>
          <DialogDescription>{t('viewing_history')} — {deviceId}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 gap-4 pt-2">
          {/* Sidebar: rango y métricas + color por línea */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto border-r border-gray-200 pr-3">
            <div>
              <h4 className="font-medium text-xs sm:text-sm text-gray-900 flex items-center gap-2 mb-1 sm:mb-2">
                <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t('date_range')}
              </h4>
              <div className="space-y-1.5 sm:space-y-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                <div>
                  <label className="text-xs text-gray-500">Inicio</label>
                  <input type="datetime-local" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full border rounded px-2 py-1 sm:py-1.5 text-xs sm:text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fin</label>
                  <input type="datetime-local" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full border rounded px-2 py-1 sm:py-1.5 text-xs sm:text-sm" />
                </div>
              </div>
            </div>
            <Button className="w-full bg-blue-600 text-white hover:bg-blue-700 text-sm py-1.5 sm:py-2" onClick={generateData} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('generate_chart')}
            </Button>
            <div className="rounded bg-gray-50 border border-gray-100 p-1.5 sm:p-2 text-xs text-gray-600">
              <p className="font-medium text-gray-700 mb-0.5 sm:mb-1">Sombreados</p>
              <label className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={showPowerShading}
                  onChange={() => setShowPowerShading((v) => !v)}
                  className="rounded border-gray-300 text-green-600"
                />
                <span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-300/60 shrink-0" />
                <span>Encendido (power_state = 1)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={showInjectionShading}
                  onChange={() => setShowInjectionShading((v) => !v)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-blue-300/60 shrink-0" />
                <span>Inyección gas (iCtrlRip = 1)</span>
              </label>
              {showPowerShading && showInjectionShading && (
                <>
                  <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded bg-violet-400 shrink-0" />
                    Ambos activos = violeta
                  </p>
                </>
              )}
            </div>
            <div className="min-h-0 flex flex-col">
              <h4 className="font-medium text-xs sm:text-sm text-gray-900 flex items-center gap-2 mb-1 sm:mb-2">
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Variables y color
              </h4>
              <div className="space-y-1 max-h-[20vh] sm:max-h-[45vh] overflow-y-auto">
                {CHART_METRIC_KEYS.map((key) => (
                  <div key={key} className="flex flex-wrap items-center gap-1.5 text-xs hover:bg-gray-50 p-1.5 rounded group">
                    <input type="checkbox" id={`m-${key}`} checked={selectedMetrics.includes(key)} onChange={() => toggleMetric(key)} className="rounded border-gray-300 text-blue-600 shrink-0" />
                    <label htmlFor={`m-${key}`} className="truncate flex-1 cursor-pointer min-w-0" style={{ color: getLineColor(key) }} title={CHART_METRIC_LABELS[key]}>
                      {CHART_METRIC_LABELS[key]}
                    </label>
                    <label className="flex items-center gap-1 shrink-0 cursor-pointer" title="Mostrar/ocultar valores en la línea">
                      <input
                        type="checkbox"
                        checked={showLabelsByMetric[key] !== false}
                        onChange={() => toggleLabels(key)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-[10px] text-gray-500">Valores</span>
                    </label>
                    <input
                      type="color"
                      value={getLineColor(key)}
                      onChange={(e) => setMetricColors((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-6 h-6 rounded border border-gray-200 cursor-pointer shrink-0"
                      title={`Color de ${CHART_METRIC_LABELS[key]}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Área gráfica: flexible y con zoom */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
            {chartData.length > 0 ? (
              <>
                <div className="flex items-center justify-end gap-2 py-1 px-2 border-b border-gray-100 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetZoom}
                    className="text-xs"
                    title="Ver la gráfica completa"
                  >
                    Restablecer zoom
                  </Button>
                </div>
                <div
                  ref={chartContainerRef}
                  className="flex-1 min-h-[280px] sm:min-h-[320px] w-full touch-none select-none cursor-grab active:cursor-grabbing"
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{ touchAction: 'none' }}
                >
                  <ResponsiveContainer width="100%" height="100%" key={`chart-${chartData.length}`}>
                    <ComposedChart
                      data={chartData.slice(brushStart, brushEnd + 1)}
                      margin={{ top: 12, right: 72, bottom: 24, left: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis
                        dataKey="timeStr"
                        stroke="#6b7280"
                        fontSize={9}
                        tickLine={false}
                        tick={{ fontSize: 9 }}
                        interval="preserveStartEnd"
                        tickFormatter={(_, index) => chartData.slice(brushStart, brushEnd + 1)[index]?.timeAxisLabel ?? ''}
                      />
                      <YAxis yAxisId="left" stroke="#64748b" fontSize={9} tickLine={false} tickFormatter={(v) => Number(v).toFixed(1)} domain={leftDomain} width={32} />
                      <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} stroke="#6366f1" fontSize={9} tickLine={false} tickFormatter={(v) => String(Number(v))} width={28} />
                      <YAxis yAxisId="right" orientation="right" domain={y3Domain} stroke="#10b981" fontSize={9} tickLine={false} tickFormatter={(v) => Number(v).toFixed(0)} width={32} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '4px' }} formatter={(value) => CHART_METRIC_LABELS[value] ?? value} iconSize={8} fontSize={10} />
                      {(() => {
                        const visible = clipSegmentsToVisible(combinedShadingSegments, brushStart, brushEnd);
                        const getFill = (type: ShadingSegmentType) => {
                          if (type === 'both') return { fill: '#7c3aed', opacity: 0.2 };
                          if (type === 'power') return { fill: '#86efac', opacity: 0.35 };
                          return { fill: '#93c5fd', opacity: 0.3 };
                        };
                        return visible
                          .filter((seg) => {
                            if (seg.type === 'power') return showPowerShading;
                            if (seg.type === 'injection') return showInjectionShading;
                            return showPowerShading || showInjectionShading;
                          })
                          .map((seg, idx) => {
                            const bothToggles = showPowerShading && showInjectionShading;
                            const fill =
                              seg.type === 'both'
                                ? bothToggles
                                  ? '#7c3aed'
                                  : showPowerShading
                                    ? '#86efac'
                                    : '#93c5fd'
                                : seg.type === 'power'
                                  ? '#86efac'
                                  : '#93c5fd';
                            const opacity = seg.type === 'both' ? (bothToggles ? 0.2 : 0.35) : seg.type === 'power' ? 0.35 : 0.3;
                            return (
                              <ReferenceArea
                                key={`shade-${idx}-${seg.x1}-${seg.x2}-${seg.type}`}
                                x1={seg.x1}
                                x2={seg.x2}
                                y1={0}
                                y2={100}
                                yAxisId="percent"
                                fill={fill}
                                fillOpacity={opacity}
                              />
                            );
                          });
                      })()}
                      {selectedMetrics.map((key, lineIndex) => {
                        const color = getLineColor(key);
                        const showLabels = showLabelsByMetric[key] === true;
                        const visibleLen = brushEnd - brushStart + 1;
                        const displayData = chartData.slice(brushStart, brushEnd + 1);
                        const isHighVariation = key === 'ethylene' || key === 'relative_humidity';
                        const maxLabels = key === 'ethylene'
                          ? (visibleLen > 15 ? 15 : 8)
                          : isHighVariation
                            ? 4
                            : 8;
                        const labelStep = Math.max(1, Math.floor(visibleLen / maxLabels));
                        const isEthylene = key === 'ethylene';
                        const labelDy = isEthylene ? 0 : 5 + lineIndex * 12;
                        const labelFontSize = isEthylene ? 10 : 13;
                        const variationThreshold = key === 'ethylene' ? 10 : key === 'relative_humidity' ? 2 : 0.3;
                        return (
                          <Line
                            key={key}
                            yAxisId={getYAxisId(key)}
                            type="monotone"
                            dataKey={key}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            name={CHART_METRIC_LABELS[key]}
                          >
                            {showLabels && (
                              <LabelList
                                content={(props: { index?: number; value?: number; x?: number; y?: number }) => {
                                  const { index = 0, value, x, y } = props;
                                  if (value == null || x == null || y == null) return null;
                                  const numVal = typeof value === 'number' ? value : Number(value);
                                  const prev = index > 0 ? displayData[index - 1]?.[key] : null;
                                  const next = index < displayData.length - 1 ? displayData[index + 1]?.[key] : null;
                                  const prevNum = prev != null ? Number(prev) : null;
                                  const nextNum = next != null ? Number(next) : null;
                                  const isVariation = (prevNum != null && Math.abs(numVal - prevNum) >= variationThreshold) ||
                                    (nextNum != null && Math.abs(numVal - nextNum) >= variationThreshold);
                                  const isRegular = index % labelStep === 0;
                                  if (!isVariation && !isRegular) return null;
                                  const text = typeof value === 'number' ? value.toFixed(1) : String(value);
                                  return (
                                    <text x={x} y={y} dy={labelDy} textAnchor="middle" fill={color} fontSize={labelFontSize} fontWeight={700}>
                                      {text}
                                    </text>
                                  );
                                }}
                              />
                            )}
                          </Line>
                        );
                      })}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-[280px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 p-4">
                <History className="h-12 w-12 sm:h-14 sm:w-14 mb-2 sm:mb-3 opacity-30" />
                <p className="text-sm sm:text-base font-medium text-center">Sin datos en el rango seleccionado</p>
                <p className="text-xs sm:text-sm mt-1 text-center">Elija fechas y pulse «Generar gráfico»</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const tempKeysTable = ['temp_supply_1', 'return_air', 'evaporation_coil', 'condensation_coil', 'compress_coil_1', 'ambient_air', 'cargo_1_temp', 'cargo_2_temp', 'cargo_3_temp', 'cargo_4_temp', 'set_point'];

const TABLE_PRESETS = [
  { id: 'last12', columns: ['temp_supply_1', 'return_air', 'relative_humidity', 'ethylene', 'co2_reading', 'set_point'] },
  { id: 'basic', columns: ['temp_supply_1', 'return_air', 'relative_humidity', 'ethylene', 'co2_reading'] },
  { id: 'temperatures', columns: ['temp_supply_1', 'return_air', 'evaporation_coil', 'condensation_coil', 'set_point'] },
  { id: 'gases', columns: ['relative_humidity', 'ethylene', 'co2_reading', 'o2_reading', 'avl_pct'] },
  { id: 'full', columns: CHART_METRIC_KEYS },
];

const HistoricalDataTableModal = ({ isOpen, onClose, deviceId }: { isOpen: boolean; onClose: () => void; deviceId?: string }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [dateRange, setDateRange] = useState({
    start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"),
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });
  const [selectedColumns, setSelectedColumns] = useState<string[]>(TABLE_PRESETS[0].columns);
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    if (!deviceId) return;
    setIsLoading(true);
    try {
      const startStr = dateRange.start.length === 16 ? dateRange.start + ':00' : dateRange.start;
      const endStr = dateRange.end.length === 16 ? dateRange.end + ':00' : dateRange.end;
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (start.getTime() >= end.getTime()) {
        setTableData([]);
        return;
      }
      const history = await fetchDeviceHistory(deviceId, { fecha_inicio: startStr, fecha_fin: endStr });
      const data = history.map((h: any) => {
        const d = new Date(h.timestamp);
        const timeStr = format(d, 'dd/MM/yyyy HH:mm');
        const row: any = { timeStr, timestamp: d.getTime() };
        CHART_METRIC_KEYS.forEach((key) => {
          let v = h[key];
          if (v == null && (key.startsWith('cargo_') || key === 'set_point_o2')) { row[key] = null; return; }
          if (key === 'ethylene') row[key] = v != null ? Number(v) : null;
          else {
            v = Number(v ?? 0);
            row[key] = tempKeysTable.includes(key) ? Number(convertTemp(v).toFixed(2)) : Number(v.toFixed(2));
          }
        });
        return row;
      });
      const ethyleneSeries = regularizeSeries(data.map((d: any) => d.ethylene), { lowThreshold: 20, highThreshold: 50 });
      setTableData(data.map((row: any, i: number) => ({ ...row, ethylene: ethyleneSeries[i] })));
    } catch (e) {
      console.error(e);
      setTableData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDateRange({
        start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"),
        end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
      setTableData([]);
    }
  }, [isOpen]);

  const applyPreset = (presetId: string) => {
    const preset = TABLE_PRESETS.find((p) => p.id === presetId);
    if (preset) setSelectedColumns(preset.columns);
    if (presetId === 'last12') {
      setDateRange({
        start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"),
        end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
    }
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const formatCellForExport = (row: any, key: string): string => {
    const v = row[key];
    if (v == null) return '—';
    if (key === 'ethylene' && Number(v) === 0) return 'NA';
    if (typeof v === 'number') return Number(v).toFixed(2);
    return String(v);
  };

  const exportRows = [...tableData].reverse();
  const exportHeader = ['Fecha / Hora', ...selectedColumns.map((k) => CHART_METRIC_LABELS[k])];

  const downloadPDF = () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const fontSize = 7;
    pdf.setFontSize(fontSize);
    const colCount = selectedColumns.length + 1;
    const colW = (pageW - margin * 2) / colCount;
    const rowH = 5;
    let y = margin;

    const drawRow = (cells: string[]) => {
      if (y > pageH - 15) { pdf.addPage('l', 'a4'); y = margin; }
      let x = margin;
      cells.forEach((cell) => {
        pdf.text(cell, x, y, { maxWidth: colW - 2 });
        x += colW;
      });
      y += rowH;
    };

    drawRow(exportHeader);
    exportRows.forEach((row: any) => {
      drawRow([row.timeStr, ...selectedColumns.map((k) => formatCellForExport(row, k))]);
    });
    pdf.save(`datos_historicos_${deviceId || 'tabla'}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
  };

  const downloadCSV = () => {
    const escape = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const headerLine = exportHeader.map(escape).join(',');
    const dataLines = exportRows.map((row: any) =>
      [row.timeStr, ...selectedColumns.map((k) => formatCellForExport(row, k))].map(escape).join(',')
    );
    const csv = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `datos_historicos_${deviceId || 'tabla'}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadExcel = () => {
    const rows = [exportHeader, ...exportRows.map((row: any) => [row.timeStr, ...selectedColumns.map((k) => formatCellForExport(row, k))])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `datos_historicos_${deviceId || 'tabla'}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[98vw] w-[98vw] sm:!max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col p-3 gap-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 py-2">
          <DialogTitle>{t('historical_data_table')}</DialogTitle>
          <DialogDescription>{t('viewing_history')} — {deviceId} · {t('search_by_date')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 min-h-0 gap-4 pt-2">
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto border-r border-gray-200 pr-3">
            <div>
              <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2 mb-2">
                <CalendarIcon className="h-4 w-4" /> {t('date_range')}
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Inicio</label>
                  <input
                    type="datetime-local"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fin</label>
                  <input
                    type="datetime-local"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
            <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={loadData} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('generate_table')}
            </Button>
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-2">Vistas predefinidas</h4>
              <div className="space-y-1">
                {TABLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t(`preset_${p.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-2">{t('columns_to_show')}</h4>
              <div className="space-y-1 max-h-[30vh] overflow-y-auto">
                {CHART_METRIC_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(key)}
                      onChange={() => toggleColumn(key)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="truncate">{CHART_METRIC_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
            {tableData.length > 0 ? (
              <>
                <div className="flex-shrink-0 flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 bg-gray-50">
                  <Button type="button" variant="outline" size="sm" onClick={downloadPDF} className="gap-1">
                    <Download className="h-3.5 w-3" /> {t('download_pdf')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={downloadCSV} className="gap-1">
                    <Download className="h-3.5 w-3" /> {t('download_csv')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={downloadExcel} className="gap-1">
                    <Download className="h-3.5 w-3" /> {t('download_excel')}
                  </Button>
                </div>
                <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">Fecha / Hora</th>
                      {selectedColumns.map((key) => (
                        <th key={key} className="text-right px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                          {CHART_METRIC_LABELS[key]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...tableData].reverse().map((row: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.timeStr}</td>
                        {selectedColumns.map((key) => (
                          <td key={key} className="px-3 py-2 text-right font-mono whitespace-nowrap">
                            {row[key] == null ? '—' : key === 'ethylene' && Number(row[key]) === 0 ? 'NA' : typeof row[key] === 'number' ? Number(row[key]).toFixed(2) : String(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                <Table2 className="h-14 w-14 mb-3 opacity-30" />
                <p className="text-base font-medium">Sin datos en el rango seleccionado</p>
                <p className="text-sm mt-1">{t('generate_table_to_load')}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
