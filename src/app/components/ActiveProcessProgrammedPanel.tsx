import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import { programmedFieldsFromSession } from '@/app/lib/controlProcessDisplay';
import { useSettings } from '@/app/contexts/SettingsContext';

type Props = {
  session: DeviceControlSessionRow;
};

/** Valores programados en solo lectura mientras el proceso de panel está activo. */
export const ActiveProcessProgrammedPanel: React.FC<Props> = ({ session }) => {
  const { t, formatTemp } = useSettings();
  const fields = programmedFieldsFromSession(session, t, formatTemp);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/40 p-4 flex gap-3">
        <Lock className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900 dark:text-blue-100">{t('control_process_running_locked')}</p>
          <p className="text-sm text-blue-800/90 dark:text-blue-200/90 mt-1">
            {t('control_process_running_locked_hint')}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          {t('control_process_programmed_values')}
        </h4>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {fields.map((f) => (
              <li key={f.label} className="flex justify-between gap-3 text-sm border-b border-border/60 pb-2 last:border-0">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-mono font-semibold text-foreground">{f.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
