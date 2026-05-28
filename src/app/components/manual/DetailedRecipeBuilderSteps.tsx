import React from 'react';
import { Thermometer, Wind, Snowflake, Save, CheckCircle, MousePointer2, Droplets, Leaf } from 'lucide-react';
import { useManualT } from './userManualI18n';
import { ManualCallout } from './ManualCallout';
import { useSettings } from '@/app/contexts/SettingsContext';

// Step 1: Enter recipe name
export const BuilderStep1: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <h1 className="text-2xl font-bold mb-6" style={{ color: 'rgb(15, 23, 42)' }}>
              {mt('manual_ui_recipe_builder')}
            </h1>

            <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
              <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgb(239, 246, 255)', border: '2px solid rgb(37, 99, 235)' }}>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(15, 23, 42)' }}>
                  {t('recipe')}
                  <span style={{ color: 'rgb(239, 68, 68)' }}> *</span>
                </label>
                <input
                  type="text"
                  value="Mango Kent Premium"
                  className="w-full px-4 py-3 rounded-lg border-2 text-lg font-medium"
                  style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(37, 99, 235)', color: 'rgb(15, 23, 42)' }}
                  readOnly
                />
                <p className="text-xs mt-2" style={{ color: 'rgb(100, 116, 139)' }}>
                  Ingrese un nombre descriptivo para identificar esta receta de maduración
                </p>
              </div>
            </div>

            <div className="opacity-30 space-y-4 mt-6">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
                <p className="font-medium">Descripción de la receta</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
                <p className="font-medium">Tipo de Producto (Fruta)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={1} variant="blue">{mt('manual_builder_1_callout')}</ManualCallout>
    </div>
  );
};

// Step 2: Add homogenization phase
export const BuilderStep2: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="opacity-20">
            <input type="text" value="Mango Kent Premium" className="w-full px-4 py-2 rounded-lg" readOnly />
          </div>

          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'rgb(15, 23, 42)' }}>
              Configurar Fases de Maduración
            </h2>

            <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
              <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgb(220, 252, 231)', border: '2px solid rgb(34, 197, 94)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                      <Thermometer className="h-5 w-5" style={{ color: 'rgb(34, 197, 94)' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>
                        1. {t('homogenization')}
                      </h3>
                      <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>
                        Fase inicial obligatoria - Nivelar temperatura
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="h-6 w-6 animate-pulse" style={{ color: 'rgb(34, 197, 94)' }} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('temperature')} (°C)
                    </label>
                    <input type="number" value="12" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(34, 197, 94)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('duration')} (horas)
                    </label>
                    <input type="number" value="8" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(34, 197, 94)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('humidity')} (%)
                    </label>
                    <input type="number" value="85" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(34, 197, 94)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('co2')} (%)
                    </label>
                    <input type="number" value="5" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(34, 197, 94)' }} readOnly />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 opacity-30">
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  2. {t('ripening')}
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  3. {t('ventilation')}
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  4. {t('cooling')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={2} variant="green">{mt('manual_builder_2_callout')}</ManualCallout>
    </div>
  );
};

// Step 3: Add ripening phase
export const BuilderStep3: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="opacity-30 mb-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(220, 252, 231)' }}>
                <p className="text-sm font-medium">1. {t('homogenization')} ✓</p>
              </div>
            </div>

            <div className="ring-4 ring-orange-500 ring-offset-4 rounded-lg">
              <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgb(255, 247, 237)', border: '2px solid rgb(234, 88, 12)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                      <Leaf className="h-5 w-5" style={{ color: 'rgb(234, 88, 12)' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>
                        2. {t('ripening')}
                      </h3>
                      <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>
                        Fase principal - Aplicación de etileno
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="h-6 w-6 animate-pulse" style={{ color: 'rgb(234, 88, 12)' }} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('temperature')} (°C)
                    </label>
                    <input type="number" value="20" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('duration')} (horas)
                    </label>
                    <input type="number" value="48" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('humidity')} (%)
                    </label>
                    <input type="number" value="90" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('ethylene')} (ppm)
                    </label>
                    <input type="number" value="100" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('co2')} (%)
                    </label>
                    <input type="number" value="3" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('ventilation')} (%)
                    </label>
                    <input type="number" value="10" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} readOnly />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 opacity-30">
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  3. {t('ventilation')}
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  4. {t('cooling')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={3} variant="orange">{mt('manual_builder_3_callout')}</ManualCallout>
    </div>
  );
};

// Step 4: Add ventilation phase
export const BuilderStep4: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="opacity-30 space-y-2 mb-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(220, 252, 231)' }}>
                <p className="text-sm font-medium">1. {t('homogenization')} ✓</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                <p className="text-sm font-medium">2. {t('ripening')} ✓</p>
              </div>
            </div>

            <div className="ring-4 ring-purple-500 ring-offset-4 rounded-lg">
              <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgb(250, 245, 255)', border: '2px solid rgb(147, 51, 234)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                      <Wind className="h-5 w-5" style={{ color: 'rgb(147, 51, 234)' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>
                        3. {t('ventilation')}
                      </h3>
                      <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>
                        Fase de purga - Eliminación de gases
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="h-6 w-6 animate-pulse" style={{ color: 'rgb(147, 51, 234)' }} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('temperature')} (°C)
                    </label>
                    <input type="number" value="18" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(147, 51, 234)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('duration')} (horas)
                    </label>
                    <input type="number" value="12" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(147, 51, 234)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('humidity')} (%)
                    </label>
                    <input type="number" value="85" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(147, 51, 234)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('ventilation')} (%)
                    </label>
                    <input type="number" value="100" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(147, 51, 234)' }} readOnly />
                  </div>
                </div>
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
                  <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>
                    💨 La ventilación al 100% elimina etileno y CO₂ residual del contenedor
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 opacity-30">
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  4. {t('cooling')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={4} variant="purple">{mt('manual_builder_4_callout')}</ManualCallout>
    </div>
  );
};

// Step 5: Add cooling phase and save
export const BuilderStep5: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="opacity-30 space-y-2 mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(220, 252, 231)' }}>
                <p className="text-xs font-medium">1. {t('homogenization')} ✓</p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                <p className="text-xs font-medium">2. {t('ripening')} ✓</p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(250, 245, 255)' }}>
                <p className="text-xs font-medium">3. {t('ventilation')} ✓</p>
              </div>
            </div>

            <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
              <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgb(239, 246, 255)', border: '2px solid rgb(37, 99, 235)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                      <Snowflake className="h-5 w-5" style={{ color: 'rgb(37, 99, 235)' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>
                        4. {t('cooling')}
                      </h3>
                      <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>
                        Fase final - Conservación del producto
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="h-6 w-6 animate-pulse" style={{ color: 'rgb(37, 99, 235)' }} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('temperature')} (°C)
                    </label>
                    <input type="number" value="8" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(37, 99, 235)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('duration')} (horas)
                    </label>
                    <input type="number" value="24" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(37, 99, 235)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('humidity')} (%)
                    </label>
                    <input type="number" value="85" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(37, 99, 235)' }} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      {t('ventilation')} (%)
                    </label>
                    <input type="number" value="20" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(37, 99, 235)' }} readOnly />
                  </div>
                </div>
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
                  <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>
                    ❄️ El enfriamiento detiene la maduración y conserva el producto hasta su distribución
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-semibold text-green-900 dark:text-green-100">{t('recipe')} Completa</p>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Las 4 fases han sido configuradas correctamente. {t('duration')} total: 92 horas
                </p>
              </div>
              
              <button className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transform scale-105 animate-pulse" style={{ backgroundColor: 'rgb(34, 197, 94)', color: 'rgb(255, 255, 255)' }}>
                <Save className="h-5 w-5" />
                {t('save')} {t('recipe')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={5} variant="blue">{mt('manual_builder_5_callout')}</ManualCallout>
    </div>
  );
};
