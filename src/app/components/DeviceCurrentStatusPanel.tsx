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

type TFn = (k: string, r?: Record<string, string> | string) => string;

export interface DeviceCurrentStatusPanelProps {
  device: Device;
  t: TFn;
  formatTemp: (celsius: number) => string;
  tempUnit: 'C' | 'F';
  toggleTempUnit: () => void;
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
        'flex gap-3 rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm transition-shadow hover:shadow',
        className
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 leading-tight">{label}</p>
        <p className={cn('mt-0.5 font-mono text-sm font-bold text-slate-900 break-words', valueClass)}>{value}</p>
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
}) => {
  const [open, setOpen] = useState(false);
  const m = device.madurador;
  const tel = device.telemetry;
  const op = device.operational;

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
          tel.ethylene != null && Number.isFinite(tel.ethylene) ? `${tel.ethylene.toFixed(1)} ppm` : '—',
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
        value:
          Number.isFinite(tel.relative_humidity) ? `${Math.round(tel.relative_humidity)} %` : '—',
      },
      {
        key: 'c2',
        icon: Cloud,
        label: t('status_co2'),
        value: tel.co2_reading != null && Number.isFinite(tel.co2_reading) ? `${tel.co2_reading.toFixed(1)} %` : '—',
      },
      {
        key: 'cp',
        icon: Gauge,
        label: t('status_capacity'),
        value: m?.capacity_load != null && Number.isFinite(m.capacity_load) ? `${m.capacity_load} %` : '—',
      },
    ],
    [device, m, t, formatTemp, tel]
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
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-slate-900">{t('status_current_title')}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{t('temp_unit_hint')}</span>
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
          className="gap-1 text-slate-600"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t('status_show_less') : t('status_show_more')}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 border-t border-slate-200 pt-4 animate-in slide-in-from-top-2 duration-200">
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
          {([1, 2, 3, 4] as const).map((n) => {
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
            value={m?.line_frequency != null && m.line_frequency > 0 ? `${m.line_frequency} Hz` : '—'}
          />
          {([1, 2, 3] as const).map((n) => {
            const p = m?.[`consumption_ph_${n}` as 'consumption_ph_1'];
            return (
              <StatusTile
                key={`ph${n}`}
                icon={PlugZap}
                label={t('status_phase_n', { n: String(n) })}
                value={p != null && Number.isFinite(p) ? p.toFixed(1) : '—'}
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
            value={Number.isFinite(op.power_kwh) ? `${op.power_kwh.toFixed(1)} kWh` : '—'}
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
                ? `${m.sp_ethyleno % 1 === 0 ? m.sp_ethyleno : m.sp_ethyleno.toFixed(1)} ${t('sp_ethyleno_unit')}`
                : '—'
            }
          />
        </div>
      )}
    </div>
  );
};
