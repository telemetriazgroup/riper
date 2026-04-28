import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  ChefHat,
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
import { createRecipe, deleteRecipe, fetchRecipes, updateRecipe } from '@/app/lib/recipesApi';

export const RecipeList = () => {
  const { t } = useSettings();
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<AppProduct[]>([]);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>(undefined);
  const [builderReadOnly, setBuilderReadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<Recipe | null>(null);
  const [kebabForId, setKebabForId] = useState<string | null>(null);
  const kebabRef = useRef<HTMLDivElement | null>(null);

  const role = getStoredUser()?.role;
  const canManageProducts = role === 'superadmin' || role === 'admin';
  const canEditRecipes = canEditRecipesAndCatalog();

  const loadAll = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [p, r] = await Promise.all([fetchProducts(), fetchRecipes()]);
      setProducts(p);
      setRecipes(r);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      return a.name.localeCompare(b.name, 'es');
    });
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedRecipes;
    return sortedRecipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fruit.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
  }, [sortedRecipes, searchQuery]);

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

  const handleDelete = async (recipe: Recipe) => {
    if (recipe.is_system) {
      alert(t('recipes_cannot_delete_system'));
      return;
    }
    if (!window.confirm(t('recipes_confirm_delete'))) return;
    try {
      await deleteRecipe(recipe.id);
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
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
            canEditRecipes && editingRecipe && !editingRecipe.is_system
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
          <h1 className="text-2xl font-bold text-gray-900">{t('recipe_library')}</h1>
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
        <ProductManager products={products} onChanged={loadAll} />
      )}

      <div className="flex gap-4 mb-6">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => (
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
            className="hover:shadow-md transition-shadow group border-gray-200 flex flex-col cursor-pointer text-left"
          >
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <ChefHat className="w-6 h-6" />
                </div>
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
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{recipe.name}</h3>
                {recipe.is_system && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    {t('recipe_standard_badge')}
                  </span>
                )}
              </div>
              <p className="text-sm text-blue-600 font-medium mb-2">{recipe.fruit}</p>

              <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                {recipe.description || t('no_description')}
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
                          onClick={() => handleDelete(recipe)}
                          title={t('delete')}
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
        ))}
      </div>
    </div>
      )}
    </>
  );
};
