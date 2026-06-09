import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useAlarmCatalog } from '@/app/hooks/useAlarmCatalog';
import {
  getAlarmCodeByNumber,
  parseAlarmCount,
  parseMaduradorAlarmOccurrences,
} from '@/app/lib/thermoKingAlarms';
import { ThermoKingAlarmDetail } from '@/app/components/ThermoKingAlarmDetail';

interface DeviceAlarmsPanelProps {
  alarmas: unknown;
  numeroAlarma?: number | null;
}

export const DeviceAlarmsPanel: React.FC<DeviceAlarmsPanelProps> = ({ alarmas, numeroAlarma }) => {
  const { language, formatDateTime, t } = useSettings();
  useAlarmCatalog();

  const occurrences = useMemo(() => parseMaduradorAlarmOccurrences(alarmas), [alarmas]);
  const active = occurrences.filter((o) => o.isActive);
  const history = occurrences.filter((o) => !o.isActive);
  const activeCount = parseAlarmCount(numeroAlarma) ?? active.length;

  const labels = {
    description: t('tk_alarm_description'),
    correctiveAction: t('tk_alarm_corrective_action'),
    unknown: t('tk_alarm_unknown_code'),
    active: t('tk_alarm_active_badge'),
    period: t('tk_alarm_period'),
    seeMore: t('tk_alarm_see_more'),
    seeLess: t('tk_alarm_see_less'),
  };

  if (!alarmas && activeCount === 0 && history.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
        {t('operativo_alarms')}
      </h4>

      <p className="text-xs text-muted-foreground mb-3">
        {t('tk_alarm_active_count')}{' '}
        <span className="font-mono text-foreground">{activeCount}</span>
      </p>

      {active.length > 0 ? (
        <div className="space-y-2 mb-4">
          {active.map((occ, i) => (
            <ThermoKingAlarmDetail
              key={`active-${occ.code}-${occ.slot ?? ''}-${i}`}
              code={occ.code}
              record={getAlarmCodeByNumber(occ.code)}
              language={language}
              desde={occ.desde}
              hasta={occ.hasta}
              isActive
              formatDateTime={formatDateTime}
              labels={labels}
              collapsed
            />
          ))}
        </div>
      ) : activeCount > 0 ? (
        <p className="text-xs text-muted-foreground mb-3">{t('tk_alarm_no_active')}</p>
      ) : null}

      {history.length > 0 ? (
        <>
          <p className="text-xs font-medium text-foreground mb-2">{t('operativo_last_alarms')}</p>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {history.map((occ, i) => (
              <ThermoKingAlarmDetail
                key={`hist-${occ.slot ?? ''}-${occ.code}-${i}`}
                code={occ.code}
                record={getAlarmCodeByNumber(occ.code)}
                language={language}
                desde={occ.desde}
                hasta={occ.hasta}
                formatDateTime={formatDateTime}
                labels={labels}
                collapsed
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
