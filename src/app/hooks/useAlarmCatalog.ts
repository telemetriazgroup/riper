import { useCallback, useEffect, useState } from 'react';
import type { AlarmCodeRecord } from '@/app/lib/alarmCodesApi';
import { loadAlarmCatalog, setAlarmCatalog } from '@/app/lib/thermoKingAlarms';

export function useAlarmCatalog(opts?: { includeArchived?: boolean }) {
  const [alarms, setAlarms] = useState<AlarmCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await loadAlarmCatalog(opts);
      setAlarmCatalog(list);
      setAlarms(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [opts?.includeArchived]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { alarms, loading, error, reload };
}
