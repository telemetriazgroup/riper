import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { startControlProcess, type StartControlProcessBody } from '@/app/lib/deviceControlProcessApi';
import { revalidateControlSessionsList } from '@/app/hooks/useControlSessionsList';
import { revalidateFleetActiveControlSessions } from '@/app/hooks/useFleetActiveControlMap';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type StartDraft = Omit<StartControlProcessBody, 'deviceId' | 'startedAt'>;
type Draft = StartDraft | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string | undefined;
  draft: Draft;
  onCompleted: () => void;
};

export const ControlProcessStartFlow: React.FC<Props> = ({ open, onOpenChange, deviceId, draft, onCompleted }) => {
  const { t, formatDateTime } = useSettings();
  const { session: active, mutate: mutateActive } = useDeviceControlSession(deviceId);
  const [step, setStep] = useState<'confirm' | 'replace'>('confirm');
  const [bypassReplace, setBypassReplace] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('confirm');
      setBypassReplace(false);
      return;
    }
    if (draft && active?.status === 'active' && !bypassReplace) {
      setStep('replace');
    } else {
      setStep('confirm');
    }
  }, [open, draft, active?.id, active?.status, bypassReplace]);

  const runStart = useCallback(async () => {
    if (!deviceId || !draft) return;
    setSubmitting(true);
    const startedAt = new Date().toISOString();
    try {
      await startControlProcess({
        deviceId,
        processType: draft.processType,
        displayLabel: draft.displayLabel,
        params: draft.params,
        durationHours: draft.durationHours,
        startedAt,
      });
      void revalidateControlSessionsList();
      void revalidateFleetActiveControlSessions();
      await mutateActive();
      toast.success(t('control_process_started') || 'Proceso registrado e iniciado');
      onOpenChange(false);
      onCompleted();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }, [deviceId, draft, mutateActive, onCompleted, onOpenChange, t]);

  const endDate = (() => {
    if (!draft) return null;
    const t0 = Date.now();
    return new Date(t0 + draft.durationHours * 3600 * 1000);
  })();

  const paramEntries = draft ? Object.entries(draft.params).filter(([k]) => k !== 'tempUnit') : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'replace'
              ? t('control_process_replace_title') || 'Cambio de proceso'
              : t('control_process_confirm_title') || 'Confirmar inicio de proceso'}
          </DialogTitle>
        </DialogHeader>

        {step === 'replace' && draft && active && (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {t('control_process_replace_desc') || `Hay un proceso activo (${active.display_label || active.process_type}). Al continuar, se cancelará y se guardará el nuevo con la configuración actual.`}
              </p>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground">{t('current') || 'Actual'}:</span>{' '}
                {active.display_label || active.process_type}
              </p>
              <p>
                <span className="font-medium text-foreground">{t('new') || 'Nuevo'}:</span> {draft.displayLabel}
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel') || 'Cancelar'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setBypassReplace(true);
                  setStep('confirm');
                }}
              >
                {t('continue')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'confirm' && draft && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('control_process_time_hint') || 'Revisa el inicio, el fin estimado y los parámetros antes de confirmar.'}
            </p>
            {draft.processType === 'Cooling' && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-2">
                  <p className="font-medium">{t('cooling_process_disclaimer_title')}</p>
                  {t('cooling_process_disclaimer')
                    .split('\n\n')
                    .map((para, i) => (
                      <p key={i} className="leading-relaxed">
                        {para}
                      </p>
                    ))}
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">{t('process') || 'Proceso'}:</span>{' '}
                <span className="font-medium">{draft.displayLabel}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{t('start') || 'Inicio'}:</span>{' '}
                {formatDateTime(new Date())}
              </p>
              {endDate && (
                <p>
                  <span className="text-muted-foreground">{t('control_process_estimated_end') || 'Fin estimado'}:</span>{' '}
                  {formatDateTime(endDate)}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">{t('duration') || 'Duración'}:</span>{' '}
                {Number.isInteger(draft.durationHours) || draft.durationHours === Math.floor(draft.durationHours)
                  ? `${draft.durationHours} h`
                  : `${Math.round(draft.durationHours * 60)} min / ${draft.durationHours.toFixed(2)} h`}
              </p>
            </div>
            {paramEntries.length > 0 && (
              <ul className="text-sm space-y-1 border rounded-md p-3 max-h-40 overflow-y-auto">
                {paramEntries.map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono text-right break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {t('cancel') || 'Cancelar'}
              </Button>
              <Button type="button" onClick={() => void runStart()} disabled={submitting} className="bg-blue-600">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('control_process_confirm') || 'Confirmar e iniciar'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
