import React, { useMemo } from 'react';
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useTunnelCommandJobs } from '@/app/hooks/useTunnelCommandJobs';
import {
  tunnelCommandKindLabel,
  tunnelCommandStatusTone,
  type TunnelCommandJob,
  type TunnelCommandStatus,
} from '@/app/lib/tunnelCommandsApi';
import { cn } from '@/app/lib/utils';

type Props = {
  deviceId: string;
};

function statusLabel(status: TunnelCommandStatus, t: (k: string) => string): string {
  switch (status) {
    case 'pending':
      return t('tunnel_cmd_pending') || 'Pendiente';
    case 'sent':
      return t('tunnel_cmd_sent') || 'Enviado';
    case 'verifying':
      return t('tunnel_cmd_verifying') || 'Verificando';
    case 'waiting':
      return t('tunnel_cmd_waiting') || 'Esperando lectura';
    case 'completed':
      return t('tunnel_cmd_completed') || 'Completado';
    case 'failed':
      return t('tunnel_cmd_failed') || 'Fallido';
    case 'cancelled':
      return t('tunnel_cmd_cancelled') || 'Cancelado';
    default:
      return status;
  }
}

function StatusIcon({ status }: { status: TunnelCommandStatus }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'failed' || status === 'cancelled') return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === 'waiting' || status === 'verifying') return <Clock className="h-4 w-4 text-amber-600" />;
  return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
}

function formatTarget(job: TunnelCommandJob, convertTemp: (c: number) => number, tempUnit: string) {
  const v = Number(job.target_value);
  if (job.kind === 'temperature') return `${convertTemp(v).toFixed(1)}°${tempUnit}`;
  if (job.kind === 'humidity' || job.kind === 'ventilation') return `${v}%`;
  if (job.kind === 'ethylene') return `${v} ppm`;
  return String(v);
}

function JobRow({
  job,
  t,
  convertTemp,
  tempUnit,
  formatDateTime,
}: {
  job: TunnelCommandJob;
  t: (k: string) => string;
  convertTemp: (c: number) => number;
  tempUnit: string;
  formatDateTime: (d: Date | string) => string;
}) {
  const tone = tunnelCommandStatusTone(job.status);
  const readVal = job.last_read_value != null ? Number(job.last_read_value) : null;

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={job.status} />
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {tunnelCommandKindLabel(job.kind, t)}
            </p>
            <p className="text-xs text-gray-500">
              Objetivo: {formatTarget(job, convertTemp, tempUnit)}
              {readVal != null && (
                <span className="ml-2">
                  · Lectura: {job.kind === 'temperature' ? `${convertTemp(readVal).toFixed(1)}°${tempUnit}` : readVal}
                </span>
              )}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
            tone === 'success' && 'bg-green-100 text-green-800',
            tone === 'warning' && 'bg-amber-100 text-amber-800',
            tone === 'danger' && 'bg-red-100 text-red-800',
            tone === 'default' && 'bg-gray-100 text-gray-700'
          )}
        >
          {statusLabel(job.status, t)}
        </span>
      </div>
      {job.last_error && (
        <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">{job.last_error}</p>
      )}
      <p className="text-[11px] text-gray-400">
        {formatDateTime(job.created_at)}
        {job.completed_at ? ` → ${formatDateTime(job.completed_at)}` : ''}
        {job.attempts > 0 ? ` · intentos ${job.attempts}` : ''}
      </p>
    </div>
  );
}

export const TunnelCommandCompliancePanel: React.FC<Props> = ({ deviceId }) => {
  const { t, convertTemp, tempUnit, formatDateTime } = useSettings();
  const { jobs, isLoading, error, refresh, hasActive } = useTunnelCommandJobs(deviceId, true);

  const recent = useMemo(() => jobs.slice(0, 8), [jobs]);

  if (isLoading && jobs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-4 border border-dashed rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading') || '…'}
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {t('tunnel_cmd_compliance_title') || 'Cumplimiento de comandos túnel'}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('tunnel_cmd_compliance_hint') ||
              'Seguimiento de temperatura (°C), humedad, etileno y ventilación enviados al upstream Tunel.'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} title={t('refresh') || 'Actualizar'}>
          <RefreshCw className={cn('h-4 w-4', hasActive && 'animate-spin')} />
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="space-y-2">
        {recent.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            t={t}
            convertTemp={convertTemp}
            tempUnit={tempUnit}
            formatDateTime={formatDateTime}
          />
        ))}
      </div>
    </div>
  );
};
