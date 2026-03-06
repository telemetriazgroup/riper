import React from 'react';
import { FileText, Thermometer, Wind, Snowflake, Plus, Save, AlertCircle, MousePointer2, CheckCircle, Droplets, Leaf } from 'lucide-react';

// Step 1: Enter recipe name
export const BuilderStep1: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <h1 className="text-2xl font-bold mb-6" style={{ color: 'rgb(15, 23, 42)' }}>
              Constructor de Recetas de Maduración
            </h1>

            <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
              <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgb(239, 246, 255)', border: '2px solid rgb(37, 99, 235)' }}>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(15, 23, 42)' }}>
                  Nombre de la Receta
                  <span style={{ color: 'rgb(239, 68, 68)' }}> *</span>
                </label>
                <input
                  type="text"
                  value="Mango Kent Premium"
                  className="w-full px-4 py-3 rounded-lg border-2 text-lg font-medium"
                  style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(37, 99, 235)', color: 'rgb(15, 23, 42)' }}
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
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">1</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Comience ingresando el nombre de la receta. Este campo es obligatorio e identifica el proceso de maduración
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 2: Add homogenization phase
export const BuilderStep2: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="opacity-20">
            <input type="text" value="Mango Kent Premium" className="w-full px-4 py-2 rounded-lg" />
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
                        1. Homogeneización
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
                      Temperatura (°C)
                    </label>
                    <input type="number" value="12" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(34, 197, 94)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Duración (horas)
                    </label>
                    <input type="number" value="8" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(34, 197, 94)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Humedad (%)
                    </label>
                    <input type="number" value="85" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(34, 197, 94)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      CO₂ (%)
                    </label>
                    <input type="number" value="5" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(34, 197, 94)' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 opacity-30">
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  2. Maduración
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  3. Ventilación
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  4. Enfriamiento
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-green-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">2</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(22, 163, 74)' }}>
            Configure la fase de homogeneización (obligatoria): temperatura, duración, humedad y CO₂. Esta fase nivela la temperatura del producto
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 3: Add ripening phase
export const BuilderStep3: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="opacity-30 mb-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(220, 252, 231)' }}>
                <p className="text-sm font-medium">1. Homogeneización ✓</p>
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
                        2. Maduración
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
                      Temperatura (°C)
                    </label>
                    <input type="number" value="20" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Duración (horas)
                    </label>
                    <input type="number" value="48" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Humedad (%)
                    </label>
                    <input type="number" value="90" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Etileno (ppm)
                    </label>
                    <input type="number" value="100" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      CO₂ (%)
                    </label>
                    <input type="number" value="3" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Ventilación (%)
                    </label>
                    <input type="number" value="10" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(234, 88, 12)' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 opacity-30">
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  3. Ventilación
                </p>
              </div>
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <p className="text-sm text-center" style={{ color: 'rgb(100, 116, 139)' }}>
                  4. Enfriamiento
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-orange-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-orange-600 text-white text-sm font-bold flex-shrink-0">3</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(234, 88, 12)' }}>
            Configure la fase de maduración: temperatura, duración, humedad, etileno (gas madurador), CO₂ y ventilación. Esta es la fase más crítica del proceso
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 4: Add ventilation phase
export const BuilderStep4: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="opacity-30 space-y-2 mb-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(220, 252, 231)' }}>
                <p className="text-sm font-medium">1. Homogeneización ✓</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                <p className="text-sm font-medium">2. Maduración ✓</p>
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
                        3. Ventilación
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
                      Temperatura (°C)
                    </label>
                    <input type="number" value="18" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(147, 51, 234)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Duración (horas)
                    </label>
                    <input type="number" value="12" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(147, 51, 234)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Humedad (%)
                    </label>
                    <input type="number" value="85" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(147, 51, 234)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Ventilación (%)
                    </label>
                    <input type="number" value="100" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(147, 51, 234)' }} />
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
                  4. Enfriamiento
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-purple-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-sm font-bold flex-shrink-0">4</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>
            Configure la fase de ventilación: temperatura, duración, humedad y porcentaje de ventilación. Esta fase elimina gases residuales (etileno y CO₂) del contenedor
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 5: Add cooling phase and save
export const BuilderStep5: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="opacity-30 space-y-2 mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(220, 252, 231)' }}>
                <p className="text-xs font-medium">1. Homogeneización ✓</p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                <p className="text-xs font-medium">2. Maduración ✓</p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(250, 245, 255)' }}>
                <p className="text-xs font-medium">3. Ventilación ✓</p>
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
                        4. Enfriamiento
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
                      Temperatura (°C)
                    </label>
                    <input type="number" value="8" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(37, 99, 235)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Duración (horas)
                    </label>
                    <input type="number" value="24" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(37, 99, 235)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Humedad (%)
                    </label>
                    <input type="number" value="85" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(37, 99, 235)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                      Ventilación (%)
                    </label>
                    <input type="number" value="20" className="w-full px-3 py-2 rounded border-2" style={{ borderColor: 'rgb(37, 99, 235)' }} />
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
                  <p className="font-semibold text-green-900 dark:text-green-100">Receta Completa</p>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Las 4 fases han sido configuradas correctamente. Duración total: 92 horas
                </p>
              </div>
              
              <button className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transform scale-105 animate-pulse" style={{ backgroundColor: 'rgb(34, 197, 94)', color: 'rgb(255, 255, 255)' }}>
                <Save className="h-5 w-5" />
                Guardar Receta
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">5</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Configure la fase de enfriamiento: temperatura baja, duración, humedad y ventilación. Esta fase conserva el producto. Finalmente, haga clic en "Guardar Receta" para completar
          </p>
        </div>
      </div>
    </div>
  );
};
