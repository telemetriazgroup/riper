import { useCallback, useEffect, useState } from 'react';
import {
  fetchTunnelCommandJobs,
  type TunnelCommandJob,
} from '@/app/lib/tunnelCommandsApi';

const POLL_MS = 10_000;

export function useTunnelCommandJobs(deviceId?: string, enabled = true) {
  const [jobs, setJobs] = useState<TunnelCommandJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!deviceId || !enabled) {
      setJobs([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTunnelCommandJobs({ deviceId, limit: 30 });
      setJobs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasActive = jobs.some((j) =>
    ['pending', 'sent', 'verifying', 'waiting'].includes(j.status)
  );

  useEffect(() => {
    if (!enabled || !deviceId) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [deviceId, enabled, refresh]);

  return { jobs, isLoading, error, refresh, hasActive };
}
