import React, { useState, useCallback, useEffect } from 'react';
import { Activity, Loader2, RefreshCw, Ban, Pencil, Archive, Eye, RotateCcw, Download, Settings2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import { getStoredUser } from '@/app/lib/auth';
import { canDeleteDeviceControlRecord, canExportControlLogic, canManageControlAutomation, canManageDeviceEthyleneConfig } from '@/app/lib/permissions';
import { useControlSessionsList, revalidateControlSessionsList } from '@/app/hooks/useControlSessionsList';
import {
  cancelControlProcess,
  updateControlSession,
  deleteControlSessionRecord,
  restoreControlSession,
  type DeviceControlSessionRow,
} from '@/app/lib/deviceControlProcessApi';
import { controlSessionProgressPct } from '@/app/lib/deviceControlProcessApi';
import { cn } from '@/app/lib/utils';
import { toast } from 'sonner';
import {
  filterUserFacingParams,
  programmedFieldsFromSession,
  summarizeProcessEventI18n,
  type ProcessEventRow,
} from '@/app/lib/controlProcessDisplay';
import { ProcessTechnicalDetailsDialog } from '@/app/components/ProcessTechnicalDetailsDialog';
import { fetchControlLogicExport } from '@/app/lib/controlLogicExportApi';
import { downloadJsonFile } from '@/app/lib/downloadJsonFile';
import { Switch } from '@/app/components/ui/switch';
import {
  fetchControlAutomationConfig,
  updateControlAutomationConfig,
} from '@/app/lib/controlAutomationConfigApi';
import {
  deleteDeviceEthyleneConfig,
  fetchDeviceEthyleneConfigs,
  upsertDeviceEthyleneConfig,
  type DeviceEthyleneConfigRow,
} from '@/app/lib/deviceEthyleneConfigApi';
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
  const { t, formatDateTime, formatTemp } = useSettings();
  const role = getStoredUser()?.role;
  const isSuperAdmin = role === 'superadmin';
  const canExportLogic = canExportControlLogic();
  const canManageAutomation = canManageControlAutomation();
  const canManageEthyleneConfig = canManageDeviceEthyleneConfig();
  const [exportLogicBusy, setExportLogicBusy] = useState(false);
  const [automationLoading, setAutomationLoading] = useState(canManageAutomation);
  const [ripeningVent220, setRipeningVent220] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [ethyleneConfigs, setEthyleneConfigs] = useState<DeviceEthyleneConfigRow[]>([]);
  const [ethyleneConfigLoading, setEthyleneConfigLoading] = useState(canManageEthyleneConfig);
  const [ethyleneDeviceId, setEthyleneDeviceId] = useState('');
  const [ethyleneMultiplier, setEthyleneMultiplier] = useState('1');
  const [ethyleneConfigSaving, setEthyleneConfigSaving] = useState(false);
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const includeArchived = Boolean(isSuperAdmin && showArchivedSessions);
  const { sessions: rows, isLoading, isError } = useControlSessionsList(includeArchived);
  const [busy, setBusy] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<DeviceControlSessionRow | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editParamsText, setEditParamsText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [detailRow, setDetailRow] = useState<DeviceControlSessionRow | null>(null);
  const [detailTechOpen, setDetailTechOpen] = useState(false);
  const uid = getStoredUser()?.id;
  const canModerateSessions = role === 'operator' || role === 'admin' || role === 'superadmin';
  const canHardDeleteDb = canDeleteDeviceControlRecord();

  const load = useCallback(() => revalidateControlSessionsList(), []);

  useEffect(() => {
    if (!canManageAutomation) return;
    let cancelled = false;
    void (async () => {
      setAutomationLoading(true);
      try {
        const cfg = await fetchControlAutomationConfig();
        if (!cancelled) setRipeningVent220(Boolean(cfg.ripening_co2_ventilation_220));
      } catch {
        if (!cancelled) toast.error(t('error') || 'Error');
      } finally {
        if (!cancelled) setAutomationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageAutomation, t]);

  useEffect(() => {
    if (!canManageEthyleneConfig) return;
    let cancelled = false;
    void (async () => {
      setEthyleneConfigLoading(true);
      try {
        const rows = await fetchDeviceEthyleneConfigs();
        if (!cancelled) setEthyleneConfigs(rows);
      } catch {
        if (!cancelled) toast.error(t('error') || 'Error');
      } finally {
        if (!cancelled) setEthyleneConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageEthyleneConfig, t]);

  const saveEthyleneDeviceConfig = async () => {
    const deviceId = ethyleneDeviceId.trim();
    const multiplier = Number(ethyleneMultiplier);
    if (!deviceId) {
      toast.error(t('device_ethylene_config_device_required'));
      return;
    }
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      toast.error(t('device_ethylene_config_multiplier_invalid'));
      return;
    }
    setEthyleneConfigSaving(true);
    try {
      const row = await upsertDeviceEthyleneConfig(deviceId, multiplier);
      setEthyleneConfigs((prev) => {
        const next = prev.filter((r) => r.device_id !== row.device_id);
        return [...next, row].sort((a, b) => a.device_id.localeCompare(b.device_id));
      });
      toast.success(t('device_ethylene_config_saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error'));
    } finally {
      setEthyleneConfigSaving(false);
    }
  };

  const removeEthyleneDeviceConfig = async (deviceId: string) => {
    if (!window.confirm(t('device_ethylene_config_delete_confirm'))) return;
    setEthyleneConfigSaving(true);
    try {
      await deleteDeviceEthyleneConfig(deviceId);
      setEthyleneConfigs((prev) => prev.filter((r) => r.device_id !== deviceId));
      toast.success(t('device_ethylene_config_deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error'));
    } finally {
      setEthyleneConfigSaving(false);
    }
  };

  const saveAutomationConfig = async (enabled: boolean) => {
    setAutomationSaving(true);
    try {
      const cfg = await updateControlAutomationConfig({ ripening_co2_ventilation_220: enabled });
      setRipeningVent220(Boolean(cfg.ripening_co2_ventilation_220));
      toast.success(t('control_automation_saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error'));
    } finally {
      setAutomationSaving(false);
    }
  };

  const exportControlLogic = async () => {
    if (!canExportLogic) return;
    setExportLogicBusy(true);
    try {
      const data = await fetchControlLogicExport();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJsonFile(data, `control_logica_tunel_tk_${stamp}.json`);
      toast.success(t('control_logic_export_success'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('control_logic_export_error'));
    } finally {
      setExportLogicBusy(false);
    }
  };

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

  const onArchiveRecord = async (r: DeviceControlSessionRow) => {
    if (r.archived_at) return;
    if (r.status === 'active') {
      toast.error(t('control_session_delete_active_hint') || 'Cancele el proceso activo primero.');
      return;
    }
    if (!window.confirm(t('control_session_delete_confirm') || '¿Archivar este registro?')) return;
    setBusy(r.id);
    try {
      await deleteControlSessionRecord(r.id);
      toast.success(t('control_session_deleted') || 'Registro archivado');
      await revalidateControlSessionsList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  };

  const onRestoreArchived = async (r: DeviceControlSessionRow) => {
    if (!isSuperAdmin || !r.archived_at) return;
    setBusy(r.id);
    try {
      await restoreControlSession(r.id);
      toast.success(t('restore_control_session'));
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
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t('loading') || '…'}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-600 dark:text-red-400 max-w-lg mx-auto">
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            {t('control_sessions_page_title') || 'Control de dispositivos — Procesos confirmados'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('control_sessions_subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isSuperAdmin && (
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={showArchivedSessions}
                onChange={(e) => setShowArchivedSessions(e.target.checked)}
              />
              {t('catalog_show_archived_sessions')}
            </label>
          )}
          {canExportLogic ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={exportLogicBusy}
              onClick={() => void exportControlLogic()}
            >
              {exportLogicBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('control_logic_export_json')}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {t('refresh') || 'Actualizar'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('control_sessions_hint_fleet') || 'Abra un dispositivo desde el panel principal para iniciar un proceso; los confirmados aparecen aquí.'}
      </p>

      {canManageAutomation ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('control_automation_settings_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('control_automation_settings_hint')}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <label htmlFor="ripening-vent-220" className="text-sm font-medium text-foreground cursor-pointer">
                {t('control_automation_ripening_vent_220')}
              </label>
              {automationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  id="ripening-vent-220"
                  checked={ripeningVent220}
                  disabled={automationSaving}
                  onCheckedChange={(checked) => void saveAutomationConfig(checked)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canManageEthyleneConfig ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('device_ethylene_config_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('device_ethylene_config_hint')}</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] items-end">
              <div>
                <label htmlFor="ethylene-device-id" className="text-xs font-medium text-muted-foreground">
                  IMEI
                </label>
                <input
                  id="ethylene-device-id"
                  value={ethyleneDeviceId}
                  onChange={(e) => setEthyleneDeviceId(e.target.value.toUpperCase())}
                  placeholder="MEX1001"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="ethylene-multiplier" className="text-xs font-medium text-muted-foreground">
                  {t('device_ethylene_config_multiplier')}
                </label>
                <input
                  id="ethylene-multiplier"
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={ethyleneMultiplier}
                  onChange={(e) => setEthyleneMultiplier(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={ethyleneConfigSaving}
                onClick={() => void saveEthyleneDeviceConfig()}
              >
                {ethyleneConfigSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('device_ethylene_config_example')}</p>
            {ethyleneConfigLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : ethyleneConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('device_ethylene_config_empty')}</p>
            ) : (
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 border-b border-border">
                    <tr>
                      <th className="p-2 text-left font-semibold">IMEI</th>
                      <th className="p-2 text-left font-semibold">{t('device_ethylene_config_multiplier')}</th>
                      <th className="p-2 text-left font-semibold">{t('device_ethylene_config_updated')}</th>
                      <th className="p-2 text-right font-semibold">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ethyleneConfigs.map((row) => (
                      <tr key={row.device_id} className="border-b border-border last:border-0">
                        <td className="p-2 font-mono text-xs">{row.device_id}</td>
                        <td className="p-2">×{row.injection_multiplier}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">
                          {row.updated_at ? formatDateTime(row.updated_at) : '—'}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={ethyleneConfigSaving}
                            onClick={() => {
                              setEthyleneDeviceId(row.device_id);
                              setEthyleneMultiplier(String(row.injection_multiplier));
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            {t('edit')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            disabled={ethyleneConfigSaving}
                            onClick={() => void removeEthyleneDeviceConfig(row.device_id)}
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" />
                            {t('delete')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-sm">
        <table className="w-full text-sm text-left min-w-[1100px] text-foreground">
          <thead>
            <tr className="border-b border-border bg-muted/60">
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
              const isArchivedRow = Boolean(r.archived_at);
              const pct = r.status === 'active' ? controlSessionProgressPct(r) : r.status === 'completed' ? 100 : 0;
              const canAct = canModerateSessions || r.user_id === uid;
              return (
                <tr
                  key={r.id}
                  className={cn(
                    'border-b border-border hover:bg-muted/40',
                    isArchivedRow && 'bg-muted/30 border-l-4 border-l-amber-400 dark:border-l-amber-500'
                  )}
                >
                  <td className="p-3 font-mono text-xs">{r.device_id}</td>
                  <td className="p-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{r.display_label || r.process_type}</span>
                      {isArchivedRow && (
                        <span className="text-[10px] font-bold uppercase px-1 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800">
                          {t('archived_badge')}
                        </span>
                      )}
                    </span>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 max-w-md">
                      {(() => {
                        const fields = programmedFieldsFromSession(r, t, formatTemp);
                        if (fields.length > 0) {
                          return fields.map((f) => `${f.label}: ${f.value}`).join(' · ');
                        }
                        const p = filterUserFacingParams(
                          (r.params && typeof r.params === 'object' ? r.params : {}) as Record<string, unknown>
                        );
                        return Object.entries(p)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ');
                      })()}
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded text-xs font-medium',
                        r.status === 'active' && 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
                        r.status === 'cancelled' && 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
                        r.status === 'completed' && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
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
                        <div className="text-foreground">
                          {r.cancelled_by_name || r.cancelled_by_email || '—'}
                        </div>
                        <div className="text-muted-foreground mt-0.5">{formatDateTime(r.cancelled_at)}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  {role !== 'viewer' && (
                    <td className="p-3 text-xs text-muted-foreground">{r.user_name || r.user_email || '—'}</td>
                  )}
                  <td className="p-3 text-right space-x-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
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
                          className="text-blue-600 dark:text-blue-400"
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
                          className="text-red-600 dark:text-red-400"
                          disabled={busy === r.id}
                          onClick={() => onCancel(r)}
                        >
                          {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                          <span className="ml-1 hidden sm:inline">{t('cancel_process') || 'Cancelar'}</span>
                        </Button>
                      </>
                    )}
                    {!isArchivedRow && r.status !== 'active' && canAct && canHardDeleteDb && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-200 dark:text-red-400 dark:border-red-900"
                        disabled={busy === r.id}
                        onClick={() => onArchiveRecord(r)}
                      >
                        <Archive className="h-3 w-3" />
                        <span className="ml-1 hidden sm:inline">{t('control_session_archive')}</span>
                      </Button>
                    )}
                    {isArchivedRow && isSuperAdmin && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-emerald-800 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800"
                        disabled={busy === r.id}
                        onClick={() => onRestoreArchived(r)}
                      >
                        {busy === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1 hidden sm:inline">{t('restore_control_session')}</span>
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">{t('no_data') || 'Sin registros'}</div>
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
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm mt-1 bg-background text-foreground"
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
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm mt-1 bg-background text-foreground"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('control_session_edit_duration_hint') || 'Se recalcula el fin estimado desde el inicio original.'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('control_process_params') || 'Parámetros (JSON)'}</label>
                <textarea
                  className="w-full min-h-[120px] font-mono text-xs border border-border rounded-md p-2 mt-1 bg-background text-foreground"
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
            <div className="space-y-3 text-sm text-foreground">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">IMEI</p>
                <p className="font-mono text-xs break-all">{detailRow.device_id}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">{t('process')}</p>
                  <p>{detailRow.display_label || detailRow.process_type}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">{t('status')}</p>
                  <p>{STATUS_ES[detailRow.status] || detailRow.status}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{t('control_session_detail_started')}</p>
                <p className="font-mono text-xs">{formatDateTime(detailRow.started_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{t('control_process_estimated_end')}</p>
                <p className="font-mono text-xs">{formatDateTime(detailRow.estimated_end_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{t('control_session_detail_duration')}</p>
                <p>{String(detailRow.duration_hours)}</p>
              </div>
              {detailRow.status === 'cancelled' && detailRow.cancelled_at && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                  <p className="text-xs font-semibold uppercase mb-1">{t('report_cancel_section')}</p>
                  <p>
                    <span className="text-amber-900/85 dark:text-amber-200/85">{t('report_cancel_by')}: </span>
                    {detailRow.cancelled_by_name || detailRow.cancelled_by_email || '—'}
                  </p>
                  <p className="mt-1">
                    <span className="text-amber-900/85 dark:text-amber-200/85">{t('report_cancel_at')}: </span>
                    {formatDateTime(detailRow.cancelled_at)}
                  </p>
                </div>
              )}
              {detailRow && programmedFieldsFromSession(detailRow, t, formatTemp).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {t('control_process_programmed_values')}
                  </p>
                  <ul className="text-sm space-y-1">
                    {programmedFieldsFromSession(detailRow, t, formatTemp).map((f) => (
                      <li key={f.label} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{f.label}</span>
                        <span className="font-mono">{f.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDetailTechOpen(true)}>
                  {t('control_process_see_more')}
                </Button>
              </div>
              {role !== 'viewer' && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">{t('user')}</p>
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

      {detailRow && (
        <ProcessTechnicalDetailsDialog
          open={detailTechOpen}
          onOpenChange={setDetailTechOpen}
          title={t('control_process_technical_detail')}
          payload={detailRow.params ?? {}}
          eventLog={
            Array.isArray(detailRow.params?.tunnelEventLog)
              ? (detailRow.params.tunnelEventLog as ProcessEventRow[])
              : []
          }
          formatEvent={(ev) => summarizeProcessEventI18n(ev, t)}
          formatDateTime={formatDateTime}
        />
      )}
    </div>
  );
};
