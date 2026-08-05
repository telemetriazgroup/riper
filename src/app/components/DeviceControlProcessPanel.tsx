import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Loader2, PauseCircle, PlayCircle, Snowflake, XCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';
import {
  cancelControlProcess,
  controlSessionProgressPct,
  sendCoolingInterventionCommand,
  setCoolingIntervention,
  type DeviceControlSessionRow,
} from '@/app/lib/deviceControlProcessApi';
import {
  filterUserFacingParams,
  programmedFieldsFromSession,
  summarizeProcessEventI18n,
  isAutomatedControlProcess,
  processAutomationPhaseLabel,
  lastProcessEventSummary,
  processEventLogFromParams,
  type ProcessEventRow,
} from '@/app/lib/controlProcessDisplay';
import { tunnelCommandStatusLabel } from '@/app/lib/tunnelCommandsApi';
import { GOURMET_TUNEL_DEVICE_ID } from '@/app/lib/tunelUnido';
import { useRipeningActiveForDevice } from '@/app/hooks/useRipeningActiveForDevice';
import { inferCurrentNextPhase } from '@/app/lib/ripeningProcessMappers';
import { ProcessTechnicalDetailsDialog } from '@/app/components/ProcessTechnicalDetailsDialog';
import { cn } from '@/app/lib/utils';
import { canOperateDeviceControl, isSuperUser } from '@/app/lib/permissions';
import { shouldShowClientSafeProcessEvents } from '@/app/lib/ethyleneDisplayPolicy';
import { toast } from 'sonner';

type Props = { deviceId: string };

export const DeviceControlProcessPanel: React.FC<Props> = ({ deviceId }) => {
  const { t, formatDateTime, formatTemp } = useSettings();
  const clientSafeEvents = shouldShowClientSafeProcessEvents();
  const isTunnel = deviceId === GOURMET_TUNEL_DEVICE_ID;
  const { session, isLoading, mutate } = useDeviceControlSession(deviceId, isTunnel ? 10000 : 30000);
  const { activeTracking, isLoading: trackingLoading } = useRipeningActiveForDevice(deviceId);
  const [cancelling, setCancelling] = React.useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [intervBusy, setIntervBusy] = useState(false);
  const [intervSetPoint, setIntervSetPoint] = useState('5');
  const [intervMode, setIntervMode] = useState('4');
  const superUser = isSuperUser();

  const pct = useMemo(() => controlSessionProgressPct(session ?? undefined), [session]);

  const programmedFields = useMemo(
    () => (session ? programmedFieldsFromSession(session, t, formatTemp) : []),
    [session, t, formatTemp]
  );

  const automation = (session?.params?.processAutomation ?? null) as Record<string, unknown> | null;
  const autoActive = isAutomatedControlProcess(session);
  const interventionActive = Boolean(automation?.interventionActive);
  const isCoolingActive =
    session?.status === 'active' && String(session?.process_type || '') === 'Cooling';

  useEffect(() => {
    if (!isCoolingActive || !session?.params) return;
    const sp = session.params.setPoint ?? session.params.set_point;
    if (sp != null && Number.isFinite(Number(sp))) {
      setIntervSetPoint(String(Number(Number(sp).toFixed(1))));
    }
  }, [isCoolingActive, session?.id, session?.params?.setPoint, session?.params?.set_point]);

  const phaseLabel = useMemo(
    () => (autoActive ? processAutomationPhaseLabel(automation, t, deviceId) : null),
    [autoActive, automation, t, deviceId]
  );
  const lastAction = useMemo(
    () => (autoActive ? lastProcessEventSummary(session?.params, t) : null),
    [autoActive, session?.params, t]
  );
  const syncedAt = session?.params?.tunnelSyncedAt as string | undefined;

  const trackingPayload = activeTracking?.process?.payload;
  const trackingPhase = useMemo(() => {
    if (!trackingPayload || !activeTracking?.summary) return null;
    const pct = activeTracking.summary.progress ?? 0;
    return inferCurrentNextPhase(trackingPayload, pct, t);
  }, [trackingPayload, activeTracking?.summary, t]);

  const trackingAutomation = trackingPayload?.controlAutomation as Record<string, unknown> | null | undefined;
  const trackingLastAction = useMemo(
    () => (trackingPayload ? lastProcessEventSummary(trackingPayload, t) : null),
    [trackingPayload, t]
  );
  const trackingSyncedAt = trackingPayload?.tunnelSyncedAt as string | undefined;
  const trackingPhaseLabel = trackingPhase?.currentLabel ?? null;
  const trackingAutoPhaseLabel = useMemo(
    () =>
      trackingAutomation
        ? processAutomationPhaseLabel(trackingAutomation, t, deviceId)
        : null,
    [trackingAutomation, t, deviceId]
  );

  const onCancel = async (row: DeviceControlSessionRow) => {
    if (row.status !== 'active') return;
    if (!window.confirm(t('control_process_cancel_confirm'))) return;
    setCancelling(true);
    try {
      await cancelControlProcess(row.id);
      await mutate();
      toast.success(t('control_process_cancelled'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setCancelling(false);
    }
  };

  const onToggleIntervention = async (row: DeviceControlSessionRow, active: boolean) => {
    setIntervBusy(true);
    try {
      await setCoolingIntervention(row.id, active);
      await mutate();
      toast.success(active ? t('intervention_started_toast') : t('intervention_ended_toast'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setIntervBusy(false);
    }
  };

  const onInterventionCommand = async (
    row: DeviceControlSessionRow,
    tipo: 1 | 8 | 11,
    dato: number
  ) => {
    setIntervBusy(true);
    try {
      await sendCoolingInterventionCommand(row.id, { tipo, dato });
      await mutate();
      toast.success(t('intervention_command_toast'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setIntervBusy(false);
    }
  };

  if (isLoading || trackingLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border border-dashed border-border rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  /** Seguimiento activo tiene prioridad sobre control manual / sesión de panel. */
  if (activeTracking?.process) {
    const trackEvents = processEventLogFromParams(trackingPayload ?? {}) as ProcessEventRow[];
    return (
      <>
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/90 to-white dark:from-indigo-950/50 dark:to-card p-4 shadow-sm">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              {t('control_follow_active_title')}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeTracking.process.display_name || activeTracking.summary?.display_name}
            </p>
          </div>

          {trackingPhaseLabel && (
            <div className="mt-3 rounded-lg border border-indigo-200/80 bg-card/60 p-3 text-sm">
              <span className="text-muted-foreground">{t('control_follow_stage')}:</span>{' '}
              <span className="font-medium text-foreground">{trackingPhaseLabel}</span>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 uppercase">
              {t('control_automation_active')}
            </p>
            {trackingAutoPhaseLabel && (
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                <span className="text-emerald-700 dark:text-emerald-300">{t('control_automation_phase')}:</span>{' '}
                {trackingAutoPhaseLabel}
              </p>
            )}
            {!clientSafeEvents && trackingLastAction && (
              <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90 leading-relaxed">
                <span className="font-medium">{t('control_automation_last_action')}:</span> {trackingLastAction}
              </p>
            )}
            {trackingSyncedAt && (
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 font-mono">
                {t('control_automation_synced')}: {formatDateTime(trackingSyncedAt)}
              </p>
            )}
          </div>

          <div className="mt-4">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setTechOpen(true)}>
              {t('control_process_see_more')}
            </Button>
          </div>
        </div>

        <ProcessTechnicalDetailsDialog
          open={techOpen}
          onOpenChange={setTechOpen}
          title={t('control_process_technical_detail')}
          payload={trackingPayload}
          eventLog={trackEvents}
          formatEvent={(ev) =>
            summarizeProcessEventI18n(ev, t, { clientSafe: clientSafeEvents })
          }
          formatDateTime={formatDateTime}
        />
      </>
    );
  }

  const isManualSession = session?.process_type === 'Manual';
  const showSession =
    Boolean(session) && (session!.status === 'active' || isManualSession);

  if (!showSession) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <Activity className="h-4 w-4 text-muted-foreground" />
          {t('control_module_title')}
        </div>
        <p className="mt-1">{t('no_control_process_active')}</p>
      </div>
    );
  }

  const row = session!;
  const userParams = filterUserFacingParams(row.params ?? {});
  const eventLog = Array.isArray(row.params?.tunnelEventLog)
    ? (row.params.tunnelEventLog as ProcessEventRow[])
    : [];
  const technicalPayload = {
    userParams,
    processAutomation: row.params?.processAutomation,
    tunnelEventLog: row.params?.tunnelEventLog,
    tunnelSyncedAt: row.params?.tunnelSyncedAt,
    tunnelOverallStatus: row.params?.tunnelOverallStatus,
    tunnelJobs: row.params?.tunnelJobs,
    tunnelCommandBatchId: row.params?.tunnelCommandBatchId,
  };
  const canCancel = row.status === 'active' && canOperateDeviceControl();
  const titleKey = isManualSession ? 'manual_mode' : 'active_control_process';
  const overall = String(row.params?.tunnelOverallStatus || '');

  return (
    <>
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/90 to-white dark:from-blue-950/50 dark:to-card p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              {t(titleKey)}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {row.display_label || row.process_type}
            </p>
            {isManualSession && overall && (
              <p className="text-xs mt-1 font-medium text-blue-800 dark:text-blue-300">
                {tunnelCommandStatusLabel(overall, t)}
              </p>
            )}
          </div>
          {canCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/50"
              disabled={cancelling}
              onClick={() => onCancel(row)}
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              <span className="ml-1">{t('cancel_process')}</span>
            </Button>
          )}
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{t('hours_progress')}</span>
            <span className="font-mono text-blue-800 dark:text-blue-300">{pct}%</span>
          </div>
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all')}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t('start')}</span>
            <p className="font-mono text-foreground">{formatDateTime(row.started_at)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('control_process_estimated_end')}</span>
            <p className="font-mono text-foreground">{formatDateTime(row.estimated_end_at)}</p>
          </div>
        </div>

        {programmedFields.length > 0 && (
          <div className="mt-4 rounded-lg border border-border/80 bg-card/60 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              {t('control_process_programmed_values')}
            </p>
            <ul className="space-y-1.5">
              {programmedFields.map((f) => (
                <li key={f.label} className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-mono font-medium text-foreground">{f.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {autoActive && (
          <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 uppercase">
              {t('control_automation_active')}
            </p>
            {phaseLabel && (
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                <span className="text-emerald-700 dark:text-emerald-300">{t('control_automation_phase')}:</span>{' '}
                {phaseLabel}
              </p>
            )}
            {!clientSafeEvents && lastAction && (
              <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90 leading-relaxed">
                <span className="font-medium">{t('control_automation_last_action')}:</span> {lastAction}
              </p>
            )}
            {syncedAt && (
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 font-mono">
                {t('control_automation_synced')}: {formatDateTime(syncedAt)}
              </p>
            )}
          </div>
        )}

        {isCoolingActive && (interventionActive || superUser) && (
          <div
            className={cn(
              'mt-4 rounded-lg border p-3 space-y-3',
              interventionActive
                ? 'border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40'
                : 'border-border bg-card/60'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <PauseCircle className="h-3.5 w-3.5" />
                  {t('intervention_mode_title')}
                </p>
                <p className="text-xs text-amber-900/80 dark:text-amber-100/80 mt-1 leading-relaxed">
                  {interventionActive
                    ? t('intervention_mode_active_banner')
                    : t('intervention_mode_idle_hint')}
                </p>
              </div>
              {superUser && (
                <Button
                  type="button"
                  size="sm"
                  variant={interventionActive ? 'outline' : 'default'}
                  disabled={intervBusy}
                  className="shrink-0"
                  onClick={() => onToggleIntervention(row, !interventionActive)}
                >
                  {intervBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : interventionActive ? (
                    <PlayCircle className="h-4 w-4" />
                  ) : (
                    <PauseCircle className="h-4 w-4" />
                  )}
                  <span className="ml-1">
                    {interventionActive ? t('intervention_end') : t('intervention_start')}
                  </span>
                </Button>
              )}
            </div>

            {superUser && interventionActive && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs space-y-1">
                  <span className="text-muted-foreground">{t('intervention_setpoint')}</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min={-40}
                      max={30}
                      value={intervSetPoint}
                      onChange={(e) => setIntervSetPoint(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
                      disabled={intervBusy}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={intervBusy}
                      onClick={() => {
                        const n = Number(intervSetPoint);
                        if (!Number.isFinite(n)) {
                          toast.error('set point inválido');
                          return;
                        }
                        void onInterventionCommand(row, 1, n);
                      }}
                    >
                      {t('intervention_send_setpoint')}
                    </Button>
                  </div>
                </label>
                <label className="block text-xs space-y-1">
                  <span className="text-muted-foreground">{t('intervention_controlling_mode')}</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="1"
                      min={0}
                      max={20}
                      value={intervMode}
                      onChange={(e) => setIntervMode(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
                      disabled={intervBusy}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={intervBusy}
                      onClick={() => {
                        const n = Math.round(Number(intervMode));
                        if (!Number.isFinite(n)) {
                          toast.error('modo inválido');
                          return;
                        }
                        void onInterventionCommand(row, 11, n);
                      }}
                    >
                      {t('intervention_send_mode')}
                    </Button>
                  </div>
                </label>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={intervBusy}
                    onClick={() => void onInterventionCommand(row, 8, 1)}
                  >
                    <Snowflake className="h-4 w-4" />
                    <span className="ml-1">{t('intervention_send_defrost')}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setTechOpen(true)}>
            {t('control_process_see_more')}
          </Button>
        </div>
      </div>

      <ProcessTechnicalDetailsDialog
        open={techOpen}
        onOpenChange={setTechOpen}
        title={t('control_process_technical_detail')}
        payload={technicalPayload}
        eventLog={eventLog}
        formatEvent={(ev) => summarizeProcessEventI18n(ev, t, { clientSafe: clientSafeEvents })}
        formatDateTime={formatDateTime}
      />
    </>
  );
};
