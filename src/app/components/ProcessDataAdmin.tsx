import React, { useState } from 'react';
import { Eye, Loader2, Archive } from 'lucide-react';
import { Button } from './ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { canHardDeleteRipeningRow } from '@/app/lib/permissions';
import { deleteRipeningProcess } from '@/app/lib/ripeningProcessesApi';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';
import { clsx } from 'clsx';

type Enriched = ReturnType<typeof mapRowToProcessView>;

type Props = {
  rows: RipeningProcessRow[];
  loading: boolean;
  onRefresh: () => void;
  onView: (v: Enriched) => void;
};

export const ProcessDataAdmin: React.FC<Props> = ({ rows, loading, onRefresh, onView }) => {
  const { t, language } = useSettings();
  const canDelete = canHardDeleteRipeningRow();
  const [deleting, setDeleting] = useState<string | null>(null);
  const archiveLabel = t('action_archive') || (language === 'en' ? 'Archive' : 'Archivar');
  const viewLabel = t('view_details') || (language === 'en' ? 'View' : 'Ver');

  const onDelete = async (id: string) => {
    if (!canDelete) return;
    if (!window.confirm(t('confirm_delete_process') || (language === 'en' ? 'Delete this process?' : '¿Eliminar este proceso?'))) {
      return;
    }
    setDeleting(id);
    try {
      await deleteRipeningProcess(id);
      onRefresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        {t('loading') || '…'}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="text-center py-16 text-gray-500 border border-dashed border-gray-200 rounded-xl">
        {t('no_saved_processes') || (language === 'en' ? 'No saved processes yet.' : 'Aún no hay procesos guardados.')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-sm">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className="p-3 font-semibold text-gray-700">ID</th>
            <th className="p-3 font-semibold text-gray-700">{t('process_name_col') || 'Nombre'}</th>
            <th className="p-3 font-semibold text-gray-700">{t('client') || 'Cliente'}</th>
            <th className="p-3 font-semibold text-gray-700">{t('product') || 'Producto'}</th>
            <th className="p-3 font-semibold text-gray-700">{t('status') || 'Estado'}</th>
            <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">{t('created') || 'Creado'}</th>
            <th className="p-3 font-semibold text-gray-700 text-right">{t('actions') || 'Acciones'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const v = mapRowToProcessView(row);
            return (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="p-3 font-mono text-xs text-gray-600" title={row.id}>
                  {row.id.slice(0, 8)}…
                </td>
                <td className="p-3 text-gray-900 max-w-[180px] truncate" title={row.display_name}>
                  {row.display_name}
                </td>
                <td className="p-3 text-gray-800 max-w-[200px] truncate">{v.client.name}</td>
                <td className="p-3 text-gray-700 max-w-[160px] truncate">{v.batch.product}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-1">
                    {row.deleted_at && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200">
                        {t('archived_badge')}
                      </span>
                    )}
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        row.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : row.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-900'
                            : row.status === 'cancelled'
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {row.status === 'active'
                        ? t('in_process')
                        : row.status === 'paused'
                          ? t('status_ripening_paused')
                        : row.status === 'completed'
                          ? t('status_ripening_completed')
                          : row.status === 'cancelled'
                            ? t('status_ripening_cancelled')
                            : row.status}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-gray-600 whitespace-nowrap text-xs">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => onView(v)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {viewLabel}
                    </Button>
                    {canDelete && !row.deleted_at && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => onDelete(row.id)}
                        disabled={deleting === row.id}
                      >
                        {deleting === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                        <span className="sr-only">{archiveLabel}</span>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
