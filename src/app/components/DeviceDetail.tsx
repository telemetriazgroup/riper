import React, { useState, useMemo, useEffect } from 'react';
import { differenceInMinutes } from 'date-fns';
import { useDevice, useDeviceHistory } from '@/app/hooks/useDevices';
import { TelemetryCharts } from './TelemetryCharts';
import { ControlPanel } from './ControlPanel';
import { EventLog } from './EventLog';
import { ArrowLeft, Battery, Thermometer, Calendar, Loader2, BarChart2, LayoutDashboard, Zap, ClipboardList } from 'lucide-react';
import { Button } from './ui/Button';
import * as Tabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import { useSettings } from '@/app/contexts/SettingsContext';
import { resolveControlPanelTab, formatMaduradorScalar } from '@/app/lib/madurador';
import { resolveDeviceDisplayName } from '@/app/lib/deviceLocalNames';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';
import { TunnelDeviceDetail } from '@/app/components/TunnelDeviceDetail';
import { MaduradorOperativoSummaryPanel } from '@/app/components/MaduradorOperativoSummaryPanel';
import { DeviceCurrentStatusPanel } from '@/app/components/DeviceCurrentStatusPanel';
import { DeviceControlProcessPanel } from '@/app/components/DeviceControlProcessPanel';
import { DeviceRipeningTrackingOverview } from '@/app/components/DeviceRipeningTrackingOverview';
import { DeviceMonitoringAnalysis } from '@/app/components/DeviceMonitoringAnalysis';
import { TunnelCommandCompliancePanel } from '@/app/components/TunnelCommandCompliancePanel';
import { showGourmetTunnelCommandStatesPanel, isGourmetSession } from '@/app/lib/gourmet';
import { formatUiDecimal } from '@/app/lib/formatUiNumber';

interface DeviceDetailProps {
  deviceId: string;
  onBack: () => void;
  initialView?: 'operation' | 'analysis' | 'log';
  /** Abre la vista Seguimiento / procesos para crear seguimiento con receta. */
  onGoToCreateTracking?: () => void;
}

export const DeviceDetail: React.FC<DeviceDetailProps> = ({
  deviceId,
  onBack,
  initialView = 'operation',
  onGoToCreateTracking,
}) => {
  const { device, isLoading } = useDevice(deviceId);
  const { history } = useDeviceHistory(deviceId);
  const { session: activeControlSession } = useDeviceControlSession(deviceId);
  const [controlMode, setControlMode] = useState('manual');
  const [activeView, setActiveView] = useState(initialView);
  const { t, convertTemp, tempUnit, formatTemp, toggleTempUnit, formatDateTime } = useSettings();

  useEffect(() => {
    if (!device) return;
    setControlMode(
      resolveControlPanelTab({
        activeSessionProcessType:
          activeControlSession?.status === 'active' ? activeControlSession.process_type : null,
        procesoApi: device.procesoApi,
        stateProcess: device.telemetry.stateProcess,
      })
    );
  }, [
    device?.id,
    device?.procesoApi,
    device?.telemetry.stateProcess,
    activeControlSession?.id,
    activeControlSession?.status,
    activeControlSession?.process_type,
  ]);

  const lastSeenDate = device?.last_seen ? new Date(device.last_seen) : null;
  const minsSinceLastSeen =
    lastSeenDate && !isNaN(lastSeenDate.getTime())
      ? differenceInMinutes(new Date(), lastSeenDate)
      : 999999;
  const showOfflineBanner =
    device &&
    (device.estado_conexion === 'offline' || minsSinceLastSeen > 720 || device.status === 'offline');

  const displayDeviceForStatus = useMemo(() => {
    if (!device || !isGourmetSession()) return device;
    if (
      activeControlSession?.status === 'active' &&
      activeControlSession.process_type === 'Cooling'
    ) {
      const sp = Number((activeControlSession.params as Record<string, unknown>)?.setPoint);
      if (Number.isFinite(sp)) {
        return {
          ...device,
          telemetry: { ...device.telemetry, set_point: sp },
        };
      }
    }
    return device;
  }, [device, activeControlSession]);

  const consumptionKwhPeriod = useMemo(() => {
    if (!history || history.length < 2) return null;
    const first = history[0] as { power_kwh?: number | null };
    const last = history[history.length - 1] as { power_kwh?: number | null };
    const a = first?.power_kwh ?? 0;
    const b = last?.power_kwh ?? 0;
    const diff = b - a;
    return diff >= 0 ? diff : null;
  }, [history]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!device) return <div>{t('device_not_found')}</div>;

  if (device.tunnel) {
    return <TunnelDeviceDetail device={device} onBack={onBack} onGoToCreateTracking={onGoToCreateTracking} />;
  }

  const lastCommFormatted =
    lastSeenDate && !isNaN(lastSeenDate.getTime()) ? formatDateTime(lastSeenDate) : '—';

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} title={t('back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{resolveDeviceDisplayName(device)}</h2>
            <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>ID: {device.id}</span>
              <span>•</span>
              <span className={
                device.estado_conexion === 'online' ? "text-green-600 dark:text-green-400 font-bold" :
                device.estado_conexion === 'wait' ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"
              }>
                {device.estado_conexion === 'online' ? 'En línea' : device.estado_conexion === 'wait' ? 'Espera' : 'Desconectado'}
              </span>
              <span>•</span>
              <span className={device.telemetry.power_state === 1 ? "text-green-600 dark:text-green-400 font-bold" : "text-muted-foreground"}>
                {device.telemetry.power_state === 1 ? 'Equipo ON' : 'Equipo OFF'}
              </span>
            </div>
            {showOfflineBanner && (
              <p className="mt-2 text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-2xl dark:text-amber-100 dark:bg-amber-950/40 dark:border-amber-800">
                <span className="font-medium">{t('last_connection')}: </span>
                {lastCommFormatted}
                <span className="block mt-1 text-amber-800/95 dark:text-amber-200/90">{t('last_values_registered_hint')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex gap-4 text-sm text-muted-foreground hidden lg:flex bg-muted/50 px-4 py-2 rounded-lg border border-border">
            <div className="flex items-center gap-1">
               <Battery className="h-4 w-4 text-muted-foreground/70" /> 
               <span className="font-mono text-foreground">{device.operational.battery_voltage}V</span>
            </div>
            <div className="w-px h-4 bg-border"></div>
            <div className="flex items-center gap-1">
               <Thermometer className="h-4 w-4 text-muted-foreground/70" /> 
               <span className="font-mono text-foreground">{convertTemp(device.operational.ambient_air)}°{tempUnit}</span>
            </div>
          </div>

          <Tabs.Root value={activeView} onValueChange={(v) => setActiveView(v as any)}>
            <Tabs.List className="flex bg-muted p-1 rounded-lg">
              <Tabs.Trigger 
                value="operation" 
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeView === 'operation' ? "bg-card text-blue-700 dark:text-blue-300 shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">{t('operation')}</span>
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="analysis" 
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeView === 'analysis' ? "bg-card text-blue-700 dark:text-blue-300 shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BarChart2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t('monitoring')}</span>
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="log" 
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeView === 'log' ? "bg-card text-blue-700 dark:text-blue-300 shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">{t('event_log')}</span>
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </div>
      </div>

      <DeviceRipeningTrackingOverview deviceId={deviceId} />

      {/* Main Content Area */}
      {activeView === 'operation' ? (
        <div className="space-y-6 h-full animate-in fade-in duration-300">
          <DeviceCurrentStatusPanel
            device={displayDeviceForStatus ?? device}
            t={t}
            formatTemp={formatTemp}
            tempUnit={tempUnit}
            toggleTempUnit={toggleTempUnit}
            formatDateTime={formatDateTime}
          />
          <DeviceControlProcessPanel deviceId={deviceId} />
          {showGourmetTunnelCommandStatesPanel(
            deviceId,
            activeControlSession?.process_type,
            activeControlSession?.status
          ) && <TunnelCommandCompliancePanel deviceId={deviceId} />}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left Column: Control Panel */}
          <div className="lg:col-span-1">
            <ControlPanel mode={controlMode} onChangeMode={setControlMode} deviceId={deviceId} device={device} />
          </div>

          {/* Right Column: Charts & Info */}
          <div className="lg:col-span-2 space-y-6">
            <TelemetryCharts deviceId={deviceId} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                  <h3 className="font-semibold mb-4 text-foreground">{t('current_process_status')}</h3>
                  {device.process ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                         <span className="text-muted-foreground">{t('recipe')}</span>
                         <span className="font-medium text-right text-foreground">{device.process.name}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-muted-foreground">{t('phase')}</span>
                         <span className="font-medium text-blue-600 dark:text-blue-400">{device.process.currentPhase}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-muted-foreground">{t('start')}</span>
                         <span className="font-medium text-foreground">{new Date(device.process.startTime).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-muted-foreground">{t('estimated_end')}</span>
                         <span className="font-medium text-foreground">{new Date(device.process.endTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>{t('no_active_process')}</p>
                    </div>
                  )}
               </div>

               <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                  <h3 className="font-semibold mb-4 text-foreground">{t('operational_data')}</h3>
                  <div className="space-y-3 text-sm">
                     {consumptionKwhPeriod != null && (
                       <div className="flex justify-between border-b border-border pb-2">
                         <span className="text-muted-foreground flex items-center gap-1">
                           <Zap className="h-4 w-4" /> {t('energy_consumption_period')}
                         </span>
                         <span className="font-mono font-medium text-foreground">{formatUiDecimal(consumptionKwhPeriod)} kWh</span>
                       </div>
                     )}
                     <div className="flex justify-between border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('power_consumption')}</span>
                       <span className="font-mono text-foreground">{device.operational.power_consumption} kW</span>
                     </div>
                     <div className="flex justify-between border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('total_accumulated')}</span>
                       <span className="font-mono text-foreground">{device.operational.power_kwh} kWh</span>
                     </div>
                     <div className="flex justify-between border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('defrost_interval')}</span>
                       <span className="font-mono text-foreground">{device.operational.defrost_interval}h</span>
                     </div>
                     <div className="flex justify-between pb-2">
                       <span className="text-muted-foreground">{t('evaporation_coil')}</span>
                       <span className="font-mono text-foreground">{convertTemp(device.operational.evaporation_coil)}°{tempUnit}</span>
                     </div>
                  </div>
               </div>

               {device.madurador && (
                 <div className="bg-card p-6 rounded-lg border border-border shadow-sm md:col-span-2">
                   <h3 className="font-semibold mb-4 text-foreground">{t('madurador_reference_title')}</h3>
                   <p className="text-xs text-muted-foreground mb-4">
                     {device.madurador.identificador_empresa
                       ? `${t('identificador_field_short')}: ${device.madurador.identificador_empresa}`
                       : null}
                   </p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_estado')}</span>
                       <span className="font-medium text-right">{device.madurador.power_state_label}</span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_supply')}</span>
                       <span className="font-mono">{convertTemp(device.telemetry.temp_supply_1)}°{tempUnit}</span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_return')}</span>
                       <span className="font-mono">{convertTemp(device.telemetry.return_air)}°{tempUnit}</span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_evap')}</span>
                       <span className="font-mono">{convertTemp(device.operational.evaporation_coil)}°{tempUnit}</span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_cond')}</span>
                       <span className="font-mono">{convertTemp(device.operational.condensation_coil)}°{tempUnit}</span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_compressor')}</span>
                       <span className="font-mono text-right">
                         {formatMaduradorScalar(device.madurador.compress_coil_1_display)}
                       </span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_avl')}</span>
                       <span className="font-mono text-right">
                         {formatMaduradorScalar(device.madurador.avl_display)}
                       </span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_voltage')}</span>
                       <span className="font-mono text-right">
                         {formatMaduradorScalar(device.madurador.line_voltage_display)}
                       </span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_set_co2')}</span>
                       <span className="font-mono text-right">
                         {formatMaduradorScalar(device.madurador.set_point_co2_display)}
                       </span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_set_hum')}</span>
                       <span className="font-mono">
                         {device.madurador.humidity_set_point != null
                           ? `${device.madurador.humidity_set_point}%`
                           : '—'}
                       </span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2">
                       <span className="text-muted-foreground">{t('madurador_detail_capacity')}</span>
                       <span className="font-mono">
                         {device.madurador.capacity_load != null ? `${device.madurador.capacity_load}%` : '—'}
                       </span>
                     </div>
                     {device.madurador.fecha_inicio &&
                       !isNaN(new Date(device.madurador.fecha_inicio).getTime()) && (
                       <div className="flex justify-between gap-2 border-b border-border pb-2 sm:col-span-2 lg:col-span-3">
                         <span className="text-muted-foreground">{t('madurador_process_start')}</span>
                         <span className="font-mono text-right text-xs">
                           {formatDateTime(device.madurador.fecha_inicio)}
                         </span>
                       </div>
                     )}
                     {device.madurador.fecha_procesada &&
                       !isNaN(new Date(device.madurador.fecha_procesada).getTime()) && (
                       <div className="flex justify-between gap-2 border-b border-border pb-2 sm:col-span-2 lg:col-span-3">
                         <span className="text-muted-foreground">{t('madurador_fecha_procesada')}</span>
                         <span className="font-mono text-right text-xs">
                           {formatDateTime(device.madurador.fecha_procesada)}
                         </span>
                       </div>
                     )}
                     <div className="flex justify-between gap-2 border-b border-border pb-2 sm:col-span-2 lg:col-span-3">
                       <span className="text-muted-foreground">{t('madurador_last_on')}</span>
                       <span className="font-mono text-right text-xs">
                         {device.madurador.ultima_fecha_encendido
                           ? formatDateTime(device.madurador.ultima_fecha_encendido)
                           : '—'}
                       </span>
                     </div>
                     <div className="flex justify-between gap-2 border-b border-border pb-2 sm:col-span-2 lg:col-span-3">
                       <span className="text-muted-foreground">{t('madurador_until')}</span>
                       <span className="font-mono text-right text-xs">
                         {device.madurador.hasta
                           ? formatDateTime(device.madurador.hasta)
                           : '—'}
                       </span>
                     </div>
                     <div className="flex justify-between gap-2 pb-2 sm:col-span-2 lg:col-span-3">
                       <span className="text-muted-foreground">{t('madurador_last_sample')}</span>
                       <span className="font-mono text-right text-xs">
                         {device.madurador.last_sample_fecha
                           ? formatDateTime(device.madurador.last_sample_fecha)
                           : '—'}
                       </span>
                     </div>
                   </div>
                 </div>
               )}

               {device.maduradorSummary ? (
                 <MaduradorOperativoSummaryPanel
                   summary={device.maduradorSummary}
                   ultimaFechaEncendido={device.madurador?.ultima_fecha_encendido}
                 />
               ) : null}
            </div>
          </div>
        </div>
        </div>
      ) : activeView === 'log' ? (
        <div className="min-h-[400px]">
          <EventLog deviceId={deviceId} />
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg border shadow-sm min-h-[600px]">
          <DeviceMonitoringAnalysis deviceId={deviceId} onGoToCreateTracking={onGoToCreateTracking} />
        </div>
      )}
    </div>
  );
};
