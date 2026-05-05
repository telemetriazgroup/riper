import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import { getStoredUser } from '@/app/lib/auth';
import { canManageCompanies } from '@/app/lib/permissions';
import {
  fetchCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  restoreCompany,
  type AppCompany,
  type CompanyCreatePayload,
} from '@/app/lib/companiesApi';
import { clsx } from 'clsx';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

export function CompaniesPage() {
  const { t } = useSettings();
  const canEdit = canManageCompanies();
  const isSuperAdmin = getStoredUser()?.role === 'superadmin';
  const [rows, setRows] = useState<AppCompany[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppCompany | null>(null);
  const [form, setForm] = useState<CompanyCreatePayload>({
    name: '',
    ruc_id: '',
    address: '',
    email: '',
    contact_name: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchCompanies(isSuperAdmin && includeArchived ? { includeArchived: true } : undefined);
      setRows(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('companies_load_error'));
    } finally {
      setLoading(false);
    }
  }, [includeArchived, isSuperAdmin, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      ruc_id: '',
      address: '',
      email: '',
      contact_name: '',
      phone: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (c: AppCompany) => {
    if (c.archived) return;
    setEditing(c);
    setForm({
      name: c.name,
      ruc_id: c.ruc_id || '',
      address: c.address || '',
      email: c.email || '',
      contact_name: c.contact_name || '',
      phone: c.phone || '',
    });
    setDialogOpen(true);
  };

  const normalizePayload = (p: CompanyCreatePayload): CompanyCreatePayload => ({
    name: p.name.trim(),
    ruc_id: p.ruc_id?.trim() || undefined,
    address: p.address?.trim() || undefined,
    email: p.email?.trim() || undefined,
    contact_name: p.contact_name?.trim() || undefined,
    phone: p.phone?.trim() || undefined,
  });

  const handleSave = async () => {
    const n = form.name.trim();
    if (!n) return;
    setSaving(true);
    try {
      const payload = normalizePayload(form);
      if (editing) {
        await updateCompany(editing.id, payload);
      } else {
        await createCompany(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (c: AppCompany) => {
    if (!canEdit || c.archived) return;
    if (!window.confirm(t('companies_confirm_archive'))) return;
    try {
      await deleteCompany(c.id);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleRestore = async (c: AppCompany) => {
    if (!isSuperAdmin || !c.archived) return;
    try {
      await restoreCompany(c.id);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error');
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = !q
    ? rows
    : rows.filter((c) => {
        const blob = [c.name, c.ruc_id, c.email, c.contact_name, c.phone, c.address]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('companies_title')}</h1>
            <p className="text-sm text-gray-600 mt-1">{t('companies_subtitle')}</p>
            {!canEdit && <p className="text-xs text-amber-800 mt-2">{t('companies_readonly')}</p>}
          </div>
        </div>
        {canEdit && (
          <Button type="button" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            {t('companies_add')}
          </Button>
        )}
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('company_search_placeholder')}
              className="flex-1 max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <Switch id="co-arch" checked={includeArchived} onCheckedChange={setIncludeArchived} />
                <Label htmlFor="co-arch" className="text-sm text-gray-700 cursor-pointer">
                  {t('catalog_show_archived')}
                </Label>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('loading')}
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 border border-dashed rounded-lg py-8 text-center">{t('companies_empty')}</p>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-3 font-semibold text-gray-700">{t('company_field_name')}</th>
                    <th className="p-3 font-semibold text-gray-700">{t('company_field_ruc')}</th>
                    <th className="p-3 font-semibold text-gray-700">{t('company_field_address')}</th>
                    <th className="p-3 font-semibold text-gray-700">{t('company_field_email')}</th>
                    <th className="p-3 font-semibold text-gray-700">{t('company_field_contact')}</th>
                    <th className="p-3 font-semibold text-gray-700">{t('company_field_phone')}</th>
                    <th className="p-3 font-semibold text-gray-700 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const archived = Boolean(c.archived || c.archived_at);
                    return (
                      <tr key={c.id} className={clsx('border-b border-gray-50', archived && 'bg-slate-50')}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{c.name}</span>
                            {archived && (
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                {t('archived_badge')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-gray-700">{c.ruc_id || '—'}</td>
                        <td className="p-3 text-gray-600 max-w-[160px] truncate" title={c.address}>
                          {c.address || '—'}
                        </td>
                        <td className="p-3 text-gray-700">{c.email || '—'}</td>
                        <td className="p-3 text-gray-700">{c.contact_name || '—'}</td>
                        <td className="p-3 text-gray-700">{c.phone || '—'}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1 justify-end">
                            {archived && isSuperAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => void handleRestore(c)}
                                aria-label={t('restore_from_archive')}
                              >
                                <RotateCcw className="w-4 h-4 text-blue-600" />
                              </Button>
                            )}
                            {!archived && canEdit && (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openEdit(c)}
                                  aria-label={t('companies_edit')}
                                >
                                  <Pencil className="w-4 h-4 text-gray-500" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:text-red-600"
                                  onClick={() => void handleArchive(c)}
                                  aria-label={t('companies_archive')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('companies_edit') : t('companies_add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                {t('company_field_name')} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">{t('company_field_ruc')}</label>
              <input
                type="text"
                value={form.ruc_id ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, ruc_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">{t('company_field_address')}</label>
              <input
                type="text"
                value={form.address ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">{t('company_field_email')}</label>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">{t('company_field_contact')}</label>
              <input
                type="text"
                value={form.contact_name ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700">{t('company_field_phone')}</label>
              <input
                type="text"
                value={form.phone ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={saving || !form.name.trim()}
              onClick={() => void handleSave()}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
