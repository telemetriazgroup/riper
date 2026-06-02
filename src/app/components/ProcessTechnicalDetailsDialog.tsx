import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/Button';
import { GOURMET_PROCESS_DEBUG_PASSWORD, type ProcessEventRow } from '@/app/lib/controlProcessDisplay';
import { useSettings } from '@/app/contexts/SettingsContext';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  payload: unknown;
  eventLog?: ProcessEventRow[];
  formatEvent?: (ev: ProcessEventRow) => string;
  formatDateTime?: (d: Date | string) => string;
};

/** Detalle técnico protegido con clave (JSON + historial de acciones). */
export const ProcessTechnicalDetailsDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  title,
  payload,
  eventLog = [],
  formatEvent,
  formatDateTime,
}) => {
  const { t } = useSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');

  const handleClose = (o: boolean) => {
    if (!o) {
      setUnlocked(false);
      setPassword('');
    }
    onOpenChange(o);
  };

  const tryUnlock = () => {
    if (password === GOURMET_PROCESS_DEBUG_PASSWORD) {
      setUnlocked(true);
      return;
    }
    toast.error(t('control_process_debug_wrong_password'));
  };

  const json = payload != null ? JSON.stringify(payload, null, 2) : '{}';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[min(90vh,640px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || t('control_process_see_more')}</DialogTitle>
        </DialogHeader>

        {!unlocked ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('control_process_debug_password_hint')}</p>
            <input
              type="password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
              autoComplete="off"
            />
            <Button type="button" className="w-full" onClick={tryUnlock}>
              {t('confirm')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {eventLog.length > 0 && formatEvent && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  {t('control_process_action_history')} ({eventLog.length})
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-md border border-border bg-muted/20 p-2">
                  {[...eventLog].reverse().map((ev, i) => (
                    <div key={i} className="text-xs border-b border-border/50 pb-1.5 last:border-0">
                      {formatDateTime && ev.at && (
                        <span className="text-muted-foreground tabular-nums">{formatDateTime(ev.at)} </span>
                      )}
                      <span className="text-foreground">{formatEvent(ev)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">JSON</p>
              <pre className="text-xs bg-muted border border-border rounded-md p-3 overflow-x-auto max-h-[320px] text-foreground font-mono">
                {json}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
