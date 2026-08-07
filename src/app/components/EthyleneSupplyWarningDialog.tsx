import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useDeviceControlSession } from '@/app/hooks/useDeviceControlSession';
import { useRipeningActiveForDevice } from '@/app/hooks/useRipeningActiveForDevice';
import {
  ackEthyleneSupplyWarn,
  evaluateEthyleneSupplyWarning,
  wasEthyleneSupplyWarnAcked,
  type EthyleneSupplyWarningResult,
} from '@/app/lib/ethyleneSupplyWarning';
import { AlertTriangle } from 'lucide-react';

type Props = { deviceId: string };

function pickRipeningWarning(
  trackingPayload: Record<string, unknown> | null | undefined,
  session: { status?: string; process_type?: string; params?: Record<string, unknown> } | null
): EthyleneSupplyWarningResult | null {
  const candidates: Record<string, unknown>[] = [];
  if (trackingPayload && typeof trackingPayload === 'object') {
    candidates.push(trackingPayload);
  }
  if (
    session?.status === 'active' &&
    String(session.process_type || '') === 'Ripening' &&
    session.params
  ) {
    candidates.push(session.params);
  }
  if (candidates.length === 0) return null;

  let best: EthyleneSupplyWarningResult | null = null;
  for (const params of candidates) {
    const result = evaluateEthyleneSupplyWarning(params);
    if (!best || result.sumDoseLogical > best.sumDoseLogical) best = result;
  }
  return best;
}

export const EthyleneSupplyWarningDialog: React.FC<Props> = ({ deviceId }) => {
  const { t } = useSettings();
  const { session } = useDeviceControlSession(deviceId);
  const { activeTracking } = useRipeningActiveForDevice(deviceId);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<EthyleneSupplyWarningResult | null>(null);

  const result = useMemo(
    () =>
      pickRipeningWarning(
        (activeTracking?.process?.payload ?? null) as Record<string, unknown> | null,
        session
      ),
    [activeTracking?.process?.payload, session]
  );

  useEffect(() => {
    if (!result) {
      setOpen(false);
      setSnapshot(null);
      return;
    }
    setSnapshot(result);
    if (
      result.warn &&
      result.firstInjectionAt &&
      !wasEthyleneSupplyWarnAcked(deviceId, result.firstInjectionAt)
    ) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [deviceId, result]);

  const onAck = () => {
    if (snapshot?.firstInjectionAt) {
      ackEthyleneSupplyWarn(deviceId, snapshot.firstInjectionAt);
    }
    setOpen(false);
  };

  const hours =
    snapshot?.durationMs != null
      ? String(Math.max(2, Math.round(snapshot.durationMs / 3600000)))
      : '2';
  const doseSum = snapshot?.sumDoseLogical != null ? String(snapshot.sumDoseLogical) : '—';
  const firstPpm =
    snapshot?.firstEffective != null ? String(snapshot.firstEffective) : '—';
  const lastPpm = snapshot?.lastEffective != null ? String(snapshot.lastEffective) : '—';

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onAck()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {t('ethylene_supply_warn_title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-relaxed text-foreground/90 space-y-3">
            <p>{t('ethylene_supply_warn_desc')}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {t('ethylene_supply_warn_stats', {
                hours,
                doseSum,
                firstPpm,
                lastPpm,
              })}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAck}>{t('ethylene_supply_warn_ack')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
