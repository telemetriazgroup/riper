import React, { useState, useEffect, useMemo } from 'react';
import { Button, buttonVariants } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { cn } from '@/app/lib/utils';
import { Thermometer, Wind, Zap, Play, Snowflake, Fan, Timer, WifiOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { sendControlCommand } from '@/app/lib/api';
import { applyTunnelManualCommands } from '@/app/lib/tunnelCommandsApi';
import { isGourmetTunnelCommandDevice } from '@/app/lib/gourmet';
import { Device } from '@/app/data';
import { useSettings } from '@/app/contexts/SettingsContext';
import { differenceInMinutes } from 'date-fns';
import { ControlProcessStartFlow } from '@/app/components/ControlProcessStartFlow';
import { StopPlanScheduleModal } from '@/app/components/StopPlanScheduleModal';
import type { StartControlProcessBody } from '@/app/lib/deviceControlProcessApi';
import { startControlProcess } from '@/app/lib/deviceControlProcessApi';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';
import { revalidateControlSessionsList } from '@/app/hooks/useControlSessionsList';
import { revalidateFleetActiveControlSessions } from '@/app/hooks/useFleetActiveControlMap';
import { useRipeningActiveForDevice } from '@/app/hooks/useRipeningActiveForDevice';
import { isManualProcesoLabel } from '@/app/lib/madurador';
import { canOperateDeviceControl } from '@/app/lib/permissions';

/** Objetivos manual en °C / % / ppm (telemetría). */
const MANUAL_TEMP_MIN_C = 5;
const MANUAL_TEMP_MAX_C = 30;
const MANUAL_RH_MIN = 80;
const MANUAL_RH_MAX = 99;
const MANUAL_ETH_MIN = 0;
const MANUAL_ETH_MAX = 250;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

interface ControlPanelProps {
  mode: string;
  onChangeMode: (mode: string) => void;
  deviceId?: string;
  device?: Device;
}

type ControlStartDraft = Omit<StartControlProcessBody, 'deviceId' | 'startedAt'>;

export const ControlPanel: React.FC<ControlPanelProps> = ({ mode, onChangeMode, deviceId, device }) => {
  const { t, tempUnit } = useSettings();
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowDraft, setFlowDraft] = useState<ControlStartDraft | null>(null);
  const { activeTracking, isLoading: trackingLoading } = useRipeningActiveForDevice(deviceId);

  /** Proceso activo creado desde la pestaña Seguimiento y enlazado a este equipo. */
  const followBlocksPanelProcesses = useMemo(() => {
    if (trackingLoading) return false;
    return Boolean(activeTracking?.process && activeTracking.summary);
  }, [activeTracking, trackingLoading]);

  const openStartFlow = (partial: ControlStartDraft) => {
    if (!deviceId) return;
    if (!canOperateDeviceControl()) {
      toast.error(t('viewer_cannot_control_panel'));
      return;
    }
    if (followBlocksPanelProcesses) {
      toast.error(t('control_follow_blocked_toast'));
      return;
    }
    setFlowDraft(partial);
    setFlowOpen(true);
  };

  const modes = [
    { id: 'manual', label: t('manual_mode'), icon: Zap },
    { id: 'homogenization', label: t('homogenization'), icon: Thermometer },
    { id: 'ripening', label: t('ripening'), icon: Play },
    { id: 'ventilation', label: t('ventilation'), icon: Fan },
    { id: 'cooling', label: t('cooling'), icon: Snowflake },
  ];

  // Global disable logic for processes
  const lastSeenDate = device?.last_seen ? new Date(device.last_seen) : new Date();
  const minsSinceLastSeen = differenceInMinutes(new Date(), lastSeenDate);
  const isOffline = minsSinceLastSeen > 720;
  const isStandby = minsSinceLastSeen > 30 && !isOffline;
  const isPoweredOff = device?.telemetry.power_state === 0;
  
  // Processes require device to be ONLINE and POWERED ON
  const areProcessesDisabled = isOffline || isStandby || isPoweredOff;
  const processModesBlockedByFollow = followBlocksPanelProcesses;
  const processModesDisabled =
    areProcessesDisabled || processModesBlockedByFollow || !canOperateDeviceControl();

  return (
    <Card className="h-full">
      <div className="border-b border-gray-100">
        <div className="flex overflow-x-auto no-scrollbar">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onChangeMode(m.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                mode === m.id
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <CardContent className="p-6">
        {mode === 'manual' && (
          <ManualControl
            deviceId={deviceId}
            device={device}
            followBlocksPanelProcesses={processModesBlockedByFollow}
            readOnly={!canOperateDeviceControl()}
          />
        )}
        {mode === 'homogenization' && (
          <HomogenizationControl
            deviceId={deviceId}
            disabled={processModesDisabled}
            onBeginStart={openStartFlow}
            tempUnitKey={tempUnit}
          />
        )}
        {mode === 'ripening' && (
          <RipeningControl
            deviceId={deviceId}
            disabled={processModesDisabled}
            onBeginStart={openStartFlow}
            tempUnitKey={tempUnit}
          />
        )}
        {mode === 'ventilation' && (
          <VentilationControl deviceId={deviceId} disabled={processModesDisabled} onBeginStart={openStartFlow} />
        )}
        {mode === 'cooling' && (
          <CoolingControl deviceId={deviceId} disabled={processModesDisabled} onBeginStart={openStartFlow} tempUnitKey={tempUnit} />
        )}
      </CardContent>
      <ControlProcessStartFlow
        open={flowOpen}
        onOpenChange={(o) => {
          setFlowOpen(o);
          if (!o) setFlowDraft(null);
        }}
        deviceId={deviceId}
        draft={flowDraft}
        onCompleted={() => {}}
      />
    </Card>
  );
};

const ControlGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-6 p-4 border border-gray-100 rounded-lg bg-gray-50/50">
    <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">{title}</h4>
    {children}
  </div>
);

type RangeControlProps = {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
  step?: number;
  originalValue?: number;
  disabled?: boolean;
  /** Decimales para mostrar y editar (0 = enteros). */
  decimals?: number;
};

const RangeControl = ({
  label,
  value,
  unit,
  min,
  max,
  onChange,
  step = 1,
  originalValue,
  disabled = false,
  decimals = 1,
}: RangeControlProps) => {
  const isChanged = originalValue !== undefined && Math.abs(value - originalValue) > 1e-9;

  const commitNumber = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    let v = clamp(n, min, max);
    if (decimals <= 0) v = Math.round(v);
    else v = Number(v.toFixed(decimals));
    onChange(v);
  };

  const displayVal =
    decimals <= 0 ? String(Math.round(value)) : decimals >= 2 ? value.toFixed(decimals) : value.toFixed(decimals);

  return (
    <div
      className={cn(
        'mb-4 p-3 rounded-lg transition-colors border',
        isChanged ? 'bg-blue-50 border-blue-200' : 'border-transparent',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <div className="flex justify-between mb-2 gap-2 flex-wrap items-start">
        <Label className={cn('text-sm font-medium', isChanged ? 'text-blue-700' : 'text-gray-600')}>{label}</Label>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              disabled={disabled}
              min={min}
              max={max}
              step={step}
              value={displayVal}
              onChange={(e) => commitNumber(e.target.value)}
              className={cn(
                'w-[5rem] rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-mono text-right shadow-sm',
                isChanged ? 'border-blue-300 text-blue-800' : 'text-gray-900'
              )}
              aria-label={label}
            />
            <span className={cn('text-sm font-bold whitespace-nowrap', isChanged ? 'text-blue-700' : 'text-gray-900')}>
              {unit}
            </span>
          </div>
          {isChanged && originalValue !== undefined && (
            <span className="text-xs text-blue-400 line-through decoration-blue-400/50">
              {decimals <= 0 ? Math.round(originalValue) : Number(originalValue.toFixed(decimals))} {unit}
            </span>
          )}
        </div>
      </div>
      <div className="relative flex items-center w-full h-5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            const c = clamp(v, min, max);
            onChange(decimals <= 0 ? Math.round(c) : Number(c.toFixed(decimals)));
          }}
          disabled={disabled}
          className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer transition-colors',
            isChanged ? 'bg-blue-200 accent-blue-600' : 'bg-gray-200 accent-gray-500'
          )}
        />
      </div>
    </div>
  );
};

const ManualControl = ({
  deviceId,
  device,
  followBlocksPanelProcesses = false,
  readOnly = false,
}: {
  deviceId?: string;
  device?: Device;
  /** Seguimiento Madurador activo (no Manual): bloquea aplicar cambios manuales hasta cancelar seguimiento. */
  followBlocksPanelProcesses?: boolean;
  /** Visualizador: no ajustar ni encender/apagar desde aquí. */
  readOnly?: boolean;
}) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const { mutate: sessionMutate } = useDeviceControlSession(deviceId);
  const md = device?.madurador;
  const [temp, setTemp] = useState(() =>
    clamp(device?.telemetry.set_point ?? 19, MANUAL_TEMP_MIN_C, MANUAL_TEMP_MAX_C)
  );
  const [humidity, setHumidity] = useState(() =>
    clamp(
      md?.humidity_set_point ?? device?.telemetry.relative_humidity ?? 90,
      MANUAL_RH_MIN,
      MANUAL_RH_MAX
    )
  );
  const [ethylene, setEthylene] = useState(() =>
    clamp(device?.telemetry.ethylene ?? 0, MANUAL_ETH_MIN, MANUAL_ETH_MAX)
  );
  const [fan, setFan] = useState(md?.ventilation_fan_reference_pct ?? 100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [powerLoading, setPowerLoading] = useState(false);

  const [isPowerConfirmOpen, setIsPowerConfirmOpen] = useState(false);
  const [cannotPowerOffOpen, setCannotPowerOffOpen] = useState(false);
  const [stopPlanModalOpen, setStopPlanModalOpen] = useState(false);

  /** Solo proceso integral en madurador (no manual) bloquea; STOP PLAN sí puede sustituir el proceso del panel. */
  const maduradorNonManualBlocksPowerSchedule = useMemo(() => {
    const lbl = device?.procesoApi?.trim();
    return Boolean(lbl && !isManualProcesoLabel(lbl));
  }, [device?.procesoApi]);

  useEffect(() => {
    if (device) {
      setTemp(clamp(device.telemetry.set_point, MANUAL_TEMP_MIN_C, MANUAL_TEMP_MAX_C));
      setHumidity(
        clamp(
          device.madurador?.humidity_set_point ?? device.telemetry.relative_humidity ?? 90,
          MANUAL_RH_MIN,
          MANUAL_RH_MAX
        )
      );
      setEthylene(clamp(device.telemetry.ethylene ?? 0, MANUAL_ETH_MIN, MANUAL_ETH_MAX));
      setFan(device.madurador?.ventilation_fan_reference_pct ?? 100);
    }
  }, [device]);

  const originalTemp = clamp(device?.telemetry.set_point ?? 19, MANUAL_TEMP_MIN_C, MANUAL_TEMP_MAX_C);
  const originalHumidity = clamp(
    device?.madurador?.humidity_set_point ?? device?.telemetry.relative_humidity ?? 90,
    MANUAL_RH_MIN,
    MANUAL_RH_MAX
  );
  const originalEthylene = clamp(device?.telemetry.ethylene ?? 0, MANUAL_ETH_MIN, MANUAL_ETH_MAX);
  const originalFan = device?.madurador?.ventilation_fan_reference_pct ?? 100;
  const isPoweredOn = device?.telemetry.power_state === 1;

  // Connection Status Logic
  const lastSeenDate = device?.last_seen ? new Date(device.last_seen) : new Date();
  const minsSinceLastSeen = differenceInMinutes(new Date(), lastSeenDate);
  
  let connectionStatus = 'online';
  if (minsSinceLastSeen > 720) connectionStatus = 'offline';
  else if (minsSinceLastSeen > 30) connectionStatus = 'standby';

  const changes = [];
  if (temp !== originalTemp) changes.push({ name: t('target_temperature'), from: `${convertTemp(originalTemp)}°${tempUnit}`, to: `${convertTemp(temp)}°${tempUnit}` });
  if (humidity !== originalHumidity) changes.push({ name: t('relative_humidity'), from: `${originalHumidity}%`, to: `${humidity}%` });
  if (ethylene !== originalEthylene) changes.push({ name: 'Etileno', from: `${originalEthylene} PPM`, to: `${ethylene} PPM` });
  if (fan !== originalFan) changes.push({ name: t('ventilation_speed'), from: `${originalFan}%`, to: `${fan}%` });

  const hasChanges = changes.length > 0;

  const handleApply = async () => {
    if (!deviceId) return;
    setIsSubmitting(true);
    try {
      const tunnelCommands: {
        set_point?: number;
        humidity_set_point?: number;
        ethylene?: number;
        fan_speed?: number;
      } = {};
      if (temp !== originalTemp) tunnelCommands.set_point = Number(temp.toFixed(1));
      if (humidity !== originalHumidity) tunnelCommands.humidity_set_point = Math.round(humidity);
      if (ethylene !== originalEthylene) tunnelCommands.ethylene = Math.round(ethylene);
      if (fan !== originalFan) tunnelCommands.fan_speed = Math.round(fan);

      if (isGourmetTunnelCommandDevice(deviceId)) {
        if (Object.keys(tunnelCommands).length === 0) {
          toast.error(t('no_changes_to_apply') || 'Sin cambios');
          setIsConfirmOpen(false);
          return;
        }
        const result = await applyTunnelManualCommands({ deviceId, commands: tunnelCommands });
        const sentKinds = result.jobs.map((j) => j.kind).join(', ');
        console.info('[tunnel] comandos enviados upstream', deviceId, tunnelCommands, sentKinds);
      } else {
        await sendControlCommand(deviceId, 'manual_update', {
          set_point: temp,
          humidity_set_point: humidity,
          ethylene,
          fan_speed: fan,
        });
      }
      const summary = changes.map((c) => `${c.name}: ${c.from} → ${c.to}`).join(' · ');
      await startControlProcess({
        deviceId,
        processType: 'Manual',
        displayLabel: `${t('manual_mode')}: ${summary}`.slice(0, 500),
        params: {
          set_point: temp,
          humidity_set_point: humidity,
          ethylene,
          fan_speed: fan,
          changes,
          tempUnit,
        },
        durationHours: 1 / 3600,
        auditLog: true,
        startedAt: new Date().toISOString(),
      });
      void revalidateControlSessionsList();
      void revalidateFleetActiveControlSessions();
      await sessionMutate();
      toast.success(
        isGourmetTunnelCommandDevice(deviceId)
          ? t('tunnel_cmd_sent_ok') || 'Comandos enviados al túnel — seguimiento en curso'
          : t('manual_control_logged') || t('apply_changes') + ' OK'
      );
      setIsConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePowerToggleRequest = (checked: boolean) => {
    if (checked) {
      setIsPowerConfirmOpen(true);
      return;
    }
    /** “Apagar” en la app programa STOP PLAN (no corte total de energía) y registra proceso en Control de dispositivos. */
    if (maduradorNonManualBlocksPowerSchedule) {
      setCannotPowerOffOpen(true);
      return;
    }
    setStopPlanModalOpen(true);
  };

  const executePowerToggle = async (turningOn: boolean) => {
    if (!deviceId) return;
    setPowerLoading(true);
    try {
      await sendControlCommand(deviceId, 'manual_update', {
        power_state: turningOn ? 1 : 0
      });
      toast.success(turningOn ? t('device_on') : t('device_off'));
      setIsPowerConfirmOpen(false);
    } catch (e) {
      toast.error("Error toggling power");
    } finally {
      setPowerLoading(false);
    }
  };

  const getStatusDisplay = () => {
    if (connectionStatus === 'offline') {
      return { 
        text: t('status_offline'), 
        color: 'text-gray-500', 
        bg: 'bg-gray-100', 
        icon: WifiOff,
        disabled: true
      };
    }
    if (connectionStatus === 'standby') {
      return { 
        text: t('status_standby'), 
        color: 'text-orange-600', 
        bg: 'bg-orange-100', 
        icon: Timer,
        disabled: false
      };
    }
    return { 
      text: t('status_active').toUpperCase(), 
      color: 'text-green-600', 
      bg: 'bg-green-100', 
      icon: Zap,
      disabled: false
    };
  };

  const status = getStatusDisplay();
  const controlsDisabled = status.disabled;
  const controlsDisabledPanel = controlsDisabled || followBlocksPanelProcesses || readOnly;
  const conexionLabel = device?.estado_conexion === 'online' ? 'Conexión: En línea' : device?.estado_conexion === 'wait' ? 'Conexión: Espera' : 'Conexión: Desconectado';
  const equipoLabel = isPoweredOn ? 'Equipo: ON' : 'Equipo: OFF';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", status.bg, status.color)}>
            <status.icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium text-gray-900">{t('equipo_estado_actual')}</div>
            <div className={cn("text-xs font-bold", status.color)}>
              {conexionLabel} • {equipoLabel}
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('controls_available_when_on')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium text-gray-500">
            {isPoweredOn ? t('turn_off') : t('turn_on')}
          </span>
          <Switch
            disabled={powerLoading || status.disabled || readOnly}
            checked={isPoweredOn}
            onCheckedChange={handlePowerToggleRequest}
            className={cn(
              'w-11 h-6 rounded-full transition-colors',
              isPoweredOn ? 'data-[state=checked]:bg-green-500' : 'bg-gray-200'
            )}
          />
        </div>
      </div>

      <AlertDialog open={isPowerConfirmOpen} onOpenChange={setIsPowerConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_power_on')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_power_on_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => executePowerToggle(true)} className="bg-green-600 hover:bg-green-700">
              {t('turn_on') || "Encender"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cannotPowerOffOpen} onOpenChange={setCannotPowerOffOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cannot_power_off_pending_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cannot_power_off_pending_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setCannotPowerOffOpen(false)} className="bg-slate-800 hover:bg-slate-900">
              {t('close')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StopPlanScheduleModal
        open={stopPlanModalOpen}
        onOpenChange={setStopPlanModalOpen}
        deviceId={deviceId}
        onCompleted={async () => {
          await sessionMutate();
          await revalidateControlSessionsList();
          await revalidateFleetActiveControlSessions();
        }}
      />

      <div className={cn("transition-opacity duration-200", controlsDisabledPanel && "opacity-50 pointer-events-none grayscale-[0.5]")}>
        <ControlGroup title={t('climatization')}>
            <RangeControl 
            label={t('target_temperature')}
            value={convertTemp(temp)} 
            unit={`°${tempUnit}`}
            min={convertTemp(MANUAL_TEMP_MIN_C)} 
            max={convertTemp(MANUAL_TEMP_MAX_C)} 
            onChange={(val: number) => {
                const cVal = tempUnit === 'F' ? (val - 32) * 5/9 : val;
                setTemp(clamp(Number(cVal.toFixed(1)), MANUAL_TEMP_MIN_C, MANUAL_TEMP_MAX_C));
            }} 
            originalValue={convertTemp(originalTemp)}
            disabled={controlsDisabledPanel}
            step={0.1}
            decimals={1}
            />
            <RangeControl 
            label={t('relative_humidity')} 
            value={humidity} 
            unit="%" 
            min={MANUAL_RH_MIN} 
            max={MANUAL_RH_MAX} 
            onChange={(v) => setHumidity(Math.round(clamp(v, MANUAL_RH_MIN, MANUAL_RH_MAX)))} 
            originalValue={originalHumidity}
            disabled={controlsDisabledPanel}
            decimals={0}
            step={1}
            />
        </ControlGroup>

        <ControlGroup title={t('gases_ventilation')}>
            <RangeControl 
            label={t('ethylene_injection')}
            value={ethylene} 
            unit="PPM" 
            min={MANUAL_ETH_MIN} 
            max={MANUAL_ETH_MAX} 
            onChange={(v) => setEthylene(Math.round(clamp(v, MANUAL_ETH_MIN, MANUAL_ETH_MAX)))} 
            originalValue={originalEthylene}
            disabled={controlsDisabledPanel}
            decimals={0}
            step={1}
            />
            <RangeControl 
            label={t('ventilation_speed')}
            value={fan} 
            unit="%" 
            min={0} 
            max={100} 
            onChange={setFan} 
            originalValue={originalFan}
            disabled={controlsDisabledPanel}
            decimals={0}
            />
        </ControlGroup>

        <div className="flex gap-3 mt-6">
            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialogTrigger
                className={cn(buttonVariants(), "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50")}
                disabled={isSubmitting || !hasChanges || controlsDisabledPanel}
            >
                {isSubmitting ? t('applying') : t('apply_changes')}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>{t('confirm_changes')}</AlertDialogTitle>
                <AlertDialogDescription>
                    {t('confirm_changes_desc')}
                </AlertDialogDescription>
                <div className="mt-4 space-y-2">
                    {changes.map((change, i) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                        <span className="font-medium text-gray-700">{change.name}</span>
                        <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400 line-through">{change.from}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-bold text-blue-600">{change.to}</span>
                        </div>
                    </div>
                    ))}
                </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleApply} className="bg-blue-600 hover:bg-blue-700">
                    {t('confirm_changes')}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
            
            <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => {
                setTemp(originalTemp);
                setHumidity(originalHumidity);
                setEthylene(originalEthylene);
                setFan(originalFan);
            }}
            disabled={controlsDisabledPanel}
            >
            {t('cancel')}
            </Button>
        </div>
      </div>
    </div>
  );
};

const HomogenizationControl = ({
  deviceId,
  disabled,
  onBeginStart,
  tempUnitKey,
}: {
  deviceId?: string;
  disabled?: boolean;
  onBeginStart: (d: ControlStartDraft) => void;
  tempUnitKey: string;
}) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [temp, setTemp] = useState(18);
  const [humidity, setHumidity] = useState(95);
  const [duration, setDuration] = useState(6);

  const handleStart = () => {
    if (!deviceId) return;
    onBeginStart({
      processType: 'Homogenization',
      displayLabel: t('homogenization'),
      params: {
        setPoint: temp,
        humiditySetPoint: humidity,
        durationHours: duration,
        name: 'Homogenización',
        tempUnit: tempUnitKey,
      },
      durationHours: duration,
    });
  };

  return (
    <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
      <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800 flex gap-2">
        <Thermometer className="h-5 w-5 shrink-0" />
        <p>La homogenización eleva gradualmente la temperatura del producto para prepararlo para la maduración. Mantenga humedad alta (90–98%). Típico: {convertTemp(8)}°{tempUnit} a {convertTemp(18)}°{tempUnit}.</p>
      </div>
      
      <ControlGroup title={t('settings')}>
        <RangeControl 
          label={t('final_temperature')} 
          value={convertTemp(temp)} 
          unit={`°${tempUnit}`} 
          min={convertTemp(15)} 
          max={convertTemp(30)} 
          onChange={(val: number) => {
             const cVal = tempUnit === 'F' ? (val - 32) * 5/9 : val;
             setTemp(clamp(Number(cVal.toFixed(1)), 15, 30));
          }} 
          disabled={disabled}
          step={0.1}
          decimals={1}
        />
        <RangeControl 
          label={t('relative_humidity')} 
          value={humidity} 
          unit="%" 
          min={80} 
          max={99} 
          onChange={(v) => setHumidity(Math.round(clamp(v, 80, 99)))} 
          disabled={disabled}
          decimals={0}
          step={1}
        />
        <RangeControl label={t('estimated_duration')} value={duration} unit="Horas" min={1} max={24} onChange={setDuration} disabled={disabled} decimals={0} />
      </ControlGroup>

      <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center bg-gray-50">
        <p className="text-sm text-gray-500 mb-1">{t('preview')}</p>
        <p className="font-medium text-gray-900">De ~{convertTemp(8)}°{tempUnit} a {convertTemp(temp)}°{tempUnit}, humedad {humidity}%, en {duration} h</p>
      </div>

      <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleStart} disabled={disabled}>
        {t('start_process')}
      </Button>
    </div>
  );
};

const RipeningControl = ({
  deviceId,
  disabled,
  onBeginStart,
  tempUnitKey,
}: {
  deviceId?: string;
  disabled?: boolean;
  onBeginStart: (d: ControlStartDraft) => void;
  tempUnitKey: string;
}) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [temp, setTemp] = useState(20);
  const [humidity, setHumidity] = useState(95);
  const [ethylene, setEthylene] = useState(100);
  const [co2, setCo2] = useState(3.5);
  const [duration, setDuration] = useState(72);

  const handleStart = () => {
    if (!deviceId) return;
    onBeginStart({
      processType: 'Ripening',
      displayLabel: t('ripening'),
      params: {
        setPoint: temp,
        humiditySetPoint: humidity,
        durationHours: duration,
        ethylene,
        co2,
        name: 'Maduración',
        tempUnit: tempUnitKey,
      },
      durationHours: duration,
    });
  };

  return (
    <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
      <ControlGroup title={t('environmental_conditions')}>
        <RangeControl 
          label={t('target_temperature')} 
          value={convertTemp(temp)} 
          unit={`°${tempUnit}`} 
          min={convertTemp(10)} 
          max={convertTemp(30)} 
          onChange={(val: number) => {
             const cVal = tempUnit === 'F' ? (val - 32) * 5/9 : val;
             setTemp(clamp(Number(cVal.toFixed(1)), 10, 30));
          }}
          disabled={disabled}
          step={0.1}
          decimals={1}
        />
        <RangeControl label={t('relative_humidity')} value={humidity} unit="%" min={80} max={99} onChange={(v) => setHumidity(Math.round(clamp(v, 80, 99)))} disabled={disabled} decimals={0} step={1} />
      </ControlGroup>

      <ControlGroup title="Gases">
        <RangeControl label={t('ethylene_injection')} value={ethylene} unit="PPM" min={0} max={250} onChange={(v) => setEthylene(Math.round(clamp(v, 0, 250)))} disabled={disabled} decimals={0} step={1} />
        <RangeControl label={t('co2_limit')} value={co2} unit="%" min={1} max={10} step={0.1} onChange={setCo2} disabled={disabled} decimals={1} />
      </ControlGroup>

      <ControlGroup title={t('duration')}>
        <RangeControl label={t('process_time')} value={duration} unit="Horas" min={24} max={120} onChange={setDuration} disabled={disabled} decimals={0} />
      </ControlGroup>

      <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleStart} disabled={disabled}>
        {t('start_process')}
      </Button>
    </div>
  );
};

const VentilationControl = ({
  deviceId,
  disabled,
  onBeginStart,
}: {
  deviceId?: string;
  disabled?: boolean;
  onBeginStart: (d: ControlStartDraft) => void;
}) => {
  const { t } = useSettings();
  const [co2, setCo2] = useState(0.5);
  const [durationMin, setDurationMin] = useState(60);
  const durationHours = Math.max(durationMin / 60, 1 / 60);

  const handleStart = () => {
    if (!deviceId) return;
    onBeginStart({
      processType: 'Ventilation',
      displayLabel: t('ventilation'),
      params: {
        targetCo2: co2,
        durationMin,
        name: 'Ventilación',
      },
      durationHours,
    });
  };
  return (
  <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
    <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 flex gap-2">
      <Fan className="h-5 w-5 shrink-0" />
      <p>Evacuación rápida de gases (Etileno/CO2) post-maduración.</p>
    </div>
    <ControlGroup title="Parámetros">
       <RangeControl label={t('target_co2')} value={co2} unit="%" min={0} max={5} step={0.1} onChange={setCo2} disabled={disabled} decimals={1} />
       <RangeControl label={t('max_duration')} value={durationMin} unit="min" min={10} max={180} onChange={setDurationMin} disabled={disabled} decimals={0} />
    </ControlGroup>
    <Button className="w-full" onClick={handleStart} disabled={disabled}>{t('start_process')}</Button>
  </div>
)};

const CoolingControl = ({
  deviceId,
  disabled,
  onBeginStart,
  tempUnitKey,
}: {
  deviceId?: string;
  disabled?: boolean;
  onBeginStart: (d: ControlStartDraft) => void;
  tempUnitKey: string;
}) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [target, setTarget] = useState(10);
  const [rampHours, setRampHours] = useState(8);

  const handleStart = () => {
    if (!deviceId) return;
    onBeginStart({
      processType: 'Cooling',
      displayLabel: t('cooling'),
      params: {
        setPoint: target,
        durationHours: rampHours,
        name: 'Enfriamiento',
        tempUnit: tempUnitKey,
      },
      durationHours: rampHours,
    });
  };

  return (
  <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
    <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800 flex gap-2">
      <Snowflake className="h-5 w-5 shrink-0" />
      <p>Reducción de temperatura para conservación y transporte.</p>
    </div>
    <ControlGroup title={t('settings')}>
      <RangeControl 
        label={t('final_temperature')} 
        value={convertTemp(target)} 
        unit={`°${tempUnit}`} 
        min={convertTemp(0)} 
        max={convertTemp(20)} 
        onChange={(val: number) => {
             const cVal = tempUnit === 'F' ? (val - 32) * 5/9 : val;
             setTarget(clamp(Number(cVal.toFixed(1)), 0, 20));
          }} 
        disabled={disabled}
        step={0.1}
        decimals={1}
      />
      <RangeControl label={t('cooling_ramp')} value={rampHours} unit="Horas" min={2} max={24} onChange={setRampHours} disabled={disabled} decimals={0} />
    </ControlGroup>
    <Button className="w-full bg-blue-600" onClick={handleStart} disabled={disabled}>{t('start_process')}</Button>
  </div>
)};
