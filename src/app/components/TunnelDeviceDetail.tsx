import React, { useMemo, useState, useEffect } from 'react';
import type { Device } from '@/app/data';
import { ArrowLeft, Layers, Package, Edit2, Check, X, Loader2, BarChart2, ClipboardList, LayoutDashboard } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { useSettings } from '@/app/contexts/SettingsContext';
import { clsx } from 'clsx';
import * as Tabs from '@radix-ui/react-tabs';
import { resolveDeviceDisplayName, deviceNameStorageKey, applySobrenombresToDevice } from '@/app/lib/deviceLocalNames';
import { updateDeviceName } from '@/app/lib/api';
import { toast } from 'sonner';
import { useDevices } from '@/app/hooks/useDevices';
import {
  aggregateGourmetTunnelDevice,
  defaultGourmetTunnelSelectedUnits,
} from '@/app/lib/gourmetTunnelFleet';
import { DeviceCurrentStatusPanel } from '@/app/components/DeviceCurrentStatusPanel';
import { DeviceControlProcessPanel } from '@/app/components/DeviceControlProcessPanel';
import { DeviceRipeningTrackingOverview } from '@/app/components/DeviceRipeningTrackingOverview';
import { DeviceMonitoringAnalysis } from '@/app/components/DeviceMonitoringAnalysis';
import { MaduradorOperativoSummaryPanel } from '@/app/components/MaduradorOperativoSummaryPanel';
import { TelemetryCharts } from '@/app/components/TelemetryCharts';
import { ControlPanel } from '@/app/components/ControlPanel';
import { resolveControlPanelTab } from '@/app/lib/madurador';
import { TunnelCommandCompliancePanel } from '@/app/components/TunnelCommandCompliancePanel';
import { EventLog } from '@/app/components/EventLog';
import { GOURMET_TUNEL_DEVICE_ID } from '@/app/lib/tunelUnido';
import { isGourmetSession } from '@/app/lib/gourmet';
import { showManualCommandStatesPanel } from '@/app/lib/fleetDemo';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';

interface TunnelDeviceDetailProps {
  device: Device;
  onBack: () => void;
  onGoToCreateTracking?: () => void;
}

export const TunnelDeviceDetail: React.FC<TunnelDeviceDetailProps> = ({
  device,
  onBack,
  onGoToCreateTracking,
}) => {
  const { t, formatTemp, tempUnit, toggleTempUnit, language, formatDateTime } = useSettings();
  const { mutate: refreshDevices } = useDevices();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(() => resolveDeviceDisplayName(device));
  const [isSavingName, setIsSavingName] = useState(false);
  const displayName = resolveDeviceDisplayName(device);
  const { session: activeControlSession } = useDeviceControlSession(GOURMET_TUNEL_DEVICE_ID);

  useEffect(() => {
    setNameDraft(displayName);
  }, [device.id, displayName]);

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed === displayName.trim()) {
      setIsEditingName(false);
      return;
    }
    setIsSavingName(true);
    try {
      const key = deviceNameStorageKey(device.id) || device.id;
      await updateDeviceName(device.id, trimmed);
      await refreshDevices(
        (current) =>
          (current ?? []).map((d) =>
            deviceNameStorageKey(d.id) === key
              ? applySobrenombresToDevice({ ...d, nombreApi: d.nombreApi ?? d.name }, { [key]: trimmed })
              : d
          ),
        { revalidate: true }
      );
      toast.success(t('name_updated'));
      setIsEditingName(false);
    } catch {
      toast.error(t('error_updating_name'));
    } finally {
      setIsSavingName(false);
    }
  };
  const [controlMode, setControlMode] = useState('manual');
  const [activeView, setActiveView] = useState<'operation' | 'analysis' | 'log'>('operation');
  const tunnel = device.tunnel;
  const [selectedUnits, setSelectedUnits] = useState<string[]>(() => defaultGourmetTunnelSelectedUnits());

  const displayDevice = useMemo(
    () => aggregateGourmetTunnelDevice(device, selectedUnits),
    [device, selectedUnits]
  );

  const displayDeviceForStatus = useMemo(() => {
    if (
      !isGourmetSession() ||
      activeControlSession?.status !== 'active' ||
      activeControlSession.process_type !== 'Cooling'
    ) {
      return displayDevice;
    }
    const sp = Number((activeControlSession.params as Record<string, unknown>)?.setPoint);
    if (!Number.isFinite(sp)) return displayDevice;
    return {
      ...displayDevice,
      telemetry: { ...displayDevice.telemetry, set_point: sp },
    };
  }, [displayDevice, activeControlSession]);

  useEffect(() => {
    setControlMode(
      resolveControlPanelTab({
        activeSessionProcessType:
          activeControlSession?.status === 'active' ? activeControlSession.process_type : null,
        procesoApi: displayDevice.procesoApi,
        stateProcess: displayDevice.telemetry.stateProcess,
      })
    );
  }, [
    displayDevice.procesoApi,
    displayDevice.telemetry.stateProcess,
    activeControlSession?.id,
    activeControlSession?.status,
    activeControlSession?.process_type,
  ]);

  const toggleUnit = (unitId: string) => {
    setSelectedUnits((prev) => {
      if (prev.includes(unitId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((u) => u !== unitId);
      }
      return [...prev, unitId].sort(
        (a, b) => defaultGourmetTunnelSelectedUnits().indexOf(a) - defaultGourmetTunnelSelectedUnits().indexOf(b)
      );
    });
  };

  const unitSensorTiles = useMemo(() => {
    const selected = new Set(selectedUnits);
    const tiles: { key: string; label: string; value: string }[] = [];
    for (const u of tunnel.units) {
      if (!selected.has(u.unidad)) continue;
      const src = u.sourceDevice;
      const m = src?.madurador;
      const c3 = m?.cargo_3_temp;
      const c4 = m?.cargo_4_temp;
      tiles.push({
        key: `${u.unidad}-c3`,
        label:
          language === 'es'
            ? `T° Sensor 3 ${u.unidad}`
            : `Sensor 3 T° ${u.unidad}`,
        value: c3 != null && Number.isFinite(c3) ? formatTemp(c3) : '—',
      });
      tiles.push({
        key: `${u.unidad}-c4`,
        label:
          language === 'es'
            ? `T° Sensor 4 ${u.unidad}`
            : `Sensor 4 T° ${u.unidad}`,
        value: c4 != null && Number.isFinite(c4) ? formatTemp(c4) : '—',
      });
    }
    return tiles;
  }, [tunnel?.units, selectedUnits, language, formatTemp]);

  if (!tunnel) return null;

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} title={t('back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap group">
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="text-2xl font-bold text-foreground border-b-2 border-blue-500 focus:outline-none bg-transparent px-1 py-0.5"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveName();
                      if (e.key === 'Escape') {
                        setNameDraft(displayName);
                        setIsEditingName(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveName()}
                    disabled={isSavingName}
                    className="p-1 hover:bg-green-100 rounded text-green-600"
                  >
                    {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(displayName);
                      setIsEditingName(false);
                    }}
                    disabled={isSavingName}
                    className="p-1 hover:bg-red-100 rounded text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-foreground">{displayName}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(displayName);
                      setIsEditingName(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground hover:text-blue-600"
                    title={t('rename_device')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 text-xs font-semibold px-2 py-0.5">
                <Layers className="h-3 w-3" />
                {language === 'es' ? 'Túnel / Madurador' : 'Tunnel / Ripener'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
              <span className="font-mono text-xs">{tunnel.grupo}</span>
              <span>•</span>
              <span
                className={clsx(
                  'font-medium',
                  displayDevice.estado_conexion === 'online'
                    ? 'text-green-600 dark:text-green-400'
                    : displayDevice.estado_conexion === 'wait'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                )}
              >
                {displayDevice.estado_conexion === 'online'
                  ? t('online')
                  : displayDevice.estado_conexion === 'wait'
                    ? t('wait')
                    : t('offline')}
              </span>
            </div>
          </div>
        </div>
        <Tabs.Root value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
          <Tabs.List className="inline-flex rounded-lg bg-muted p-1 gap-1">
            <Tabs.Trigger
              value="operation"
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                activeView === 'operation'
                  ? 'bg-card text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">{t('operation')}</span>
            </Tabs.Trigger>
            <Tabs.Trigger
              value="analysis"
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                activeView === 'analysis'
                  ? 'bg-card text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('monitoring')}</span>
            </Tabs.Trigger>
            <Tabs.Trigger
              value="log"
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                activeView === 'log'
                  ? 'bg-card text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">{t('event_log')}</span>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>

      <DeviceRipeningTrackingOverview deviceId={GOURMET_TUNEL_DEVICE_ID} />

      {activeView === 'operation' ? (
        <>
      <Card className="border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">
            {language === 'es' ? 'Máquinas del túnel' : 'Tunnel machines'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {language === 'es'
              ? 'Seleccione al menos una unidad. Los promedios en Estatus actual usan las unidades marcadas.'
              : 'Select at least one unit. Current status averages use the checked units.'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {tunnel.units.map((u) => {
              const checked = selectedUnits.includes(u.unidad);
              const imei = u.imei ?? u.pregunta ?? '—';
              return (
                <label
                  key={u.unidad}
                  className={clsx(
                    'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    checked
                      ? 'border-indigo-400 bg-indigo-100/80 dark:border-indigo-600 dark:bg-indigo-950/50'
                      : 'border-border bg-card hover:bg-muted/50'
                  )}
                >
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={checked}
                    onChange={() => toggleUnit(u.unidad)}
                  />
                  <span className="font-mono font-semibold text-foreground">{u.unidad}</span>
                  <span className="text-xs text-muted-foreground font-mono">{imei}</span>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <DeviceCurrentStatusPanel
        device={displayDeviceForStatus}
        t={t}
        formatTemp={formatTemp}
        tempUnit={tempUnit}
        toggleTempUnit={toggleTempUnit}
        formatDateTime={formatDateTime}
        hideCargoSensorNumbers={[3, 4]}
      />

      {unitSensorTiles.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {language === 'es' ? 'Sensores por unidad' : 'Sensors by unit'}
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unitSensorTiles.map((tile) => (
              <div
                key={tile.key}
                className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {tile.label}
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{tile.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showManualCommandStatesPanel(
        GOURMET_TUNEL_DEVICE_ID,
        activeControlSession?.process_type,
        activeControlSession?.status
      ) && <TunnelCommandCompliancePanel deviceId={GOURMET_TUNEL_DEVICE_ID} />}

      <DeviceControlProcessPanel deviceId={GOURMET_TUNEL_DEVICE_ID} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ControlPanel
            mode={controlMode}
            onChangeMode={setControlMode}
            deviceId={GOURMET_TUNEL_DEVICE_ID}
            device={displayDevice}
          />
        </div>
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            {language === 'es' ? 'Últimas 12 horas' : 'Last 12 hours'}
          </h3>
          <TelemetryCharts deviceId={GOURMET_TUNEL_DEVICE_ID} />
        </div>
      </div>

        </>
      ) : activeView === 'log' ? (
        <EventLog deviceId={GOURMET_TUNEL_DEVICE_ID} />
      ) : (
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-lg border border-border shadow-sm min-h-[400px]">
            <DeviceMonitoringAnalysis
              deviceId={GOURMET_TUNEL_DEVICE_ID}
              onGoToCreateTracking={onGoToCreateTracking}
            />
          </div>
          {displayDevice.maduradorSummary ? (
            <MaduradorOperativoSummaryPanel
              summary={displayDevice.maduradorSummary}
              ultimaFechaEncendido={displayDevice.madurador?.ultima_fecha_encendido}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {language === 'es'
                  ? 'Historial de ajustes (etileno, humedad, CO₂, encendido) no disponible en telemetría actual.'
                  : 'Settings history (ethylene, humidity, CO₂, power) not available in current telemetry.'}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
