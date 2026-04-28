import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Package, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { AppProduct } from '@/app/lib/productsApi';
import { createProduct, deleteProduct, restoreProduct, updateProduct } from '@/app/lib/productsApi';
import { useSettings } from '../../contexts/SettingsContext';

interface ProductManagerProps {
  products: AppProduct[];
  onChanged: () => void;
  /** Mostrar/restaurar filas archivadas — solo uso superadmin desde el padre */
  isSuperAdmin?: boolean;
}

export function ProductManager({ products, onChanged, isSuperAdmin = false }: ProductManagerProps) {
  const { t } = useSettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppProduct | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDialogOpen(true);
  };

  const openEdit = (p: AppProduct) => {
    setEditing(p);
    setName(p.name);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      if (editing) {
        await updateProduct(editing.id, { name: n });
      } else {
        await createProduct({ name: n, sort_order: products.length });
      }
      setDialogOpen(false);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (p: AppProduct) => {
    if (!window.confirm(t('products_confirm_delete'))) return;
    try {
      await deleteProduct(p.id);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleRestore = async (p: AppProduct) => {
    if (!isSuperAdmin) return;
    try {
      await restoreProduct(p.id);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <>
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('products_section_title')}</h2>
                <p className="text-sm text-gray-500">{t('products_section_desc')}</p>
              </div>
            </div>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shrink-0"
              onClick={openCreate}
            >
              <Plus className="w-4 h-4" />
              {t('products_add')}
            </Button>
          </div>

          {products.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              {t('products_empty')}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {products.map((p) => {
                const archived = p.archived === true || Boolean(p.archived_at);
                return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    archived ? 'bg-slate-50/90 border-l-4 border-l-amber-400' : 'bg-white'
                  } hover:bg-gray-50/80`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-medium truncate ${archived ? 'text-slate-600' : 'text-gray-900'}`}>
                      {p.name}
                    </span>
                    {archived && (
                      <span className="text-[10px] uppercase font-semibold shrink-0 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                        {t('archived_badge')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!archived && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(p)}
                          aria-label={t('products_edit')}
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-red-600"
                          onClick={() => handleArchive(p)}
                          aria-label={t('products_confirm_delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {archived && isSuperAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-emerald-800 border-emerald-200"
                        onClick={() => handleRestore(p)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t('restore_from_archive')}
                      </Button>
                    )}
                  </div>
                </li>
              )})}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle>{editing ? t('products_edit') : t('products_add')}</DialogTitle>
          </DialogHeader>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('products_name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg shadow-sm px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('protocol_placeholder')}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={saving || !name.trim()}
              onClick={handleSubmit}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
