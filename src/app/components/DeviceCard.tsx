import React, { useState, useEffect, useMemo } from 'react';
import type { KeyedMutator } from 'swr';
import { Device } from '@/app/data';
import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import { controlSessionProgressPct } from '@/app/lib/deviceControlProcessApi';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { getFleetProcesoMaduradorLabel, getPanelControlProcessTitle } from '@/app/lib/fleetProcessLabels';
import { getFleetCardTemperatureDisplay } from '@/app/lib/fleetTemperatureDisplay';
import { qualifiesForFleetAlarmHighlight } from '@/app/lib/fleetKpi';
import { getRipeningRecipePhaseLabels, mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import {
  Thermometer,
  Droplets,
  Wind,
  Activity,
  Gauge,
  Clock,
  Edit2,
  Check,
  X,
  Loader2,
  Power,
  WifiOff,
  Timer,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { Button } from './ui/Button';
import { updateDeviceName } from '@/app/lib/api';
import { applySobrenombresToDevice, deviceNameStorageKey, resolveDeviceDisplayName } from '@/app/lib/deviceLocalNames';
import { toast } from 'sonner';
import { useSettings } from '@/app/contexts/SettingsContext';
import { differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { isThermoKingSession } from '@/app/lib/fleetDemo';
import { isManualProcesoLabel } from '@/app/lib/madurador';
import { formatFleetEthyleneLabel } from '@/app/lib/ethyleneDisplayPolicy';
import { formatUiDecimal, formatUiPercent } from '@/app/lib/formatUiNumber';
import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';

function fleetEthyleneText(
  device: Device,
  trackingProcess?: RipeningProcessRow | null,
  panelActiveSession?: DeviceControlSessionRow | null
): string {
  return formatFleetEthyleneLabel(device, { trackingProcess, panelActiveSession });
}

interface DeviceCardProps {
  device: Device;
  onClick: (deviceId: string) => void;
  /** SWR `mutate` de la lista de dispositivos: permite alias optimista + revalidación. */
  onRefresh?: KeyedMutator<Device[]>;
  /** Sesión activa iniciada desde el panel (prioridad sobre proceso API Madurador). */
  panelActiveSession?: DeviceControlSessionRow | null;
  /** Proceso activo de la pestaña Seguimiento enlazado a este equipo (`payload.deviceId`). */
  trackingProcess?: RipeningProcessRow | null;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onClick,
  onRefresh,
  panelActiveSession,
  trackingProcess,
}) => {
  const { t, language, formatDateTime, formatTemp } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(() => resolveDeviceDisplayName(device));
  const [isSaving, setIsSaving] = useState(false);
  const [trackingDetailsOpen, setTrackingDetailsOpen] = useState(false);
  const displayName = resolveDeviceDisplayName(device);
  const ethyleneFleetLabel = fleetEthyleneText(device, trackingProcess, panelActiveSession);

  useEffect(() => {
    setNewName(displayName);
  }, [device.id, displayName]);

  useEffect(() => {
    setTrackingDetailsOpen(false);
  }, [device.id]);

  const hasTrackingProcess = Boolean(trackingProcess);

  const trackingView = useMemo(
    () => (trackingProcess ? mapRowToProcessView(trackingProcess) : null),
    [trackingProcess]
  );

  const plannedRecipeSteps = useMemo(
    () => (trackingProcess ? getRipeningRecipePhaseLabels(trackingProcess.payload) : []),
    [trackingProcess]
  );

  const trackingProgressPct =
    trackingView != null && Number.isFinite(trackingView.progress)
      ? Math.min(100, Math.max(0, trackingView.progress))
      : null;

  const fleetTemps = useMemo(
    () =>
      getFleetCardTemperatureDisplay(
        device,
        panelActiveSession,
        trackingProcess,
        trackingProgressPct
      ),
    [device, panelActiveSession, trackingProcess, trackingProgressPct]
  );

  const handleSaveName = async (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    const trimmed = newName.trim();
    if (trimmed === displayName.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const key = deviceNameStorageKey(device.id) || device.id;
      await updateDeviceName(device.id, trimmed);
      if (onRefresh) {
        await onRefresh(
          (current) =>
            (current ?? []).map((d) =>
              deviceNameStorageKey(d.id) === key
                ? applySobrenombresToDevice(
                    { ...d, nombreApi: d.nombreApi ?? d.name },
                    { [key]: trimmed }
                  )
                : d
            ),
          { revalidate: true }
        );
      }
      toast.success(t('name_updated'));
      setIsEditing(false);
    } catch (error) {
      toast.error(t('error_updating_name'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewName(displayName);
    setIsEditing(false);
  };

  // Status Logic
  const isValidDate = (d: Date) => d instanceof Date && !isNaN(d.getTime());
  const lastSeenDate = device.last_seen ? new Date(device.last_seen) : new Date(0);
  const isDateValid = isValidDate(lastSeenDate);

  const minsSinceLastSeen = isDateValid ? differenceInMinutes(new Date(), lastSeenDate) : 999999;

  const isTkCard = isThermoKingSession();

  let connectionStatus: 'online' | 'standby' | 'offline' = 'online';
  if (minsSinceLastSeen > 720) connectionStatus = 'offline'; // > 12 hours
  else if (minsSinceLastSeen > 30) connectionStatus = 'standby'; // > 30 mins

  const isPoweredOff = device.telemetry.power_state === 0;

  const isFleetAlarm = qualifiesForFleetAlarmHighlight(device);
  const isManualFleetProcess = isManualProcesoLabel(device.procesoApi);

  const getStatusColor = () => {
    if (connectionStatus === 'offline') return 'border-l-4 border-l-gray-400 bg-gray-50 dark:bg-muted/40';
    if (connectionStatus === 'standby') return 'border-l-4 border-l-orange-400 bg-orange-50/30 dark:bg-orange-950/25';
    
    // Online
    if (isFleetAlarm) return 'border-l-4 border-l-red-500';
    if (device.status === 'warning') return 'border-l-4 border-l-yellow-500';
    
    if (isPoweredOff) return 'border-l-4 border-l-gray-300';
    
    return 'border-l-4 border-l-green-500';
  };

  const getStatusBadge = () => {
    const base = 'shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1';
    if (connectionStatus === 'offline') {
      return <span className={cn(base, 'bg-gray-200 text-gray-600')}><WifiOff className="w-3 h-3 shrink-0"/> OFFLINE</span>;
    }
    if (connectionStatus === 'standby') {
      return <span className={cn(base, 'bg-orange-100 text-orange-700')}><Timer className="w-3 h-3 shrink-0"/> ESPERA</span>;
    }
    if (isPoweredOff) {
      return <span className={cn(base, 'bg-gray-200 text-gray-700')}><Power className="w-3 h-3 shrink-0"/> APAGADO</span>;
    }
    if (isFleetAlarm) {
      return <span className={cn(base, 'bg-red-100 text-red-700')}>ALARMA</span>;
    }
    if (device.status === 'warning') {
      return <span className={cn(base, 'bg-yellow-100 text-yellow-700')}>AVISO</span>;
    }
    return <span className={cn(base, 'bg-green-100 text-green-700')}>ACTIVO</span>;
  };

  const formatLastSeen = () => {
    if (!isDateValid) return '-';
    if (isManualFleetProcess) {
      return formatDateTime(lastSeenDate);
    }
    try {
      return formatDistanceToNow(lastSeenDate, { addSuffix: true, locale: language === 'es' ? es : enUS });
    } catch (error) {
      return '-';
    }
  };

  const renderFleetProcessStrip = (variant: 'online' | 'offline') => {
    const wrap =
      variant === 'online'
        ? 'col-span-2 mt-2 pt-2 border-t border-border'
        : 'mt-3 pt-3 border-t border-border';

    if (!hasTrackingProcess && !panelActiveSession && !device.process) return null;

    const sch = trackingProcess?.payload?.scheduleSummary;

    return (
      <div className={wrap}>
        {hasTrackingProcess && trackingProcess && trackingView ? (
          <div className="rounded-md border border-teal-200 bg-teal-50/80 px-2 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-teal-800 flex items-center gap-2">
              {t('fleet_tracking_block_title')}
              {trackingProcess.status === 'paused' && (
                <span className="rounded px-1.5 py-0.5 bg-amber-200 text-amber-950 normal-case font-semibold">
                  {t('fleet_tracking_paused_badge')}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-teal-950 mt-0.5">
              {trackingProcess.display_name || trackingView.display_name || '—'}
            </p>
            <p className="text-[11px] text-teal-900/90 mt-1">
              {trackingView.client?.name ?? '—'} · {trackingView.batch?.product ?? '—'}
            </p>
            <p className="text-[11px] text-teal-800 mt-0.5">
              <span className="font-medium">{t('phase')}: </span>
              {trackingView.phase}
            </p>
            {trackingProgressPct != null && (
              <>
                <div className="flex justify-between items-center mt-2 gap-2">
                  <span className="text-[11px] font-mono font-semibold text-teal-900">{trackingProgressPct}%</span>
                </div>
                <div className="w-full bg-teal-200/80 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-teal-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${trackingProgressPct}%` }}
                  />
                </div>
              </>
            )}
            {plannedRecipeSteps.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-teal-900 uppercase tracking-wide">
                  {t('fleet_tracking_planned_phases')}
                </p>
                <ol className="mt-1 text-[11px] text-teal-900/95 list-decimal list-inside space-y-0.5">
                  {plannedRecipeSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            <button
              type="button"
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium text-teal-900 hover:bg-teal-100/80"
              onClick={(e) => {
                e.stopPropagation();
                setTrackingDetailsOpen((o) => !o);
              }}
            >
              {trackingDetailsOpen ? (
                <>
                  {t('fleet_tracking_hide_details')} <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                </>
              ) : (
                <>
                  {t('fleet_tracking_more_details')} <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </>
              )}
            </button>
            {trackingDetailsOpen && (
              <div className="mt-2 border-t border-teal-200/70 pt-2 text-[11px] text-teal-950 space-y-1.5">
                <div className="font-mono text-[10px] break-all">
                  <span className="text-teal-700">UUID: </span>
                  {trackingProcess.id}
                </div>
                {trackingView.recipe?.name && (
                  <div>
                    <span className="text-teal-700">{t('recipe')}: </span>
                    {trackingView.recipe.name}
                  </div>
                )}
                {sch?.startedAt && (
                  <div>
                    <span className="text-teal-700">{t('start')}: </span>
                    {formatDateTime(sch.startedAt)}
                  </div>
                )}
                {(sch?.estimatedEndAt || sch?.totalDurationHours != null) && (
                  <div>
                    <span className="text-teal-700">{t('estimated_end')}: </span>
                    {sch?.estimatedEndAt
                      ? formatDateTime(sch.estimatedEndAt)
                      : sch?.totalDurationHours != null
                        ? `${sch.totalDurationHours} h`
                        : '—'}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {panelActiveSession ? (
              <div className="rounded-md border border-indigo-200/80 bg-indigo-50/60 px-2 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                  {t('fleet_process_panel')}
                </div>
                <p className="text-sm font-semibold text-indigo-950 mt-0.5">
                  {getPanelControlProcessTitle(
                    panelActiveSession.process_type,
                    panelActiveSession.display_label,
                    t
                  )}
                </p>
                <div className="text-[11px] text-indigo-900/90 mt-1 space-y-0.5">
                  <div>
                    <span className="text-indigo-700/80">{t('start')}: </span>
                    {formatDateTime(panelActiveSession.started_at)}
                  </div>
                  <div>
                    <span className="text-indigo-700/80">{t('control_process_estimated_end')}: </span>
                    {formatDateTime(panelActiveSession.estimated_end_at)}
                  </div>
                </div>
                <div className="w-full bg-indigo-200/80 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${controlSessionProgressPct(panelActiveSession)}%` }}
                  />
                </div>
              </div>
            ) : device.process ? (
              <div>
                <div className="flex justify-between items-center mb-1 gap-2">
                  <span className="text-xs font-medium text-blue-600">
                    {getFleetProcesoMaduradorLabel(device.procesoApi, t)}
                  </span>
                  {!isManualFleetProcess && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" /> {device.process.timeLeft ?? '—'}
                    </span>
                  )}
                </div>
                {isManualFleetProcess ? (
                  <div className="text-[10px] text-muted-foreground">
                    {t('last_data')}: {isDateValid ? formatDateTime(lastSeenDate) : '—'}
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] text-muted-foreground space-y-0.5 mb-1">
                      <div>
                        {t('start')}: {formatDateTime(device.process.startTime)}
                      </div>
                      <div>
                        {t('end')}: {formatDateTime(device.process.endTime)}
                      </div>
                    </div>
                    {device.process.showProgressBar !== false && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${device.process.progress}%` }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  };

  return (
    <Card 
      className={cn("cursor-pointer hover:shadow-md transition-shadow overflow-hidden", getStatusColor())}
      onClick={() => onClick(device.id)}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0 relative z-10 overflow-hidden min-w-0">
        <div className="flex-1 min-w-0 overflow-hidden mr-2" onClick={(e) => isEditing && e.stopPropagation()}>
          {isEditing ? (
            <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-sm font-bold text-card-foreground border-b-2 border-blue-500 focus:outline-none bg-transparent px-1 py-0.5"
                placeholder={t('device_name_placeholder')}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName(e);
                  if (e.key === 'Escape') handleCancel(e as any);
                }}
              />
              <button onClick={handleSaveName} disabled={isSaving} className="p-1 hover:bg-green-100 rounded text-green-600">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={handleCancel} disabled={isSaving} className="p-1 hover:bg-red-100 rounded text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg font-bold text-card-foreground truncate">{displayName}</CardTitle>
              {device.tunnel && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                  <Layers className="h-3 w-3" />
                  TÚNEL
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewName(displayName);
                  setIsEditing(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400"
                title={t('rename_device')}
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="text-xs text-muted-foreground font-mono mt-1 flex items-center gap-2">
            <span>{device.id}</span>
            <span className="text-[10px] text-muted-foreground/70">• {formatLastSeen()}</span>
          </div>
        </div>
        <div className="flex-shrink-0">{getStatusBadge()}</div>
      </CardHeader>
      
      <CardContent>
        {connectionStatus === 'offline' ? (
           <div className="space-y-3">
             <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
               <div className="font-semibold flex items-center gap-2">
                 <WifiOff className="h-4 w-4 shrink-0" />
                 {t('device_disconnected')}
               </div>
               <div className="text-xs mt-1">{t('last_connection')}: {isDateValid ? formatDateTime(lastSeenDate) : '—'}</div>
               <div className="text-xs text-amber-900/90 mt-0.5">{t('last_values_registered_hint')}</div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-3">
                 <div className="flex items-center gap-2">
                   <Thermometer className="h-4 w-4 text-red-500" />
                   <div>
                     <div className="text-xs text-muted-foreground">{t('temperature')}</div>
                     <div className="font-bold text-card-foreground">
                       {Number.isFinite(fleetTemps.primaryC) ? formatTemp(fleetTemps.primaryC) : '—'}
                       <span className="text-muted-foreground/70 font-normal ml-1">
                         / {Number.isFinite(fleetTemps.setpointC) ? formatTemp(fleetTemps.setpointC) : '—'}
                       </span>
                     </div>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   {isTkCard ? (
                     <Gauge className="h-4 w-4 text-sky-500" />
                   ) : (
                     <Droplets className="h-4 w-4 text-blue-500" />
                   )}
                   <div>
                     <div className="text-xs text-muted-foreground">{isTkCard ? t('oxygen') : t('humidity')}</div>
                     <div className="font-bold text-card-foreground">
                       {isTkCard
                         ? device.telemetry.o2_reading != null && Number.isFinite(device.telemetry.o2_reading as number)
                           ? formatUiPercent(device.telemetry.o2_reading as number)
                           : '—'
                         : formatUiPercent(device.telemetry.relative_humidity)}
                     </div>
                   </div>
                 </div>
               </div>
               <div className="space-y-3">
                 <div className="flex items-center gap-2">
                   <Activity className="h-4 w-4 text-green-500" />
                   <div>
                     <div className="text-xs text-muted-foreground">{t('ethylene')}</div>
                     <div className="font-bold text-card-foreground">{ethyleneFleetLabel}</div>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <Wind className="h-4 w-4 text-muted-foreground" />
                   <div>
                     <div className="text-xs text-muted-foreground">{t('co2')}</div>
                     <div className="font-bold text-card-foreground">
                       {device.telemetry.co2_reading != null ? formatUiPercent(device.telemetry.co2_reading) : '-'}
                     </div>
                   </div>
                 </div>
               </div>
             </div>
             {renderFleetProcessStrip('offline')}
           </div>
        ) : (
          <div className={cn('relative grid grid-cols-2 gap-4', isPoweredOff && 'opacity-60 grayscale')}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-red-500" />
                <div>
                  <div className="text-xs text-muted-foreground">{t('temperature')}</div>
                  <div className="font-bold text-card-foreground">
                       {Number.isFinite(fleetTemps.primaryC) ? formatTemp(fleetTemps.primaryC) : '—'}
                       <span className="text-gray-400 font-normal ml-1">
                         / {Number.isFinite(fleetTemps.setpointC) ? formatTemp(fleetTemps.setpointC) : '—'}
                       </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isTkCard ? (
                  <Gauge className="h-4 w-4 text-sky-500" />
                ) : (
                  <Droplets className="h-4 w-4 text-blue-500" />
                )}
                <div>
                  <div className="text-xs text-muted-foreground">{isTkCard ? t('oxygen') : t('humidity')}</div>
                  <div className="font-bold text-card-foreground">
                    {isTkCard
                      ? device.telemetry.o2_reading != null && Number.isFinite(device.telemetry.o2_reading as number)
                        ? formatUiPercent(device.telemetry.o2_reading as number)
                        : '—'
                      : formatUiPercent(device.telemetry.relative_humidity)}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-xs text-muted-foreground">{t('ethylene')}</div>
                  <div className="font-bold text-card-foreground">{ethyleneFleetLabel}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">{t('co2')}</div>
                  <div className="font-bold text-card-foreground">
                    {device.telemetry.co2_reading != null ? formatUiPercent(device.telemetry.co2_reading) : '-'}
                  </div>
                </div>
              </div>
            </div>

            {renderFleetProcessStrip('online')}
            
            {isPoweredOff && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="bg-gray-900/10 backdrop-blur-[1px] absolute inset-0 rounded-b-xl" />
                 {/* Optional: Add an overlay text if needed */}
              </div>
            )}
          </div>
        )}
        
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800 p-0 h-auto hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              onClick(device.id);
            }}
          >
            {t('view_details')} →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
