import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Clock, 
  Thermometer, 
  Droplets, 
  Wind, 
  FlaskConical,
  ChefHat,
  ToggleLeft,
  ToggleRight,
  ArrowDown,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { clsx } from 'clsx';
import { useSettings } from '../../contexts/SettingsContext';
import { ProductCombobox, type ProductRow } from './ProductCombobox';
import type { AppProduct } from '@/app/lib/productsApi';

// --- Types ---
export type PhaseType = 'homogenization' | 'ripening' | 'venting' | 'cooling';

export interface PhaseConfig {
  id: string;
  type: PhaseType;
  enabled: boolean;
  // Common params (some may be unused per type)
  temp: number; // Celsius default
  duration: number; // Hours (or minutes for venting)
  // Specifics
  ethylene?: number;
  co2Limit?: number;
  humidity?: number;
  tempType?: 'air' | 'product'; // For cooling distinction
}

export interface Recipe {
  id: string;
  name: string;
  fruit: string;
  description: string;
  phases: PhaseConfig[]; // Ordered list of configured phases
  /** Receta del sistema (no editable in situ; se duplica) — solo lectura vía API */
  is_system?: boolean;
  /** Archivo lógico (API); restauración solo superadmin */
  archived?: boolean;
  archived_at?: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
}

interface RecipeBuilderProps {
  initialData?: Recipe;
  /** Catálogo de productos (API); el valor guardado en la receta es el nombre. */
  products: ProductOption[];
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
  /** Ver protocolo sin modificar (detalle) */
  readOnly?: boolean;
  /** En modo detalle, pasar a edición (solo recetas no estándar) */
  onStartEdit?: () => void;
  /** En modo detalle, crear copia editable */
  onDuplicateFromView?: () => void;
  /** Admin/superadmin: crear producto sin salir del editor */
  canCreateProduct?: boolean;
  onProductCreated?: (product: AppProduct) => void;
}

// --- Constants ---
const PHASES_DEF: { 
  type: PhaseType; 
  labelKey: string; 
  descKey: string; 
  icon: any; 
  color: string;
  borderColor: string;
  bgColor: string;
}[] = [
  { 
    type: 'homogenization', 
    labelKey: 'phase_homogenization', 
    descKey: 'phase_homogenization_desc',
    icon: Thermometer, 
    color: 'text-yellow-700',
    borderColor: 'border-yellow-200',
    bgColor: 'bg-yellow-50'
  },
  { 
    type: 'ripening', 
    labelKey: 'phase_ripening', 
    descKey: 'phase_ripening_desc',
    icon: FlaskConical, 
    color: 'text-orange-700',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50'
  },
  { 
    type: 'venting', 
    labelKey: 'phase_venting', 
    descKey: 'phase_venting_desc',
    icon: Wind, 
    color: 'text-blue-700',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50'
  },
  { 
    type: 'cooling', 
    labelKey: 'phase_cooling', 
    descKey: 'phase_cooling_desc',
    icon: Droplets, 
    color: 'text-cyan-700',
    borderColor: 'border-cyan-200',
    bgColor: 'bg-cyan-50'
  }
];

// Helper to get existing phase config or default
const getPhaseConfig = (phases: PhaseConfig[], type: PhaseType): PhaseConfig => {
  const existing = phases.find(p => p.type === type);
  if (existing) return { ...existing, enabled: true };
  
  // Defaults
  const defaults: Partial<PhaseConfig> = {
    id: `ph-${type}-${Date.now()}`,
    type,
    enabled: false,
    temp: 20,
    duration: 24,
  };

  if (type === 'homogenization') {
    defaults.humidity = 95;
  }
  if (type === 'ripening') {
    defaults.ethylene = 100;
    defaults.co2Limit = 1.0;
    defaults.humidity = 90;
  }
  if (type === 'venting') {
    defaults.temp = 18;
    defaults.co2Limit = 0.5; // CO2 Objetivo
    defaults.duration = 30; // Minutos default
  }
  if (type === 'cooling') {
    defaults.temp = 10; // Product temp target
    defaults.tempType = 'product';
    defaults.duration = 12;
  }

  return defaults as PhaseConfig;
};

export const RecipeBuilder: React.FC<RecipeBuilderProps> = ({
  initialData,
  products,
  onSave,
  onCancel,
  readOnly = false,
  onStartEdit,
  onDuplicateFromView,
  canCreateProduct = false,
  onProductCreated,
}) => {
  const { t } = useSettings();
  const [name, setName] = useState(initialData?.name || '');
  const [fruit, setFruit] = useState(initialData?.fruit || '');
  const [description, setDescription] = useState(initialData?.description || '');

  React.useEffect(() => {
    if (initialData) return;
    setFruit((prev) => {
      if (prev && products.some((p) => p.name === prev)) return prev;
      return products[0]?.name ?? '';
    });
  }, [products, initialData]);
  
  // State for the 4 fixed phases
  const [phases, setPhases] = useState<{ [key in PhaseType]: PhaseConfig }>({
    homogenization: getPhaseConfig(initialData?.phases || [], 'homogenization'),
    ripening: getPhaseConfig(initialData?.phases || [], 'ripening'),
    venting: getPhaseConfig(initialData?.phases || [], 'venting'),
    cooling: getPhaseConfig(initialData?.phases || [], 'cooling'),
  });

  // Al abrir otra receta o un duplicado, volver a hidratar desde initialData
  const recipeId = initialData?.id ?? 'new';
  const recipeNameKey = initialData?.name ?? '';
  React.useEffect(() => {
    if (!initialData) {
      setName('');
      setDescription('');
      setPhases({
        homogenization: getPhaseConfig([], 'homogenization'),
        ripening: getPhaseConfig([], 'ripening'),
        venting: getPhaseConfig([], 'venting'),
        cooling: getPhaseConfig([], 'cooling'),
      });
      return;
    }
    setName(initialData.name);
    setFruit(initialData.fruit);
    setDescription(initialData.description);
    setPhases({
      homogenization: getPhaseConfig(initialData.phases, 'homogenization'),
      ripening: getPhaseConfig(initialData.phases, 'ripening'),
      venting: getPhaseConfig(initialData.phases, 'venting'),
      cooling: getPhaseConfig(initialData.phases, 'cooling'),
    });
  }, [recipeId, recipeNameKey]);

  const handlePhaseChange = (type: PhaseType, updates: Partial<PhaseConfig>) => {
    setPhases(prev => ({
      ...prev,
      [type]: { ...prev[type], ...updates }
    }));
  };

  const togglePhase = (type: PhaseType) => {
    if (readOnly) return;
    setPhases(prev => ({
      ...prev,
      [type]: { ...prev[type], enabled: !prev[type].enabled }
    }));
  };

  const handleSave = () => {
    if (readOnly) return;
    const orderedPhases = PHASES_DEF
      .map(def => phases[def.type])
      .filter(p => p.enabled);

    onSave({
      id: initialData?.id || 'new',
      name,
      fruit: fruit.trim() || (products[0]?.name ?? ''),
      description,
      phases: orderedPhases,
      is_system: initialData?.is_system,
    });
  };

  const fruitOptions = React.useMemo(() => {
    const names = products.map((p) => p.name);
    const set = new Set(names);
    if (initialData?.fruit && !set.has(initialData.fruit)) {
      return [...names, initialData.fruit];
    }
    if (fruit && !set.has(fruit)) {
      return [...names, fruit];
    }
    return names;
  }, [products, initialData?.fruit, fruit]);

  const fruitOptionRows: ProductRow[] = React.useMemo(
    () =>
      fruitOptions.map((name) => ({
        name,
        id: products.find((p) => p.name === name)?.id ?? `__extra__-${name}`,
      })),
    [fruitOptions, products]
  );

  React.useEffect(() => {
    if (!fruitOptions.length) return;
    if (!fruitOptions.includes(fruit)) {
      setFruit(fruitOptions[0]);
    }
  }, [fruitOptions, fruit]);

  const getTotalDuration = () => {
    let totalHours = 0;
    if (phases.homogenization.enabled) totalHours += phases.homogenization.duration;
    if (phases.ripening.enabled) totalHours += phases.ripening.duration;
    if (phases.venting.enabled) totalHours += (phases.venting.duration / 60); // Min to hours
    if (phases.cooling.enabled) totalHours += phases.cooling.duration;
    return totalHours;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {initialData?.archived && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t('recipe_open_archived_notice')}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-4 z-20 gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2.5 text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            aria-label={t('back_to_recipe_list')}
            title={t('back_to_recipe_list')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg shrink-0">
            <ChefHat className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">
              {readOnly
                ? t('recipe_view_title')
                : initialData && initialData.id !== 'new'
                  ? t('edit_recipe')
                  : t('new_recipe')}
            </h1>
            <p className="text-xs text-gray-500">
              {t('total_duration')}: <span className="font-semibold text-blue-600">{getTotalDuration().toFixed(1)} {t('hours')}</span>
            </p>
            {readOnly && initialData?.is_system && (
              <p className="text-xs text-amber-800 mt-1 bg-amber-50 border border-amber-100 rounded px-2 py-1 inline-block">
                {t('recipe_system_readonly_hint')}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
          {readOnly ? (
            <>
              <Button variant="ghost" onClick={onCancel} className="flex-1 md:flex-none">
                {t('back_to_recipe_list')}
              </Button>
              {onDuplicateFromView && (
                <Button
                  variant="outline"
                  className="gap-2 border-slate-300"
                  onClick={onDuplicateFromView}
                >
                  {t('duplicate_recipe')}
                </Button>
              )}
              {!initialData?.is_system && onStartEdit && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  onClick={onStartEdit}
                >
                  {t('edit_recipe')}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onCancel} className="flex-1 md:flex-none">
                {t('cancel')}
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 flex-1 md:flex-none" onClick={handleSave}>
                <Save className="w-4 h-4" /> {t('save')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* General Info */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full md:col-span-1">
             <label className="block text-sm font-medium text-gray-700 mb-1">{t('protocol_name')}</label>
             <input 
               type="text" 
               value={name}
               disabled={readOnly}
               onChange={e => setName(e.target.value)}
               placeholder={t('protocol_placeholder')}
               className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-800"
             />
          </div>
          <div className="col-span-full md:col-span-1">
             <label className="block text-sm font-medium text-gray-700 mb-1">{t('product_label')}</label>
             {readOnly ? (
               <input
                 type="text"
                 readOnly
                 value={fruit}
                 className="w-full border-gray-300 rounded-lg shadow-sm bg-gray-50 text-gray-800 px-3 py-2"
               />
             ) : (products.length > 0 || canCreateProduct) ? (
               <ProductCombobox
                 value={fruit}
                 onChange={setFruit}
                 items={fruitOptionRows}
                 disabled={false}
                 canCreateProduct={canCreateProduct}
                 onProductCreated={onProductCreated ?? (() => {})}
                 createSortOrder={products.length}
               />
             ) : (
               <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                 {t('products_empty')}
               </p>
             )}
          </div>
          <div className="col-span-full">
             <label className="block text-sm font-medium text-gray-700 mb-1">{t('description_notes')}</label>
             <textarea 
               value={description}
               disabled={readOnly}
               onChange={e => setDescription(e.target.value)}
               rows={2}
               placeholder={t('description_placeholder')}
               className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-50"
             />
          </div>
        </CardContent>
      </Card>

      {/* Sequential Phase Editor */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider pl-1">
          {t('logical_process_sequence')}
        </div>
        
        {PHASES_DEF.map((def, index) => {
          const config = phases[def.type];
          const isEnabled = config.enabled;

          return (
            <div key={def.type} className="relative">
               {/* Connecting Line */}
               {index < PHASES_DEF.length - 1 && (
                 <div className="absolute left-6 top-10 bottom-[-20px] w-0.5 bg-gray-200 -z-10"></div>
               )}

               <Card className={clsx(
                 "border transition-all duration-300", 
                 isEnabled ? `border-l-4 ${def.borderColor} shadow-md` : "border-gray-200 border-l-4 border-l-gray-300 opacity-60 hover:opacity-100 bg-gray-50"
               )}>
                 <div className="p-4 md:p-6">
                   {/* Header Row */}
                   <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-4">
                       <div className={clsx("w-12 h-12 rounded-full flex items-center justify-center shadow-sm", isEnabled ? "bg-white text-gray-800" : "bg-gray-200 text-gray-400")}>
                         <def.icon className={clsx("w-6 h-6", isEnabled && def.color)} />
                       </div>
                       <div>
                         <h3 className={clsx("text-lg font-bold", isEnabled ? "text-gray-900" : "text-gray-500")}>{t(def.labelKey)}</h3>
                         <p className="text-sm text-gray-500 hidden md:block">{t(def.descKey)}</p>
                       </div>
                     </div>
                     <button 
                       type="button"
                       onClick={() => togglePhase(def.type)}
                       disabled={readOnly}
                       className={clsx("flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors", 
                         isEnabled ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300",
                         readOnly && "opacity-80 cursor-not-allowed"
                       )}
                     >
                       {isEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                       {isEnabled ? t('active') : t('inactive')}
                     </button>
                   </div>

                   {/* Configuration Form (Only if enabled) */}
                   {isEnabled && (
                     <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-200">
                        
                        {/* 1. Homogenization Fields */}
                        {def.type === 'homogenization' && (
                          <>
                            <InputGroup label={t('set_temperature')} icon={Thermometer} unit="°C">
                              <input type="number" step="0.1" disabled={readOnly} value={config.temp} onChange={e => handlePhaseChange(def.type, { temp: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                            </InputGroup>
                            <InputGroup label={t('set_humidity')} icon={Droplets} unit="%">
                              <input type="number" step="1" min={80} max={98} disabled={readOnly} value={config.humidity ?? 95} onChange={e => handlePhaseChange(def.type, { humidity: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                            </InputGroup>
                            <InputGroup label={t('set_time')} icon={Clock} unit={t('unit_hours')}>
                              <input type="number" step="1" disabled={readOnly} value={config.duration} onChange={e => handlePhaseChange(def.type, { duration: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                            </InputGroup>
                          </>
                        )}

                        {/* 2. Ripening Fields */}
                        {def.type === 'ripening' && (
                          <>
                             <InputGroup label={t('set_temperature')} icon={Thermometer} unit="°C">
                               <input type="number" step="0.1" disabled={readOnly} value={config.temp} onChange={e => handlePhaseChange(def.type, { temp: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                             </InputGroup>
                             <InputGroup label={t('set_ethylene')} icon={FlaskConical} unit={t('unit_ppm')}>
                               <input type="number" step="10" disabled={readOnly} value={config.ethylene} onChange={e => handlePhaseChange(def.type, { ethylene: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                             </InputGroup>
                             <InputGroup label={t('set_co2')} icon={Wind} unit="%">
                               <input type="number" step="0.1" disabled={readOnly} value={config.co2Limit} onChange={e => handlePhaseChange(def.type, { co2Limit: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                             </InputGroup>
                             <InputGroup label={t('set_humidity')} icon={Droplets} unit="%">
                               <input type="number" step="1" disabled={readOnly} value={config.humidity} onChange={e => handlePhaseChange(def.type, { humidity: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                             </InputGroup>
                             <div className="lg:col-span-4 max-w-[200px]">
                               <InputGroup label={t('set_time')} icon={Clock} unit={t('unit_hours')}>
                                 <input type="number" step="1" disabled={readOnly} value={config.duration} onChange={e => handlePhaseChange(def.type, { duration: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                               </InputGroup>
                             </div>
                          </>
                        )}

                        {/* 3. Venting Fields */}
                        {def.type === 'venting' && (
                          <>
                            <InputGroup label={t('set_temperature')} icon={Thermometer} unit="°C">
                              <input type="number" step="0.1" disabled={readOnly} value={config.temp} onChange={e => handlePhaseChange(def.type, { temp: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                            </InputGroup>
                            <InputGroup label={t('target_co2')} icon={Wind} unit="%">
                              <input type="number" step="0.1" disabled={readOnly} value={config.co2Limit} onChange={e => handlePhaseChange(def.type, { co2Limit: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                            </InputGroup>
                            <InputGroup label={t('set_time')} icon={Clock} unit={t('unit_minutes')} highlight>
                              <input type="number" step="1" disabled={readOnly} value={config.duration} onChange={e => handlePhaseChange(def.type, { duration: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent text-blue-600" />
                            </InputGroup>
                          </>
                        )}

                        {/* 4. Cooling Fields */}
                        {def.type === 'cooling' && (
                          <>
                            <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-100">
                               <label className="text-xs text-cyan-800 font-semibold flex items-center gap-1 mb-1">
                                 <Thermometer className="w-3 h-3" /> {t('target_product_temp')}
                               </label>
                               <div className="flex items-center bg-white rounded border border-cyan-200 px-2 py-1">
                                  <input 
                                    type="number" 
                                    step="0.1"
                                    disabled={readOnly}
                                    value={config.temp} 
                                    onChange={e => handlePhaseChange(def.type, { temp: Number(e.target.value) })} 
                                    className="w-full text-center font-bold outline-none text-cyan-700" 
                                  />
                                  <span className="text-xs text-gray-500 font-medium ml-1">°C</span>
                               </div>
                               <p className="text-[10px] text-cyan-600 mt-1">{t('pulp_temp_control_note')}</p>
                            </div>

                            <InputGroup label={t('set_time')} icon={Clock} unit={t('unit_hours')}>
                              <input type="number" step="1" disabled={readOnly} value={config.duration} onChange={e => handlePhaseChange(def.type, { duration: Number(e.target.value) })} className="w-full text-center font-bold outline-none bg-transparent" />
                            </InputGroup>
                          </>
                        )}

                     </div>
                   )}
                 </div>
               </Card>
               
               {/* Arrow */}
               {index < PHASES_DEF.length - 1 && config.enabled && phases[PHASES_DEF[index+1].type].enabled && (
                 <div className="absolute left-6 -bottom-5 z-10 bg-white border border-gray-200 rounded-full p-1 text-gray-400">
                   <ArrowDown className="w-4 h-4" />
                 </div>
               )}
            </div>
          );
        })}

      </div>
    </div>
  );
};

// --- Helper Component ---
const InputGroup = ({ label, icon: Icon, unit, highlight, children }: any) => (
  <div className={clsx("bg-gray-50 p-3 rounded-lg border", highlight ? "border-blue-200 bg-blue-50" : "border-gray-200")}>
    <label className="text-xs text-gray-500 font-medium flex items-center gap-1 mb-1">
      <Icon className="w-3 h-3" /> {label}
    </label>
    <div className="flex items-center bg-white rounded border border-gray-200 px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      {children}
      <span className="text-xs text-gray-500 font-medium ml-1 select-none">{unit}</span>
    </div>
  </div>
);
