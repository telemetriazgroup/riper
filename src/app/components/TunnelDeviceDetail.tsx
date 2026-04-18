import React from 'react';
import type { Device } from '@/app/data';
import { ArrowLeft, Thermometer, Wind, Activity, Droplets, Power, Loader2, Layers } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { useSettings } from '@/app/contexts/SettingsContext';
import { format } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import { clsx } from 'clsx';

interface TunnelDeviceDetailProps {
  device: Device;
  onBack: () => void;
}

export const TunnelDeviceDetail: React.FC<TunnelDeviceDetailProps> = ({ device, onBack }) => {
  const { t, convertTemp, tempUnit, language } = useSettings();
  const tunnel = device.tunnel;
  if (!tunnel) return null;

  const muestra = tunnel.muestraFecha;
  const muestraFmt =
    muestra && !isNaN(new Date(muestra).getTime())
      ? format(new Date(muestra), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? esLocale : undefined })
      : '—';

  const avgLabel =
    tunnel.averageMode === 'powered_on'
      ? language === 'es'
        ? 'Promedio T° suministro (unidades encendidas)'
        : 'Average supply temp (powered-on units)'
      : language === 'es'
        ? 'Promedio T° suministro (todas apagadas → las 5 unidades)'
        : 'Average supply temp (all off → all 5 units)';

  const sortDatosKeys = (d: Record<string, string | number | null>) =>
    Object.keys(d).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} title={t('back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900">{device.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5">
                <Layers className="h-3 w-3" />
                {language === 'es' ? 'Túnel / Madurador' : 'Tunnel / Ripener'}
              </span>
            </div>
            <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2 mt-1">
              <span className="font-mono text-xs">{tunnel.grupo}</span>
              <span>•</span>
              <span
                className={clsx(
                  'font-medium',
                  device.estado_conexion === 'online'
                    ? 'text-green-600'
                    : device.estado_conexion === 'wait'
                      ? 'text-amber-600'
                      : 'text-gray-500'
                )}
              >
                {device.estado_conexion === 'online'
                  ? t('online')
                  : device.estado_conexion === 'wait'
                    ? t('wait')
                    : t('offline')}
              </span>
              <span>•</span>
              <span>
                {language === 'es' ? 'Muestra' : 'Sample'}: {muestraFmt}
              </span>
            </div>
            {tunnel.selectedImei && (
              <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
                {language === 'es'
                  ? 'Bloque IMEI usado (mayor fecha entre redundancias):'
                  : 'IMEI block used (latest timestamp among redundant feeds):'}{' '}
                <span className="font-mono">{tunnel.selectedImei}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <Card className="border-indigo-200/80 bg-indigo-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-indigo-600" />
            {language === 'es' ? 'Resumen del túnel (5 máquinas)' : 'Tunnel summary (5 machines)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">{avgLabel}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-white/80 p-4">
              <div className="text-xs text-gray-500">{t('temperature')} (T_Suministro Ø)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {tunnel.averageSupplyTemp != null
                  ? `${convertTemp(tunnel.averageSupplyTemp).toFixed(1)}°${tempUnit}`
                  : '—'}
              </div>
            </div>
            <div className="rounded-lg border bg-white/80 p-4">
              <div className="text-xs text-gray-500">{t('set_temperature')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {convertTemp(device.telemetry.set_point).toFixed(1)}°{tempUnit}
              </div>
            </div>
            <div className="rounded-lg border bg-white/80 p-4">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Droplets className="h-3.5 w-3.5" /> {t('humidity')}
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{device.telemetry.relative_humidity}%</div>
            </div>
            <div className="rounded-lg border bg-white/80 p-4">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" /> {t('co2')}
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {device.telemetry.co2_reading != null ? `${Number(device.telemetry.co2_reading).toFixed(2)} %` : '—'}
              </div>
            </div>
            <div className="rounded-lg border bg-white/80 p-4 sm:col-span-2">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" /> {t('ethylene')} (campo_1)
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {device.telemetry.ethylene != null ? `${Number(device.telemetry.ethylene).toFixed(2)}` : '—'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          {language === 'es' ? 'Unidades' : 'Units'}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tunnel.units.map((u) => (
            <Card key={u.unidad} className="overflow-hidden">
              <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0 bg-gray-50/80 border-b">
                <CardTitle className="text-base font-mono">{u.unidad}</CardTitle>
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full',
                    u.powerOn ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                  )}
                >
                  <Power className="h-3 w-3" />
                  {u.powerOn ? 'ON' : 'OFF'}
                </span>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-gray-500 text-xs">T suministro</span>
                    <div className="font-mono font-medium">
                      {u.supplyTemp != null ? `${convertTemp(u.supplyTemp).toFixed(1)}°${tempUnit}` : '—'}
                    </div>
                  </div>
                  {u.pregunta && (
                    <div className="col-span-2">
                      <span className="text-gray-500 text-xs">ID</span>
                      <div className="font-mono text-xs break-all">{u.pregunta}</div>
                    </div>
                  )}
                </div>
                <div className="border-t pt-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">
                    {language === 'es' ? 'Parámetros' : 'Parameters'}
                  </div>
                  {sortDatosKeys(u.datos).length === 0 ? (
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 opacity-50" />
                      {language === 'es' ? 'Sin datos en conjunto' : 'No data in conjunto'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {sortDatosKeys(u.datos).map((k) => (
                        <div key={k} className="flex justify-between gap-2 border-b border-gray-50 pb-1">
                          <span className="text-gray-500 truncate" title={k}>
                            {k}
                          </span>
                          <span className="font-mono text-gray-900 shrink-0 max-w-[55%] truncate" title={String(u.datos[k])}>
                            {u.datos[k] === null || u.datos[k] === undefined ? '—' : String(u.datos[k])}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
