import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { createProduct, type AppProduct } from '@/app/lib/productsApi';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/Button';
import { useSettings } from '../../contexts/SettingsContext';
import { clsx } from 'clsx';

export type ProductRow = { id: string; name: string };

type ProductComboboxProps = {
  value: string;
  onChange: (name: string) => void;
  items: ProductRow[];
  disabled?: boolean;
  canCreateProduct: boolean;
  onProductCreated: (product: AppProduct) => void;
  /** `sort_order` al crear (p. ej. `products.length` del catálogo) */
  createSortOrder: number;
};

export const ProductCombobox: React.FC<ProductComboboxProps> = ({
  value,
  onChange,
  items,
  disabled = false,
  canCreateProduct,
  onProductCreated,
  createSortOrder,
}) => {
  const { t } = useSettings();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  const exactInCatalog = useMemo(
    () => items.some((i) => i.name.toLowerCase() === query.trim().toLowerCase()),
    [items, query]
  );

  const canShowCreate =
    canCreateProduct && query.trim().length > 0 && !exactInCatalog;

  const createIndex = canShowCreate ? filtered.length : -1;
  const totalListOptions = filtered.length + (canShowCreate ? 1 : 0);

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
        setOpen(false);
        syncQueryFromValue();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, syncQueryFromValue]);

  useEffect(() => {
    if (open) setHighlight(0);
  }, [open, query, filtered.length, canShowCreate, items.length]);

  const pick = (name: string) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const openCreate = () => {
    setCreateName(query.trim() || value);
    setErr('');
    setCreateOpen(true);
  };

  const handleCreateSave = async () => {
    const n = createName.trim();
    if (!n) return;
    setSaving(true);
    setErr('');
    try {
      const created = await createProduct({ name: n, sort_order: createSortOrder });
      onProductCreated(created);
      pick(created.name);
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
        className="w-full border-gray-300 rounded-lg shadow-sm bg-gray-50 text-gray-800 px-3 py-2"
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
                  pick(filtered[highlight].name);
                } else if (canShowCreate) {
                  openCreate();
                }
              }
            }}
            placeholder={t('product_search_placeholder')}
            className="w-full border border-gray-300 rounded-lg shadow-sm pl-3 pr-10 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            autoComplete="off"
          />
          <button
            type="button"
            className="absolute right-0 top-0 h-full px-2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (inputRef.current) {
                setQuery(value);
                setOpen((o) => !o);
                inputRef.current.focus();
              }
            }}
            aria-label={t('open_product_list')}
          >
            <ChevronDown
              className={clsx('w-4 h-4 transition-transform', open && 'rotate-180')}
            />
          </button>
        </div>
        {open && (
          <div
            id={listId}
            role="listbox"
            className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {filtered.length === 0 && !canShowCreate && (
              <p className="px-3 py-2 text-xs text-gray-500">{t('no_product_matches')}</p>
            )}
            {filtered.map((row, i) => (
              <button
                key={row.id}
                type="button"
                role="option"
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50',
                  highlight === i && 'bg-blue-50'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row.name)}
                onMouseEnter={() => setHighlight(i)}
              >
                {row.name}
              </button>
            ))}
            {canShowCreate && createIndex >= 0 && (
              <button
                type="button"
                role="option"
                className={clsx(
                  'flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm text-amber-800 hover:bg-amber-50',
                  highlight === createIndex && 'bg-amber-50'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={openCreate}
                onMouseEnter={() => setHighlight(createIndex)}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {t('product_combobox_create')}: <span className="font-medium">«{query.trim()}»</span>
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white border-gray-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('products_add')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">{t('product_create_in_recipe_hint')}</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="new-prod-name">
              {t('products_name')}
            </label>
            <input
              id="new-prod-name"
              type="text"
              value={createName}
              onChange={(e) => {
                setCreateName(e.target.value);
                setErr('');
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={saving || !createName.trim()}
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
