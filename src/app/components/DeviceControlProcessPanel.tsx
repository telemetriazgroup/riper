import React, { useMemo } from 'react';
import { Activity, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';
import { cancelControlProcess, controlSessionProgressPct, type DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import { cn } from '@/app/lib/utils';
import { toast } from 'sonner';

function ParamsList({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params).filter(([k]) => k !== 'name' && k !== 'tempUnit');
  if (entries.length === 0) return <p className="text-sm text-gray-500">—</p>;
  return (
    <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-2 border-b border-gray-50 pb-1">
          <span className="text-gray-500">{k}</span>
          <span className="font-mono text-right break-all text-gray-900">
            {v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Props = { deviceId: string };

export const DeviceControlProcessPanel: React.FC<Props> = ({ deviceId }) => {
  const { t, formatDateTime } = useSettings();
  const { session, isLoading, mutate } = useDeviceControlSession(deviceId);
  const [cancelling, setCancelling] = React.useState(false);

  const pct = useMemo(() => controlSessionProgressPct(session ?? undefined), [session]);

  const onCancel = async (row: DeviceControlSessionRow) => {
    if (row.status !== 'active') return;
    if (!window.confirm(t('control_process_cancel_confirm') || '¿Cancelar el proceso de control en curso?')) return;
    setCancelling(true);
    try {
      await cancelControlProcess(row.id);
      await mutate();
      toast.success(t('control_process_cancelled') || 'Proceso cancelado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-4 border border-dashed rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading') || '…'}
      </div>
    );
  }

  if (!session || session.status !== 'active') {
    return (
      <div className="rounded-xl border border-gray-200 bg-slate-50/80 p-4 text-sm text-gray-600">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <Activity className="h-4 w-4 text-slate-500" />
          {t('control_module_title') || 'Módulo control (panel)'}
        </div>
        <p className="mt-1 text-gray-500">{t('no_control_process_active') || 'No hay un proceso de control iniciado desde el panel (Homogenización, Maduración, Ventilación, Enfriamiento).'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-white p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            {t('active_control_process') || 'Proceso de control activo'}
          </h3>
          <p className="text-sm text-gray-600 mt-0.5">
            {session.display_label || session.process_type} · {session.process_type}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
          disabled={cancelling}
          onClick={() => onCancel(session)}
        >
          {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          <span className="ml-1">{t('cancel_process') || 'Cancelar'}</span>
        </Button>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{t('hours_progress') || 'Avance (tiempo)'}</span>
          <span className="font-mono text-blue-800">{pct}%</span>
        </div>
        <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full bg-blue-600 transition-all')}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">{t('start') || 'Inicio'}</span>
          <p className="font-mono text-gray-900">
            {formatDateTime(session.started_at)}
          </p>
        </div>
        <div>
          <span className="text-gray-500">{t('control_process_estimated_end') || 'Fin estimado'}</span>
          <p className="font-mono text-gray-900">
            {formatDateTime(session.estimated_end_at)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{t('control_process_params') || 'Parámetros guardados'}</p>
        <ParamsList params={session.params} />
      </div>
    </div>
  );
}
