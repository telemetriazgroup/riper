import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  chartNullIfZero,
  sanitizeCo2PercentSeries,
  sanitizeEthylenePpmSeries,
} from '@/app/lib/historySeriesSanitize';
import {
  Activity,
  AlertCircle,
  ClipboardCheck,
  FlaskConical,
  Leaf,
  Loader2,
  Wind,
  Zap,
  ClipboardList,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import { formatUiDecimal, formatUiPercent } from '@/app/lib/formatUiNumber';
import { useRipeningActiveForDevice } from '@/app/hooks/useRipeningActiveForDevice';
import type { HistoryPoint } from '@/app/lib/api';
import { fetchMaduradorRangoHistoryForImei } from '@/app/lib/madurador';
import {
  cumulativeVentilationFt3FromRawRows,
  energyKwhDeltaFromPoints,
  freshAirModeLabel,
  ft3ToM3,
  lastRawRow,
  ventilationLabelFromAvlRaw,
} from '@/app/lib/deviceMonitoringMetrics';
import { inferCurrentNextPhase, mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';
import { getStoredUser } from '@/app/lib/auth';
import { canRegisterRipeningSampling } from '@/app/lib/permissions';
import { postRipeningSampling, fetchRipeningProcess } from '@/app/lib/ripeningProcessesApi';
import { RipeningSamplingModal, type SamplingType, type SamplingParameter } from '@/app/components/RipeningSamplingModal';
import { toast } from 'sonner';

interface DeviceMonitoringAnalysisProps {
  deviceId: string;
  /** Ir a la vista Procesos / Seguimiento para crear uno nuevo. */
  onGoToCreateTracking?: () => void;
}

function chartTick(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return ts;
  }
}

function gasExchangeLabel(mode: number, t: (k: string) => string): string {
  if (mode === 0) return t('gas_ex_off');
  if (mode === 1) return t('gas_ex_manual');
  if (mode === 2) return t('gas_ex_auto');
  return String(mode);
}

export const DeviceMonitoringAnalysis: React.FC<DeviceMonitoringAnalysisProps> = ({
  deviceId,
  onGoToCreateTracking,
}) => {
  const { t, formatDateTime } = useSettings();
  const { activeTracking, isLoading: trackingLoading, mutate: mutateTracking } =
    useRipeningActiveForDevice(deviceId);
  const [chartTab, setChartTab] = useState<'environment' | 'gases'>('environment');
  const [samplingModalOpen, setSamplingModalOpen] = useState(false);
  const [samplingSaving, setSamplingSaving] = useState(false);

  const canRegisterSampling =
    activeTracking?.process?.status === 'active' && canRegisterRipeningSampling();

  const startedAtIso = useMemo(() => {
    const sum = activeTracking?.summary;
    if (!sum?.startedAt) return activeTracking?.process?.created_at ?? null;
    return sum.startedAt;
  }, [activeTracking?.summary, activeTracking?.process]);

  const swrKey =
    activeTracking?.process && startedAtIso
      ? `device-monitoring-rango:${deviceId}:${startedAtIso}`
      : null;

  const {
    data: rangoData,
    error: rangoError,
    isLoading: rangoLoading,
  } = useSWR(
    swrKey,
    async () => {
      const start = new Date(startedAtIso!);
      let fin = new Date();
      if (fin.getTime() <= start.getTime()) {
        fin = new Date(start.getTime() + 60_000);
      }
      return fetchMaduradorRangoHistoryForImei(deviceId, {
        fecha_inicio: startedAtIso!,
        fecha_fin: fin.toISOString(),
        maduradorAmericaLima: true,
        includeRawDatos: true,
      });
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const view = useMemo(() => {
    if (!activeTracking?.process) return null;
    return mapRowToProcessView(activeTracking.process);
  }, [activeTracking?.process]);

  const phaseHint = useMemo(() => {
    if (!activeTracking?.process || !view) return null;
    const pct =
      activeTracking.summary?.progress != null && Number.isFinite(activeTracking.summary.progress)
        ? activeTracking.summary.progress
        : view.progress;
    return inferCurrentNextPhase(activeTracking.process.payload, pct);
  }, [activeTracking, view]);

  const chartRows = useMemo(() => {
    const pts = rangoData?.points ?? [];
    if (!pts.length) return [];
    const tempPulp = pts.map((p: HistoryPoint) => chartNullIfZero(p.return_air));
    const tempAir = pts.map((p: HistoryPoint) => chartNullIfZero(p.temp_supply_1));
    const eth = sanitizeEthylenePpmSeries(pts.map((p: HistoryPoint) => p.ethylene));
    const co2San = sanitizeCo2PercentSeries(pts.map((p: HistoryPoint) => p.co2_reading));
    const co2 = co2San.map((v) => (v === 0 ? null : v));
    return pts.map((p: HistoryPoint, i: number) => ({
      tick: chartTick(p.timestamp),
      ts: p.timestamp,
      temp_pulp: tempPulp[i],
      temp_air: tempAir[i],
      ethylene: eth[i],
      co2: co2[i],
    }));
  }, [rangoData?.points]);

  const metrics = useMemo(() => {
    const raw = rangoData?.rawDatos;
    const pts = rangoData?.points ?? [];
    const ft3 = raw?.length ? cumulativeVentilationFt3FromRawRows(raw) : 0;
    const m3 = ft3ToM3(ft3);
    const kwh = energyKwhDeltaFromPoints(pts);
    const last = lastRawRow(raw);
    const avlLbl = ventilationLabelFromAvlRaw(last?.avl);
    const fam = freshAirModeLabel(last?.fresh_air_ex_mode);
    return { ft3, m3, kwh, avlLbl, fam, last };
  }, [rangoData]);

  /** Último muestreo por marca de tiempo (timeline puede venir reciente primero o no). */
  const lastSample = useMemo(() => {
    const tl = activeTracking?.process?.timeline;
    if (!Array.isArray(tl)) return null;
    const sampling = tl.filter((ev: unknown) => (ev as { type?: string })?.type === 'sampling');
    if (!sampling.length) return null;
    let best: unknown = sampling[0];
    for (let i = 1; i < sampling.length; i++) {
      const ev = sampling[i];
      const a = new Date((ev as { timestamp?: string }).timestamp ?? 0).getTime();
      const b = new Date((best as { timestamp?: string }).timestamp ?? 0).getTime();
      if (a >= b) best = ev;
    }
    return best;
  }, [activeTracking?.process]);

  const samplingHistory = useMemo(() => {
    const tl = activeTracking?.process?.timeline;
    if (!Array.isArray(tl)) return [];
    const list = tl.filter((ev: unknown) => {
      const o = ev as { type?: string };
      return o?.type === 'sampling';
    }) as {
      timestamp?: string;
      title?: string;
      user?: string;
      persona_escrita?: string;
      data?: { name: string; value: string; unit: string }[];
    }[];
    return [...list].sort(
      (a, b) =>
        new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()
    );
  }, [activeTracking?.process]);

  const handleSaveSampling = async (newSample: {
    type: SamplingType;
    parameters: SamplingParameter[];
    notes: string;
    imageFiles: File[];
    personaEscrita: string;
  }) => {
    const pid = activeTracking?.process?.id;
    if (!pid) return;
    setSamplingSaving(true);
    try {
      await postRipeningSampling(
        pid,
        {
          samplingType: newSample.type,
          personaEscrita: newSample.personaEscrita.trim(),
          parameters: newSample.parameters
            .filter((p) => p.value !== '')
            .map((p) => ({ name: p.name, value: p.value, unit: p.unit })),
          notes: newSample.notes || undefined,
        },
        newSample.imageFiles
      );
      await fetchRipeningProcess(pid);
      await mutateTracking(undefined, { revalidate: true });
      toast.success(t('detail_monitoring_sampling_saved'));
      setSamplingModalOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSamplingSaving(false);
    }
  };

  if (trackingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[320px] text-muted-foreground gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t('control_follow_loading')}
      </div>
    );
  }

  if (!activeTracking?.summary || !activeTracking.process) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400 mx-auto" />
        <p className="text-lg font-medium text-foreground">{t('detail_monitoring_no_tracking')}</p>
        {onGoToCreateTracking && (
          <Button type="button" className="gap-2" onClick={onGoToCreateTracking}>
            <ClipboardList className="h-4 w-4" />
            {t('detail_monitoring_create_cta')}
          </Button>
        )}
      </div>
    );
  }

  const sum = activeTracking.summary;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Predictiva placeholder */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start">
        <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">{t('detail_monitoring_predictive_placeholder')}</p>
      </div>

      {/* Resumen proceso */}
      <Card className="border-teal-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-teal-50/80 border-b border-teal-100 py-3">
          <CardTitle className="text-base text-teal-950">{sum.display_name}</CardTitle>
          <p className="text-sm text-teal-800 mt-1">
            {sum.client} · {sum.product}
          </p>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-xs uppercase text-slate-500">{t('detail_tracking_phase_now')}</span>
            <p className="font-semibold text-slate-900">{phaseHint?.currentLabel ?? '—'}</p>
          </div>
          <div>
            <span className="text-xs uppercase text-slate-500">{t('detail_tracking_phase_next')}</span>
            <p className="font-semibold text-slate-900">{phaseHint?.nextLabel ?? t('detail_tracking_phase_none_next')}</p>
          </div>
          <div>
            <span className="text-xs uppercase text-slate-500">{t('detail_tracking_progress')}</span>
            <p className="font-mono font-semibold">{sum.progress}%</p>
          </div>
          <div>
            <span className="text-xs uppercase text-slate-500">{t('detail_tracking_estimated_end')}</span>
            <p className="font-mono text-xs">{sum.estimatedEndAt ? formatDateTime(sum.estimatedEndAt) : '—'}</p>
          </div>
        </CardContent>
      </Card>

      {rangoLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('detail_monitoring_loading_series')}
        </div>
      )}
      {rangoError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {t('detail_monitoring_fetch_error')}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('detail_monitoring_co2_volume')}
          primary={`${metrics.ft3.toFixed(0)} ft³`}
          secondary={`${formatUiDecimal(metrics.m3)} m³`}
          icon={<Leaf className="w-5 h-5 text-green-600" />}
        />
        <MetricCard
          title={t('detail_monitoring_energy_period')}
          primary={metrics.kwh != null ? `${formatUiDecimal(metrics.kwh)} kWh` : '—'}
          secondary={t('detail_monitoring_energy_hint')}
          icon={<Zap className="w-5 h-5 text-yellow-600" />}
        />
        <MetricCard
          title={t('detail_monitoring_ethylene_title')}
          primary={t('detail_monitoring_ethylene_na')}
          icon={<FlaskConical className="w-5 h-5 text-purple-500" />}
        />
        <MetricCard
          title={t('detail_monitoring_vent_state')}
          primary={metrics.avlLbl.closed ? t('detail_monitoring_vent_closed') : metrics.avlLbl.label}
          secondary={
            metrics.fam >= 0 && metrics.fam <= 2
              ? `${t('detail_monitoring_vent_control')}: ${gasExchangeLabel(metrics.fam, t)}`
              : undefined
          }
          icon={<Wind className="w-5 h-5 text-sky-600" />}
        />
      </div>

      {/* Gráficas */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg text-gray-800">{t('detail_monitoring_evolution_title')}</CardTitle>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setChartTab('environment')}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                chartTab === 'environment' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
              )}
            >
              {t('detail_monitoring_charts_env')}
            </button>
            <button
              type="button"
              onClick={() => setChartTab('gases')}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                chartTab === 'gases' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
              )}
            >
              {t('detail_monitoring_charts_gas')}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {!chartRows.length && !rangoLoading ? (
            <p className="text-sm text-slate-500 py-8 text-center">{t('detail_monitoring_empty_series')}</p>
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === 'environment' ? (
                  <AreaChart data={chartRows}>
                    <defs>
                      <linearGradient id="gradAir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="tick" fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis domain={['auto', 'auto']} fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="temp_pulp"
                      name={t('detail_monitoring_pulp')}
                      stroke="#ef4444"
                      fillOpacity={0}
                      strokeWidth={2}
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="temp_air"
                      name={t('detail_monitoring_air')}
                      stroke="#2563eb"
                      fill="url(#gradAir)"
                      strokeWidth={2}
                      connectNulls
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="tick" fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis yAxisId="l" domain={['auto', 'auto']} fontSize={11} />
                    <YAxis yAxisId="r" orientation="right" domain={['auto', 'auto']} fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="l"
                      type="monotone"
                      dataKey="ethylene"
                      name={t('ethylene') + ' (ppm)'}
                      stroke="#9333ea"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                    <Line
                      yAxisId="r"
                      type="monotone"
                      dataKey="co2"
                      name={'CO₂ (%)'}
                      stroke="#64748b"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Muestreo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              {t('detail_monitoring_last_sampling')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {!lastSample ? (
              <p className="text-sm text-slate-500">{t('detail_monitoring_no_sampling_yet')}</p>
            ) : (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <dt className="text-[11px] font-semibold uppercase text-slate-500">
                      {t('detail_monitoring_sampling_by')}
                    </dt>
                    <dd className="font-medium text-slate-900 mt-0.5">
                      {(lastSample as { persona_escrita?: string; user?: string }).persona_escrita?.trim() ||
                        (lastSample as { user?: string }).user ||
                        '—'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <dt className="text-[11px] font-semibold uppercase text-slate-500">
                      {t('detail_monitoring_sampling_at')}
                    </dt>
                    <dd className="font-mono text-slate-900 mt-0.5 text-xs">
                      {(lastSample as { timestamp?: string }).timestamp
                        ? formatDateTime(String((lastSample as { timestamp?: string }).timestamp))
                        : '—'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 sm:col-span-1">
                    <dt className="text-[11px] font-semibold uppercase text-slate-500">
                      {t('detail_monitoring_sampling_type')}
                    </dt>
                    <dd className="font-medium text-slate-900 mt-0.5">
                      {(lastSample as { title?: string }).title || t('detail_monitoring_sampling_fallback')}
                    </dd>
                  </div>
                </dl>
                {Array.isArray((lastSample as { data?: unknown }).data) &&
                ((lastSample as { data: unknown[] }).data?.length ?? 0) > 0 ? (
                  <ul className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">{t('detail_monitoring_measured_values')}</p>
                    {((lastSample as { data: { name: string; value: string; unit: string }[] }).data).map(
                      (paramRow, i) => (
                        <li key={i} className="flex justify-between text-sm border rounded-md px-3 py-2">
                          <span className="text-slate-600">{paramRow.name}</span>
                          <span className="font-mono font-medium">
                            {paramRow.value} {paramRow.unit}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                ) : null}
              </>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto gap-2">
                  <Activity className="h-4 w-4" />
                  {t('detail_monitoring_history_title')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('detail_monitoring_history_title')}</DialogTitle>
                </DialogHeader>
                <ul className="space-y-3 text-sm">
                  {samplingHistory.length === 0 ? (
                    <li className="text-slate-500">{t('detail_monitoring_no_sampling_yet')}</li>
                  ) : (
                    samplingHistory.map((ev, idx) => (
                      <li key={idx} className="border rounded-lg p-3 space-y-2">
                        <div className="font-medium text-slate-900">{ev.title ?? t('detail_monitoring_sampling_fallback')}</div>
                        <dl className="text-xs text-slate-600 space-y-1">
                          <div>
                            <dt className="inline font-semibold">{t('detail_monitoring_sampling_by')}: </dt>
                            <dd className="inline">{ev.persona_escrita ?? ev.user ?? '—'}</dd>
                          </div>
                          <div>
                            <dt className="inline font-semibold">{t('detail_monitoring_sampling_at')}: </dt>
                            <dd className="inline font-mono">
                              {ev.timestamp ? formatDateTime(ev.timestamp) : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline font-semibold">{t('detail_monitoring_sampling_type')}: </dt>
                            <dd className="inline">{ev.title ?? '—'}</dd>
                          </div>
                        </dl>
                        {ev.data && ev.data.length > 0 && (
                          <ul className="mt-2 space-y-1 font-mono text-xs border-t border-slate-100 pt-2">
                            {ev.data.map((d, j) => (
                              <li key={j}>
                                {d.name}: {d.value} {d.unit}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-gradient-to-br from-blue-50/90 to-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('detail_monitoring_add_sampling_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>{t('detail_monitoring_add_sampling_desc')}</p>
            {canRegisterSampling ? (
              <Button
                type="button"
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setSamplingModalOpen(true)}
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('sampling_register')}
              </Button>
            ) : (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                {t('detail_monitoring_sampling_no_permission')}
              </p>
            )}
            {onGoToCreateTracking && (
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={onGoToCreateTracking}>
                {t('detail_monitoring_open_processes')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {samplingModalOpen && (
        <RipeningSamplingModal
          isOpen={samplingModalOpen}
          onClose={() => !samplingSaving && setSamplingModalOpen(false)}
          onSave={handleSaveSampling}
          saving={samplingSaving}
          defaultPersonaName={getStoredUser()?.name || ''}
        />
      )}
    </div>
  );
};

function MetricCard({
  title,
  primary,
  secondary,
  icon,
}: {
  title: string;
  primary: string;
  secondary?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
          {icon}
        </div>
        <div className="text-xl font-bold text-gray-900">{primary}</div>
        {secondary ? <div className="text-xs text-gray-500 mt-1">{secondary}</div> : null}
      </CardContent>
    </Card>
  );
}
