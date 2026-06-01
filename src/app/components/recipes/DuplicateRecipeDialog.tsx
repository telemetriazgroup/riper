import React, { useMemo, useState } from 'react';
import type { AppProduct } from '@/app/lib/productsApi';
import { ProductCombobox, type ProductRow } from './ProductCombobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/Button';
import { Label } from '../ui/label';
import { useSettings } from '../../contexts/SettingsContext';
import { localizeRecipe, localizedProductName } from '@/app/lib/catalogI18n';
import type { PhaseConfig, PhaseType, Recipe } from './RecipeBuilder';
import { ChefHat, Copy, Thermometer, FlaskConical, Wind, Droplets } from 'lucide-react';
import { clsx } from 'clsx';

type ProductOption = { id: string; name: string };

function clonePhasesForDuplicate(phases: PhaseConfig[]): PhaseConfig[] {
  const t = Date.now();
  return phases.map((p, i) => ({
    ...p,
    id: `ph-${p.type}-${t}-${i}`,
  }));
}

const phaseIcons: Record<PhaseType, React.ComponentType<{ className?: string }>> = {
  homogenization: Thermometer,
  ripening: FlaskConical,
  venting: Wind,
  cooling: Droplets,
};

const phaseColors: Record<PhaseType, string> = {
  homogenization: 'bg-yellow-100 text-yellow-800',
  ripening: 'bg-orange-100 text-orange-800',
  venting: 'bg-blue-100 text-blue-800',
  cooling: 'bg-cyan-100 text-cyan-800',
};

type DuplicateRecipeDialogProps = {
  source: Recipe;
  products: ProductOption[];
  onClose: () => void;
  onConfirm: (draft: Recipe) => void;
  canCreateProduct: boolean;
  onProductCreated: (p: AppProduct) => void;
  createSortOrder: number;
};

export const DuplicateRecipeDialog: React.FC<DuplicateRecipeDialogProps> = ({
  source,
  products,
  onClose,
  onConfirm,
  canCreateProduct,
  onProductCreated,
  createSortOrder,
}) => {
  const { t, language } = useSettings();
  const sourceDisplay = useMemo(() => localizeRecipe(source, language), [source, language]);
  const [name, setName] = useState(
    () => `${sourceDisplay.name} ${t('recipe_dup_suffix')}`.trim()
  );
  const [fruit, setFruit] = useState(() => source.fruit);
  const [description, setDescription] = useState(() => source.description || '');
  const [nameError, setNameError] = useState('');

  const fruitOptions = useMemo(() => {
    const names = products.map((p) => p.name);
    const set = new Set(names);
    if (source.fruit && !set.has(source.fruit)) {
      return [...names, source.fruit];
    }
    if (fruit && !set.has(fruit)) {
      return [...names, fruit];
    }
    return names;
  }, [products, source.fruit, fruit]);

  const fruitOptionRows: ProductRow[] = useMemo(
    () =>
      fruitOptions.map((n) => ({
        name: n,
        id: products.find((p) => p.name === n)?.id ?? `__extra__-${n}`,
        label: localizedProductName(
          n,
          language,
          products.find((p) => p.name === n)?.name_en
        ),
      })),
    [fruitOptions, products, language]
  );

  const handleConfirm = () => {
    const n = name.trim();
    if (!n) {
      setNameError(t('recipe_name_required'));
      return;
    }
    setNameError('');
    onConfirm({
      id: 'new',
      name: n,
      fruit: fruit.trim() || fruitOptions[0] || source.fruit,
      description: description.trim(),
      phases: clonePhasesForDuplicate(source.phases),
      is_system: undefined,
      iconKey: source.iconKey ?? null,
      customImageUrl: source.customImageUrl?.trim() ? source.customImageUrl.trim() : null,
    });
  };

  const shortLabel: Record<PhaseType, string> = {
    homogenization: t('short_homog'),
    ripening: t('short_ripening'),
    venting: t('short_venting'),
    cooling: t('short_cooling'),
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] overflow-y-auto text-gray-900">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-left">{t('recipe_dup_modal_title')}</DialogTitle>
              <DialogDescription className="text-left text-gray-500">
                {t('recipe_dup_modal_hint')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          <span className="font-medium">{t('source_recipe')}: </span>
          {sourceDisplay.name}
          {source.is_system ? ` · ${t('recipe_standard_badge')}` : ''}
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="dup-name" className="text-gray-800">
              {t('protocol_name')}
            </Label>
            <input
              id="dup-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t('protocol_placeholder')}
              autoComplete="off"
            />
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
          </div>

          <div>
            <span className="text-sm font-medium text-gray-800 block mb-1">{t('product_label')}</span>
            {fruitOptions.length > 0 || canCreateProduct ? (
              <div className="mt-1">
                <ProductCombobox
                  value={fruit}
                  onChange={setFruit}
                  items={fruitOptionRows}
                  canCreateProduct={canCreateProduct}
                  onProductCreated={onProductCreated}
                  createSortOrder={createSortOrder}
                />
              </div>
            ) : (
              <p className="mt-1 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {t('products_empty')}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="dup-desc" className="text-gray-800">
              {t('description_notes')}
            </Label>
            <textarea
              id="dup-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t('description_placeholder')}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-gray-500" />
              {t('recipe_dup_phases_summary')}
            </p>
            <p className="text-xs text-gray-500 mb-2">{t('recipe_dup_phases_editable_later')}</p>
            <div className="flex flex-wrap gap-2">
              {source.phases
                .filter((p) => p.enabled)
                .map((phase) => {
                  const Icon = phaseIcons[phase.type];
                  return (
                    <span
                      key={phase.type}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                        phaseColors[phase.type]
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {shortLabel[phase.type]}
                    </span>
                  );
                })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleConfirm}>
            <Copy className="w-4 h-4" />
            {t('recipe_dup_continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
