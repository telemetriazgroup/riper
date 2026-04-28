import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { startControlProcess } from '@/app/lib/deviceControlProcessApi';
import { sendControlCommand } from '@/app/lib/api';
import { revalidateControlSessionsList } from '@/app/hooks/useControlSessionsList';
import { revalidateFleetActiveControlSessions } from '@/app/hooks/useFleetActiveControlMap';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string | undefined;
  /** called after sesión registrada en control de dispositivos */
  onCompleted: () => void | Promise<void>;
};

function formatLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${Y}-${M}-${D}T${h}:${min}`;
}

export const StopPlanScheduleModal: React.FC<Props> = ({
  open,
  onOpenChange,
  deviceId,
  onCompleted,
}) => {
  const { t, formatDateTime } = useSettings();
  const [endLocal, setEndLocal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !deviceId) return;
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    setEndLocal(formatLocalDatetimeValue(d));
  }, [open, deviceId]);

  const handleConfirm = async () => {
    if (!deviceId) return;
    const endMs = new Date(endLocal).getTime();
    const nowMs = Date.now();
    if (!Number.isFinite(endMs) || endMs <= nowMs) {
      toast.error(t('stop_plan_end_must_be_future'));
      return;
    }
    const minEnd = nowMs + 60_000;
    if (endMs < minEnd) {
      toast.error(t('stop_plan_min_duration'));
      return;
    }

    const endIso = new Date(endMs).toISOString();
    const durationMs = endMs - nowMs;
    const durationHours = durationMs / 3600000;

    const displayLabel = `${t('stop_plan_process_label')} · ${formatDateTime(new Date(endMs))}`;
    const params = {
      mode: 'stop_plan',
      stopUntil: endIso,
      explanation: 'controller_active_machine_stopped',
    };

    setSubmitting(true);
    try {
      await startControlProcess({
        deviceId,
        processType: 'StopPlan',
        displayLabel,
        params,
        durationHours,
        startedAt: new Date(nowMs).toISOString(),
      });
      await revalidateControlSessionsList();
      await revalidateFleetActiveControlSessions();
      await sendControlCommand(deviceId, 'stop_plan', {
        planned_end_at: endIso,
      });
      await onCompleted();
      toast.success(t('stop_plan_registered'));
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const minSelectable = formatLocalDatetimeValue(new Date(Date.now() + 60_000));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            {t('stop_plan_modal_title')}
          </DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-2 text-gray-700">
            <p>{t('stop_plan_modal_intro')}</p>
            <p className="text-sm rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-amber-950">
              {t('stop_plan_modal_technical')}
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <label className="block text-sm font-medium text-gray-800" htmlFor="stop-plan-until">
            {t('stop_plan_until_label')}
          </label>
          <input
            id="stop-plan-until"
            type="datetime-local"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={endLocal}
            min={minSelectable}
            onChange={(e) => setEndLocal(e.target.value)}
            disabled={submitting}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="bg-amber-700 hover:bg-amber-800 text-white gap-2"
            disabled={submitting || !endLocal}
            onClick={() => void handleConfirm()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('stop_plan_confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
