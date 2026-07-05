import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  Calendar,
  Droplets,
  Filter,
  Thermometer,
  CloudRain,
  Wind,
  FlaskConical,
  PlayCircle,
  Cog,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { useSettings } from '@/app/contexts/SettingsContext';
import { getMockEventLog, type LogEntry, type LogEvent, type EventKind } from '@/app/data/eventLog';
import { formatUiDecimal, formatUiPercent } from '@/app/lib/formatUiNumber';
import { useControlSessionsList } from '@/app/hooks/useControlSessionsList';
import { useRipeningActiveForDevice } from '@/app/hooks/useRipeningActiveForDevice';
import { processActionLogEntriesForDevice, processActionLogEntriesFromTracking } from '@/app/lib/controlProcessDisplay';
import { resolveEthyleneDisplayTargetPpm } from '@/app/lib/ethyleneDisplayPolicy';

interface EventLogProps {
  deviceId: string;
}

const CONTROL_KINDS = new Set<EventKind>([
  'process_action',
  'control_process_start',
  'control_process_cancel',
  'control_process_complete',
  'control_temperature',
  'control_humidity',
  'control_co2',
  'control_ethylene',
  'control_ventilation',
  'control_general',
]);

function isControlKind(kind: EventKind): boolean {
  return CONTROL_KINDS.has(kind);
}

function logEntryTemp(entry: LogEntry, formatTemp: (c: number) => string): string {
  if (entry.type === 'sampling') return formatTemp(entry.temp);
  const v = (entry as LogEvent).temp;
  return v != null && Number.isFinite(v) ? formatTemp(v) : '—';
}

function logEntryHumidity(entry: LogEntry): string {
  if (entry.type === 'sampling') return formatUiPercent(entry.humidity);
  const v = (entry as LogEvent).humidity;
  return v != null && Number.isFinite(v) ? formatUiPercent(v) : '—';
}

function logEntryEthylene(entry: LogEntry): string {
  if (entry.type === 'sampling') return `${formatUiDecimal(entry.ethylene)} ppm`;
  const v = (entry as LogEvent).ethylene;
  return v != null && Number.isFinite(v) ? `${formatUiDecimal(v)} ppm` : '—';
}

function logEntryCo2(entry: LogEntry): string {
  if (entry.type === 'sampling') return formatUiPercent(entry.co2);
  const v = (entry as LogEvent).co2;
  return v != null && Number.isFinite(v) ? formatUiPercent(v) : '—';
}

function controlKindLabel(kind: EventKind, t: (k: string) => string): string {
  const map: Partial<Record<EventKind, string>> = {
    control_process_start: 'log_event_kind_control_process',
    control_process_cancel: 'log_event_kind_control_process',
    control_process_complete: 'log_event_kind_control_process',
    control_temperature: 'log_event_kind_control_temperature',
    control_humidity: 'log_event_kind_control_humidity',
    control_co2: 'log_event_kind_control_co2',
    control_ethylene: 'log_event_kind_control_ethylene',
    control_ventilation: 'log_event_kind_control_ventilation',
    control_general: 'log_event_kind_control_general',
    process_action: 'log_event_kind_process_action',
  };
  const key = map[kind];
  return key ? t(key) : t('log_event');
}

function ControlKindBadge({ kind, t }: { kind: EventKind; t: (k: string) => string }) {
  const label = controlKindLabel(kind, t);
  const configs: Partial<Record<EventKind, { className: string; Icon: React.ComponentType<{ className?: string }> }>> = {
    control_process_start: { className: 'bg-indigo-50 text-indigo-700', Icon: PlayCircle },
    control_process_cancel: { className: 'bg-red-50 text-red-700', Icon: PlayCircle },
    control_process_complete: { className: 'bg-emerald-50 text-emerald-700', Icon: PlayCircle },
    control_temperature: { className: 'bg-orange-50 text-orange-700', Icon: Thermometer },
    control_humidity: { className: 'bg-sky-50 text-sky-700', Icon: CloudRain },
    control_co2: { className: 'bg-teal-50 text-teal-700', Icon: Wind },
    control_ethylene: { className: 'bg-violet-50 text-violet-700', Icon: FlaskConical },
    control_ventilation: { className: 'bg-cyan-50 text-cyan-700', Icon: Wind },
    control_general: { className: 'bg-gray-100 text-gray-700', Icon: Cog },
    process_action: { className: 'bg-violet-50 text-violet-700', Icon: Cog },
  };
  const cfg = configs[kind] ?? { className: 'bg-blue-50 text-blue-700', Icon: Calendar };
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export const EventLog: React.FC<EventLogProps> = ({ deviceId }) => {
  const { t, formatTemp, formatDateTime } = useSettings();
  const [filter, setFilter] = useState<'all' | 'control' | 'samplings'>('all');
  const { sessions } = useControlSessionsList(false);
  const { activeTracking } = useRipeningActiveForDevice(deviceId);

  const panelActiveSession = useMemo(
    () => sessions.find((s) => s.device_id === deviceId && s.status === 'active') ?? null,
    [sessions, deviceId]
  );

  const programmedEthyleneTarget = useMemo(
    () =>
      resolveEthyleneDisplayTargetPpm({
        deviceId,
        trackingProcess: activeTracking?.process ?? null,
        panelActiveSession,
        sessions,
      }),
    [deviceId, activeTracking?.process, panelActiveSession, sessions]
  );

  const clientLogDisplayOpts = useMemo(
    () => ({
      clientSafe: true,
      clientFacingLog: true,
      programmedEthyleneTarget,
      deviceId,
    }),
    [programmedEthyleneTarget, deviceId]
  );

  const processActions = useMemo(
    () => processActionLogEntriesForDevice(deviceId, sessions, t, formatTemp, clientLogDisplayOpts),
    [deviceId, sessions, t, formatTemp, clientLogDisplayOpts]
  );

  const trackingActions = useMemo(
    () =>
      processActionLogEntriesFromTracking(
        deviceId,
        activeTracking?.process ?? null,
        t,
        formatTemp,
        clientLogDisplayOpts
      ),
    [deviceId, activeTracking?.process, t, formatTemp, clientLogDisplayOpts]
  );

  const rawLog = useMemo(() => {
    const mock = getMockEventLog(deviceId);
    const merged = [...mock, ...processActions, ...trackingActions];
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return merged;
  }, [deviceId, processActions, trackingActions]);

  const log = useMemo(() => {
    if (filter === 'control') {
      return rawLog.filter((e) => e.type === 'event' && isControlKind((e as LogEvent).kind));
    }
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
              {(['all', 'control', 'samplings'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all'
                    ? t('log_filter_all')
                    : f === 'control'
                      ? t('log_filter_control')
                      : t('log_filter_samplings')}
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
                    {formatDateTime(entry.timestamp)}
                  </td>
                  <td className="px-4 py-2.5">
                    {entry.type === 'event' ? (
                      isControlKind((entry as LogEvent).kind) ? (
                        <ControlKindBadge kind={(entry as LogEvent).kind} t={t} />
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                          <Calendar className="h-3.5 w-3.5" />
                          {t('log_event')}
                        </span>
                      )
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
                        <span className="font-medium">{(entry as LogEvent).description}</span>
                        {(entry as LogEvent).detail && (
                          <span className="block text-gray-500 text-xs mt-0.5">
                            <span className="font-medium text-gray-600">{t('log_ctrl_reason_label')}:</span>{' '}
                            {(entry as LogEvent).detail}
                          </span>
                        )}
                        {(entry as LogEvent).phase && isControlKind((entry as LogEvent).kind) && (
                          <span className="block text-gray-400 text-xs mt-0.5">{(entry as LogEvent).phase}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">{entry.note ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                    {logEntryTemp(entry, formatTemp)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                    {logEntryHumidity(entry)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                    {logEntryEthylene(entry)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700 pr-4">
                    {logEntryCo2(entry)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {log.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            {t('no_data')}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
