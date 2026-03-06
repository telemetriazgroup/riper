import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ChefHat, 
  Clock, 
  MoreVertical,
  Edit,
  Trash,
  Thermometer,
  FlaskConical,
  Wind,
  Droplets
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { RecipeBuilder, Recipe, PhaseType } from './RecipeBuilder';
import { PERUVIAN_RECIPES } from '../../data/recipes';
import { clsx } from 'clsx';
import { useSettings } from '../../contexts/SettingsContext';

export const RecipeList = () => {
  const { t } = useSettings();
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [recipes, setRecipes] = useState<Recipe[]>(PERUVIAN_RECIPES);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>(undefined);

  const handleCreate = () => {
    setEditingRecipe(undefined); 
    setView('builder');
  };

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setView('builder');
  };

  const handleSave = (recipe: Recipe) => {
    if (recipe.id === 'new' || !recipes.find(r => r.id === recipe.id)) {
      const newRecipe = { ...recipe, id: `rec-${Date.now()}` };
      setRecipes([newRecipe, ...recipes]);
    } else {
      setRecipes(recipes.map(r => r.id === recipe.id ? recipe : r));
    }
    setView('list');
  };

  // Helper to render phase badges
  const renderPhaseBadges = (phases: Recipe['phases']) => {
    const iconMap: Record<PhaseType, any> = {
      homogenization: Thermometer,
      ripening: FlaskConical,
      venting: Wind,
      cooling: Droplets
    };
    
    const colorMap: Record<PhaseType, string> = {
      homogenization: 'bg-yellow-100 text-yellow-700',
      ripening: 'bg-orange-100 text-orange-700',
      venting: 'bg-blue-100 text-blue-700',
      cooling: 'bg-cyan-100 text-cyan-700'
    };

    const labelMap: Record<PhaseType, string> = {
      homogenization: t('short_homog'),
      ripening: t('short_ripening'),
      venting: t('short_venting'),
      cooling: t('short_cooling')
    };

    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {phases.filter(p => p.enabled).map(phase => {
          const Icon = iconMap[phase.type];
          return (
            <span 
              key={phase.type} 
              className={clsx(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
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
      // Venting is usually minutes, but stored as such. 
      // In RecipeBuilder we normalize. Assuming raw value here needs handling if it's minutes.
      // Based on RecipeBuilder, venting duration is entered as minutes but stored in 'duration'.
      // Wait, RecipeBuilder logic: 
      // if (phases.venting.enabled) totalHours += (phases.venting.duration / 60);
      
      if (curr.type === 'venting') return acc + (curr.duration / 60);
      return acc + curr.duration;
    }, 0);
  };

  if (view === 'builder') {
    return (
      <RecipeBuilder 
        initialData={editingRecipe} 
        onSave={handleSave} 
        onCancel={() => setView('list')} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('recipe_library')}</h1>
          <p className="text-gray-500 text-sm">{t('recipe_library_desc')}</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleCreate}>
          <Plus className="w-4 h-4" />
          {t('new_recipe')}
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder={t('search_recipe_placeholder')} 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.map(recipe => (
          <Card key={recipe.id} className="hover:shadow-md transition-shadow group border-gray-200 flex flex-col">
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <ChefHat className="w-6 h-6" />
                </div>
                <div className="relative">
                  <button className="text-gray-400 hover:text-gray-600 p-1">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <h3 className="font-bold text-gray-900 text-lg mb-1 leading-tight">{recipe.name}</h3>
              <p className="text-sm text-blue-600 font-medium mb-2">{recipe.fruit}</p>
              
              <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                {recipe.description || t('no_description')}
              </p>

              {/* Active Phases Badges */}
              <div className="mb-4">
                 {renderPhaseBadges(recipe.phases)}
              </div>

              <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                  <Clock className="w-4 h-4" />
                  {calculateTotalDuration(recipe.phases).toFixed(1)}h Total
                </div>
                
                <div className="flex gap-2">
                   <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(recipe)}>
                     <Edit className="w-4 h-4 text-gray-500" />
                   </Button>
                   <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-red-600" onClick={() => {
                      setRecipes(recipes.filter(r => r.id !== recipe.id));
                   }}>
                     <Trash className="w-4 h-4" />
                   </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
