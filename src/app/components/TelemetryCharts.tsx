import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceArea, LabelList, TooltipProps,
} from 'recharts';
import { useDeviceHistory, useDevice } from '@/app/hooks/useDevices';
import { useRipeningActiveForDevice } from '@/app/hooks/useRipeningActiveForDevice';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';
import { useControlSessionsList } from '@/app/hooks/useControlSessionsList';
import {
  applyTelemetryDisplayPolicyToHistory,
  type TelemetryDisplayContext,
} from '@/app/lib/telemetryDisplayPolicy';
import { isUnfilteredEthyleneViewer } from '@/app/lib/ethyleneDisplayPolicy';
import { fetchRipeningProcesses } from '@/app/lib/ripeningProcessesApi';
import { showsUnfilteredTelemetry } from '@/app/lib/telemetryViewPolicy';
import { CHART_ETHYLENE_MAX_PPM } from '@/app/lib/historySeriesSanitize';
import useSWR from 'swr';
import { fetchDeviceHistory } from '@/app/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Loader2, History, Calendar as CalendarIcon, Filter, Search, Table2, Download } from 'lucide-react';
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
import { formatChartPointLabels } from '@/app/lib/displayTimeZone';
import {
  buildLast12hChartData,
  buildThermoKingLast12hChartData,
  postProcessHistoricalChartRows,
  resolveEthyleneChartDomain,
} from '@/app/lib/historySeriesSanitize';
import { isThermoKingSession } from '@/app/lib/fleetDemo';
import { CHART_METRIC_KEYS, buildChartMetricLabels } from '@/app/lib/chartMetricLabels';
import { formatUiDecimal } from '@/app/lib/formatUiNumber';

/** Modal Datos históricos: ejes Y1–Y4 y orden de variables en panel. */
const HISTORICAL_Y1_TEMP_KEYS = [
  'temp_supply_1', 'return_air', 'evaporation_coil', 'condensation_coil', 'compress_coil_1',
  'ambient_air', 'cargo_1_temp', 'cargo_2_temp', 'cargo_3_temp', 'cargo_4_temp', 'set_point',
] as const;
const HISTORICAL_Y2_PCT_KEYS = [
  'avl_pct', 'line_frequency', 'relative_humidity', 'capacity_load', 'humidity_set_point',
] as const;
const HISTORICAL_Y3_GAS_KEYS = ['set_point_o2', 'set_point_co2', 'o2_reading', 'co2_reading'] as const;
const HISTORICAL_Y4_AUX_KEYS = ['line_voltage', 'sp_ethyleno', 'ethylene'] as const;

const HISTORICAL_PRESET_COOLING = [
  'cargo_1_temp', 'cargo_2_temp', 'cargo_3_temp', 'cargo_4_temp', 'return_air',
] as const;
const HISTORICAL_PRESET_RIPENING = [
  'set_point_co2', 'co2_reading', 'ethylene', 'relative_humidity', 'temp_supply_1',
] as const;
const HISTORICAL_PRESET_STANDARD = [
  'temp_supply_1', 'return_air', 'evaporation_coil', 'relative_humidity', 'capacity_load', 'set_point',
] as const;
/** CO₂, etileno y ventilación (avl_pct). */
const HISTORICAL_PRESET_GASES = ['co2_reading', 'ethylene', 'avl_pct'] as const;
/** Incluye Set O2 por defecto (TermoKing / atmósfera controlada). */
const HISTORICAL_PRESET_CONTROLLED_ATMOSPHERE = ['set_point_o2', 'o2_reading', 'co2_reading', 'ethylene'] as const;

const HISTORICAL_SIDEBAR_METRIC_ORDER: string[] = [
  ...HISTORICAL_Y1_TEMP_KEYS,
  ...HISTORICAL_Y2_PCT_KEYS,
  ...HISTORICAL_Y3_GAS_KEYS,
  ...HISTORICAL_Y4_AUX_KEYS,
];

type HistoricalChartPreset = 'cooling' | 'ripening' | 'standard' | 'gases' | 'controlled_atmosphere';

function historicalYAxisIdForMetric(key: string): 'left' | 'pct' | 'gas' | 'aux' {
  if ((HISTORICAL_Y1_TEMP_KEYS as readonly string[]).includes(key)) return 'left';
  if ((HISTORICAL_Y2_PCT_KEYS as readonly string[]).includes(key)) return 'pct';
  if ((HISTORICAL_Y3_GAS_KEYS as readonly string[]).includes(key)) return 'gas';
  if ((HISTORICAL_Y4_AUX_KEYS as readonly string[]).includes(key)) return 'aux';
  return 'aux';
}

/** No dibujar set CO₂ en leyenda si solo hay ausencia o ceros */
function historicalCo2SetpointHasPlottedValues(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => {
    const v = row.set_point_co2;
    return (
      v != null &&
      typeof v === 'number' &&
      !Number.isNaN(v) &&
      v !== 0
    );
  });
}

function filterHistoricalChartLineKeys(keys: string[], rows: Record<string, unknown>[]): string[] {
  return keys.filter((key) => key !== 'set_point_co2' || historicalCo2SetpointHasPlottedValues(rows));
}

function sortHistoricalSelectedMetrics(keys: string[]): string[] {
  const rank = (k: string) => {
    const a = (HISTORICAL_Y1_TEMP_KEYS as readonly string[]).indexOf(k);
    if (a >= 0) return a;
    const b = (HISTORICAL_Y2_PCT_KEYS as readonly string[]).indexOf(k);
    if (b >= 0) return 100 + b;
    const c = (HISTORICAL_Y3_GAS_KEYS as readonly string[]).indexOf(k);
    if (c >= 0) return 200 + c;
    const d = (HISTORICAL_Y4_AUX_KEYS as readonly string[]).indexOf(k);
    if (d >= 0) return 300 + d;
    return 999;
  };
  return [...keys].sort((x, y) => rank(x) - rank(y));
}

/** Parte `yyyy-MM-ddTHH:mm` en fecha + hora para inputs nativos (un solo bloque de período). */
function splitDateTimeLocal(iso: string): { d: string; t: string } {
  if (!iso) return { d: '', t: '00:00' };
  const d = iso.slice(0, 10);
  const rest = iso.includes('T') ? iso.slice(11) : '';
  const t = rest.length >= 5 ? rest.slice(0, 5) : '00:00';
  return { d, t };
}

function joinDateTimeLocal(date: string, time: string): string {
  if (!date) return '';
  const t = time && time.length >= 4 ? time.slice(0, 5) : '00:00';
  return `${date}T${t}`;
}

/** Segmentos contiguos donde value === 1 (p. ej. power_state encendido). Incluye índices para recortar al rango visible. */
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

/** Segmentos contiguos donde power_state === 1 para sombreado verde. */
function computePowerShadingSegments(
  data: { timeStr: string; power_state?: number }[]
): { x1: string; x2: string; startIndex: number; endIndex: number }[] {
  return computeOnSegments(data, (i) => (data[i].power_state === 1 ? 1 : 0));
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
  /** CO₂ lectura por defecto (R244 G102 B1) */
  co2_reading: '#f46601',
  /** O₂ lectura por defecto (R5 G79 B250) */
  o2_reading: '#054ffa',
  set_point: '#dc2626',
  capacity_load: '#ea580c',
  humidity_set_point: '#2563eb',
  set_point_o2: '#4f46e5',
  set_point_co2: '#7c3aed',
  sp_ethyleno: '#059669',
  ethylene: '#10b981',
};

interface TelemetryChartsProps {
  deviceId?: string;
}

function ViewAsClientToggle({
  checked,
  onChange,
  t,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  t: (k: string) => string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
      <input
        type="checkbox"
        className="rounded border-border"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {t('telemetry_view_as_client')}
    </label>
  );
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ deviceId }) => {
  const { t, convertTemp, tempUnit, language } = useSettings();
  const metricLabels = useMemo(() => buildChartMetricLabels(t), [t, language]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [viewAsClient, setViewAsClient] = useState(false);
  const showViewAsClientToggle = isUnfilteredEthyleneViewer();
  
  const [timeRange] = useState<'12h' | '24h' | '7d'>('12h');
  const { history, isLoading } = useDeviceHistory(deviceId || null);
  const { device } = useDevice(deviceId || null);
  const { activeTracking } = useRipeningActiveForDevice(deviceId);
  const { session: panelSession } = useDeviceControlSession(deviceId);
  const { sessions: controlSessions } = useControlSessionsList(false);
  const { data: ripeningProcesses = [] } = useSWR('ripening-processes-chart', () => fetchRipeningProcesses());

  const trackingProcessesForDevice = useMemo(() => {
    if (!deviceId) return [];
    const id = String(deviceId).trim();
    return ripeningProcesses.filter(
      (p) => String((p.payload as { deviceId?: string })?.deviceId ?? '').trim() === id
    );
  }, [deviceId, ripeningProcesses]);

  const chartEthyleneMaxPpm = useMemo(() => {
    if (showsUnfilteredTelemetry({ viewAsClient })) return 1500;
    return CHART_ETHYLENE_MAX_PPM;
  }, [viewAsClient]);

  const telemetryPolicyCtx = useMemo((): TelemetryDisplayContext | null => {
    if (!deviceId) return null;
    return {
      deviceId,
      trackingProcess: activeTracking?.process ?? null,
      trackingProcesses: trackingProcessesForDevice,
      panelActiveSession: panelSession?.status === 'active' ? panelSession : null,
      sessions: controlSessions,
      device: device ?? null,
      view: { viewAsClient },
    };
  }, [deviceId, activeTracking, trackingProcessesForDevice, panelSession, controlSessions, device, viewAsClient]);

  const policyHistory = useMemo(() => {
    const raw = history ?? [];
    if (!telemetryPolicyCtx || raw.length === 0) return raw;
    return applyTelemetryDisplayPolicyToHistory(raw, telemetryPolicyCtx);
  }, [history, telemetryPolicyCtx]);

  const isTkCharts = isThermoKingSession();
  const dataClassic = useMemo(
    () => buildLast12hChartData(policyHistory, convertTemp, { ethyleneMaxPpm: chartEthyleneMaxPpm }),
    [policyHistory, convertTemp, chartEthyleneMaxPpm]
  );
  const dataThermoKing = useMemo(
    () => buildThermoKingLast12hChartData(policyHistory, convertTemp, { ethyleneMaxPpm: chartEthyleneMaxPpm }),
    [policyHistory, convertTemp, chartEthyleneMaxPpm]
  );

  const ethyleneChartDomain = useMemo((): [number, number] => {
    const values = isTkCharts
      ? dataThermoKing.map((d) => d.ethylene)
      : dataClassic.map((d) => d.ethylene);
    return resolveEthyleneChartDomain(values, { cap: chartEthyleneMaxPpm });
  }, [isTkCharts, dataClassic, dataThermoKing, chartEthyleneMaxPpm]);

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-2 h-[400px] flex items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </Card>
    );
  }

  const noHistory = (policyHistory?.length ?? 0) === 0;

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{t('last_12_hours')}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {showViewAsClientToggle && (
            <ViewAsClientToggle checked={viewAsClient} onChange={setViewAsClient} t={t} />
          )}
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
        {noHistory ? (
          <div className="h-[300px] w-full flex flex-col items-center justify-center text-center px-4 text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
            <p className="text-sm font-medium text-foreground">{t('last_12h_no_data_title')}</p>
          </div>
        ) : (
        <div className="w-full space-y-6">
          {isTkCharts ? (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('last12_dual_temp_supply_return')}</p>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dataThermoKing}
                      margin={{ top: 8, right: 24, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        yAxisId="left"
                        domain={['auto', 'auto']}
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => formatUiDecimal(Number(val))}
                        width={44}
                        label={{
                          value: `${t('temperature')} (°${tempUnit})`,
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#6b7280',
                          style: { fontSize: 11 },
                        }}
                      />
                      <Tooltip
                        formatter={(value: number | null, name) => [
                          value != null && typeof value === 'number' && !Number.isNaN(value) ? formatUiDecimal(value) : '—',
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#374151', marginBottom: '0.25rem', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '12px' }} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="temp_return"
                        name={`${metricLabels.return_air} (°${tempUnit})`}
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        allowDataOverflow
                        connectNulls
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="temp_supply"
                        name={`${metricLabels.temp_supply_1} (°${tempUnit})`}
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        allowDataOverflow
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('last12_gases_et_co_o2')}</p>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dataThermoKing}
                      margin={{ top: 8, right: 48, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        yAxisId="left"
                        domain={ethyleneChartDomain}
                        stroke="#10b981"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => Number(val).toFixed(0)}
                        width={44}
                        label={{ value: `${t('ethylene')} (ppm)`, angle: -90, position: 'insideLeft', fill: '#10b981', style: { fontSize: 11 } }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 25]}
                        stroke="#0ea5e9"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => formatUiDecimal(Number(val))}
                        width={44}
                        label={{
                          value: `${t('co2')} / ${metricLabels.o2_reading} (%)`,
                          angle: 90,
                          position: 'insideRight',
                          fill: '#0ea5e9',
                          style: { fontSize: 11 },
                        }}
                      />
                      <Tooltip
                        formatter={(value: number | null, name) => [
                          value != null && typeof value === 'number' && !Number.isNaN(value) ? formatUiDecimal(value) : '—',
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#374151', marginBottom: '0.25rem', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '12px' }} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="ethylene"
                        name={`${t('ethylene')} (ppm)`}
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        allowDataOverflow
                        connectNulls
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="co2"
                        name={`${t('co2')} (%)`}
                        stroke="#f46601"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 6 }}
                        allowDataOverflow
                        connectNulls
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="o2"
                        name={`${metricLabels.o2_reading} (%)`}
                        stroke="#054ffa"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        allowDataOverflow
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('integral_report_ripening_env')}</p>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dataClassic}
                      margin={{ top: 8, right: 48, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        yAxisId="left"
                        domain={[0, 30]}
                        stroke="#ef4444"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => formatUiDecimal(Number(val))}
                        width={44}
                        label={{ value: `${metricLabels.return_air} (°${tempUnit})`, angle: -90, position: 'insideLeft', fill: '#ef4444', style: { fontSize: 11 } }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[30, 100]}
                        stroke="#3b82f6"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => Number(val).toFixed(0)}
                        width={40}
                        label={{ value: `${t('humidity')} (%)`, angle: 90, position: 'insideRight', fill: '#3b82f6', style: { fontSize: 11 } }}
                      />
                      <Tooltip
                        formatter={(value: number | null, name) => [
                          value != null && typeof value === 'number' && !Number.isNaN(value) ? formatUiDecimal(value) : '—',
                          name,
                        ]}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#374151', marginBottom: '0.25rem', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '12px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="temp" name={`${metricLabels.return_air} (°${tempUnit})`} stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6 }} allowDataOverflow connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="humidity" name={`${t('humidity')} (%)`} stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} allowDataOverflow connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('last12_chart_ethylene_co2')}</p>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dataClassic}
                      margin={{ top: 8, right: 48, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        yAxisId="left"
                        domain={ethyleneChartDomain}
                        stroke="#10b981"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => Number(val).toFixed(0)}
                        width={44}
                        label={{ value: `${t('ethylene')} (ppm)`, angle: -90, position: 'insideLeft', fill: '#10b981', style: { fontSize: 11 } }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 6]}
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => formatUiDecimal(Number(val))}
                        width={40}
                        label={{ value: `${t('co2')} (%)`, angle: 90, position: 'insideRight', fill: '#6b7280', style: { fontSize: 11 } }}
                      />
                      <Tooltip
                        formatter={(value: number | null, name) => [
                          value != null && typeof value === 'number' && !Number.isNaN(value) ? formatUiDecimal(value) : '—',
                          name,
                        ]}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#374151', marginBottom: '0.25rem', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '12px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="ethylene" name={`${t('ethylene')} (ppm)`} stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} allowDataOverflow connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="co2" name={`${t('co2')} (%)`} stroke="#f46601" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} allowDataOverflow connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </CardContent>

      <HistoricalDataModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        deviceId={deviceId}
        telemetryPolicyCtx={telemetryPolicyCtx}
        chartEthyleneMaxPpm={chartEthyleneMaxPpm}
        viewAsClient={viewAsClient}
        onViewAsClientChange={setViewAsClient}
        showViewAsClientToggle={showViewAsClientToggle}
      />
      <HistoricalDataTableModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        deviceId={deviceId}
        telemetryPolicyCtx={telemetryPolicyCtx}
        chartEthyleneMaxPpm={chartEthyleneMaxPpm}
        viewAsClient={viewAsClient}
        onViewAsClientChange={setViewAsClient}
        showViewAsClientToggle={showViewAsClientToggle}
      />
    </Card>
  );
};

// --- Historical Data Modal Component ---

const HistoricalDataModal = ({
  isOpen,
  onClose,
  deviceId,
  telemetryPolicyCtx,
  chartEthyleneMaxPpm,
  viewAsClient,
  onViewAsClientChange,
  showViewAsClientToggle,
}: {
  isOpen: boolean;
  onClose: () => void;
  deviceId?: string;
  telemetryPolicyCtx?: TelemetryDisplayContext | null;
  chartEthyleneMaxPpm?: number;
  viewAsClient?: boolean;
  onViewAsClientChange?: (v: boolean) => void;
  showViewAsClientToggle?: boolean;
}) => {
  const { t, tempUnit, displayTimeZone, language, dateFormat } = useSettings();
  const metricLabels = useMemo(() => buildChartMetricLabels(t), [t, language]);
  
  // Initialize range to last 12 hours
  const [dateRange, setDateRange] = useState({ 
    start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"), 
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm") 
  });
  
  const [historicalPreset, setHistoricalPreset] = useState<HistoricalChartPreset | null>(() =>
    isThermoKingSession() ? 'controlled_atmosphere' : 'standard'
  );
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() =>
    isThermoKingSession() ? [...HISTORICAL_PRESET_CONTROLLED_ATMOSPHERE] : [...HISTORICAL_PRESET_STANDARD]
  );
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metricColors, setMetricColors] = useState<Record<string, string>>({});
  const [zoomRange, setZoomRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [showLabelsByMetric, setShowLabelsByMetric] = useState<Record<string, boolean>>({});
  const [showPowerShading, setShowPowerShading] = useState(false);
  const [historicalTempUnit, setHistoricalTempUnit] = useState<'C' | 'F'>('C');
  const [variablesColorSearch, setVariablesColorSearch] = useState('');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pinchStartRef = useRef<{ distance: number; startIndex: number; endIndex: number } | null>(null);
  const dragStartRef = useRef<{ clientX: number; startIndex: number; endIndex: number } | null>(null);
  const touchPanRef = useRef<{ clientX: number; startIndex: number; endIndex: number } | null>(null);
  const getLineColor = (key: string) => metricColors[key] ?? METRIC_COLORS[key] ?? '#64748b';
  const toggleLabels = (key: string) =>
    setShowLabelsByMetric((prev) => ({ ...prev, [key]: !prev[key] }));

  const chartDataLabeled = useMemo(() => {
    if (!chartData.length) return chartData;
    return chartData.map((row, i) => {
      const d = new Date(row.timestamp);
      const prev = i > 0 ? new Date(chartData[i - 1].timestamp) : null;
      const { timeStr, timeAxisLabel } = formatChartPointLabels(d, prev, displayTimeZone, language, dateFormat);
      return { ...row, timeStr, timeAxisLabel };
    });
  }, [chartData, displayTimeZone, language, dateFormat]);

  const chartDataWithDisplayTemps = useMemo(() => {
    if (!chartDataLabeled.length) return chartDataLabeled;
    const toDisp = (c: number) => (historicalTempUnit === 'C' ? c : (c * 9) / 5 + 32);
    return chartDataLabeled.map((row: any) => {
      const next = { ...row };
      (HISTORICAL_Y1_TEMP_KEYS as readonly string[]).forEach((k) => {
        const v = row[k];
        if (typeof v === 'number' && !Number.isNaN(v)) next[k] = Number(toDisp(v).toFixed(2));
      });
      return next;
    });
  }, [chartDataLabeled, historicalTempUnit]);

  const sortedSelectedMetrics = useMemo(
    () => sortHistoricalSelectedMetrics(selectedMetrics),
    [selectedMetrics]
  );

  const historicalChartLineKeys = useMemo(
    () => filterHistoricalChartLineKeys(sortedSelectedMetrics, chartData),
    [sortedSelectedMetrics, chartData]
  );

  const sidebarMetricKeys = useMemo(() => {
    const allowed = new Set(CHART_METRIC_KEYS);
    return HISTORICAL_SIDEBAR_METRIC_ORDER.filter((k) => allowed.has(k));
  }, []);

  const filteredSidebarMetricKeys = useMemo(() => {
    const q = variablesColorSearch.trim().toLowerCase();
    if (!q) return sidebarMetricKeys;
    return sidebarMetricKeys.filter((key) => {
      const label = (metricLabels[key] ?? key).toLowerCase();
      return label.includes(q) || key.toLowerCase().includes(q);
    });
  }, [sidebarMetricKeys, variablesColorSearch, metricLabels]);

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
      const historyRaw = await fetchDeviceHistory(deviceId, { fecha_inicio: startStr, fecha_fin: endStr });
      const history =
        telemetryPolicyCtx && historyRaw.length > 0
          ? applyTelemetryDisplayPolicyToHistory(historyRaw, telemetryPolicyCtx)
          : historyRaw;
      const data = history.map((h: any) => {
        const d = new Date(h.timestamp);
        const row: any = { timestamp: d.getTime(), power_state: h.power_state ?? 0, iCtrlRip: h.iCtrlRip ?? 0 };
        CHART_METRIC_KEYS.forEach((key) => {
          let v = h[key];
          if (v == null && (key.startsWith('cargo_') || key === 'set_point_o2')) { row[key] = null; return; }
          if (key === 'ethylene') {
            row[key] = v != null ? Number(v) : null;
            return;
          }
          v = Number(v ?? 0);
          if ((HISTORICAL_Y1_TEMP_KEYS as readonly string[]).includes(key)) row[key] = Number(Number(v ?? 0).toFixed(2));
          else row[key] = Number(v.toFixed(2));
        });
        row.avl_raw = h.avl_raw ?? null;
        return row;
      });
      postProcessHistoricalChartRows(data, {
        nullZeroCo2O2Readings: true,
        ethyleneMaxPpm: chartEthyleneMaxPpm,
      });
      setChartData(data);
      setZoomRange({ startIndex: 0, endIndex: data.length - 1 });
    } catch (e) {
      console.error(e);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const powerShadingSegments = useMemo(
    () => (chartDataLabeled.length ? computePowerShadingSegments(chartDataLabeled) : []),
    [chartDataLabeled]
  );

  /** Recorta segmentos al rango visible y usa timeStr del slice para que ReferenceArea dibuje (x1/x2 deben existir en data del chart). */
  const clipSegmentsToVisible = useCallback(
    (
      segments: { startIndex: number; endIndex: number }[],
      brushStart: number,
      brushEnd: number
    ): { x1: string; x2: string }[] => {
      if (!chartDataLabeled.length) return [];
      return segments
        .map((seg) => {
          const vStart = Math.max(seg.startIndex, brushStart);
          const vEnd = Math.min(seg.endIndex, brushEnd);
          if (vStart > vEnd) return null;
          return {
            x1: chartDataLabeled[vStart].timeStr,
            x2: chartDataLabeled[vEnd].timeStr,
          };
        })
        .filter((s): s is { x1: string; x2: string } => s != null);
    },
    [chartDataLabeled]
  );

  /** Y1 temperatura: datos en °C en memoria; dominio según historicalTempUnit (0–30 °C / 32–86 °F por defecto). */
  const leftDomain = useMemo((): [number, number] => {
    const u = historicalTempUnit;
    const defMin = u === 'C' ? 0 : 32;
    const defMax = u === 'C' ? 30 : 86;
    if (!chartDataWithDisplayTemps.length) return [defMin, defMax];
    const keys = selectedMetrics.filter((k) => (HISTORICAL_Y1_TEMP_KEYS as readonly string[]).includes(k));
    if (!keys.length) return [defMin, defMax];
    let lo = Infinity, hi = -Infinity;
    chartDataWithDisplayTemps.forEach((row: any) => {
      keys.forEach((key) => {
        const v = row[key];
        if (typeof v === 'number' && !Number.isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      });
    });
    if (lo === Infinity) return [defMin, defMax];
    const pad = Math.max((hi - lo) * 0.08, u === 'C' ? 0.5 : 1);
    const low = Math.min(defMin, lo - pad);
    const high = Math.max(defMax, hi + pad);
    return [Number(low.toFixed(1)), Number(high.toFixed(1))];
  }, [chartDataWithDisplayTemps, selectedMetrics, historicalTempUnit]);

  /** Y3 CO₂/O₂ (%): base 0–5, hasta ~25 salvo que los datos superen 25. */
  const gasDomain = useMemo((): [number, number] => {
    const keys = selectedMetrics
      .filter((k) => (HISTORICAL_Y3_GAS_KEYS as readonly string[]).includes(k))
      .filter((k) => k !== 'set_point_co2' || historicalCo2SetpointHasPlottedValues(chartData));
    if (!keys.length || !chartData.length) return [0, 5];
    let maxVal = 0;
    chartData.forEach((row) => {
      keys.forEach((key) => {
        const v = row[key];
        if (typeof v === 'number' && !Number.isNaN(v)) maxVal = Math.max(maxVal, v);
      });
    });
    if (maxVal <= 0) return [0, 5];
    const padded = Math.max(5, Math.ceil(maxVal * 1.08));
    if (maxVal <= 25) return [0, Math.min(25, padded)];
    return [0, Math.ceil(maxVal * 1.08)];
  }, [chartData, selectedMetrics]);

  /** Y4 voltaje / etileno: base 0–300, crece con los datos. */
  const auxDomain = useMemo((): [number, number] => {
    const keys = selectedMetrics.filter((k) => (HISTORICAL_Y4_AUX_KEYS as readonly string[]).includes(k));
    if (!keys.length || !chartData.length) return [0, 300];
    let maxVal = 0;
    chartData.forEach((row) => {
      keys.forEach((key) => {
        const v = row[key];
        if (typeof v === 'number' && !Number.isNaN(v)) maxVal = Math.max(maxVal, v);
      });
    });
    const top = Math.max(300, Math.ceil(maxVal * 1.1));
    return [0, top];
  }, [chartData, selectedMetrics]);

  const applyHistoricalPreset = useCallback((preset: HistoricalChartPreset) => {
    setHistoricalPreset(preset);
    if (preset === 'cooling') setSelectedMetrics([...HISTORICAL_PRESET_COOLING]);
    else if (preset === 'ripening') setSelectedMetrics([...HISTORICAL_PRESET_RIPENING]);
    else if (preset === 'gases') setSelectedMetrics([...HISTORICAL_PRESET_GASES]);
    else if (preset === 'controlled_atmosphere')
      setSelectedMetrics([...HISTORICAL_PRESET_CONTROLLED_ATMOSPHERE]);
    else setSelectedMetrics([...HISTORICAL_PRESET_STANDARD]);
  }, []);

  const clearAllHistoricalMetrics = useCallback(() => {
    setHistoricalPreset(null);
    setSelectedMetrics([]);
  }, []);

  const soloHistoricalMetric = useCallback((key: string) => {
    setHistoricalPreset(null);
    setSelectedMetrics([key]);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDateRange({
        start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"),
        end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
      setChartData([]);
      setZoomRange(null);
      if (isThermoKingSession()) {
        setSelectedMetrics([...HISTORICAL_PRESET_CONTROLLED_ATMOSPHERE]);
        setHistoricalPreset('controlled_atmosphere');
      } else {
        setSelectedMetrics([...HISTORICAL_PRESET_STANDARD]);
        setHistoricalPreset('standard');
      }
      setShowLabelsByMetric({});
      setHistoricalTempUnit(tempUnit === 'F' ? 'F' : 'C');
      setVariablesColorSearch('');
    }
  }, [isOpen, tempUnit]);

  useEffect(() => {
    if (chartData.length > 0 && zoomRange === null)
      setZoomRange({ startIndex: 0, endIndex: chartData.length - 1 });
  }, [chartData.length, zoomRange]);

  const resetZoom = useCallback(() => {
    if (chartData.length > 0)
      setZoomRange({ startIndex: 0, endIndex: chartData.length - 1 });
  }, [chartData.length]);

  const toggleMetric = (metric: string) => {
    setHistoricalPreset(null);
    setSelectedMetrics((prev) => (prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]));
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const row = payload?.[0]?.payload as { power_state?: number } | undefined;
    const powerOn = row && row.power_state === 1;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[180px]">
        <p className="text-xs font-semibold text-gray-700 border-b pb-2 mb-2">{label}</p>
        {powerOn && (
          <p className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded shrink-0"
              style={{ backgroundColor: '#86efac' }}
            />
            {t('chart_shading_power_on')}
          </p>
        )}
        <ul className="space-y-1">
          {(Array.isArray(payload) ? payload : []).map((entry) => (
            <li key={entry.dataKey} className="flex justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{metricLabels[String(entry.dataKey)] ?? entry.dataKey}</span>
              <span className="font-mono font-medium">{entry.value != null ? formatUiDecimal(Number(entry.value)) : '—'}</span>
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

  const histRangeStart = splitDateTimeLocal(dateRange.start);
  const histRangeEnd = splitDateTimeLocal(dateRange.end);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[98vw] w-[98vw] sm:!max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col p-3 gap-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 py-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <DialogTitle>{t('historical_data')}</DialogTitle>
              <DialogDescription>{t('viewing_history')} — {deviceId}</DialogDescription>
            </div>
            {showViewAsClientToggle && onViewAsClientChange && (
              <ViewAsClientToggle
                checked={viewAsClient ?? false}
                onChange={onViewAsClientChange}
                t={t}
              />
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 gap-4 pt-2">
          {/* Sidebar: rango y métricas + color por línea */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto border-r border-gray-200 pr-3">
            <div className="rounded-lg border border-gray-200 bg-muted/20 p-3 space-y-3">
              <h4 className="font-medium text-xs sm:text-sm text-gray-900 flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                {t('historical_period_search')}
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-gray-500 block mb-0.5">{t('historical_start')}</label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={histRangeStart.d}
                      onChange={(e) =>
                        setDateRange((prev) => ({
                          ...prev,
                          start: joinDateTimeLocal(e.target.value, splitDateTimeLocal(prev.start).t),
                        }))
                      }
                      className="flex-1 min-w-0 border rounded px-2 py-1.5 text-xs sm:text-sm"
                    />
                    <input
                      type="time"
                      value={histRangeStart.t}
                      onChange={(e) =>
                        setDateRange((prev) => ({
                          ...prev,
                          start: joinDateTimeLocal(splitDateTimeLocal(prev.start).d, e.target.value),
                        }))
                      }
                      className="w-[5.5rem] shrink-0 border rounded px-2 py-1.5 text-xs sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 block mb-0.5">{t('historical_end')}</label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={histRangeEnd.d}
                      onChange={(e) =>
                        setDateRange((prev) => ({
                          ...prev,
                          end: joinDateTimeLocal(e.target.value, splitDateTimeLocal(prev.end).t),
                        }))
                      }
                      className="flex-1 min-w-0 border rounded px-2 py-1.5 text-xs sm:text-sm"
                    />
                    <input
                      type="time"
                      value={histRangeEnd.t}
                      onChange={(e) =>
                        setDateRange((prev) => ({
                          ...prev,
                          end: joinDateTimeLocal(splitDateTimeLocal(prev.end).d, e.target.value),
                        }))
                      }
                      className="w-[5.5rem] shrink-0 border rounded px-2 py-1.5 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-1 border-t border-gray-200/80">
                <p className="text-[11px] text-gray-500 mb-1.5">{t('historical_temp_scale')}</p>
                <div className="flex rounded-md border border-gray-200 bg-white p-0.5 gap-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={historicalTempUnit === 'C' ? 'default' : 'ghost'}
                    className="h-7 flex-1 text-xs px-2"
                    onClick={() => setHistoricalTempUnit('C')}
                  >
                    °C
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={historicalTempUnit === 'F' ? 'default' : 'ghost'}
                    className="h-7 flex-1 text-xs px-2"
                    onClick={() => setHistoricalTempUnit('F')}
                  >
                    °F
                  </Button>
                </div>
              </div>
            </div>
            <Button className="w-full bg-blue-600 text-white hover:bg-blue-700 text-sm py-1.5 sm:py-2" onClick={generateData} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('generate_chart')}
            </Button>
            <div>
              <h4 className="font-medium text-xs sm:text-sm text-gray-900 mb-1.5 sm:mb-2">{t('historical_view_presets')}</h4>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={historicalPreset === 'cooling' ? 'default' : 'outline'}
                  className="w-full justify-center text-xs"
                  onClick={() => applyHistoricalPreset('cooling')}
                >
                  {t('historical_preset_cooling')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={historicalPreset === 'ripening' ? 'default' : 'outline'}
                  className="w-full justify-center text-xs"
                  onClick={() => applyHistoricalPreset('ripening')}
                >
                  {t('historical_preset_ripening')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={historicalPreset === 'standard' ? 'default' : 'outline'}
                  className="w-full justify-center text-xs"
                  onClick={() => applyHistoricalPreset('standard')}
                >
                  {t('historical_preset_standard')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={historicalPreset === 'gases' ? 'default' : 'outline'}
                  className="w-full justify-center text-xs"
                  onClick={() => applyHistoricalPreset('gases')}
                >
                  {t('historical_preset_gases')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={historicalPreset === 'controlled_atmosphere' ? 'default' : 'outline'}
                  className="w-full justify-center text-xs"
                  onClick={() => applyHistoricalPreset('controlled_atmosphere')}
                >
                  {t('historical_preset_controlled_atmosphere')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-center text-xs text-muted-foreground border-dashed"
                  onClick={clearAllHistoricalMetrics}
                >
                  {t('historical_clear_all')}
                </Button>
              </div>
            </div>
            <div className="rounded bg-gray-50 border border-gray-100 p-1.5 sm:p-2 text-xs text-gray-600">
              <p className="font-medium text-gray-700 mb-0.5 sm:mb-1">{t('chart_shading_section')}</p>
              <label className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={showPowerShading}
                  onChange={() => setShowPowerShading((v) => !v)}
                  className="rounded border-gray-300 text-green-600"
                />
                <span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-300/60 shrink-0" />
                <span>{t('chart_shading_power_on')}</span>
              </label>
            </div>
            <div className="min-h-0 flex flex-col">
              <h4 className="font-medium text-xs sm:text-sm text-gray-900 flex items-center gap-2 mb-1 sm:mb-2">
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t('historical_variables_and_color')}
              </h4>
              <div className="relative mb-1.5 sm:mb-2">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                <input
                  type="search"
                  value={variablesColorSearch}
                  onChange={(e) => setVariablesColorSearch(e.target.value)}
                  placeholder={t('historical_variables_search_placeholder')}
                  className="w-full pl-8 pr-2 py-1.5 rounded-md border border-gray-200 bg-white text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1 max-h-[20vh] sm:max-h-[45vh] overflow-y-auto">
                {filteredSidebarMetricKeys.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2 px-1">{t('historical_variables_no_match')}</p>
                ) : (
                  filteredSidebarMetricKeys.map((key) => (
                  <div key={key} className="flex flex-wrap items-center gap-1.5 text-xs hover:bg-gray-50 p-1.5 rounded group">
                    <input
                      type="checkbox"
                      id={`m-${key}`}
                      checked={selectedMetrics.includes(key)}
                      onChange={() => toggleMetric(key)}
                      className="rounded border-gray-300 text-blue-600 shrink-0"
                      aria-label={metricLabels[key]}
                    />
                    <span
                      className="truncate flex-1 cursor-pointer min-w-0 select-none"
                      style={{ color: getLineColor(key) }}
                      title={`${metricLabels[key]} — ${t('historical_solo_doubleclick')}`}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        soloHistoricalMetric(key);
                      }}
                    >
                      {metricLabels[key]}
                    </span>
                    <label className="flex items-center gap-1 shrink-0 cursor-pointer" title={t('historical_show_values_title')}>
                      <input
                        type="checkbox"
                        checked={!!showLabelsByMetric[key]}
                        onChange={() => toggleLabels(key)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-[10px] text-gray-500">{t('historical_show_values')}</span>
                    </label>
                    <input
                      type="color"
                      value={getLineColor(key)}
                      onChange={(e) => setMetricColors((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-6 h-6 rounded border border-gray-200 cursor-pointer shrink-0"
                      title={t('historical_color_of', { label: metricLabels[key] })}
                    />
                  </div>
                ))
                )}
              </div>
            </div>
          </div>

          {/* Área gráfica: flexible y con zoom */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
            {chartDataLabeled.length > 0 ? (
              <>
                <div className="flex items-center justify-end gap-2 py-1 px-2 border-b border-gray-100 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetZoom}
                    className="text-xs"
                    title={t('chart_reset_zoom_title')}
                  >
                    {t('chart_reset_zoom')}
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
                  <ResponsiveContainer width="100%" height="100%" key={`chart-${chartDataLabeled.length}`}>
                    <ComposedChart
                      data={chartDataWithDisplayTemps.slice(brushStart, brushEnd + 1)}
                      margin={{ top: 14, right: 112, bottom: 28, left: 44 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis
                        dataKey="timeStr"
                        stroke="#6b7280"
                        fontSize={9}
                        tickLine={false}
                        tick={{ fontSize: 9 }}
                        interval="preserveStartEnd"
                        tickFormatter={(_, index) => chartDataWithDisplayTemps.slice(brushStart, brushEnd + 1)[index]?.timeAxisLabel ?? ''}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#475569"
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={(v) => Number(v).toFixed(1)}
                        domain={leftDomain}
                        width={36}
                        label={{
                          value: `°${historicalTempUnit}`,
                          angle: -90,
                          position: 'insideLeft',
                          style: { fill: '#475569', fontSize: 10 },
                        }}
                      />
                      <YAxis
                        yAxisId="pct"
                        orientation="right"
                        domain={[0, 100]}
                        stroke="#6366f1"
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={(v) => String(Number(v))}
                        width={30}
                        label={{
                          value: '%',
                          angle: 90,
                          position: 'insideRight',
                          offset: 6,
                          style: { fill: '#6366f1', fontSize: 9 },
                        }}
                      />
                      <YAxis
                        yAxisId="gas"
                        orientation="right"
                        domain={gasDomain}
                        stroke="#7c3aed"
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={(v) => Number(v).toFixed(1)}
                        width={30}
                        label={{
                          value: 'O₂/CO₂',
                          angle: 90,
                          position: 'insideRight',
                          offset: 6,
                          style: { fill: '#7c3aed', fontSize: 9 },
                        }}
                      />
                      <YAxis
                        yAxisId="aux"
                        orientation="right"
                        domain={auxDomain}
                        stroke="#059669"
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={(v) => Number(v).toFixed(0)}
                        width={32}
                        label={{
                          value: 'V / ppm',
                          angle: 90,
                          position: 'insideRight',
                          offset: 4,
                          style: { fill: '#059669', fontSize: 9 },
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '4px' }} formatter={(value) => metricLabels[value] ?? value} iconSize={8} fontSize={10} />
                      {showPowerShading &&
                        clipSegmentsToVisible(powerShadingSegments, brushStart, brushEnd).map((seg, idx) => (
                          <ReferenceArea
                            key={`shade-${idx}-${seg.x1}-${seg.x2}`}
                            x1={seg.x1}
                            x2={seg.x2}
                            y1={0}
                            y2={100}
                            yAxisId="pct"
                            fill="#86efac"
                            fillOpacity={0.35}
                          />
                        ))}
                      {historicalChartLineKeys.map((key, lineIndex) => {
                        const color = getLineColor(key);
                        const showLabels = !!showLabelsByMetric[key];
                        const visibleLen = brushEnd - brushStart + 1;
                        const displayData = chartDataWithDisplayTemps.slice(brushStart, brushEnd + 1);
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
                            yAxisId={historicalYAxisIdForMetric(key)}
                            type="monotone"
                            dataKey={key}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                            activeDot={{ r: 4 }}
                            name={metricLabels[key]}
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
                                  const text = typeof value === 'number' ? formatUiDecimal(value) : String(value);
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
                <p className="text-sm sm:text-base font-medium text-center">{t('no_data_in_range')}</p>
                <p className="text-xs sm:text-sm mt-1 text-center">{t('generate_chart_to_load')}</p>
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
  { id: 'controlled_atmosphere', columns: ['set_point_o2', 'o2_reading', 'co2_reading', 'ethylene'] },
  { id: 'full', columns: CHART_METRIC_KEYS },
];

function tableModalDefaultPresetColumns(): string[] {
  if (isThermoKingSession()) {
    const preset = TABLE_PRESETS.find((p) => p.id === 'controlled_atmosphere');
    if (preset) return [...preset.columns];
  }
  return [...TABLE_PRESETS[0].columns];
}

const HistoricalDataTableModal = ({
  isOpen,
  onClose,
  deviceId,
  telemetryPolicyCtx,
  chartEthyleneMaxPpm,
  viewAsClient,
  onViewAsClientChange,
  showViewAsClientToggle,
}: {
  isOpen: boolean;
  onClose: () => void;
  deviceId?: string;
  telemetryPolicyCtx?: TelemetryDisplayContext | null;
  chartEthyleneMaxPpm?: number;
  viewAsClient?: boolean;
  onViewAsClientChange?: (v: boolean) => void;
  showViewAsClientToggle?: boolean;
}) => {
  const { t, convertTemp, tempUnit, formatDateTime, formatFileTimestamp, language } = useSettings();
  const metricLabels = useMemo(() => buildChartMetricLabels(t), [t, language]);
  const [dateRange, setDateRange] = useState({
    start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"),
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => tableModalDefaultPresetColumns());
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const tableDataLabeled = useMemo(
    () => tableData.map((row) => ({ ...row, timeStr: formatDateTime(row.timestamp) })),
    [tableData, formatDateTime]
  );

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
      const historyRaw = await fetchDeviceHistory(deviceId, { fecha_inicio: startStr, fecha_fin: endStr });
      const history =
        telemetryPolicyCtx && historyRaw.length > 0
          ? applyTelemetryDisplayPolicyToHistory(historyRaw, telemetryPolicyCtx)
          : historyRaw;
      const data = history.map((h: any) => {
        const d = new Date(h.timestamp);
        const row: any = { timestamp: d.getTime(), power_state: h.power_state ?? 0, iCtrlRip: h.iCtrlRip ?? 0 };
        CHART_METRIC_KEYS.forEach((key) => {
          let v = h[key];
          if (v == null && (key.startsWith('cargo_') || key === 'set_point_o2')) { row[key] = null; return; }
          if (key === 'ethylene') {
            row[key] = v != null ? Number(v) : null;
            return;
          }
          v = Number(v ?? 0);
          if ((HISTORICAL_Y1_TEMP_KEYS as readonly string[]).includes(key)) row[key] = Number(Number(v ?? 0).toFixed(2));
          else row[key] = Number(v.toFixed(2));
        });
        row.avl_raw = h.avl_raw ?? null;
        return row;
      });
      postProcessHistoricalChartRows(data, {
        nullZeroCo2O2Readings: true,
        ethyleneMaxPpm: chartEthyleneMaxPpm,
      });
      const forDisplay = data.map((row: any) => {
        const next = { ...row };
        tempKeysTable.forEach((k) => {
          const v = next[k];
          if (typeof v === 'number' && !Number.isNaN(v)) next[k] = Number(convertTemp(v).toFixed(2));
        });
        return next;
      });
      setTableData(forDisplay);
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
      setSelectedColumns(tableModalDefaultPresetColumns());
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
    if ((key === 'co2_reading' || key === 'o2_reading') && Number(v) === 0) return '-';
    if (key === 'ethylene' && Number(v) === 0) return 'NA';
    if (typeof v === 'number') return formatUiDecimal(v);
    return String(v);
  };

  const exportRows = [...tableDataLabeled].reverse();
  const exportHeader = [t('chart_export_datetime'), ...selectedColumns.map((k) => metricLabels[k])];

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
    pdf.save(`datos_historicos_${deviceId || 'tabla'}_${formatFileTimestamp()}.pdf`);
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
    a.download = `datos_historicos_${deviceId || 'tabla'}_${formatFileTimestamp()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadExcel = () => {
    const rows = [exportHeader, ...exportRows.map((row: any) => [row.timeStr, ...selectedColumns.map((k) => formatCellForExport(row, k))])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `datos_historicos_${deviceId || 'tabla'}_${formatFileTimestamp()}.xlsx`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[98vw] w-[98vw] sm:!max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col p-3 gap-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 py-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <DialogTitle>{t('historical_data_table')}</DialogTitle>
              <DialogDescription>{t('viewing_history')} — {deviceId} · {t('search_by_date')}</DialogDescription>
            </div>
            {showViewAsClientToggle && onViewAsClientChange && (
              <ViewAsClientToggle
                checked={viewAsClient ?? false}
                onChange={onViewAsClientChange}
                t={t}
              />
            )}
          </div>
        </DialogHeader>
        <div className="flex flex-1 min-h-0 gap-4 pt-2">
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto border-r border-gray-200 pr-3">
            <div>
              <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2 mb-2">
                <CalendarIcon className="h-4 w-4" /> {t('date_range')}
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">{t('historical_start')}</label>
                  <input
                    type="datetime-local"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('historical_end')}</label>
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
              <h4 className="font-medium text-sm text-gray-900 mb-2">{t('table_preset_views')}</h4>
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
                    <span className="truncate">{metricLabels[key]}</span>
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
                      <th className="text-left px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">{t('chart_export_datetime')}</th>
                      {selectedColumns.map((key) => (
                        <th key={key} className="text-right px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                          {metricLabels[key]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...tableDataLabeled].reverse().map((row: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.timeStr}</td>
                        {selectedColumns.map((key) => (
                          <td key={key} className="px-3 py-2 text-right font-mono whitespace-nowrap">
                            {row[key] == null
                              ? '—'
                              : (key === 'co2_reading' || key === 'o2_reading') && Number(row[key]) === 0
                                ? '-'
                                : key === 'ethylene' && Number(row[key]) === 0
                                  ? 'NA'
                                  : typeof row[key] === 'number'
                                    ? formatUiDecimal(Number(row[key]))
                                    : String(row[key])}
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
                <p className="text-base font-medium">{t('no_data_in_range')}</p>
                <p className="text-sm mt-1">{t('generate_table_to_load')}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
