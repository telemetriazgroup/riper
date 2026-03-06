import React from 'react';
import { Thermometer, Droplets, Leaf, Wind, Play, Save, MousePointer2, Hand } from 'lucide-react';

// Step 1: Access device control
export const ControlStep1: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[500px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header with highlight */}
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                    Control de Dispositivo
                  </h1>
                  <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>REEFER-001 - Madurador Norte A</p>
                </div>
                <div className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                  <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(22, 163, 74)' }} />
                  Activo
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 opacity-20">
            <button className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <Play className="h-6 w-6 mx-auto" />
            </button>
          </div>
        </div>
      </div>
      {/* Annotation */}
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">1</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Acceda a la pantalla de control del dispositivo seleccionado. Verá el nombre, ID y estado actual
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 2: Adjust temperature
export const ControlStep2: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6 opacity-20" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
              Control de Dispositivo
            </h1>
          </div>

          {/* Temperature Control with highlight */}
          <div className="ring-4 ring-red-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(239, 68, 68)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg animate-pulse" style={{ backgroundColor: 'rgb(254, 242, 242)' }}>
                  <Thermometer className="h-6 w-6" style={{ color: 'rgb(239, 68, 68)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>Temperatura</h3>
                  <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                    Rango: 5°C - 25°C
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold animate-pulse" style={{ color: 'rgb(239, 68, 68)' }}>20°C</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="5"
                  max="25"
                  value="20"
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{ 
                    background: `linear-gradient(to right, rgb(239, 68, 68) 0%, rgb(239, 68, 68) 75%, rgb(226, 232, 240) 75%, rgb(226, 232, 240) 100%)`
                  }}
                />
                <div className="absolute -top-8 left-3/4 transform -translate-x-1/2">
                  <Hand className="h-8 w-8 text-red-600 animate-bounce" />
                </div>
              </div>
              <div className="flex justify-between text-xs mt-2" style={{ color: 'rgb(100, 116, 139)' }}>
                <span>5°C</span>
                <span>15°C</span>
                <span>25°C</span>
              </div>
            </div>
          </div>

          <div className="opacity-20 space-y-4">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h3>Humedad</h3>
            </div>
          </div>
        </div>
      </div>
      {/* Annotation */}
      <div className="absolute top-4 right-4 bg-white border-2 border-red-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-red-600 text-white text-sm font-bold flex-shrink-0">2</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(239, 68, 68)' }}>
            Ajuste la temperatura deseada deslizando el control entre 5°C y 25°C. El valor se muestra en tiempo real
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 3: Adjust humidity
export const ControlStep3: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <div className="flex items-center gap-3">
                <Thermometer className="h-6 w-6" />
                <p className="text-3xl font-bold">20°C</p>
              </div>
            </div>
          </div>

          {/* Humidity Control with highlight */}
          <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(34, 197, 94)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg animate-pulse" style={{ backgroundColor: 'rgb(240, 253, 244)' }}>
                  <Droplets className="h-6 w-6" style={{ color: 'rgb(34, 197, 94)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>Humedad</h3>
                  <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                    Rango: 70% - 95%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold animate-pulse" style={{ color: 'rgb(34, 197, 94)' }}>85%</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="70"
                  max="95"
                  value="85"
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{ 
                    background: `linear-gradient(to right, rgb(34, 197, 94) 0%, rgb(34, 197, 94) 60%, rgb(226, 232, 240) 60%, rgb(226, 232, 240) 100%)`
                  }}
                />
                <div className="absolute -top-8 left-3/5 transform -translate-x-1/2">
                  <Hand className="h-8 w-8 text-green-600 animate-bounce" />
                </div>
              </div>
              <div className="flex justify-between text-xs mt-2" style={{ color: 'rgb(100, 116, 139)' }}>
                <span>70%</span>
                <span>82%</span>
                <span>95%</span>
              </div>
            </div>
          </div>

          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h3>Etileno</h3>
            </div>
          </div>
        </div>
      </div>
      {/* Annotation */}
      <div className="absolute top-4 right-4 bg-white border-2 border-green-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">3</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(22, 163, 74)' }}>
            Configure la humedad relativa moviendo el control entre 70% y 95%. Mantenga niveles óptimos para el producto
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 4: Adjust ethylene
export const ControlStep4: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="opacity-20 space-y-4">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <Thermometer className="h-6 w-6" />
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <Droplets className="h-6 w-6" />
            </div>
          </div>

          {/* Ethylene Control with highlight */}
          <div className="ring-4 ring-orange-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(234, 88, 12)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg animate-pulse" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                  <Leaf className="h-6 w-6" style={{ color: 'rgb(234, 88, 12)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>Etileno</h3>
                  <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                    Rango: 0 - 200 ppm
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold animate-pulse" style={{ color: 'rgb(234, 88, 12)' }}>100 ppm</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="200"
                  value="100"
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{ 
                    background: `linear-gradient(to right, rgb(234, 88, 12) 0%, rgb(234, 88, 12) 50%, rgb(226, 232, 240) 50%, rgb(226, 232, 240) 100%)`
                  }}
                />
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                  <Hand className="h-8 w-8 text-orange-600 animate-bounce" />
                </div>
              </div>
              <div className="flex justify-between text-xs mt-2" style={{ color: 'rgb(100, 116, 139)' }}>
                <span>0 ppm</span>
                <span>100 ppm</span>
                <span>200 ppm</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Annotation */}
      <div className="absolute top-4 right-4 bg-white border-2 border-orange-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-orange-600 text-white text-sm font-bold flex-shrink-0">4</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(234, 88, 12)' }}>
            Establezca el nivel de etileno (0-200 ppm). Este gas acelera la maduración de frutas climatéricas
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 5: Save configuration
export const ControlStep5: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="opacity-20 space-y-4">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <div className="flex items-center gap-3">
                <Thermometer className="h-6 w-6" />
                <p className="text-2xl font-bold">20°C</p>
              </div>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <div className="flex items-center gap-3">
                <Droplets className="h-6 w-6" />
                <p className="text-2xl font-bold">85%</p>
              </div>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <div className="flex items-center gap-3">
                <Leaf className="h-6 w-6" />
                <p className="text-2xl font-bold">100 ppm</p>
              </div>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <div className="flex items-center gap-3">
                <Wind className="h-6 w-6" />
                <p className="text-2xl font-bold">50%</p>
              </div>
            </div>
          </div>

          {/* Save Button with highlight */}
          <div className="relative ring-4 ring-purple-500 ring-offset-4 rounded-lg">
            <button
              className="w-full py-4 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transform scale-105"
              style={{ backgroundColor: 'rgb(147, 51, 234)', color: 'rgb(255, 255, 255)', border: '2px solid rgb(147, 51, 234)' }}
            >
              <Save className="h-6 w-6 animate-pulse" />
              <span className="text-lg">
                Guardar Configuración
              </span>
            </button>
            <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
              <MousePointer2 className="h-8 w-8 text-purple-600 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      {/* Annotation */}
      <div className="absolute top-4 right-4 bg-white border-2 border-purple-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-sm font-bold flex-shrink-0">5</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>
            Presione "Guardar Configuración" para aplicar todos los cambios al dispositivo. Los parámetros se actualizarán inmediatamente
          </p>
        </div>
      </div>
    </div>
  );
};