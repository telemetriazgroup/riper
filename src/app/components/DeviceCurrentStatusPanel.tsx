import React, { useState, useMemo } from 'react';
import type { Device } from '@/app/data';
import { formatMaduradorScalar } from '@/app/lib/madurador';
import { cn } from '@/app/lib/utils';
import {
  Thermometer,
  Wind,
  Flame,
  MessageSquareWarning,
  Fan,
  Droplets,
  Cloud,
  Gauge,
  ChevronDown,
  ChevronUp,
  Snowflake,
  CloudRain,
  Cog,
  Sun,
  Package,
  Zap,
  Radio,
  PlugZap,
  Leaf,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { formatUiDecimal, formatUiPercent } from '@/app/lib/formatUiNumber';
import { useRipeningActiveForDevice } from '@/app/hooks/useRipeningActiveForDevice';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';
import { resolveFleetEthyleneDisplayPpm } from '@/app/lib/ethyleneDisplayPolicy';

type TFn = (k: string, r?: Record<string, string> | string) => string;

export interface DeviceCurrentStatusPanelProps {
  device: Device;
  t: TFn;
  formatTemp: (celsius: number) => string;
  tempUnit: 'C' | 'F';
  toggleTempUnit: () => void;
  /** Fecha/hora del último dato telemetría (junto al título «Estatus actual»). */
  formatDateTime?: (d: Date) => string;
  /** Ocultar sensores de carga en el bloque expandido (p. ej. túnel Gourmet los muestra por unidad). */
  hideCargoSensorNumbers?: number[];
}

function toNum(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string') {
    const n = parseFloat(x.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatVentilation(
  m: Device['madurador'] | undefined,
  t: TFn
): string {
  const raw = m?.avl_raw;
  if (raw == null || raw === 0) return t('vent_na');
  const disp = m?.avl_display;
  if (typeof disp === 'number' && Number.isFinite(disp) && disp !== 0) {
    return `${disp} ${t('cfm_unit')}`;
  }
  if (typeof disp === 'string' && disp.trim() !== '' && disp !== '0') return disp;
  if (raw !== 0) return `${raw} ${t('cfm_unit')}`;
  return t('vent_na');
}

function gasExchangeLabel(mode: number, t: TFn): string {
  if (mode === 0) return t('gas_ex_off');
  if (mode === 1) return t('gas_ex_manual');
  if (mode === 2) return t('gas_ex_auto');
  return String(mode);
}

function StatusTile({
  icon: Icon,
  label,
  value,
  className,
  valueClass,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border border-border bg-card/90 p-3 shadow-sm transition-shadow hover:shadow',
        className
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
        <p className={cn('mt-0.5 font-mono text-sm font-bold text-foreground break-words', valueClass)}>{value}</p>
      </div>
    </div>
  );
}

export const DeviceCurrentStatusPanel: React.FC<DeviceCurrentStatusPanelProps> = ({
  device,
  t,
  formatTemp,
  tempUnit,
  toggleTempUnit,
  formatDateTime,
  hideCargoSensorNumbers,
}) => {
  const { activeTracking } = useRipeningActiveForDevice(device.id);
  const { session: panelSession } = useDeviceControlSession(device.id);
  const ethyleneDisplayPpm = useMemo(
    () =>
      resolveFleetEthyleneDisplayPpm(device, {
        trackingProcess: activeTracking?.process ?? null,
        panelActiveSession: panelSession?.status === 'active' ? panelSession : null,
      }),
    [device, activeTracking, panelSession]
  );
  const [open, setOpen] = useState(false);
  const m = device.madurador;
  const tel = device.telemetry;
  const op = device.operational;

  const lastSampleText = useMemo(() => {
    if (!formatDateTime || !device.last_seen) return null;
    const d = new Date(device.last_seen);
    if (isNaN(d.getTime())) return null;
    return formatDateTime(d);
  }, [device.last_seen, formatDateTime]);

  const primary = useMemo(
    () => [
      {
        key: 's1',
        icon: Thermometer,
        label: t('status_temp_supply'),
        value: formatTemp(tel.temp_supply_1),
      },
      {
        key: 'ra',
        icon: Wind,
        label: t('status_return'),
        value: formatTemp(tel.return_air),
      },
      {
        key: 'et',
        icon: Flame,
        label: t('status_ethylene'),
        value:
          ethyleneDisplayPpm != null && Number.isFinite(ethyleneDisplayPpm)
            ? `${formatUiDecimal(ethyleneDisplayPpm)} ppm`
            : '—',
      },
      {
        key: 'al',
        icon: MessageSquareWarning,
        label: t('status_alarms'),
        value: device.numeroAlarmaTotal != null ? String(device.numeroAlarmaTotal) : '—',
      },
      {
        key: 'vl',
        icon: Fan,
        label: t('status_ventilation'),
        value: formatVentilation(m, t),
      },
      {
        key: 'rh',
        icon: Droplets,
        label: t('status_humidity'),
        value: Number.isFinite(tel.relative_humidity) ? formatUiPercent(tel.relative_humidity) : '—',
      },
      {
        key: 'c2',
        icon: Cloud,
        label: t('status_co2'),
        value:
          tel.co2_reading != null && Number.isFinite(tel.co2_reading)
            ? formatUiPercent(tel.co2_reading)
            : '—',
      },
      {
        key: 'cp',
        icon: Gauge,
        label: t('status_capacity'),
        value: m?.capacity_load != null && Number.isFinite(m.capacity_load) ? formatUiPercent(m.capacity_load) : '—',
      },
    ],
    [device, m, t, formatTemp, tel, ethyleneDisplayPpm]
  );

  const compTemp = m?.compress_coil_1_temp;
  const compDisplay = m?.compress_coil_1_display;
  const compressorValue = useMemo(() => {
    if (compTemp != null && Number.isFinite(compTemp)) return formatTemp(compTemp);
    const n = toNum(compDisplay);
    if (n != null && Math.abs(n) < 200) return formatTemp(n);
    return compDisplay != null && String(compDisplay) !== '' ? String(formatMaduradorScalar(compDisplay)) : '—';
  }, [compTemp, compDisplay, formatTemp]);

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-muted/40 to-card p-4 sm:p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-lg font-bold text-foreground">{t('status_current_title')}</h3>
          {lastSampleText && (
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              <span className="text-muted-foreground/80 font-medium">{t('status_last_data_time')}</span>{' '}
              {lastSampleText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('temp_unit_hint')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={() => toggleTempUnit()}
            title={tempUnit === 'C' ? 'Fahrenheit' : 'Celsius'}
          >
            °{tempUnit}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {primary.map((p) => (
          <StatusTile key={p.key} icon={p.icon} label={p.label} value={p.value} />
        ))}
      </div>

      <div className="mt-3 flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t('status_show_less') : t('status_show_more')}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 border-t border-border pt-4 animate-in slide-in-from-top-2 duration-200">
          <StatusTile
            icon={Snowflake}
            label={t('status_evap')}
            value={formatTemp(op.evaporation_coil)}
          />
          <StatusTile
            icon={CloudRain}
            label={t('status_cond')}
            value={formatTemp(op.condensation_coil)}
          />
          <StatusTile icon={Cog} label={t('status_compressor')} value={compressorValue} />
          <StatusTile icon={Sun} label={t('status_ambient')} value={formatTemp(op.ambient_air)} />
          {([1, 2, 3, 4] as const)
            .filter((n) => !hideCargoSensorNumbers.includes(n))
            .map((n) => {
            const v = m?.[`cargo_${n}_temp` as 'cargo_1_temp'];
            return (
              <StatusTile
                key={`cg${n}`}
                icon={Package}
                label={t('status_cargo_n', { n: String(n) })}
                value={v != null && Number.isFinite(v) ? formatTemp(v) : '—'}
              />
            );
          })}
          <StatusTile
            icon={Zap}
            label={t('status_line_voltage')}
            value={m?.line_voltage_display != null ? String(formatMaduradorScalar(m.line_voltage_display)) : '—'}
          />
          <StatusTile
            icon={Radio}
            label={t('status_line_frequency')}
            value={m?.line_frequency != null && m.line_frequency > 0 ? `${formatUiDecimal(m.line_frequency)} Hz` : '—'}
          />
          {([1, 2, 3] as const).map((n) => {
            const p = m?.[`consumption_ph_${n}` as 'consumption_ph_1'];
            return (
              <StatusTile
                key={`ph${n}`}
                icon={PlugZap}
                label={t('status_phase_n', { n: String(n) })}
                value={p != null && Number.isFinite(p) ? formatUiDecimal(p) : '—'}
              />
            );
          })}
          <StatusTile
            icon={Cloud}
            label={t('status_sp_co2')}
            value={
              m?.set_point_co2_value != null && Number.isFinite(m.set_point_co2_value)
                ? String(m.set_point_co2_value)
                : m?.set_point_co2_display != null
                  ? String(formatMaduradorScalar(m.set_point_co2_display))
                  : '—'
            }
          />
          <StatusTile
            icon={Zap}
            label={t('status_kwh')}
            value={Number.isFinite(op.power_kwh) ? `${formatUiDecimal(op.power_kwh)} kWh` : '—'}
          />
          <StatusTile
            icon={Leaf}
            label={t('status_gas_exchange')}
            value={gasExchangeLabel(op.fresh_air_ex_mode, t)}
          />
          <StatusTile
            icon={Flame}
            label={t('status_sp_ethylene')}
            value={
              m?.sp_ethyleno != null && Number.isFinite(m.sp_ethyleno)
                ? `${formatUiDecimal(m.sp_ethyleno)} ${t('sp_ethyleno_unit')}`
                : '—'
            }
          />
        </div>
      )}
    </div>
  );
};
