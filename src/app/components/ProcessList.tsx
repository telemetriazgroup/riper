import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  ChevronRight, 
  Package, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { clsx } from 'clsx';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ProcessDetail } from './ProcessDetail';
import { RecipeBuilder, Recipe } from './recipes/RecipeBuilder';
import { PERUVIAN_RECIPES } from '../data/recipes';
import { useSettings } from '@/app/contexts/SettingsContext';

interface ProcessListProps {
  onSelectProcess?: (id: string) => void;
}

export const ProcessList: React.FC<ProcessListProps> = ({ onSelectProcess }) => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [selectedProcess, setSelectedProcess] = useState<any | null>(null);
  const { t } = useSettings();

  // --- RICH MOCK DATA ---
  const activeProcesses = [
    {
      id: "PROC-2024-88",
      client: { name: "Mango Aérea de Colombia S.A.", type: "external" },
      batch: { 
        product: "Mango Tommy Atkins", 
        origin: "Tolima, Finca La Esperanza", 
        quantity_kg: 4500, 
        quantity_m3: 12.5, 
        box_count: 320, 
        entry_date: "2024-02-02T08:30:00" 
      },
      status: "active",
      phase: "Aplicación Etileno",
      start_date: "2024-02-02",
      progress: 35,
      recipe: {
        name: "Maduración Exportación Aérea v3",
        duration_hours: 72,
        targets: { brix: "14-16", firmness: "10-12", color: "4.5-5.0" }
      },
      image: "https://images.unsplash.com/photo-1663018084454-86fd8150f950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
      timeline: []
    },
    {
      id: "PROC-2024-92",
      client: { name: "Agroindustrial Camposol S.A.", type: "external" },
      batch: { 
        product: "Palta Hass", 
        origin: "La Libertad, Perú", 
        quantity_kg: 22000, 
        quantity_m3: 65.0, 
        box_count: 2100, 
        entry_date: "2024-02-01T06:00:00" 
      },
      status: "active",
      phase: "Ventilación Controlada",
      start_date: "2024-02-01",
      progress: 68,
      recipe: {
        name: "Maduración Ready-to-Eat (Hass)",
        duration_hours: 96,
        targets: { brix: "22-24 (MS)", firmness: "4-6", color: "5 (Negro)" }
      },
      image: "https://images.unsplash.com/photo-1601039641847-7857b994d704?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdm9jYWRvc3xlbnwxfHx8fDE3NzAxMzcxNjZ8MA&ixlib=rb-4.1.0&q=80&w=400",
      timeline: []
    }
  ];

  if (selectedProcess) {
    return <ProcessDetail processData={selectedProcess} onBack={() => setSelectedProcess(null)} />;
  }

  if (view === 'create') {
    return <CreateProcessForm onCancel={() => setView('list')} onSave={() => setView('list')} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('process_tracking')}</h1>
          <p className="text-gray-500 text-sm">{t('process_tracking_desc')}</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => setView('create')}>
          <Plus className="w-4 h-4" />
          {t('new_process')}
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder={t('search_process_placeholder')} 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button variant="outline" className="gap-2 text-gray-600">
          <Filter className="w-4 h-4" /> {t('filters')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeProcesses.map((proc) => (
          <Card 
            key={proc.id} 
            className="hover:shadow-md transition-shadow cursor-pointer group border-gray-200 overflow-hidden"
            onClick={() => setSelectedProcess(proc)}
          >
            <div className="h-32 w-full relative overflow-hidden">
               <ImageWithFallback src={proc.image} alt={proc.batch.product} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               <div className="absolute top-2 right-2">
                 <span className={clsx(
                   "px-2 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md",
                   proc.status === 'active' ? "bg-green-500/90 text-white" : "bg-orange-500/90 text-white"
                 )}>
                   {proc.status === 'active' ? t('in_process') : t('attention')}
                 </span>
               </div>
            </div>
            <CardContent className="p-5">
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 text-lg truncate">{proc.client.name}</h3>
                <p className="text-sm text-gray-500">{proc.batch.product} • {proc.id}</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500 flex items-center gap-1"><Package className="w-4 h-4" /> {t('current_phase')}</span>
                   <span className="font-medium text-blue-600">{proc.phase}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-4 h-4" /> {t('start')}</span>
                   <span className="font-medium text-gray-900">{proc.start_date}</span>
                </div>
                
                <div className="pt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{t('estimated_progress')}</span>
                    <span className="font-bold text-gray-900">{proc.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${proc.progress}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                 <span className="text-sm font-medium text-blue-600 group-hover:underline flex items-center gap-1">
                   {t('view_details')} <ChevronRight className="w-4 h-4" />
                 </span>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Create New Card Placeholder */}
        <div 
          onClick={() => setView('create')}
          className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-8 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all cursor-pointer min-h-[300px]"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover:bg-blue-100">
            <Plus className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg">{t('start_new_process')}</h3>
          <p className="text-sm text-center mt-1 max-w-[200px]">{t('start_new_process_desc')}</p>
        </div>
      </div>
    </div>
  );
};

// --- Subcomponent: Create Process Form ---
const CreateProcessForm = ({ onCancel, onSave }: any) => {
  const [step, setStep] = useState<'form' | 'custom-recipe'>('form');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [customRecipe, setCustomRecipe] = useState<Recipe | null>(null);
  const { t } = useSettings();

  const activeRecipe = customRecipe || PERUVIAN_RECIPES.find(r => r.id === selectedRecipeId);

  const handleCustomRecipeSave = (recipe: Recipe) => {
    setCustomRecipe(recipe);
    setSelectedRecipeId('custom');
    setStep('form');
  };

  if (step === 'custom-recipe') {
    return (
      <div className="pt-4">
        <RecipeBuilder 
          onCancel={() => setStep('form')} 
          onSave={handleCustomRecipeSave} 
          initialData={customRecipe || undefined}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-300">
      <Card className="border-gray-200 shadow-lg">
        <CardContent className="p-8">
           <div className="mb-8 border-b border-gray-100 pb-4">
             <h2 className="text-2xl font-bold text-gray-900">{t('new_maturation_process')}</h2>
             <p className="text-gray-500 mt-1">{t('new_process_desc')}</p>
           </div>

           <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
             {/* Section 1: Client & Origin */}
             <div className="space-y-4">
               <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                 <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                 {t('client_info')}
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">{t('client_type')}</label>
                   <select className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                     <option>Servicio Externo</option>
                     <option>Propio / Interno</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">{t('client_name')}</label>
                   <input type="text" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Ej. Mango Aérea Colombia" />
                 </div>
               </div>
             </div>

             <div className="h-px bg-gray-100 my-6"></div>

             {/* Section 2: Batch Details */}
             <div className="space-y-4">
               <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                 <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</span>
                 {t('batch_details')}
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('product')}</label>
                    <select className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                      <option>Seleccionar...</option>
                      <option>Mango Tommy Atkins</option>
                      <option>Mango Kent</option>
                      <option>Banano Cavendish</option>
                      <option>Aguacate Hass</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('quantity_kg')}</label>
                    <input type="number" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('control_device')}</label>
                    <select className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                       <option>Cámara 01 (Disponible)</option>
                       <option>Cámara 04 (Disponible)</option>
                    </select>
                  </div>
               </div>
             </div>

             <div className="h-px bg-gray-100 my-6"></div>

             {/* Section 3: Recipe Selection */}
             <div className="space-y-4">
               <div className="flex justify-between items-center">
                 <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                   <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">3</span>
                   {t('recipe_planning')}
                 </h3>
                 <Button type="button" variant="outline" size="sm" onClick={() => setStep('custom-recipe')}>
                   <Plus className="w-3 h-3 mr-1" /> {t('create_edit_custom')}
                 </Button>
               </div>
               
               <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                 <label className="block text-sm font-medium text-blue-800 mb-2">{t('select_recipe_library')}</label>
                 <select 
                   value={selectedRecipeId}
                   onChange={(e) => {
                     setSelectedRecipeId(e.target.value);
                     setCustomRecipe(null);
                   }}
                   className="w-full border-blue-200 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                 >
                   <option value="">-- Seleccionar Protocolo --</option>
                   {customRecipe && <option value="custom">★ Receta Personalizada Actual</option>}
                   {PERUVIAN_RECIPES.map(r => (
                     <option key={r.id} value={r.id}>{r.name} ({r.fruit})</option>
                   ))}
                 </select>

                 {/* Recipe Preview */}
                 {activeRecipe && (
                   <div className="mt-4 bg-white/60 p-3 rounded-md border border-blue-100 text-sm">
                      <p className="font-semibold text-blue-900 mb-1">{activeRecipe.name}</p>
                      <p className="text-gray-600 text-xs mb-2">{activeRecipe.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {activeRecipe.phases.filter(p => p.enabled).map((p, i) => (
                          <span key={i} className="px-2 py-1 bg-white border border-blue-100 rounded text-xs text-blue-700 font-medium">
                            {i+1}. {p.type.toUpperCase()} ({p.duration}h)
                          </span>
                        ))}
                      </div>
                   </div>
                 )}
               </div>
             </div>

             <div className="flex justify-end gap-3 pt-6">
               <Button type="button" variant="ghost" onClick={onCancel}>{t('cancel')}</Button>
               <Button type="submit" disabled={!activeRecipe} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[150px]">
                 {t('start_process')}
               </Button>
             </div>
           </form>
        </CardContent>
      </Card>
    </div>
  );
};
