import React from 'react';
import { BookMarked, Plus, Search, Filter, MousePointer2, FileText, Apple, Clock } from 'lucide-react';
import { useManualT } from './userManualI18n';
import { ManualCallout } from './ManualCallout';
import { useSettings } from '@/app/contexts/SettingsContext';

// Step 1: Access recipe library
export const RecipeStep1: React.FC = () => {
  const mt = useManualT();

  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                    <BookMarked className="h-6 w-6" style={{ color: 'rgb(37, 99, 235)' }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
                      {mt('manual_ui_recipe_library')}
                    </h1>
                    <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                      12 recetas disponibles
                    </p>
                  </div>
                </div>
                <button className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 opacity-30" style={{ backgroundColor: 'rgb(37, 99, 235)', color: 'rgb(255, 255, 255)' }}>
                  <Plus className="h-5 w-5" />
                  {mt('manual_ui_new_recipe')}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 opacity-20">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <p className="font-medium">Mango Kent</p>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <p className="font-medium">Palta Hass</p>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <p className="font-medium">Plátano</p>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={1} variant="blue">{mt('manual_recipe_1_callout')}</ManualCallout>
    </div>
  );
};

// Step 2: Search and filter recipes
export const RecipeStep2: React.FC = () => {
  const mt = useManualT();

  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h1 className="text-2xl font-bold">{mt('manual_ui_recipe_library')}</h1>
            </div>
          </div>

          <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(34, 197, 94)' }}>
              <div className="flex gap-4">
                <div className="flex-1 relative transform scale-105">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-pulse" style={{ color: 'rgb(34, 197, 94)' }} />
                  <input
                    type="text"
                    placeholder="Buscar recetas por fruta..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border-2"
                    style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(34, 197, 94)', color: 'rgb(15, 23, 42)' }}
                    value="Mango"
                    readOnly
                  />
                  <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                    <MousePointer2 className="h-7 w-7 text-green-600 animate-pulse" />
                  </div>
                </div>
                <button className="px-4 py-2 rounded-lg border flex items-center gap-2" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(226, 232, 240)', color: 'rgb(100, 116, 139)' }}>
                  <Filter className="h-5 w-5" />
                  {mt('manual_ui_filters')}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 opacity-30">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <p>Recetas filtradas</p>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={2} variant="green">{mt('manual_recipe_2_callout')}</ManualCallout>
    </div>
  );
};

// Step 3: Select a recipe
export const RecipeStep3: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="flex gap-4">
              <input type="text" className="flex-1 px-4 py-2 rounded-lg" placeholder="Buscar..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="ring-4 ring-purple-500 ring-offset-4 rounded-lg">
              <div className="rounded-lg overflow-hidden transform scale-105" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(147, 51, 234)' }}>
                <div className="p-4" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                  <Apple className="h-12 w-12 mx-auto mb-2 animate-pulse" style={{ color: 'rgb(234, 88, 12)' }} />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2" style={{ color: 'rgb(15, 23, 42)' }}>Mango Kent Standard</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" style={{ color: 'rgb(100, 116, 139)' }} />
                      <span style={{ color: 'rgb(100, 116, 139)' }}>
                        {t('duration')}: 92 horas
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" style={{ color: 'rgb(100, 116, 139)' }} />
                      <span style={{ color: 'rgb(100, 116, 139)' }}>
                        4 fases de maduración
                      </span>
                    </div>
                  </div>
                  <button className="w-full mt-4 py-2 rounded-lg font-medium" style={{ backgroundColor: 'rgb(147, 51, 234)', color: 'rgb(255, 255, 255)' }}>
                    {mt('manual_ui_view_details')}
                  </button>
                </div>
              </div>
              <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                <MousePointer2 className="h-8 w-8 text-purple-600 animate-pulse" />
              </div>
            </div>

            <div className="opacity-30">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <h3 className="font-bold">Palta Hass</h3>
                <p className="text-sm">72 horas</p>
              </div>
            </div>

            <div className="opacity-30">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <h3 className="font-bold">Plátano</h3>
                <p className="text-sm">48 horas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={3} variant="purple">{mt('manual_recipe_3_callout')}</ManualCallout>
    </div>
  );
};

// Step 4: Create new recipe
export const RecipeStep4: React.FC = () => {
  const mt = useManualT();

  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="flex items-center justify-between opacity-30">
              <h1 className="text-2xl font-bold">{mt('manual_ui_recipe_library')}</h1>
              <button className="px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ backgroundColor: 'rgb(241, 245, 249)' }}>
                <Plus className="h-5 w-5" />
                {mt('manual_ui_new_recipe')}
              </button>
            </div>
          </div>

          <div className="ring-4 ring-orange-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(234, 88, 12)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
                  Crear {mt('manual_ui_new_recipe')}
                </h2>
                <button className="px-4 py-2 rounded-lg font-medium transform scale-110 animate-pulse" style={{ backgroundColor: 'rgb(234, 88, 12)', color: 'rgb(255, 255, 255)' }}>
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm mb-4" style={{ color: 'rgb(100, 116, 139)' }}>
                Haga clic en &quot;{mt('manual_ui_new_recipe')}&quot; para iniciar el constructor guiado de recetas de maduración
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                  <BookMarked className="h-8 w-8 mx-auto mb-2" style={{ color: 'rgb(37, 99, 235)' }} />
                  <p className="text-sm font-medium" style={{ color: 'rgb(15, 23, 42)' }}>
                    Constructor Paso a Paso
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgb(100, 116, 139)' }}>
                    Guía completa para configurar cada fase
                  </p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'rgb(254, 243, 199)' }}>
                  <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: 'rgb(234, 88, 12)' }} />
                  <p className="text-sm font-medium" style={{ color: 'rgb(15, 23, 42)' }}>
                    Plantillas Predefinidas
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgb(100, 116, 139)' }}>
                    Recetas estándar para frutas comunes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={4} variant="orange">{mt('manual_recipe_4_callout')}</ManualCallout>
    </div>
  );
};
