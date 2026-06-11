import React, { useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Button } from '@/app/components/ui/Button';
import { Loader2, ClipboardList, Timer, User, Package, ChefHat, Layers, AlertTriangle, Pause, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useRipeningActiveForDevice } from '@/app/hooks/useRipeningActiveForDevice';
import { patchRipeningProcess, pauseRipeningProcess, resumeRipeningProcess } from '@/app/lib/ripeningProcessesApi';
import { canCancelRipeningTracking, canPauseRipeningTracking } from '@/app/lib/permissions';
import {
  inferCurrentNextPhase,
  mapRowToProcessView,
  phaseDurationHoursFromStored,
  formatRecipePhaseParamLines,
} from '@/app/lib/ripeningProcessMappers';
import { toast } from 'sonner';

interface DeviceRipeningTrackingOverviewProps {
  deviceId: string;
}

/** Panel de seguimiento (pestaña Seguimiento) fuera del panel de control: receta, cliente, etapa y tiempos. */
export const DeviceRipeningTrackingOverview: React.FC<DeviceRipeningTrackingOverviewProps> = ({
  deviceId,
}) => {
  const { t, language, formatDateTime, convertTemp, tempUnit } = useSettings();
  const { activeTracking, isLoading, mutate } = useRipeningActiveForDevice(deviceId);
  const [confirmKind, setConfirmKind] = useState<'cancel' | 'pause' | 'resume' | null>(null);
  const [busy, setBusy] = useState(false);
  const locale = language === 'es' ? es : enUS;

  const view = useMemo(() => {
    if (!activeTracking?.process) return null;
    return mapRowToProcessView(activeTracking.process);
  }, [activeTracking?.process]);

  const phaseInfo = useMemo(() => {
    if (!activeTracking?.process || !view) return null;
    const pct =
      activeTracking.summary?.progress != null && Number.isFinite(activeTracking.summary.progress)
        ? activeTracking.summary.progress
        : view.progress;
    return inferCurrentNextPhase(activeTracking.process.payload, pct);
  }, [activeTracking?.process, activeTracking?.summary?.progress, view]);

  const totalHoursPlanned = useMemo(() => {
    if (!activeTracking?.process || !view) return null;
    const sch = view.scheduleSummary as { totalDurationHours?: number };
    if (sch?.totalDurationHours != null && Number.isFinite(Number(sch.totalDurationHours))) {
      return Number(sch.totalDurationHours);
    }
    const raw = activeTracking.process.payload.recipe as { phases?: Record<string, unknown>[] } | undefined;
    const phases = Array.isArray(raw?.phases)
      ? raw.phases.filter((p) => p && (p as { enabled?: boolean }).enabled !== false)
      : [];
    const sum = phases.reduce((acc, p) => acc + phaseDurationHoursFromStored(p as { type?: string; duration?: number }), 0);
    return sum > 0 ? sum : view.recipe.duration_hours || null;
  }, [activeTracking?.process, view]);

  const remainingLabel = useMemo(() => {
    const end = activeTracking?.summary?.estimatedEndAt;
    if (!end) return null;
    const d = new Date(end);
    if (isNaN(d.getTime())) return null;
    if (d.getTime() <= Date.now()) return t('detail_tracking_remaining_done');
    try {
      return formatDistanceToNow(d, { locale, addSuffix: true });
    } catch {
      return formatDateTime(end);
    }
  }, [activeTracking?.summary?.estimatedEndAt, formatDateTime, locale, t]);

  const objectivesRows = useMemo(() => {
    if (!activeTracking?.process) return [];
    const p = activeTracking.process.payload;
    const tg = view?.recipe.targets;
    const rows: { label: string; value: string }[] = [];
    if (tg) {
      if (tg.brix && tg.brix !== '—') rows.push({ label: '°Bx', value: tg.brix });
      if (tg.firmness && tg.firmness !== '—') rows.push({ label: t('detail_tracking_firmness_short'), value: tg.firmness });
      if (tg.color && tg.color !== '—') rows.push({ label: t('detail_tracking_color_short'), value: tg.color });
    }
    const objs = p.objectives;
    if (Array.isArray(objs)) {
      for (const o of objs) {
        if (o && typeof o.name === 'string' && o.value != null) {
          rows.push({
            label: o.name,
            value: `${o.value}${o.unit ? ` ${o.unit}` : ''}`,
          });
        }
      }
    }
    return rows;
  }, [activeTracking?.process, view?.recipe.targets, t]);

  const currentPhaseParams = useMemo(() => {
    if (!phaseInfo?.phasesMeta?.length) return [];
    const raw = phaseInfo.phasesMeta[phaseInfo.currentIndex]?.raw;
    if (!raw || Object.keys(raw).length === 0) return [];
    return formatRecipePhaseParamLines(raw, t, { convertTemp, tempUnit });
  }, [phaseInfo, t, convertTemp, tempUnit]);

  const onConfirmCancel = async () => {
    const pid = activeTracking?.process?.id;
    if (!pid) return;
    setBusy(true);
    try {
      await patchRipeningProcess(pid, { status: 'cancelled' });
      await mutate(undefined, { revalidate: true });
      toast.success(t('control_follow_cancelled'));
      setConfirmKind(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onConfirmPause = async () => {
    const pid = activeTracking?.process?.id;
    if (!pid) return;
    setBusy(true);
    try {
      await pauseRipeningProcess(pid);
      await mutate(undefined, { revalidate: true });
      toast.success(t('control_follow_paused_toast'));
      setConfirmKind(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onConfirmResume = async () => {
    const pid = activeTracking?.process?.id;
    if (!pid) return;
    setBusy(true);
    try {
      await resumeRipeningProcess(pid);
      await mutate(undefined, { revalidate: true });
      toast.success(t('control_follow_resumed_toast'));
      setConfirmKind(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3 text-sm text-teal-900">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        {t('control_follow_loading')}
      </div>
    );
  }

  if (!activeTracking?.summary || !activeTracking.process || !view) {
    return null;
  }

  const sum = activeTracking.summary;
  const proc = activeTracking.process;
  const pct = Math.min(100, Math.max(0, sum.progress));
  const procStatus = proc.status || 'active';
  const isPaused = procStatus === 'paused';

  return (
    <>
      <section
        className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/90 to-white shadow-sm overflow-hidden"
        aria-label={t('detail_tracking_section_label')}
      >
        <div className="border-b border-teal-200/80 bg-teal-600/10 px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex gap-2 min-w-0">
            <ClipboardList className="h-5 w-5 text-teal-800 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <h3 className="text-sm font-bold uppercase tracking-wide text-teal-900">{t('detail_tracking_title')}</h3>
              <p className="text-lg font-semibold text-teal-950 mt-0.5 truncate">{sum.display_name}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {canPauseRipeningTracking() && procStatus === 'active' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100"
                disabled={busy}
                onClick={() => setConfirmKind('pause')}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                <span className="ml-1.5">{t('control_follow_pause_tracking')}</span>
              </Button>
            )}
            {canPauseRipeningTracking() && isPaused && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-teal-500 bg-teal-50 text-teal-950 hover:bg-teal-100"
                disabled={busy}
                onClick={() => setConfirmKind('resume')}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span className="ml-1.5">{t('control_follow_resume_tracking')}</span>
              </Button>
            )}
            {canCancelRipeningTracking() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100"
                disabled={busy}
                onClick={() => setConfirmKind('cancel')}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                <span className={busy ? 'ml-1' : 'ml-1.5'}>{t('control_follow_cancel_tracking')}</span>
              </Button>
            )}
          </div>
        </div>

        {isPaused && (
          <p className="px-4 pt-3 text-xs text-amber-900 bg-amber-50/80 border-b border-teal-200/80">
            {t('detail_tracking_paused_note')}
          </p>
        )}

        <div className="p-4 space-y-4 text-sm text-teal-950">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex gap-2 items-start">
              <User className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-semibold uppercase text-teal-800">{t('detail_tracking_client')}</div>
                <div className="font-medium">{sum.client}</div>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <Package className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-semibold uppercase text-teal-800">{t('detail_tracking_product')}</div>
                <div className="font-medium">{sum.product}</div>
              </div>
            </div>
            <div className="flex gap-2 items-start md:col-span-2 lg:col-span-1">
              <ChefHat className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase text-teal-800">{t('detail_tracking_recipe')}</div>
                <div className="font-medium truncate">{view.recipe.name}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase text-teal-800">{t('detail_tracking_progress')}</span>
              <span className="font-mono font-semibold">{pct}%</span>
            </div>
            <div className="w-full bg-teal-200/70 rounded-full h-2">
              <div className="bg-teal-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-teal-100 bg-white/80 p-3">
              <div className="flex items-center gap-2 text-teal-900 font-semibold text-xs uppercase mb-1">
                <Layers className="h-4 w-4" />
                {t('detail_tracking_phase_now')}
              </div>
              <p className="text-base font-medium">{phaseInfo?.currentLabel ?? '—'}</p>
            </div>
            <div className="rounded-lg border border-teal-100 bg-white/80 p-3">
              <div className="flex items-center gap-2 text-teal-900 font-semibold text-xs uppercase mb-1">
                <Layers className="h-4 w-4 opacity-70" />
                {t('detail_tracking_phase_next')}
              </div>
              <p className="text-base font-medium">{phaseInfo?.nextLabel ?? t('detail_tracking_phase_none_next')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-teal-900/5 px-3 py-2">
              <div className="font-semibold text-teal-900 uppercase tracking-wide">{t('detail_tracking_total_hours')}</div>
              <div className="text-teal-950 font-mono mt-1">
                {totalHoursPlanned != null ? `${totalHoursPlanned} h` : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-teal-900/5 px-3 py-2">
              <div className="flex items-center gap-1 font-semibold text-teal-900 uppercase tracking-wide">
                <Timer className="h-3.5 w-3.5" />
                {t('detail_tracking_remaining')}
              </div>
              <div className="text-teal-950 mt-1">{remainingLabel ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-teal-900/5 px-3 py-2">
              <div className="font-semibold text-teal-900 uppercase tracking-wide">{t('detail_tracking_estimated_end')}</div>
              <div className="text-teal-950 font-mono mt-1">
                {sum.estimatedEndAt ? formatDateTime(sum.estimatedEndAt) : '—'}
              </div>
            </div>
          </div>

          {sum.startedAt && (
            <div className="text-xs text-teal-800/90">
              <span className="font-semibold">{t('start')}: </span>
              {formatDateTime(sum.startedAt)}
            </div>
          )}

          {objectivesRows.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase text-teal-800 mb-2">{t('detail_tracking_targets')}</div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {objectivesRows.map((row, i) => (
                  <li key={i} className="rounded-md border border-teal-100 bg-white/90 px-3 py-2">
                    <span className="text-teal-700 text-[11px]">{row.label}</span>
                    <div className="font-mono font-medium text-teal-950">{row.value}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentPhaseParams.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase text-teal-800 mb-2">{t('detail_tracking_phase_params')}</div>
              <ul className="space-y-1 text-teal-950">
                {currentPhaseParams.map((line, i) => (
                  <li key={i} className="font-mono text-xs border-l-2 border-teal-400 pl-2">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-teal-700/90 font-mono break-all pt-1 border-t border-teal-100">
            UUID: {proc.id}
          </div>

          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t('control_follow_blocked_hint')}
          </p>
        </div>
      </section>

      <AlertDialog open={confirmKind != null} onOpenChange={(open) => !open && !busy && setConfirmKind(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmKind === 'pause' && t('control_follow_pause_tracking')}
              {confirmKind === 'resume' && t('control_follow_resume_tracking')}
              {confirmKind === 'cancel' && t('control_follow_cancel_tracking')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmKind === 'pause' && t('control_follow_pause_confirm')}
              {confirmKind === 'resume' && t('control_follow_resume_confirm')}
              {confirmKind === 'cancel' && t('control_follow_cancel_confirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('cancel')}</AlertDialogCancel>
            <Button
              type="button"
              disabled={busy}
              className={
                confirmKind === 'pause'
                  ? 'bg-amber-700 hover:bg-amber-800 text-white'
                  : confirmKind === 'resume'
                    ? 'bg-teal-700 hover:bg-teal-800 text-white'
                    : 'bg-amber-700 hover:bg-amber-800 text-white'
              }
              onClick={() => {
                if (confirmKind === 'pause') void onConfirmPause();
                else if (confirmKind === 'resume') void onConfirmResume();
                else if (confirmKind === 'cancel') void onConfirmCancel();
              }}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmKind === 'pause' ? (
                t('control_follow_pause_tracking')
              ) : confirmKind === 'resume' ? (
                t('control_follow_resume_tracking')
              ) : (
                t('control_follow_cancel_tracking')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
