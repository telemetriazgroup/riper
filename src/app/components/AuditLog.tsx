import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Shield, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { fetchAuditLogs, type AuditLogRow } from '@/app/lib/auditApi';

function formatTs(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale === 'es' ? 'es' : 'en', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

export const AuditLog: React.FC = () => {
  const { t, language } = useSettings();
  const locale = language === 'es' ? 'es' : 'en';
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAuditLogs(80, null);
      setRows(res.data);
      setNextBeforeId(res.nextBeforeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('audit_load_error'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = async () => {
    if (!nextBeforeId || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const res = await fetchAuditLogs(80, nextBeforeId);
      setRows((prev) => [...prev, ...res.data]);
      setNextBeforeId(res.nextBeforeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('audit_load_error'));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b bg-slate-50/90">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-900">
              <Shield className="w-6 h-6" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900">{t('audit_title')}</CardTitle>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">{t('audit_subtitle')}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadInitial()} className="gap-2 shrink-0">
            <RefreshCw className="w-4 h-4" />
            {t('audit_refresh')}
          </Button>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {error && (
            <p className="text-sm text-red-600 mb-3" role="alert">
              {error}
            </p>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('loading')}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[11px] tracking-wide">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t('audit_col_time')}</th>
                      <th className="px-3 py-2 font-semibold">{t('audit_col_user')}</th>
                      <th className="px-3 py-2 font-semibold">{t('audit_col_action')}</th>
                      <th className="px-3 py-2 font-semibold">{t('audit_col_entity')}</th>
                      <th className="px-3 py-2 font-semibold">{t('audit_col_id')}</th>
                      <th className="px-3 py-2 font-semibold min-w-[200px]">{t('audit_col_detail')}</th>
                      <th className="px-3 py-2 font-semibold">{t('audit_col_ip')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                          {t('audit_empty')}
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 align-top">
                          <td className="px-3 py-2 text-slate-800 whitespace-nowrap">
                            {formatTs(r.created_at, locale)}
                          </td>
                          <td className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate" title={r.actor_email ?? ''}>
                            {r.actor_email ?? '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-blue-900">{r.action}</td>
                          <td className="px-3 py-2 text-slate-700">{r.entity_type}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 max-w-[120px] truncate" title={r.entity_id ?? ''}>
                            {r.entity_id ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-700 break-all max-w-md">
                            {r.meta != null ? (
                              <code className="block whitespace-pre-wrap break-words text-[11px] leading-snug bg-slate-50 rounded px-1.5 py-1 border border-slate-100">
                                {JSON.stringify(r.meta, null, 0)}
                              </code>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{r.ip_address ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {nextBeforeId && (
                <div className="flex justify-center pt-4">
                  <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('loading')}
                      </>
                    ) : (
                      t('audit_load_more')
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
