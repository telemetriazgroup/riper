import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Clock, 
  Thermometer, 
  Droplets, 
  Wind, 
  FlaskConical,
  ToggleLeft,
  ToggleRight,
  ArrowDown,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { clsx } from 'clsx';
import { useSettings } from '../../contexts/SettingsContext';
import { celsiusFromDisplayValue, type TempUnit } from '@/app/lib/temperatureUnits';
import { ProductCombobox, type ProductRow } from './ProductCombobox';
import type { AppProduct } from '@/app/lib/productsApi';
import {
  RECIPE_FRUIT_SUGGESTIONS,
  RECIPE_ICON_PRESETS,
  RecipeFruitAvatar,
  iconKeyFromFruitName,
} from '@/app/lib/recipeFruitPresets';
import { localizeRecipe, localizedProductName } from '@/app/lib/catalogI18n';

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
  name_en?: string | null;
  fruit: string;
  fruit_en?: string | null;
  description: string;
  description_en?: string | null;
  phases: PhaseConfig[]; // Ordered list of configured phases
  /** Icono predeterminado (clave de preset); la imagen personalizada tiene prioridad. */
  iconKey?: string | null;
  /** Imagen propia (URL https); si está definida, sustituye al icono preset. */
  customImageUrl?: string | null;
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
  const { t, tempUnit, convertTemp, language } = useSettings();
  const [name, setName] = useState(initialData?.name || '');
  const [fruit, setFruit] = useState(initialData?.fruit || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [iconKey, setIconKey] = useState<string | null>(initialData?.iconKey ?? null);
  const [customImageUrl, setCustomImageUrl] = useState(initialData?.customImageUrl ?? '');

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
      setIconKey(null);
      setCustomImageUrl('');
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
    setIconKey(initialData.iconKey ?? null);
    setCustomImageUrl(initialData.customImageUrl ?? '');
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
      iconKey,
      customImageUrl: customImageUrl.trim() || null,
    });
  };

  const fruitOptions = React.useMemo(() => {
    const fromCatalog = products.map((p) => p.name);
    const merged: string[] = [];
    const seen = new Set<string>();
    const push = (n: string) => {
      const t = n.trim();
      if (!t || seen.has(t)) return;
      seen.add(t);
      merged.push(t);
    };
    for (const n of RECIPE_FRUIT_SUGGESTIONS) push(n);
    for (const n of fromCatalog) push(n);
    if (initialData?.fruit) push(initialData.fruit);
    if (fruit) push(fruit);
    return merged;
  }, [products, initialData?.fruit, fruit]);

  const fruitOptionRows: ProductRow[] = React.useMemo(
    () =>
      fruitOptions.map((name) => ({
        name,
        id: products.find((p) => p.name === name)?.id ?? `__extra__-${name}`,
        label: localizedProductName(
          name,
          language,
          products.find((p) => p.name === name)?.name_en
        ),
      })),
    [fruitOptions, products, language]
  );

  const localizedView = React.useMemo(
    () => (readOnly && initialData ? localizeRecipe(initialData, language) : null),
    [readOnly, initialData, language]
  );
  const displayName = localizedView?.name ?? name;
  const displayFruit = localizedView?.fruit ?? fruit;
  const displayDescription = localizedView?.description ?? description;

  React.useEffect(() => {
    if (!fruitOptions.length) return;
    if (!fruitOptions.includes(fruit)) {
      setFruit(fruitOptions[0]);
    }
  }, [fruitOptions, fruit]);

  /** Receta nueva: al estabilizar el producto, sugerir icono si aún no hay uno guardado. */
  React.useEffect(() => {
    if (initialData) return;
    if (iconKey != null) return;
    const k = iconKeyFromFruitName(fruit);
    if (k) setIconKey(k);
  }, [fruit, initialData, iconKey]);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-card p-6 rounded-xl border border-border shadow-sm sticky top-4 z-20 gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 inline-flex items-center justify-center rounded-lg border border-border bg-card p-2.5 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            aria-label={t('back_to_recipe_list')}
            title={t('back_to_recipe_list')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <RecipeFruitAvatar
            recipe={{
              fruit,
              iconKey,
              customImageUrl: customImageUrl.trim() || null,
            }}
            sizeClass="w-12 h-12"
            className="shrink-0 ring-2 ring-white shadow"
            title={displayFruit}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">
              {readOnly
                ? t('recipe_view_title')
                : initialData && initialData.id !== 'new'
                  ? t('edit_recipe')
                  : t('new_recipe')}
            </h1>
            <p className="text-xs text-muted-foreground">
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
      <Card className="border-border shadow-sm">
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full md:col-span-1">
             <label className="block text-sm font-medium text-foreground mb-1">{t('protocol_name')}</label>
             <input 
               type="text" 
               value={readOnly ? displayName : name}
               disabled={readOnly}
               onChange={e => setName(e.target.value)}
               placeholder={t('protocol_placeholder')}
               className="app-field disabled:opacity-60"
             />
          </div>
          <div className="col-span-full md:col-span-1">
             <label className="block text-sm font-medium text-foreground mb-1">{t('product_label')}</label>
             {readOnly ? (
               <input
                 type="text"
                 readOnly
                 value={displayFruit}
                 className="app-select"
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
             <label className="block text-sm font-medium text-foreground mb-1">{t('description_notes')}</label>
             <textarea 
               value={readOnly ? displayDescription : description}
               disabled={readOnly}
               onChange={e => setDescription(e.target.value)}
               rows={2}
               placeholder={t('description_placeholder')}
               className="app-field text-sm disabled:opacity-60"
             />
          </div>

          <div className="col-span-full border-t border-border pt-4 mt-2">
            <p className="text-sm font-medium text-foreground mb-1">{t('recipe_icon_section_title')}</p>
            <p className="text-xs text-muted-foreground mb-3">{t('recipe_icon_presets_hint')}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {RECIPE_ICON_PRESETS.map((p) => {
                const selected = iconKey === p.key && !(customImageUrl.trim());
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={readOnly}
                    title={t(`recipe_preset_${p.key}`)}
                    onClick={() => {
                      setIconKey(p.key);
                      setCustomImageUrl('');
                    }}
                    className={clsx(
                      'flex h-11 min-w-[2.75rem] items-center justify-center rounded-lg border-2 text-xl transition-colors',
                      selected
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-border bg-card hover:border-muted-foreground/30',
                      readOnly && 'cursor-default opacity-80'
                    )}
                  >
                    {p.emoji}
                  </button>
                );
              })}
            </div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('recipe_icon_custom_url')}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={customImageUrl}
                disabled={readOnly}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder={t('recipe_icon_custom_url_placeholder')}
                className="app-field flex-1 text-sm disabled:opacity-60"
              />
              {!readOnly && customImageUrl.trim() && (
                <Button type="button" variant="outline" className="shrink-0" onClick={() => setCustomImageUrl('')}>
                  {t('recipe_icon_clear_image')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sequential Phase Editor */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider pl-1">
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
                            <RecipeTempInput
                              celsius={config.temp}
                              readOnly={readOnly}
                              tempUnit={tempUnit}
                              convertTemp={convertTemp}
                              label={t('set_temperature')}
                              onCelsiusChange={(temp) => handlePhaseChange(def.type, { temp })}
                            />
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
                             <RecipeTempInput
                               celsius={config.temp}
                               readOnly={readOnly}
                               tempUnit={tempUnit}
                               convertTemp={convertTemp}
                               label={t('set_temperature')}
                               onCelsiusChange={(temp) => handlePhaseChange(def.type, { temp })}
                             />
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
                            <RecipeTempInput
                              celsius={config.temp}
                              readOnly={readOnly}
                              tempUnit={tempUnit}
                              convertTemp={convertTemp}
                              label={t('set_temperature')}
                              onCelsiusChange={(temp) => handlePhaseChange(def.type, { temp })}
                            />
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
                               <RecipeTempInput
                                 celsius={config.temp}
                                 readOnly={readOnly}
                                 tempUnit={tempUnit}
                                 convertTemp={convertTemp}
                                 inline
                                 onCelsiusChange={(temp) => handlePhaseChange(def.type, { temp })}
                               />
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

// --- Helper Components ---
function RecipeTempInput({
  celsius,
  readOnly,
  tempUnit,
  convertTemp,
  label,
  onCelsiusChange,
  inline = false,
}: {
  celsius: number;
  readOnly?: boolean;
  tempUnit: TempUnit;
  convertTemp: (c: number) => number;
  label?: string;
  onCelsiusChange: (c: number) => void;
  inline?: boolean;
}) {
  const display = convertTemp(celsius);
  const input = (
    <input
      type="number"
      step={0.1}
      disabled={readOnly}
      value={Number.isFinite(display) ? Number(display.toFixed(1)) : ''}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isFinite(v)) return;
        onCelsiusChange(celsiusFromDisplayValue(v, tempUnit));
      }}
      className={clsx(
        'w-full text-center font-bold outline-none bg-transparent',
        inline && 'text-cyan-700'
      )}
    />
  );

  if (inline) {
    return (
      <div className="flex items-center bg-background rounded border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-foreground">
        {input}
        <span className="text-xs text-muted-foreground font-medium ml-1">°{tempUnit}</span>
      </div>
    );
  }

  return (
    <InputGroup label={label ?? 'Temp'} icon={Thermometer} unit={`°${tempUnit}`}>
      {input}
    </InputGroup>
  );
}

const InputGroup = ({ label, icon: Icon, unit, highlight, children }: any) => (
  <div className={clsx("bg-muted/40 p-3 rounded-lg border", highlight ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30" : "border-border")}>
    <label className="text-xs text-muted-foreground font-medium flex items-center gap-1 mb-1">
      <Icon className="w-3 h-3" /> {label}
    </label>
    <div className="flex items-center bg-background rounded border border-border px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent text-foreground">
      {children}
      <span className="text-xs text-muted-foreground font-medium ml-1 select-none">{unit}</span>
    </div>
  </div>
);
