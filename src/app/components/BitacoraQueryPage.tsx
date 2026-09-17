import React, { useCallback, useMemo, useState } from 'react';
import { ClipboardList, Download, Loader2, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  BITACORA_MAX_RANGE_DAYS,
  bitacoraRowsToCsv,
  queryBitacoraRange,
  type ControlBitacoraRow,
} from '@/app/lib/controlBitacoraApi';
import { processActionLogEntriesFromBitacora } from '@/app/lib/controlProcessDisplay';

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 48 * 60 * 60 * 1000);
  return { from: toLocalInputValue(from), to: toLocalInputValue(to) };
}

function localInputToIso(local: string): string {
  const t = new Date(local).getTime();
  if (!Number.isFinite(t)) throw new Error('invalid_date');
  return new Date(t).toISOString();
}

export const BitacoraQueryPage: React.FC = () => {
  const { t, formatDateTime, formatTemp } = useSettings();
  const defaults = useMemo(() => defaultRange(), []);
  const [deviceId, setDeviceId] = useState('');
  const [fromLocal, setFromLocal] = useState(defaults.from);
  const [toLocal, setToLocal] = useState(defaults.to);
  const [processType, setProcessType] = useState('');
  const [action, setAction] = useState('');
  const [rows, setRows] = useState<ControlBitacoraRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const displayOpts = useMemo(
    () => ({ clientSafe: true, clientFacingLog: true, deviceId: deviceId.trim() }),
    [deviceId]
  );

  const displayRows = useMemo(
    () => processActionLogEntriesFromBitacora(deviceId.trim() || '_', rows, t, formatTemp, displayOpts),
    [deviceId, rows, t, formatTemp, displayOpts]
  );

  const runQuery = useCallback(
    async (cursor?: string | null) => {
      const id = deviceId.trim();
      if (!id) {
        setError(t('bitacora_query_device_required'));
        return;
      }
      let fromIso: string;
      let toIso: string;
      try {
        fromIso = localInputToIso(fromLocal);
        toIso = localInputToIso(toLocal);
      } catch {
        setError(t('bitacora_query_invalid_range'));
        return;
      }
      const spanMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
      if (!(spanMs > 0)) {
        setError(t('bitacora_query_invalid_range'));
        return;
      }
      const maxMs = BITACORA_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
      if (spanMs > maxMs) {
        setError(t('bitacora_query_range_too_long', { days: String(BITACORA_MAX_RANGE_DAYS) }));
        return;
      }

      const isMore = Boolean(cursor);
      if (isMore) setLoadingMore(true);
      else {
        setLoading(true);
        setSearched(true);
      }
      setError('');
      try {
        const res = await queryBitacoraRange({
          deviceId: id,
          from: fromIso,
          to: toIso,
          cursor: cursor || undefined,
          limit: 100,
          action: action.trim() || undefined,
          processType: processType.trim() || undefined,
          includePayload: true,
        });
        setRows((prev) => (isMore ? [...prev, ...res.data] : res.data));
        setNextCursor(res.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('bitacora_query_load_error'));
        if (!isMore) {
          setRows([]);
          setNextCursor(null);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [deviceId, fromLocal, toLocal, action, processType, t]
  );

  const exportCsv = () => {
    if (!rows.length) return;
    const csv = bitacoraRowsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora_${deviceId.trim()}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b bg-slate-50/90">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-900">
              <ClipboardList className="w-6 h-6" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900">{t('bitacora_query_title')}</CardTitle>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">{t('bitacora_query_subtitle')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className="text-slate-600 font-medium">{t('bitacora_query_device')}</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="IMEI / deviceId"
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 font-medium">{t('bitacora_query_from')}</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={fromLocal}
                onChange={(e) => setFromLocal(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 font-medium">{t('bitacora_query_to')}</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={toLocal}
                onChange={(e) => setToLocal(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 font-medium">{t('bitacora_query_process')}</span>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                value={processType}
                onChange={(e) => setProcessType(e.target.value)}
              >
                <option value="">{t('bitacora_query_any')}</option>
                <option value="Cooling">Cooling</option>
                <option value="Ripening">Ripening</option>
                <option value="Homogenization">Homogenization</option>
                <option value="Ventilation">Ventilation</option>
                <option value="Manual">Manual</option>
                <option value="StopPlan">StopPlan</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600 font-medium">{t('bitacora_query_action')}</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder={t('bitacora_query_action_placeholder')}
                autoComplete="off"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runQuery()} className="gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {t('bitacora_query_search')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void runQuery()}
              className="gap-2"
              disabled={loading || !searched}
            >
              <RefreshCw className="w-4 h-4" />
              {t('bitacora_query_refresh')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportCsv}
              className="gap-2"
              disabled={!rows.length}
            >
              <Download className="w-4 h-4" />
              {t('bitacora_query_export_csv')}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('loading')}
            </div>
          ) : !searched ? (
            <p className="text-sm text-slate-500 py-8 text-center">{t('bitacora_query_hint')}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">{t('bitacora_query_empty')}</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {t('bitacora_query_results', { count: String(rows.length) })}
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[11px] tracking-wide">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t('log_date_time')}</th>
                      <th className="px-3 py-2 font-semibold">{t('log_type')}</th>
                      <th className="px-3 py-2 font-semibold">{t('log_description')}</th>
                      <th className="px-3 py-2 font-semibold">{t('bitacora_query_col_process')}</th>
                      <th className="px-3 py-2 font-semibold">{t('bitacora_query_col_source')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {displayRows.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                          {formatDateTime(e.timestamp)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{e.kind}</td>
                        <td className="px-3 py-2 text-slate-900">
                          <div>{e.description}</div>
                          {e.detail ? (
                            <div className="text-xs text-slate-500 mt-0.5">{e.detail}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{e.phase ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">
                          {rows.find((r) => `bit-${r.id}` === e.id)?.source ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nextCursor ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() => void runQuery(nextCursor)}
                    className="gap-2"
                  >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t('bitacora_query_load_more')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
