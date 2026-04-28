import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  Calendar,
  ChevronRight,
  Package,
  Loader2,
  Database,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { clsx } from 'clsx';
import { AuthedImage } from './AuthedImage';
import { ProcessDetail } from './ProcessDetail';
import { CreateProcessForm } from './CreateProcessForm';
import { ProcessDataAdmin } from './ProcessDataAdmin';
import { useSettings } from '@/app/contexts/SettingsContext';
import { getStoredUser } from '@/app/lib/auth';
import { canCreateRipeningProcess } from '@/app/lib/permissions';
import { fetchRipeningProcesses, type RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';

interface ProcessListProps {
  onSelectProcess?: (id: string) => void;
}

export const ProcessList: React.FC<ProcessListProps> = ({ onSelectProcess }) => {
  const [view, setView] = useState<'list' | 'create' | 'admin'>('list');
  const [selectedProcess, setSelectedProcess] = useState<ReturnType<typeof mapRowToProcessView> | null>(null);
  const [rawRows, setRawRows] = useState<RipeningProcessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const { t } = useSettings();

  const role = getStoredUser()?.role;
  const canCreate = canCreateRipeningProcess();
  const showProcessDataTab = role === 'operator' || role === 'admin' || role === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchRipeningProcesses();
      setRawRows(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('load_processes_error'));
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const r = getStoredUser()?.role;
    if (r === 'viewer' && (view === 'admin' || view === 'create')) {
      setView('list');
    }
    if (!canCreateRipeningProcess() && view === 'create') {
      setView('list');
    }
  }, [view]);

  const listViews = useMemo(() => rawRows.map((r) => mapRowToProcessView(r)), [rawRows]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return listViews;
    return listViews.filter(
      (p) =>
        p.client.name.toLowerCase().includes(q) ||
        String(p.batch.product).toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.display_name || '').toLowerCase().includes(q)
    );
  }, [listViews, searchQ]);

  if (selectedProcess) {
    return (
      <ProcessDetail
        processData={selectedProcess}
        onBack={() => {
          setSelectedProcess(null);
          void load();
        }}
        onProcessUpdated={(u) => {
          setSelectedProcess(u);
          void load();
        }}
      />
    );
  }

  if (view === 'create') {
    return (
      <CreateProcessForm
        onCancel={() => {
          setView('list');
          void load();
        }}
        onSave={() => {
          setView('list');
          void load();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('process_tracking')}</h1>
          <p className="text-gray-500 text-sm">{t('process_tracking_desc')}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-stretch md:justify-end">
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50/80 text-sm">
            <button
              type="button"
              onClick={() => setView('list')}
              className={clsx(
                'px-3 py-1.5 rounded-md transition',
                view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {t('seguimiento')}
            </button>
            {showProcessDataTab && (
              <button
                type="button"
                onClick={() => setView('admin')}
                className={clsx(
                  'px-3 py-1.5 rounded-md transition flex items-center gap-1.5',
                  view === 'admin' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Database className="w-3.5 h-3.5" />
                {t('process_data_mgmt')}
              </button>
            )}
          </div>
          {canCreate && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => setView('create')}>
              <Plus className="w-4 h-4" />
              {t('new_process')}
            </Button>
          )}
        </div>
      </div>

      {view === 'admin' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('process_data_mgmt_desc')}</p>
          <ProcessDataAdmin
            rows={rawRows}
            loading={loading}
            onRefresh={load}
            onView={(v) => {
              setSelectedProcess(v);
              onSelectProcess?.(v.id);
            }}
          />
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t('search_process_placeholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" className="gap-2 text-gray-600" type="button" disabled>
              <Filter className="w-4 h-4" /> {t('filters')}
            </Button>
          </div>

          {loadError && (
            <p className="text-sm text-red-600" role="alert">
              {loadError}
            </p>
          )}

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('loading')}
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((proc) => (
                <Card
                  key={proc.id}
                  className="hover:shadow-md transition-shadow cursor-pointer group border-gray-200 overflow-hidden"
                  onClick={() => {
                    setSelectedProcess(proc);
                    onSelectProcess?.(proc.id);
                  }}
                >
                  <div className="h-32 w-full relative overflow-hidden">
                    {proc.firstEvidenceApiPath ? (
                      <AuthedImage
                        apiPath={proc.firstEvidenceApiPath}
                        alt={proc.batch.product}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-blue-100" aria-hidden />
                    )}
                    <div className="absolute top-2 right-2">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md',
                          proc.status === 'active'
                            ? 'bg-green-500/90 text-white'
                            : proc.status === 'cancelled'
                              ? 'bg-slate-600/90 text-white'
                              : 'bg-orange-500/90 text-white'
                        )}
                      >
                        {proc.status === 'active'
                          ? t('in_process')
                          : proc.status === 'cancelled'
                            ? t('status_ripening_cancelled')
                            : t('attention')}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    <div className="mb-4">
                      <h3 className="font-bold text-gray-900 text-lg truncate">{proc.client.name}</h3>
                      <p className="text-sm text-gray-500">
                        {proc.batch.product} • {proc.id.slice(0, 8)}…
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Package className="w-4 h-4" /> {t('current_phase')}
                        </span>
                        <span className="font-medium text-blue-600">{proc.phase}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> {t('start')}
                        </span>
                        <span className="font-medium text-gray-900">{proc.start_date}</span>
                      </div>

                      <div className="pt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">{t('estimated_progress')}</span>
                          <span className="font-bold text-gray-900">{proc.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${proc.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                      <span className="text-sm font-medium text-blue-600 group-hover:underline flex items-center gap-1">
                        {t('view_details')} <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {canCreate && (
                <div
                  onClick={() => setView('create')}
                  className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-8 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all cursor-pointer min-h-[300px]"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover:bg-blue-100">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-lg">{t('start_new_process')}</h3>
                  <p className="text-sm text-center mt-1 max-w-[200px]">{t('start_new_process_desc')}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
