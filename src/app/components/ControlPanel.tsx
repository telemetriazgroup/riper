import React, { useState, useEffect } from 'react';
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
import { Thermometer, Wind, Zap, Play, Snowflake, Fan, Power, Timer, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { sendControlCommand } from '@/app/lib/api';
import { Device } from '@/app/data';
import { useSettings } from '@/app/contexts/SettingsContext';
import { differenceInMinutes } from 'date-fns';

interface ControlPanelProps {
  mode: string;
  onChangeMode: (mode: string) => void;
  deviceId?: string;
  device?: Device;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ mode, onChangeMode, deviceId, device }) => {
  const { t } = useSettings();

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
        {mode === 'manual' && <ManualControl deviceId={deviceId} device={device} />}
        {mode === 'homogenization' && <HomogenizationControl deviceId={deviceId} disabled={areProcessesDisabled} />}
        {mode === 'ripening' && <RipeningControl deviceId={deviceId} disabled={areProcessesDisabled} />}
        {mode === 'ventilation' && <VentilationControl deviceId={deviceId} disabled={areProcessesDisabled} />}
        {mode === 'cooling' && <CoolingControl deviceId={deviceId} disabled={areProcessesDisabled} />}
      </CardContent>
    </Card>
  );
};

const ControlGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-6 p-4 border border-gray-100 rounded-lg bg-gray-50/50">
    <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">{title}</h4>
    {children}
  </div>
);

const RangeControl = ({ label, value, unit, min, max, onChange, step = 1, originalValue, disabled = false }: any) => {
  const isChanged = originalValue !== undefined && value !== originalValue;

  return (
    <div className={cn("mb-4 p-3 rounded-lg transition-colors border", isChanged ? "bg-blue-50 border-blue-200" : "border-transparent", disabled && "opacity-50 pointer-events-none")}>
      <div className="flex justify-between mb-2">
        <Label className={cn("text-sm font-medium", isChanged ? "text-blue-700" : "text-gray-600")}>{label}</Label>
        <div className="flex flex-col items-end">
          <span className={cn("text-sm font-bold", isChanged ? "text-blue-700" : "text-gray-900")}>{value} {unit}</span>
          {isChanged && (
            <span className="text-xs text-blue-400 line-through decoration-blue-400/50">
              {originalValue} {unit}
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
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(
            "w-full h-2 rounded-lg appearance-none cursor-pointer transition-colors",
            isChanged ? "bg-blue-200 accent-blue-600" : "bg-gray-200 accent-gray-500"
          )}
        />
      </div>
    </div>
  );
};

const ManualControl = ({ deviceId, device }: { deviceId?: string, device?: Device }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [temp, setTemp] = useState(device?.telemetry.set_point ?? 19);
  const [humidity, setHumidity] = useState(device?.telemetry.relative_humidity ?? 90);
  const [ethylene, setEthylene] = useState(device?.telemetry.ethylene ?? 0);
  const [fan, setFan] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [powerLoading, setPowerLoading] = useState(false);

  const [isPowerConfirmOpen, setIsPowerConfirmOpen] = useState(false);

  useEffect(() => {
    if (device) {
      setTemp(device.telemetry.set_point);
      // setHumidity(device.telemetry.humidity_set_point ?? 90);
    }
  }, [device]);

  const originalTemp = device?.telemetry.set_point ?? 19;
  const originalHumidity = device?.telemetry.relative_humidity ?? 90;
  const originalEthylene = device?.telemetry.ethylene ?? 0;
  const originalFan = 100;
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
      await sendControlCommand(deviceId, 'manual_update', {
        set_point: temp,
        humidity_set_point: humidity,
        ethylene,
        fan_speed: fan
      });
      toast.success(t('apply_changes') + " OK");
      setIsConfirmOpen(false);
    } catch (e) {
      toast.error("Error");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePowerToggleRequest = (checked: boolean) => {
    if (checked) {
      // If turning ON, show confirmation
      setIsPowerConfirmOpen(true);
    } else {
      // If turning OFF, proceed immediately (or add another confirm if desired, but request specified ON)
      executePowerToggle(false);
    }
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
                disabled={powerLoading || status.disabled}
                checked={isPoweredOn}
                onCheckedChange={handlePowerToggleRequest}
                className={cn(
                    "w-11 h-6 rounded-full transition-colors",
                    isPoweredOn ? "data-[state=checked]:bg-green-500" : "bg-gray-200"
                )} 
            />
        </div>
      </div>

      <AlertDialog open={isPowerConfirmOpen} onOpenChange={setIsPowerConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_power_on') || "¿Encender dispositivo?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_power_on_desc') || "¿Está seguro de que desea encender el equipo? Esto activará los sistemas de control y climatización."}
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

      <div className={cn("transition-opacity duration-200", controlsDisabled && "opacity-50 pointer-events-none grayscale-[0.5]")}>
        <ControlGroup title={t('climatization')}>
            <RangeControl 
            label={t('target_temperature')}
            value={convertTemp(temp)} 
            unit={`°${tempUnit}`}
            min={convertTemp(-30)} 
            max={convertTemp(30)} 
            onChange={(val: number) => {
                const cVal = tempUnit === 'F' ? (val - 32) * 5/9 : val;
                setTemp(Number(cVal.toFixed(1)));
            }} 
            originalValue={convertTemp(originalTemp)}
            disabled={controlsDisabled}
            />
            <RangeControl 
            label={t('relative_humidity')} 
            value={humidity} 
            unit="%" 
            min={0} 
            max={100} 
            onChange={setHumidity} 
            originalValue={originalHumidity}
            disabled={controlsDisabled}
            />
        </ControlGroup>

        <ControlGroup title={t('gases_ventilation')}>
            <RangeControl 
            label={t('ethylene_injection')}
            value={ethylene} 
            unit="PPM" 
            min={0} 
            max={200} 
            onChange={setEthylene} 
            originalValue={originalEthylene}
            disabled={controlsDisabled}
            />
            <RangeControl 
            label={t('ventilation_speed')}
            value={fan} 
            unit="%" 
            min={0} 
            max={100} 
            onChange={setFan} 
            originalValue={originalFan}
            disabled={controlsDisabled}
            />
        </ControlGroup>

        <div className="flex gap-3 mt-6">
            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialogTrigger
                className={cn(buttonVariants(), "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50")}
                disabled={isSubmitting || !hasChanges || controlsDisabled}
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
            disabled={controlsDisabled}
            >
            {t('cancel')}
            </Button>
        </div>
      </div>
    </div>
  );
};

const HomogenizationControl = ({ deviceId, disabled }: { deviceId?: string, disabled?: boolean }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [temp, setTemp] = useState(18);
  const [duration, setDuration] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = async () => {
    if (!deviceId) return;
    setIsSubmitting(true);
    try {
      await sendControlCommand(deviceId, 'set_process', {
        type: 'Homogenization',
        name: 'Homogenización Manual',
        setPoint: temp,
        durationHours: duration
      });
      toast.success(t('start') + " OK");
    } catch (e) {
      toast.error("Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
      <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800 flex gap-2">
        <Thermometer className="h-5 w-5 shrink-0" />
        <p>La homogenización eleva gradualmente la temperatura del producto para prepararlo para la maduración. Típico: {convertTemp(8)}°{tempUnit} a {convertTemp(18)}°{tempUnit}.</p>
      </div>
      
      <ControlGroup title={t('settings')}>
        <RangeControl 
          label={t('final_temperature')} 
          value={convertTemp(temp)} 
          unit={`°${tempUnit}`} 
          min={convertTemp(10)} 
          max={convertTemp(25)} 
          onChange={(val: number) => {
             const cVal = tempUnit === 'F' ? (val - 32) * 5/9 : val;
             setTemp(Number(cVal.toFixed(1)));
          }} 
          disabled={disabled}
        />
        <RangeControl label={t('estimated_duration')} value={duration} unit="Horas" min={1} max={24} onChange={setDuration} disabled={disabled} />
      </ControlGroup>

      <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center bg-gray-50">
        <p className="text-sm text-gray-500 mb-1">{t('preview')}</p>
        <p className="font-medium text-gray-900">De ~{convertTemp(8)}°{tempUnit} a {convertTemp(temp)}°{tempUnit} en {duration} horas</p>
      </div>

      <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleStart} disabled={isSubmitting || disabled}>
        {isSubmitting ? t('starting') : t('start_process')}
      </Button>
    </div>
  );
};

const RipeningControl = ({ deviceId, disabled }: { deviceId?: string, disabled?: boolean }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [temp, setTemp] = useState(20);
  const [humidity, setHumidity] = useState(95);
  const [ethylene, setEthylene] = useState(100);
  const [co2, setCo2] = useState(3.5);
  const [duration, setDuration] = useState(72);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = async () => {
    if (!deviceId) return;
    setIsSubmitting(true);
    try {
      await sendControlCommand(deviceId, 'set_process', {
        type: 'Ripening',
        name: 'Maduración Manual',
        setPoint: temp,
        durationHours: duration,
        ethylene,
        co2
      });
      toast.success("OK");
    } catch (e) {
      toast.error("Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
      <ControlGroup title={t('environmental_conditions')}>
        <RangeControl 
          label={t('target_temperature')} 
          value={convertTemp(temp)} 
          unit={`°${tempUnit}`} 
          min={convertTemp(15)} 
          max={convertTemp(25)} 
          onChange={(val: number) => {
             const cVal = tempUnit === 'F' ? (val - 32) * 5/9 : val;
             setTemp(Number(cVal.toFixed(1)));
          }}
          disabled={disabled}
        />
        <RangeControl label={t('relative_humidity')} value={humidity} unit="%" min={80} max={100} onChange={setHumidity} disabled={disabled} />
      </ControlGroup>

      <ControlGroup title="Gases">
        <RangeControl label={t('ethylene_injection')} value={ethylene} unit="PPM" min={10} max={150} onChange={setEthylene} disabled={disabled} />
        <RangeControl label={t('co2_limit')} value={co2} unit="%" min={1} max={10} step={0.1} onChange={setCo2} disabled={disabled} />
      </ControlGroup>

      <ControlGroup title={t('duration')}>
        <RangeControl label={t('process_time')} value={duration} unit="Horas" min={24} max={120} onChange={setDuration} disabled={disabled} />
      </ControlGroup>

      <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleStart} disabled={isSubmitting || disabled}>
        {isSubmitting ? t('starting') : t('start_process')}
      </Button>
    </div>
  );
};

const VentilationControl = ({ deviceId, disabled }: { deviceId?: string, disabled?: boolean }) => {
  const { t } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleStart = async () => {
    if (!deviceId) return;
    setIsSubmitting(true);
    try {
       await sendControlCommand(deviceId, 'set_process', {
         type: 'Ventilation',
         name: 'Ventilación Manual',
         durationHours: 1
       });
       toast.success("OK");
    } catch (e) { toast.error("Error"); }
    finally { setIsSubmitting(false); }
  };
  return (
  <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
    <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 flex gap-2">
      <Fan className="h-5 w-5 shrink-0" />
      <p>Evacuación rápida de gases (Etileno/CO2) post-maduración.</p>
    </div>
    <ControlGroup title="Parámetros">
       <RangeControl label={t('target_co2')} value={0.5} unit="%" min={0} max={5} onChange={() => {}} disabled={disabled} />
       <RangeControl label={t('max_duration')} value={60} unit="min" min={10} max={180} onChange={() => {}} disabled={disabled} />
    </ControlGroup>
    <Button className="w-full" onClick={handleStart} disabled={isSubmitting || disabled}>{isSubmitting ? t('starting') : t('start')}</Button>
  </div>
)};

const CoolingControl = ({ deviceId, disabled }: { deviceId?: string, disabled?: boolean }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleStart = async () => {
    if (!deviceId) return;
    setIsSubmitting(true);
    try {
       await sendControlCommand(deviceId, 'set_process', {
         type: 'Cooling',
         name: 'Cooling Manual',
         durationHours: 8,
         setPoint: 10
       });
       toast.success("OK");
    } catch (e) { toast.error("Error"); }
    finally { setIsSubmitting(false); }
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
        value={convertTemp(10)} 
        unit={`°${tempUnit}`} 
        min={convertTemp(5)} 
        max={convertTemp(15)} 
        onChange={() => {}} 
        disabled={disabled}
      />
      <RangeControl label={t('cooling_ramp')} value={8} unit="Horas" min={2} max={24} onChange={() => {}} disabled={disabled} />
    </ControlGroup>
    <Button className="w-full bg-blue-600" onClick={handleStart} disabled={isSubmitting || disabled}>{isSubmitting ? t('starting') : t('start')}</Button>
  </div>
)};
