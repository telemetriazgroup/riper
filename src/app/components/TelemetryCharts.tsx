import React, { useState, useEffect, useMemo } from 'react';
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

/** Segmentos contiguos donde value === 1 para sombreado (power_state / iCtrlRip) */
function computeOnSegments(data: { timeStr: string }[], getValue: (i: number) => number): { x1: string; x2: string }[] {
  const segments: { x1: string; x2: string }[] = [];
  let start: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (getValue(i) === 1) {
      if (start === null) start = i;
    } else {
      if (start !== null) {
        segments.push({ x1: data[start].timeStr, x2: data[i - 1].timeStr });
        start = null;
      }
    }
  }
  if (start !== null) segments.push({ x1: data[start].timeStr, x2: data[data.length - 1].timeStr });
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
  const humidity = regularizeSeriesSmooth(raw.map((d: any) => d.humidityRaw)).map((v) => Number(v.toFixed(2)));
  const ethylene = regularizeSeries(raw.map((d: any) => d.ethyleneRaw), { lowThreshold: 20, highThreshold: 50 });
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
  const getLineColor = (key: string) => metricColors[key] ?? METRIC_COLORS[key] ?? '#64748b';

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
      const data = history.map((h: any) => {
        const d = new Date(h.timestamp);
        const timeStr = format(d, 'dd/MM HH:mm');
        const row: any = { timeStr, timestamp: d.getTime(), power_state: h.power_state ?? 0, iCtrlRip: h.iCtrlRip ?? 0 };
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
      const normalized = data.map((row: any, i: number) => ({ ...row, ethylene: ethyleneSeries[i] }));
      setChartData(normalized);
    } catch (e) {
      console.error(e);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const powerStateSegments = useMemo(() => chartData.length ? computeOnSegments(chartData, (i) => chartData[i].power_state) : [], [chartData]);
  const iCtrlRipSegments = useMemo(() => chartData.length ? computeOnSegments(chartData, (i) => chartData[i].iCtrlRip) : [], [chartData]);

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
    }
  }, [isOpen]);

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]);
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[180px]">
        <p className="text-xs font-semibold text-gray-700 border-b pb-2 mb-2">{label}</p>
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
              <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2 mb-2">
                <CalendarIcon className="h-4 w-4" /> {t('date_range')}
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Inicio</label>
                  <input type="datetime-local" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fin</label>
                  <input type="datetime-local" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
            <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={generateData} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('generate_chart')}
            </Button>
            <div className="rounded bg-gray-50 border border-gray-100 p-2 text-xs text-gray-600">
              <p className="font-medium text-gray-700 mb-1">Sombreados</p>
              <p><span className="inline-block w-3 h-3 rounded bg-green-400/40 mr-1" /> Equipo encendido</p>
              <p><span className="inline-block w-3 h-3 rounded bg-blue-400/40 mr-1" /> Inyección gas ON</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4" /> Variables y color
              </h4>
              <div className="space-y-1 max-h-[45vh] overflow-y-auto">
                {CHART_METRIC_KEYS.map((key) => (
                  <div key={key} className="flex items-center gap-2 text-xs hover:bg-gray-50 p-1.5 rounded group">
                    <input type="checkbox" id={`m-${key}`} checked={selectedMetrics.includes(key)} onChange={() => toggleMetric(key)} className="rounded border-gray-300 text-blue-600 shrink-0" />
                    <label htmlFor={`m-${key}`} className="truncate flex-1 cursor-pointer min-w-0" style={{ color: getLineColor(key) }} title={CHART_METRIC_LABELS[key]}>
                      {CHART_METRIC_LABELS[key]}
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

          {/* Área gráfica */}
          <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
            {chartData.length > 0 ? (
              <div className="flex-1 w-full min-h-[400px]" style={{ height: 'calc(96vh - 140px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 12, right: 80, bottom: 20, left: 44 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="timeStr" stroke="#6b7280" fontSize={10} tickLine={false} tick={{ fontSize: 9 }} />
                    <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => Number(v).toFixed(1)} domain={leftDomain} width={36} />
                    <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} stroke="#6366f1" fontSize={10} tickLine={false} tickFormatter={(v) => String(Number(v))} width={32} />
                    <YAxis yAxisId="right" orientation="right" domain={y3Domain} stroke="#10b981" fontSize={10} tickLine={false} tickFormatter={(v) => Number(v).toFixed(0)} width={36} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '6px' }} formatter={(value) => CHART_METRIC_LABELS[value] ?? value} />
                    {powerStateSegments.map((seg, idx) => (
                      <ReferenceArea key={`p-${idx}`} x1={seg.x1} x2={seg.x2} y1={0} y2={100} yAxisId="percent" fill="#22c55e" fillOpacity={0.2} />
                    ))}
                    {iCtrlRipSegments.map((seg, idx) => (
                      <ReferenceArea key={`c-${idx}`} x1={seg.x1} x2={seg.x2} y1={0} y2={100} yAxisId="percent" fill="#3b82f6" fillOpacity={0.15} />
                    ))}
                    {selectedMetrics.map((key, lineIndex) => {
                      const color = getLineColor(key);
                      const labelOffset = lineIndex * 14;
                      return (
                        <Line
                          key={key}
                          yAxisId={getYAxisId(key)}
                          type="monotone"
                          dataKey={key}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 5 }}
                          name={CHART_METRIC_LABELS[key]}
                        >
                          <LabelList
                            content={(props: { index?: number; value?: number; x?: number; y?: number }) => {
                              const { index, value, x, y } = props;
                              if (index !== dataLen - 1 || value == null || x == null || y == null) return null;
                              const text = typeof value === 'number' ? value.toFixed(1) : String(value);
                              return (
                                <text x={x} y={y} dx={6} dy={labelOffset} textAnchor="start" fill={color} fontSize={10} fontWeight={500}>
                                  {text}
                                </text>
                              );
                            }}
                          />
                        </Line>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                <History className="h-14 w-14 mb-3 opacity-30" />
                <p className="text-base font-medium">Sin datos en el rango seleccionado</p>
                <p className="text-sm mt-1">Elija fechas y pulse «Generar gráfico»</p>
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
