import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, Download } from 'lucide-react';
import { Button } from './ui/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { useSettings } from '@/app/contexts/SettingsContext';
import { getStoredUser } from '@/app/lib/auth';
import { canEditRecipesAndCatalog } from '@/app/lib/permissions';
import {
  archiveAlarmCode,
  createAlarmCode,
  restoreAlarmCode,
  updateAlarmCode,
  type AlarmCodePayload,
  type AlarmCodeRecord,
} from '@/app/lib/alarmCodesApi';
import {
  formatThermoKingAlarmCode,
  getAlarmCorrectiveAction,
  getAlarmDescription,
  searchAlarmCodes,
  setAlarmCatalog,
} from '@/app/lib/thermoKingAlarms';
import { clsx } from 'clsx';
import { downloadJsonFile } from '@/app/lib/downloadJsonFile';

const emptyForm = (): AlarmCodePayload => ({
  code: 0,
  titleEs: '',
  titleEn: '',
  descriptionEs: '',
  descriptionEn: '',
  correctiveActionEs: '',
  correctiveActionEn: '',
  model: 'MP4000',
});

export const ThermoKingAlarmsPage: React.FC = () => {
  const { language, t } = useSettings();
  const canEdit = canEditRecipesAndCatalog();
  const isSuperAdmin = getStoredUser()?.role === 'superadmin';

  const [rows, setRows] = useState<AlarmCodeRecord[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AlarmCodeRecord | null>(null);
  const [form, setForm] = useState<AlarmCodePayload>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { fetchAlarmCodes } = await import('@/app/lib/alarmCodesApi');
      const data = await fetchAlarmCodes(isSuperAdmin && includeArchived ? { includeArchived: true } : undefined);
      setRows(data);
      setAlarmCatalog(data.filter((a) => !a.archived));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('tk_alarms_load_error'));
    } finally {
      setLoading(false);
    }
  }, [includeArchived, isSuperAdmin, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => searchAlarmCodes(rows.filter((r) => !r.archived || includeArchived), query, language),
    [rows, query, language, includeArchived]
  );

  const selected = useMemo(
    () => (selectedId ? visible.find((a) => a.id === selectedId) ?? rows.find((a) => a.id === selectedId) ?? null : null),
    [visible, rows, selectedId]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: AlarmCodeRecord) => {
    if (row.archived) return;
    setEditing(row);
    setForm({
      code: row.code,
      titleEs: row.titleEs,
      titleEn: row.titleEn,
      descriptionEs: row.descriptionEs,
      descriptionEn: row.descriptionEn,
      correctiveActionEs: row.correctiveActionEs,
      correctiveActionEn: row.correctiveActionEn,
      model: row.model,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateAlarmCode(editing.id, form);
      } else {
        await createAlarmCode(form);
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('tk_alarms_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (row: AlarmCodeRecord) => {
    if (!canEdit || row.archived) return;
    if (!window.confirm(t('tk_alarms_archive_confirm', { code: formatThermoKingAlarmCode(row.code) }))) return;
    try {
      await archiveAlarmCode(row.id);
      if (selectedId === row.id) setSelectedId(null);
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('tk_alarms_save_error'));
    }
  };

  const restore = async (row: AlarmCodeRecord) => {
    try {
      await restoreAlarmCode(row.id);
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('tk_alarms_save_error'));
    }
  };

  const exportJson = () => {
    const activeRows = rows.filter((r) => !r.archived || includeArchived);
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        source: 'riper-alarm-catalog',
        model: 'MP4000',
        count: activeRows.length,
        includeArchived: Boolean(isSuperAdmin && includeArchived),
      },
      alarms: activeRows.map((r) => ({
        code: r.code,
        titleEs: r.titleEs,
        titleEn: r.titleEn,
        descriptionEs: r.descriptionEs,
        descriptionEn: r.descriptionEn,
        correctiveActionEs: r.correctiveActionEs,
        correctiveActionEn: r.correctiveActionEn,
        model: r.model,
        archived: Boolean(r.archived),
      })),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJsonFile(payload, `alarmas_tk_mp4000_${stamp}.json`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {t('tk_alarms_page_title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{t('tk_alarms_page_subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('tk_alarms_search_placeholder')}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background text-foreground"
            />
          </div>
          {canEdit ? (
            <Button onClick={openCreate} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              {t('tk_alarms_add')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="gap-2 shrink-0"
            disabled={loading || rows.length === 0}
            onClick={exportJson}
          >
            <Download className="h-4 w-4" />
            {t('tk_alarms_export_json')}
          </Button>
        </div>
      </div>

      {isSuperAdmin ? (
        <div className="flex items-center gap-2">
          <Switch id="alarms-archived" checked={includeArchived} onCheckedChange={setIncludeArchived} />
          <Label htmlFor="alarms-archived">{t('tk_alarms_show_archived')}</Label>
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 min-h-[32rem]">
          <div className="xl:col-span-2 border border-border rounded-lg bg-card overflow-hidden flex flex-col max-h-[70vh]">
            <div className="px-3 py-2 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('tk_alarms_list')} ({visible.length})
            </div>
            <ul className="overflow-y-auto flex-1 divide-y divide-border">
              {visible.map((alarm) => {
                const title = language === 'es' ? alarm.titleEs : alarm.titleEn;
                const active = selectedId === alarm.id;
                return (
                  <li key={alarm.id} className={clsx(alarm.archived && 'opacity-60')}>
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => setSelectedId(alarm.id)}
                        className={clsx(
                          'flex-1 text-left px-3 py-2.5 hover:bg-muted/60 transition-colors',
                          active && 'bg-muted/80 border-l-2 border-l-red-500'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400 shrink-0">
                            #{formatThermoKingAlarmCode(alarm.code)}
                          </span>
                          <span className="text-sm text-foreground line-clamp-2">{title}</span>
                        </div>
                      </button>
                      {canEdit ? (
                        <div className="flex items-center gap-1 pr-2">
                          {!alarm.archived ? (
                            <>
                              <button type="button" onClick={() => openEdit(alarm)} className="p-1.5 rounded hover:bg-muted" title={t('edit')}>
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => void archive(alarm)} className="p-1.5 rounded hover:bg-muted text-red-600" title={t('action_archive')}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : isSuperAdmin ? (
                            <button type="button" onClick={() => void restore(alarm)} className="p-1.5 rounded hover:bg-muted" title={t('restore_from_archive')}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
              {visible.length === 0 ? (
                <li className="p-6 text-sm text-muted-foreground text-center">{t('tk_alarms_no_results')}</li>
              ) : null}
            </ul>
          </div>

          <div className="xl:col-span-3 border border-border rounded-lg bg-card p-4 overflow-y-auto max-h-[70vh]">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('tk_alarm_code')}</p>
                  <h3 className="text-xl font-bold font-mono text-foreground">#{formatThermoKingAlarmCode(selected.code)}</h3>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {language === 'es' ? selected.titleEs : selected.titleEn}
                  </p>
                  {selected.archived ? (
                    <span className="inline-block mt-2 text-xs font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      {t('archived_badge')}
                    </span>
                  ) : null}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {t('tk_alarm_description')}
                  </h4>
                  <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                    {getAlarmDescription(selected, language) || '—'}
                  </pre>
                </div>

                {getAlarmCorrectiveAction(selected, language) ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {t('tk_alarm_corrective_action')}
                    </h4>
                    <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                      {getAlarmCorrectiveAction(selected, language)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                {t('tk_alarms_select_hint')}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('tk_alarms_edit') : t('tk_alarms_add')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div>
              <Label htmlFor="alarm-code">{t('tk_alarm_code')}</Label>
              <input
                id="alarm-code"
                type="number"
                min={0}
                max={999}
                disabled={Boolean(editing)}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="alarm-model">{t('tk_alarms_model')}</Label>
              <input
                id="alarm-model"
                value={form.model ?? 'MP4000'}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="title-es">{t('tk_alarms_title_es')}</Label>
              <input
                id="title-es"
                value={form.titleEs}
                onChange={(e) => setForm((f) => ({ ...f, titleEs: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="title-en">{t('tk_alarms_title_en')}</Label>
              <input
                id="title-en"
                value={form.titleEn}
                onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="desc-es">{t('tk_alarm_description')} (ES)</Label>
              <textarea
                id="desc-es"
                rows={4}
                value={form.descriptionEs ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, descriptionEs: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-sans"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="desc-en">{t('tk_alarm_description')} (EN)</Label>
              <textarea
                id="desc-en"
                rows={4}
                value={form.descriptionEn ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-sans"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="corr-es">{t('tk_alarm_corrective_action')} (ES)</Label>
              <textarea
                id="corr-es"
                rows={4}
                value={form.correctiveActionEs ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, correctiveActionEs: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-sans"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="corr-en">{t('tk_alarm_corrective_action')} (EN)</Label>
              <textarea
                id="corr-en"
                rows={4}
                value={form.correctiveActionEn ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, correctiveActionEn: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-sans"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
