import React, { useState, useCallback } from 'react';
import { Activity, Loader2, RefreshCw, Ban, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import { getStoredUser } from '@/app/lib/auth';
import { canDeleteDeviceControlRecord } from '@/app/lib/permissions';
import { useControlSessionsList, revalidateControlSessionsList } from '@/app/hooks/useControlSessionsList';
import {
  cancelControlProcess,
  updateControlSession,
  deleteControlSessionRecord,
  type DeviceControlSessionRow,
} from '@/app/lib/deviceControlProcessApi';
import { controlSessionProgressPct } from '@/app/lib/deviceControlProcessApi';
import { cn } from '@/app/lib/utils';
import { toast } from 'sonner';
const STATUS_ES: Record<string, string> = {
  active: 'Activo',
  cancelled: 'Cancelado',
  completed: 'Completado',
};

function paramsToString(p: Record<string, unknown>) {
  try {
    return JSON.stringify(p, null, 2);
  } catch {
    return '{}';
  }
}

export const DeviceControlAdmin: React.FC = () => {
  const { t, formatDateTime } = useSettings();
  const { sessions: rows, isLoading, isError } = useControlSessionsList();
  const [busy, setBusy] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<DeviceControlSessionRow | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editParamsText, setEditParamsText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [detailRow, setDetailRow] = useState<DeviceControlSessionRow | null>(null);
  const role = getStoredUser()?.role;
  const uid = getStoredUser()?.id;
  const canModerateSessions = role === 'operator' || role === 'admin' || role === 'superadmin';
  const canHardDeleteDb = canDeleteDeviceControlRecord();

  const load = useCallback(() => revalidateControlSessionsList(), []);

  const onCancel = async (r: DeviceControlSessionRow) => {
    if (r.status !== 'active') return;
    if (!canModerateSessions && r.user_id !== uid) return;
    if (!window.confirm(t('control_process_cancel_confirm') || '¿Cancelar?')) return;
    setBusy(r.id);
    try {
      await cancelControlProcess(r.id);
      toast.success(t('control_process_cancelled') || 'Cancelado');
      await revalidateControlSessionsList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  };

  const onDeleteRecord = async (r: DeviceControlSessionRow) => {
    if (r.status === 'active') {
      toast.error(t('control_session_delete_active_hint') || 'Cancele el proceso activo primero.');
      return;
    }
    if (!window.confirm(t('control_session_delete_confirm') || '¿Eliminar este registro del listado?')) return;
    setBusy(r.id);
    try {
      await deleteControlSessionRecord(r.id);
      toast.success(t('control_session_deleted') || 'Registro eliminado');
      await revalidateControlSessionsList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  };

  const openEdit = (r: DeviceControlSessionRow) => {
    if (r.status !== 'active') return;
    setEditRow(r);
    setEditLabel(r.display_label || r.process_type);
    setEditDuration(String(r.duration_hours ?? ''));
    setEditParamsText(paramsToString((r.params || {}) as Record<string, unknown>));
  };

  const saveEdit = async () => {
    if (!editRow) return;
    let params: Record<string, unknown> = (editRow.params || {}) as Record<string, unknown>;
    if (editParamsText.trim()) {
      try {
        const parsed = JSON.parse(editParamsText) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('invalid');
        }
        params = parsed as Record<string, unknown>;
      } catch {
        toast.error(t('control_session_params_invalid_json') || 'JSON de parámetros no válido');
        return;
      }
    }
    const d = Number(editDuration);
    if (!Number.isFinite(d) || d <= 0) {
      toast.error(t('control_session_duration_invalid') || 'Duración no válida');
      return;
    }
    setSavingEdit(true);
    try {
      await updateControlSession(editRow.id, {
        displayLabel: editLabel,
        params,
        durationHours: d,
      });
      toast.success(t('control_session_updated') || 'Cambios guardados');
      setEditRow(null);
      await revalidateControlSessionsList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t('loading') || '…'}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-600 max-w-lg mx-auto">
        <p className="font-medium">{t('control_sessions_load_error') || 'No se pudo cargar el listado.'}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('control_sessions_load_error_hint') || 'Compruebe la API (Ripener) y que haya sesión iniciada.'}
        </p>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          {t('refresh') || 'Reintentar'}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            {t('control_sessions_page_title') || 'Control de dispositivos — Procesos confirmados'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('control_sessions_subtitle')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          {t('refresh') || 'Actualizar'}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('control_sessions_hint_fleet') || 'Abra un dispositivo desde el panel principal para iniciar un proceso; los confirmados aparecen aquí.'}
      </p>

      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm text-left min-w-[1100px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              <th className="p-3 font-semibold">IMEI / {t('device')}</th>
              <th className="p-3 font-semibold">{t('process') || 'Proceso'}</th>
              <th className="p-3 font-semibold">{t('status') || 'Estado'}</th>
              <th className="p-3 font-semibold whitespace-nowrap">%</th>
              <th className="p-3 font-semibold whitespace-nowrap">{t('start') || 'Inicio'}</th>
              <th className="p-3 font-semibold whitespace-nowrap">{t('control_process_estimated_end') || 'Fin'}</th>
              <th className="p-3 font-semibold min-w-[140px]">{t('control_session_cancelled_by_col')}</th>
              {role !== 'viewer' && <th className="p-3 font-semibold">{t('user') || 'Usuario'}</th>}
              <th className="p-3 font-semibold text-right">{t('actions') || 'Acciones'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.status === 'active' ? controlSessionProgressPct(r) : r.status === 'completed' ? 100 : 0;
              const canAct = canModerateSessions || r.user_id === uid;
              return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="p-3 font-mono text-xs">{r.device_id}</td>
                  <td className="p-3">
                    <span className="font-medium text-gray-900">{r.display_label || r.process_type}</span>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2 max-w-md">
                      {Object.entries((r.params && typeof r.params === 'object' ? r.params : {}) as Record<string, unknown>)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' · ')}
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded text-xs font-medium',
                        r.status === 'active' && 'bg-green-100 text-green-800',
                        r.status === 'cancelled' && 'bg-amber-100 text-amber-800',
                        r.status === 'completed' && 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {STATUS_ES[r.status] || r.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.status === 'active' ? `${pct}%` : '—'}</td>
                  <td className="p-3 whitespace-nowrap text-xs">
                    {formatDateTime(r.started_at)}
                  </td>
                  <td className="p-3 whitespace-nowrap text-xs">
                    {formatDateTime(r.estimated_end_at)}
                  </td>
                  <td className="p-3 text-xs align-top">
                    {r.status === 'cancelled' && r.cancelled_at ? (
                      <div>
                        <div className="text-gray-900">
                          {r.cancelled_by_name || r.cancelled_by_email || '—'}
                        </div>
                        <div className="text-gray-500 mt-0.5">{formatDateTime(r.cancelled_at)}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {role !== 'viewer' && (
                    <td className="p-3 text-xs text-gray-600">{r.user_name || r.user_email || '—'}</td>
                  )}
                  <td className="p-3 text-right space-x-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-slate-700"
                      onClick={() => setDetailRow(r)}
                      title={t('control_session_view_detail')}
                    >
                      <Eye className="h-3 w-3 sm:mr-1" />
                      <span className="hidden lg:inline">{t('control_session_view_detail')}</span>
                    </Button>
                    {r.status === 'active' && canAct && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-blue-600"
                          disabled={busy === r.id}
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-3 w-3" />
                          <span className="ml-1 hidden sm:inline">{t('edit') || 'Editar'}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          disabled={busy === r.id}
                          onClick={() => onCancel(r)}
                        >
                          {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                          <span className="ml-1 hidden sm:inline">{t('cancel_process') || 'Cancelar'}</span>
                        </Button>
                      </>
                    )}
                    {r.status !== 'active' && canAct && canHardDeleteDb && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        disabled={busy === r.id}
                        onClick={() => onDeleteRecord(r)}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="ml-1 hidden sm:inline">{t('control_session_delete') || 'Eliminar'}</span>
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-8 text-center text-gray-500">{t('no_data') || 'Sin registros'}</div>
        )}
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('control_session_edit_title') || 'Editar proceso activo'}</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground text-xs">
                {editRow.device_id} · {editRow.process_type}
              </p>
              <div>
                <label className="text-xs text-muted-foreground">{t('process') || 'Nombre'}</label>
                <input
                  className="w-full border rounded-md px-2 py-1.5 text-sm mt-1"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {t('duration') || 'Duración'} (h)
                </label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  className="w-full border rounded-md px-2 py-1.5 text-sm mt-1"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('control_session_edit_duration_hint') || 'Se recalcula el fin estimado desde el inicio original.'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('control_process_params') || 'Parámetros (JSON)'}</label>
                <textarea
                  className="w-full min-h-[120px] font-mono text-xs border rounded-md p-2 mt-1"
                  value={editParamsText}
                  onChange={(e) => setEditParamsText(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)} disabled={savingEdit}>
              {t('cancel') || 'Cancelar'}
            </Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={savingEdit} className="bg-blue-600">
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save') || 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-lg max-h-[min(90vh,680px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('control_session_detail_title')}</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm text-gray-800">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">IMEI</p>
                <p className="font-mono text-xs break-all">{detailRow.device_id}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500">{t('process')}</p>
                  <p>{detailRow.display_label || detailRow.process_type}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">{t('status')}</p>
                  <p>{STATUS_ES[detailRow.status] || detailRow.status}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">{t('control_session_detail_started')}</p>
                <p className="font-mono text-xs">{formatDateTime(detailRow.started_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">{t('control_process_estimated_end')}</p>
                <p className="font-mono text-xs">{formatDateTime(detailRow.estimated_end_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">{t('control_session_detail_duration')}</p>
                <p>{String(detailRow.duration_hours)}</p>
              </div>
              {detailRow.status === 'cancelled' && detailRow.cancelled_at && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
                  <p className="text-xs font-semibold uppercase mb-1">{t('report_cancel_section')}</p>
                  <p>
                    <span className="text-amber-900/85">{t('report_cancel_by')}: </span>
                    {detailRow.cancelled_by_name || detailRow.cancelled_by_email || '—'}
                  </p>
                  <p className="mt-1">
                    <span className="text-amber-900/85">{t('report_cancel_at')}: </span>
                    {formatDateTime(detailRow.cancelled_at)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">{t('control_process_params')}</p>
                <pre className="text-xs bg-slate-50 border rounded-md p-2 overflow-x-auto max-h-52">
                  {paramsToString((detailRow.params || {}) as Record<string, unknown>)}
                </pre>
              </div>
              {role !== 'viewer' && (
                <div>
                  <p className="text-xs font-semibold text-gray-500">{t('user')}</p>
                  <p>{detailRow.user_name || detailRow.user_email || '—'}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailRow(null)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
