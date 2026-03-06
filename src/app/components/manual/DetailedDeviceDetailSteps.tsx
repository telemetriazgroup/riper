import React from 'react';
import { Activity, TrendingUp, Clock, Thermometer, Droplets, Leaf, Wind, MousePointer2, LineChart, BarChart3 } from 'lucide-react';
import { HistoricalTemperatureChart, MultiParameterChart, DataTable } from './HistoricalCharts';

// Step 1: Access device detail
export const DetailStep1: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
                    REEFER-001 - Madurador Norte A
                  </h1>
                  <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                    Producto: Mango Kent
                  </p>
                </div>
                <div className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 animate-pulse" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(22, 163, 74)' }} />
                  Activo
                </div>
              </div>
              <div className="flex gap-2 border-b" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                <button className="px-4 py-2 text-sm font-medium border-b-2" style={{ borderColor: 'rgb(37, 99, 235)', color: 'rgb(37, 99, 235)' }}>
                  Operación
                </button>
                <button className="px-4 py-2 text-sm font-medium opacity-50" style={{ color: 'rgb(100, 116, 139)' }}>
                  Análisis
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">1</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Acceda al detalle del dispositivo desde el dashboard. Verá el encabezado con nombre, producto y estado
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 2: View real-time parameters
export const DetailStep2: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h1 className="text-2xl font-bold">REEFER-001</h1>
            </div>
          </div>
          
          <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(34, 197, 94)' }}>
              <div className="p-4 rounded-lg text-center transform scale-105" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                <Thermometer className="h-8 w-8 mx-auto mb-2 animate-pulse" style={{ color: 'rgb(37, 99, 235)' }} />
                <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Temperatura</p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(37, 99, 235)' }}>20.2°C</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" style={{ color: 'rgb(34, 197, 94)' }} />
                  <span className="text-xs" style={{ color: 'rgb(34, 197, 94)' }}>+0.3°C</span>
                </div>
              </div>
              <div className="p-4 rounded-lg text-center transform scale-105" style={{ backgroundColor: 'rgb(240, 253, 244)' }}>
                <Droplets className="h-8 w-8 mx-auto mb-2 animate-pulse" style={{ color: 'rgb(34, 197, 94)' }} />
                <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Humedad</p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(34, 197, 94)' }}>89%</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" style={{ color: 'rgb(34, 197, 94)' }} />
                  <span className="text-xs" style={{ color: 'rgb(34, 197, 94)' }}>+2%</span>
                </div>
              </div>
              <div className="p-4 rounded-lg text-center transform scale-105" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                <Leaf className="h-8 w-8 mx-auto mb-2 animate-pulse" style={{ color: 'rgb(234, 88, 12)' }} />
                <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Etileno</p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(234, 88, 12)' }}>98 ppm</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" style={{ color: 'rgb(234, 88, 12)' }} />
                  <span className="text-xs" style={{ color: 'rgb(234, 88, 12)' }}>+5 ppm</span>
                </div>
              </div>
              <div className="p-4 rounded-lg text-center transform scale-105" style={{ backgroundColor: 'rgb(254, 242, 242)' }}>
                <Wind className="h-8 w-8 mx-auto mb-2 animate-pulse" style={{ color: 'rgb(239, 68, 68)' }} />
                <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>CO₂</p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(239, 68, 68)' }}>2.8%</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" style={{ color: 'rgb(239, 68, 68)' }} />
                  <span className="text-xs" style={{ color: 'rgb(239, 68, 68)' }}>+0.2%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-green-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">2</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(22, 163, 74)' }}>
            Observe los parámetros en tiempo real: temperatura, humedad, etileno y CO₂. Las flechas muestran la tendencia
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 3: View process timeline
export const DetailStep3: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <Thermometer className="h-8 w-8" />
              </div>
            </div>
          </div>
          
          <div className="ring-4 ring-purple-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(147, 51, 234)' }}>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'rgb(15, 23, 42)' }}>
                <Clock className="h-5 w-5 animate-pulse" style={{ color: 'rgb(147, 51, 234)' }} />
                Línea de Tiempo del Proceso
              </h3>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5" style={{ backgroundColor: 'rgb(226, 232, 240)' }} />
                
                <div className="space-y-4">
                  <div className="relative pl-12 pb-4">
                    <div className="absolute left-2.5 top-1 h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(34, 197, 94)' }} />
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(240, 253, 244)', border: '1px solid rgb(187, 247, 208)' }}>
                      <p className="font-medium text-sm" style={{ color: 'rgb(22, 163, 74)' }}>
                        Maduración - En Progreso
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'rgb(100, 116, 139)' }}>65% • 28h restantes</p>
                    </div>
                  </div>
                  
                  <div className="relative pl-12 pb-4">
                    <div className="absolute left-2.5 top-1 h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(226, 232, 240)' }} />
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(248, 250, 252)', border: '1px solid rgb(226, 232, 240)' }}>
                      <p className="font-medium text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                        Ventilación - Pendiente
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'rgb(100, 116, 139)' }}>0% • Iniciará en 28h</p>
                    </div>
                  </div>
                  
                  <div className="relative pl-12">
                    <div className="absolute left-2.5 top-1 h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(226, 232, 240)' }} />
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(248, 250, 252)', border: '1px solid rgb(226, 232, 240)' }}>
                      <p className="font-medium text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                        Enfriamiento - Pendiente
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'rgb(100, 116, 139)' }}>0% • Iniciará en 32h</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-purple-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-sm font-bold flex-shrink-0">3</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>
            Revise la línea de tiempo del proceso. Vea la fase actual (verde) y las fases pendientes (gris)
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 4: Switch to Analysis tab
export const DetailStep4: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="flex items-center justify-between mb-4 opacity-30">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>REEFER-001</h1>
              </div>
              <div className="px-4 py-2 rounded-full text-sm font-medium">
                Activo
              </div>
            </div>
            <div className="flex gap-2 border-b relative" style={{ borderColor: 'rgb(226, 232, 240)' }}>
              <button className="px-4 py-2 text-sm font-medium opacity-50" style={{ color: 'rgb(100, 116, 139)' }}>
                Operación
              </button>
              <div className="relative ring-4 ring-orange-500 ring-offset-2 rounded-t-lg">
                <button className="px-4 py-2 text-sm font-medium border-b-2 transform scale-105" style={{ borderColor: 'rgb(37, 99, 235)', color: 'rgb(37, 99, 235)', backgroundColor: 'rgb(239, 246, 255)' }}>
                  Análisis
                </button>
                <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                  <MousePointer2 className="h-7 w-7 text-orange-600 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-orange-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-orange-600 text-white text-sm font-bold flex-shrink-0">4</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(234, 88, 12)' }}>
            Cambie a la pestaña "Análisis" para ver gráficos históricos y tendencias de los parámetros
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 5: View historical charts
export const DetailStep5: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[800px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm">Operación</button>
              <button className="px-4 py-2 text-sm">Análisis</button>
            </div>
          </div>
          
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <HistoricalTemperatureChart 
              title="Gráfica de Temperatura - Últimas 24 Horas"
              description="Monitoreo continuo de temperatura con mediciones cada 2 horas"
              highlightColor="rgb(37, 99, 235)"
            />
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">5</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Visualice la gráfica histórica de temperatura con estadísticas detalladas: promedio, máximo, mínimo y desviación estándar
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 6: View multi-parameter chart
export const DetailStep6: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[800px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
            <MultiParameterChart 
              title="Gráfica Comparativa de Todos los Parámetros"
              description="Visualización simultánea de temperatura, humedad, etileno y CO₂ para análisis correlacional"
              highlightColor="rgb(34, 197, 94)"
            />
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-green-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">6</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(22, 163, 74)' }}>
            Analice todos los parámetros en una sola gráfica para identificar patrones y correlaciones entre temperatura, humedad, etileno y CO₂
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 7: View data table
export const DetailStep7: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[900px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="ring-4 ring-purple-500 ring-offset-4 rounded-lg">
            <DataTable highlightColor="rgb(147, 51, 234)" />
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-purple-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-sm font-bold flex-shrink-0">7</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>
            Revise la tabla de datos históricos con todas las mediciones registradas. Incluye indicadores de tendencia y resumen estadístico
          </p>
        </div>
      </div>
    </div>
  );
};