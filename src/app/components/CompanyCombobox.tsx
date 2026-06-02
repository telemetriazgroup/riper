import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { createCompany, type AppCompany, type CompanyCreatePayload } from '@/app/lib/companiesApi';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { clsx } from 'clsx';

export type CompanyListRow = { id: string; name: string; ruc_id?: string; email?: string };

type CompanyComboboxProps = {
  value: string;
  companyId: string | null;
  items: CompanyListRow[];
  onChange: (name: string, companyId: string | null) => void;
  disabled?: boolean;
  canCreate: boolean;
  onCompanyCreated?: (c: AppCompany) => void;
};

export const CompanyCombobox: React.FC<CompanyComboboxProps> = ({
  value,
  companyId: _companyId,
  items,
  onChange,
  disabled = false,
  canCreate,
  onCompanyCreated,
}) => {
  const { t } = useSettings();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CompanyCreatePayload>({
    name: '',
    ruc_id: '',
    address: '',
    email: '',
    contact_name: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  queryRef.current = query;

  const rowMatches = (row: CompanyListRow, q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const parts = [row.name, row.ruc_id, row.email].filter(Boolean).map((x) => String(x).toLowerCase());
    return parts.some((p) => p.includes(s));
  };

  const filtered = useMemo(() => {
    return items.filter((i) => rowMatches(i, query));
  }, [items, query]);

  const exactInCatalog = useMemo(
    () => items.some((i) => i.name.toLowerCase() === query.trim().toLowerCase()),
    [items, query]
  );

  const canShowCreate =
    canCreate && query.trim().length > 0 && !exactInCatalog;

  const createIndex = canShowCreate ? filtered.length : -1;
  const totalListOptions = filtered.length + (canShowCreate ? 1 : 0);

  const flushFromQuery = useCallback(() => {
    const q = queryRef.current.trim();
    const exact = items.find((i) => i.name.toLowerCase() === q.toLowerCase());
    onChange(q, exact ? exact.id : null);
    setQuery(q);
  }, [items, onChange]);

  const syncQueryFromValue = useCallback(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) syncQueryFromValue();
  }, [value, open, syncQueryFromValue]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = boxRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        flushFromQuery();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, flushFromQuery]);

  useEffect(() => {
    if (open) setHighlight(0);
  }, [open, query, filtered.length, canShowCreate, items.length]);

  const pick = (row: CompanyListRow) => {
    onChange(row.name, row.id);
    setQuery(row.name);
    setOpen(false);
  };

  const openCreate = () => {
    setCreateForm({
      name: query.trim() || value,
      ruc_id: '',
      address: '',
      email: '',
      contact_name: '',
      phone: '',
    });
    setErr('');
    setCreateOpen(true);
  };

  const handleCreateSave = async () => {
    const n = createForm.name.trim();
    if (!n) return;
    setSaving(true);
    setErr('');
    try {
      const payload: CompanyCreatePayload = {
        name: n,
        ruc_id: createForm.ruc_id?.trim() || undefined,
        address: createForm.address?.trim() || undefined,
        email: createForm.email?.trim() || undefined,
        contact_name: createForm.contact_name?.trim() || undefined,
        phone: createForm.phone?.trim() || undefined,
      };
      const created = await createCompany(payload);
      onCompanyCreated?.(created);
      pick({ id: created.id, name: created.name, ruc_id: created.ruc_id, email: created.email });
      setCreateOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (disabled) {
    return (
      <input
        type="text"
        readOnly
        value={value}
        className="app-field"
      />
    );
  }

  return (
    <>
      <div ref={boxRef} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            value={open ? query : value}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              setOpen(true);
            }}
            onFocus={() => {
              setQuery(value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                setOpen(true);
                return;
              }
              if (!open) return;
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                syncQueryFromValue();
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (totalListOptions <= 0) return;
                setHighlight((h) => Math.min(totalListOptions - 1, h + 1));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => Math.max(0, h - 1));
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (totalListOptions <= 0) return;
                if (highlight < filtered.length) {
                  pick(filtered[highlight]);
                } else if (canShowCreate) {
                  openCreate();
                }
              }
            }}
            placeholder={t('company_search_placeholder')}
            className="app-field pl-3 pr-10"
            autoComplete="off"
          />
          <button
            type="button"
            className="absolute right-0 top-0 h-full px-2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (inputRef.current) {
                setQuery(value);
                setOpen((o) => !o);
                inputRef.current.focus();
              }
            }}
            aria-label={t('open_company_list')}
          >
            <ChevronDown className={clsx('w-4 h-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
        {open && (
          <div
            id={listId}
            role="listbox"
            className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
          >
            {filtered.length === 0 && !canShowCreate && (
              <p className="px-3 py-2 text-xs text-muted-foreground">{t('no_company_matches')}</p>
            )}
            {filtered.map((row, i) => (
              <button
                key={row.id}
                type="button"
                role="option"
                className={clsx(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60',
                  highlight === i && 'bg-blue-50'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="font-medium">{row.name}</span>
                {(row.ruc_id || row.email) && (
                  <span className="text-[11px] text-muted-foreground">
                    {[row.ruc_id, row.email].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))}
            {canShowCreate && createIndex >= 0 && (
              <button
                type="button"
                role="option"
                className={clsx(
                  'flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40',
                  highlight === createIndex && 'bg-amber-50'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={openCreate}
                onMouseEnter={() => setHighlight(createIndex)}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {t('company_combobox_create')}: <span className="font-medium">«{query.trim()}»</span>
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('company_quick_create_title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('company_quick_create_hint')}</p>
          <div className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block font-medium text-foreground" htmlFor="co-name">
                {t('company_field_name')} <span className="text-red-600">*</span>
              </label>
              <input
                id="co-name"
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                className="app-field"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-foreground" htmlFor="co-ruc">
                {t('company_field_ruc')}
              </label>
              <input
                id="co-ruc"
                type="text"
                value={createForm.ruc_id ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, ruc_id: e.target.value }))}
                className="app-field"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-foreground" htmlFor="co-addr">
                {t('company_field_address')}
              </label>
              <input
                id="co-addr"
                type="text"
                value={createForm.address ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, address: e.target.value }))}
                className="app-field"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-foreground" htmlFor="co-email">
                {t('company_field_email')}
              </label>
              <input
                id="co-email"
                type="email"
                value={createForm.email ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                className="app-field"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-foreground" htmlFor="co-contact">
                {t('company_field_contact')}
              </label>
              <input
                id="co-contact"
                type="text"
                value={createForm.contact_name ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, contact_name: e.target.value }))}
                className="app-field"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-foreground" htmlFor="co-phone">
                {t('company_field_phone')}
              </label>
              <input
                id="co-phone"
                type="text"
                value={createForm.phone ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                className="app-field"
              />
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={saving || !createForm.name.trim()}
              onClick={handleCreateSave}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
