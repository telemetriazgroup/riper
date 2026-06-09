import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AlarmCodeRecord } from '@/app/lib/alarmCodesApi';
import type { AppLanguage } from '@/app/lib/thermoKingAlarms';
import {
  formatThermoKingAlarmCode,
  getAlarmCorrectiveAction,
  getAlarmDescription,
  getAlarmTitle,
} from '@/app/lib/thermoKingAlarms';

interface ThermoKingAlarmDetailProps {
  code: number;
  record: AlarmCodeRecord | null;
  language: AppLanguage;
  desde?: string;
  hasta?: string;
  isActive?: boolean;
  formatDateTime?: (iso: string | undefined) => string;
  labels: {
    description: string;
    correctiveAction: string;
    unknown: string;
    active: string;
    period: string;
    seeMore: string;
    seeLess: string;
  };
  /** En dispositivos: solo título + ver más */
  collapsed?: boolean;
}

export const ThermoKingAlarmDetail: React.FC<ThermoKingAlarmDetailProps> = ({
  code,
  record,
  language,
  desde,
  hasta,
  isActive,
  formatDateTime,
  labels,
  collapsed = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const title = getAlarmTitle(record, code, language);
  const description = record ? getAlarmDescription(record, language) : '';
  const corrective = record ? getAlarmCorrectiveAction(record, language) : '';
  const fmt = formatDateTime ?? ((iso) => iso ?? '—');
  const showDetails = !collapsed || expanded;

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-foreground">#{formatThermoKingAlarmCode(code)}</span>
            {isActive ? (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                {labels.active}
              </span>
            ) : null}
          </div>
          <p className="font-semibold text-foreground mt-1">{title}</p>
          {!record ? <p className="text-xs text-muted-foreground mt-1">{labels.unknown}</p> : null}
        </div>
        {collapsed && (description || corrective) ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 shrink-0"
          >
            {expanded ? labels.seeLess : labels.seeMore}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>

      {(desde || hasta) && (
        <p className="text-xs text-muted-foreground">
          {labels.period}: {fmt(desde)} → {fmt(hasta)}
        </p>
      )}

      {showDetails && description ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{labels.description}</p>
          <pre className="text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed">{description}</pre>
        </div>
      ) : null}

      {showDetails && corrective ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {labels.correctiveAction}
          </p>
          <pre className="text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed">{corrective}</pre>
        </div>
      ) : null}
    </div>
  );
};
