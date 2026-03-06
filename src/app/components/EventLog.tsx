import React, { useMemo, useState } from 'react';
import { ClipboardList, Calendar, Droplets, Filter } from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { useSettings } from '@/app/contexts/SettingsContext';
import { getMockEventLog, type LogEntry, type LogEvent, type EventKind } from '@/app/data/eventLog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const EVENT_KIND_LABELS: Record<EventKind, string> = {
  process_start: 'Inicio de proceso',
  process_stop: 'Fin de proceso',
  phase_change: 'Cambio de fase',
  alarm: 'Alarma',
  alarm_cleared: 'Alarma despejada',
  setpoint_change: 'Cambio de setpoints',
  power_on: 'Equipo encendido',
  power_off: 'Equipo apagado',
  manual_sample: 'Muestreo manual',
  defrost: 'Deshielo',
  door_open: 'Puerta abierta',
};

interface EventLogProps {
  deviceId: string;
}

export const EventLog: React.FC<EventLogProps> = ({ deviceId }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [filter, setFilter] = useState<'all' | 'events' | 'samplings'>('all');

  const rawLog = useMemo(() => getMockEventLog(deviceId), [deviceId]);
  const log = useMemo(() => {
    if (filter === 'events') return rawLog.filter((e): e is LogEvent => e.type === 'event');
    if (filter === 'samplings') return rawLog.filter((e) => e.type === 'sampling');
    return rawLog;
  }, [rawLog, filter]);

  return (
    <Card className="border-gray-200">
      <CardContent className="p-0">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">{t('event_log')}</h3>
              <p className="text-xs text-gray-500">{t('event_log_desc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['all', 'events', 'samplings'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? t('log_filter_all') : f === 'events' ? t('log_filter_events') : t('log_filter_samplings')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('log_date_time')}</th>
                <th className="px-4 py-3 font-semibold">{t('log_type')}</th>
                <th className="px-4 py-3 font-semibold">{t('log_description')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('log_temp')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('log_humidity')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('log_ethylene')}</th>
                <th className="px-4 py-3 font-semibold text-right pr-4">{t('log_co2')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {log.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                    {format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
                  </td>
                  <td className="px-4 py-2.5">
                    {entry.type === 'event' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        {t('log_event')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-medium">
                        <Droplets className="h-3.5 w-3.5" />
                        {t('log_sampling')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-800">
                    {entry.type === 'event' ? (
                      <div>
                        <span className="font-medium">
                          {EVENT_KIND_LABELS[(entry as LogEvent).kind] ?? (entry as LogEvent).description}
                        </span>
                        {(entry as LogEvent).detail && (
                          <span className="block text-gray-500 text-xs mt-0.5">{(entry as LogEvent).detail}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">{entry.note ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                    {entry.type === 'sampling'
                      ? `${convertTemp(entry.temp).toFixed(1)}°${tempUnit === 'C' ? 'C' : 'F'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                    {entry.type === 'sampling' ? `${entry.humidity}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                    {entry.type === 'sampling' ? `${entry.ethylene} ppm` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700 pr-4">
                    {entry.type === 'sampling' ? `${entry.co2.toFixed(2)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {log.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            No hay registros para el filtro seleccionado.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
