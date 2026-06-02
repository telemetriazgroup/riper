import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Clock,
  MoreVertical,
  Edit,
  Trash,
  Copy,
  Eye,
  Thermometer,
  FlaskConical,
  Wind,
  Droplets,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { RecipeBuilder, Recipe, PhaseType } from './RecipeBuilder';
import { DuplicateRecipeDialog } from './DuplicateRecipeDialog';
import { ProductManager } from './ProductManager';
import { clsx } from 'clsx';
import { useSettings } from '../../contexts/SettingsContext';
import { getStoredUser } from '@/app/lib/auth';
import { canEditRecipesAndCatalog } from '@/app/lib/permissions';
import { fetchProducts, type AppProduct } from '@/app/lib/productsApi';
import {
  createRecipe,
  deleteRecipe,
  fetchRecipes,
  restoreRecipe,
  updateRecipe,
} from '@/app/lib/recipesApi';
import { RecipeFruitAvatar } from '@/app/lib/recipeFruitPresets';
import { localizeRecipe, productDisplayName } from '@/app/lib/catalogI18n';
import { fetchRipeningProcesses, type RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { isThermoKingSession } from '@/app/lib/fleetDemo';

/** Recetas usadas en seguimiento pero no enlazadas a fila catálogo (p. ej. personalizada solo en payload). */
function recipesAppliedOnThermoKingDevice(catalog: Recipe[], processRows: RipeningProcessRow[]): Recipe[] {
  const catalogIds = new Set<string>();
  const embedded: Recipe[] = [];
  for (const row of processRows) {
    const pr = row.payload?.recipe as Partial<Recipe> | undefined;
    if (!pr || typeof pr !== 'object' || !String(pr.name ?? '').trim()) continue;
    const rid = typeof pr.id === 'string' ? pr.id.trim() : '';
    const catalogMatch = rid && rid !== 'new' ? catalog.find((c) => c.id === rid) : undefined;
    if (catalogMatch) {
      catalogIds.add(rid);
      continue;
    }
    if (Array.isArray(pr.phases) && pr.phases.length > 0) {
      embedded.push({
        id: `seguimiento-${row.id}`,
        name: String(pr.name),
        fruit: typeof pr.fruit === 'string' ? pr.fruit : '',
        description: typeof pr.description === 'string' ? pr.description : '',
        phases: pr.phases as Recipe['phases'],
        iconKey: pr.iconKey ?? null,
        customImageUrl: pr.customImageUrl ?? null,
        is_system: Boolean(pr.is_system),
      });
    }
  }
  return [...embedded, ...catalog.filter((rec) => catalogIds.has(rec.id))];
}

export const RecipeList = () => {
  const { t, language } = useSettings();
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<AppProduct[]>([]);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>(undefined);
  const [builderReadOnly, setBuilderReadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Solo superadmin: ver recetas y productos archivados en el listado */
  const [showArchivedCatalog, setShowArchivedCatalog] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Recipe | null>(null);
  const [kebabForId, setKebabForId] = useState<string | null>(null);
  const kebabRef = useRef<HTMLDivElement | null>(null);

  const role = getStoredUser()?.role;
  const isSuperAdmin = role === 'superadmin';
  const canManageProducts = role === 'superadmin' || role === 'admin';
  const canEditRecipes = canEditRecipesAndCatalog();

  const loadAll = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const includeArchived = Boolean(isSuperAdmin && showArchivedCatalog);
      const ripeningOpts = includeArchived ? { includeArchived: true as const } : undefined;
      const [p, r, thermoProcesses] = await Promise.all([
        fetchProducts({ includeArchived }),
        fetchRecipes({ includeArchived }),
        isThermoKingSession() ? fetchRipeningProcesses(ripeningOpts) : Promise.resolve([] as RipeningProcessRow[]),
      ]);
      setProducts(p);
      if (isThermoKingSession()) {
        setRecipes(recipesAppliedOnThermoKingDevice(r, thermoProcesses));
      } else {
        setRecipes(r);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('load_error'));
    } finally {
      setLoading(false);
    }
  }, [t, isSuperAdmin, showArchivedCatalog]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!kebabForId) return;
    const onDown = (e: MouseEvent) => {
      const el = kebabRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setKebabForId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [kebabForId]);

  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
      const sa = a.is_system ? 0 : 1;
      const sb = b.is_system ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const la = localizeRecipe(a, language).name;
      const lb = localizeRecipe(b, language).name;
      return la.localeCompare(lb, language === 'en' ? 'en' : 'es');
    });
  }, [recipes, language]);

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedRecipes;
    return sortedRecipes.filter((r) => {
      const d = localizeRecipe(r, language);
      return (
        d.name.toLowerCase().includes(q) ||
        d.fruit.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.fruit.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      );
    });
  }, [sortedRecipes, searchQuery, language]);

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name })),
    [products]
  );

  const goToList = () => {
    setView('list');
    setBuilderReadOnly(false);
    setEditingRecipe(undefined);
  };

  const handleCreate = () => {
    setEditingRecipe(undefined);
    setBuilderReadOnly(false);
    setView('builder');
  };

  /** Clic en tarjeta: ver protocolo (solo lectura). */
  const openViewDetails = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setBuilderReadOnly(true);
    setView('builder');
  };

  /** Editar: solo recetas no estándar (las del sistema se editan vía duplicar). */
  const handleEdit = (recipe: Recipe) => {
    if (recipe.archived) {
      alert(t('recipe_archived_cannot_edit'));
      return;
    }
    setEditingRecipe(recipe);
    setBuilderReadOnly(false);
    setView('builder');
  };

  const openDuplicateModal = (recipe: Recipe) => {
    setKebabForId(null);
    setDuplicateSource(recipe);
  };

  const applyDuplicateDraft = (draft: Recipe) => {
    setDuplicateSource(null);
    setEditingRecipe(draft);
    setBuilderReadOnly(false);
    setView('builder');
  };

  const handleSave = async (recipe: Recipe) => {
    try {
      if (recipe.archived && recipe.id !== 'new') {
        alert(t('recipe_archived_cannot_edit'));
        return;
      }
      const isNew = recipe.id === 'new' || !recipes.some((r) => r.id === recipe.id);
      if (isNew) {
        const { id: _id, is_system: _s, ...rest } = recipe;
        const created = await createRecipe(rest);
        setRecipes((prev) => [created, ...prev]);
      } else {
        if (recipe.is_system) {
          alert(t('recipes_cannot_save_system'));
          return;
        }
        const { id, is_system: _s, ...rest } = recipe;
        const updated = await updateRecipe(id, rest);
        setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
      goToList();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleArchiveRecipe = async (recipe: Recipe) => {
    if (recipe.is_system) {
      alert(t('recipes_cannot_delete_system'));
      return;
    }
    if (!window.confirm(t('recipes_confirm_delete'))) return;
    try {
      await deleteRecipe(recipe.id);
      await loadAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleRestoreRecipe = async (recipe: Recipe) => {
    if (!isSuperAdmin) return;
    try {
      await restoreRecipe(recipe.id);
      await loadAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  };

  const renderPhaseBadges = (phases: Recipe['phases']) => {
    const iconMap: Record<PhaseType, React.ComponentType<{ className?: string }>> = {
      homogenization: Thermometer,
      ripening: FlaskConical,
      venting: Wind,
      cooling: Droplets,
    };

    const colorMap: Record<PhaseType, string> = {
      homogenization: 'bg-yellow-100 text-yellow-700',
      ripening: 'bg-orange-100 text-orange-700',
      venting: 'bg-blue-100 text-blue-700',
      cooling: 'bg-cyan-100 text-cyan-700',
    };

    const labelMap: Record<PhaseType, string> = {
      homogenization: t('short_homog'),
      ripening: t('short_ripening'),
      venting: t('short_venting'),
      cooling: t('short_cooling'),
    };

    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {phases
          .filter((p) => p.enabled)
          .map((phase) => {
            const Icon = iconMap[phase.type];
            return (
              <span
                key={phase.type}
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider',
                  colorMap[phase.type]
                )}
              >
                <Icon className="w-3 h-3" />
                {labelMap[phase.type]}
              </span>
            );
          })}
      </div>
    );
  };

  const calculateTotalDuration = (phases: Recipe['phases']) => {
    return phases.reduce((acc, curr) => {
      if (!curr.enabled) return acc;
      if (curr.type === 'venting') return acc + curr.duration / 60;
      return acc + curr.duration;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm">{t('loading_catalog')}</p>
      </div>
    );
  }

  return (
    <>
      {duplicateSource && (
        <DuplicateRecipeDialog
          key={duplicateSource.id}
          source={duplicateSource}
          products={productOptions}
          onClose={() => setDuplicateSource(null)}
          onConfirm={applyDuplicateDraft}
          canCreateProduct={canManageProducts}
          onProductCreated={() => {
            void loadAll();
          }}
          createSortOrder={products.length}
        />
      )}
      {view === 'builder' ? (
        <RecipeBuilder
          key={editingRecipe ? `${editingRecipe.id}\u200b${editingRecipe.name}` : 'new-recipe'}
          initialData={editingRecipe}
          products={productOptions}
          onSave={handleSave}
          onCancel={goToList}
          readOnly={builderReadOnly}
          onStartEdit={
            canEditRecipes && editingRecipe && !editingRecipe.is_system && !editingRecipe.archived
              ? () => setBuilderReadOnly(false)
              : undefined
          }
          onDuplicateFromView={
            canEditRecipes && editingRecipe
              ? () => openDuplicateModal(editingRecipe)
              : undefined
          }
          canCreateProduct={canManageProducts}
          onProductCreated={() => {
            void loadAll();
          }}
        />
      ) : (
    <div className="space-y-6 animate-in fade-in duration-300">
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
          {loadError}
          <Button variant="ghost" size="sm" className="ml-2 h-7" onClick={() => loadAll()}>
            {t('retry')}
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('recipe_library')}</h1>
          <p className="text-gray-500 text-sm">{t('recipe_library_desc')}</p>
        </div>
        {canEditRecipes && (
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleCreate}>
            <Plus className="w-4 h-4" />
            {t('new_recipe')}
          </Button>
        )}
      </div>

      {canManageProducts && (
        <ProductManager products={products} onChanged={loadAll} isSuperAdmin={isSuperAdmin} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_recipe_placeholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isSuperAdmin && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={showArchivedCatalog}
              onChange={(e) => setShowArchivedCatalog(e.target.checked)}
            />
            {t('catalog_show_archived')}
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => {
          const display = localizeRecipe(recipe, language);
          return (
          <Card
            key={recipe.id}
            role="button"
            tabIndex={0}
            onClick={() => openViewDetails(recipe)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openViewDetails(recipe);
              }
            }}
            className={clsx(
              'hover:shadow-md transition-shadow group flex flex-col cursor-pointer text-left',
              recipe.archived ? 'border-2 border-dashed border-amber-300 bg-amber-50/30' : 'border-gray-200'
            )}
          >
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <RecipeFruitAvatar recipe={recipe} sizeClass="w-14 h-14" className="ring-1 ring-gray-200" title={display.fruit} />
                <div
                  ref={kebabForId === recipe.id ? kebabRef : undefined}
                  className="relative z-20"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
                    aria-expanded={kebabForId === recipe.id}
                    aria-haspopup="menu"
                    onClick={() =>
                      setKebabForId((id) => (id === recipe.id ? null : recipe.id))
                    }
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {kebabForId === recipe.id && (
                    <div
                      className="absolute right-0 top-full mt-1 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      role="menu"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setKebabForId(null);
                          openViewDetails(recipe);
                        }}
                      >
                        <Eye className="w-4 h-4 shrink-0 text-gray-500" />
                        {t('recipe_view_action')}
                      </button>
                      {canEditRecipes && (
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => openDuplicateModal(recipe)}
                        >
                          <Copy className="w-4 h-4 shrink-0 text-gray-500" />
                          {t('duplicate_recipe')}
                        </button>
                      )}
                      {recipe.archived && isSuperAdmin && (
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-900 hover:bg-emerald-50"
                          onClick={() => {
                            setKebabForId(null);
                            void handleRestoreRecipe(recipe);
                          }}
                        >
                          <RotateCcw className="w-4 h-4 shrink-0" />
                          {t('restore_from_archive')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{display.name}</h3>
                {recipe.archived && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
                    {t('archived_badge')}
                  </span>
                )}
                {recipe.is_system && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    {t('recipe_standard_badge')}
                  </span>
                )}
              </div>
              <p className="text-sm text-blue-600 font-medium mb-2">{display.fruit}</p>

              <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                {display.description || t('no_description')}
              </p>

              <div className="mb-4">{renderPhaseBadges(recipe.phases)}</div>

              <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                  <Clock className="w-4 h-4" />
                  {calculateTotalDuration(recipe.phases).toFixed(1)}h {t('total_label')}
                </div>

                {canEditRecipes && (
                  <div
                    className="flex flex-wrap items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {recipe.is_system ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => openDuplicateModal(recipe)}
                        title={t('duplicate_recipe')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {t('duplicate_recipe')}
                      </Button>
                    ) : recipe.archived ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => openDuplicateModal(recipe)}
                          title={t('duplicate_recipe')}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {t('duplicate_recipe')}
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 text-emerald-800 border-emerald-200"
                            onClick={() => void handleRestoreRecipe(recipe)}
                            title={t('restore_from_archive')}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t('restore_from_archive')}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(recipe)}
                          title={t('edit_recipe')}
                        >
                          <Edit className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openDuplicateModal(recipe)}
                          title={t('duplicate_recipe')}
                        >
                          <Copy className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-red-600"
                          onClick={() => void handleArchiveRecipe(recipe)}
                          title={t('recipes_confirm_delete')}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
      )}
    </>
  );
};
