import React, { useEffect, useState } from 'react';
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
import {
  ackEthyleneInstallNotice,
  listPendingInstallNotices,
  type EthyleneInstallation,
} from '@/app/lib/ethyleneInstallationsApi';
import { CheckCircle2 } from 'lucide-react';

type Props = { deviceId: string; onOpenInstallation?: () => void };

export const EthyleneInstallNoticeDialog: React.FC<Props> = ({ deviceId, onOpenInstallation }) => {
  const { t, formatDateTime } = useSettings();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<EthyleneInstallation | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listPendingInstallNotices(deviceId);
        if (cancelled) return;
        if (rows[0]) {
          setItem(rows[0]);
          setOpen(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const onAck = async () => {
    if (!item) {
      setOpen(false);
      return;
    }
    try {
      await ackEthyleneInstallNotice(item.id);
    } catch {
      /* ignore */
    }
    setOpen(false);
    onOpenInstallation?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            {t('install_completed_notice_title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">{t('install_completed_notice_desc')}</span>
            {item?.test_target_ppm != null ? (
              <span className="block text-foreground">
                {t('install_test_target')}: {item.test_target_ppm} ppm
                {item.test_final_ppm != null ? ` → ${item.test_final_ppm} ppm` : ''}
              </span>
            ) : null}
            {item?.test_completed_at ? (
              <span className="block text-xs text-muted-foreground">
                {formatDateTime(item.test_completed_at)}
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => void onAck()}>{t('install_view_report')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
