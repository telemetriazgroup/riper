import React from 'react';
import { LayoutDashboard, Activity, AlertCircle, CheckCircle, Clock, MousePointer2, TrendingUp, Thermometer } from 'lucide-react';

// Step 1: View dashboard overview
export const DashboardStep1: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                    <LayoutDashboard className="h-6 w-6" style={{ color: 'rgb(37, 99, 235)' }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>Panel de Control</h1>
                    <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                      Bienvenido, Administrador
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                    Sistema Operativo
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">1</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Después de iniciar sesión, verá el panel de control principal con el encabezado que muestra su nombre de usuario y el estado del sistema
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 2: Review statistics cards
export const DashboardStep2: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h1 className="text-2xl font-bold">Panel de Control</h1>
            </div>
          </div>

          <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(34, 197, 94)' }}>
              <div className="rounded-lg p-4 transform scale-105" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                <div className="flex items-center justify-between mb-2">
                  <Activity className="h-8 w-8 animate-pulse" style={{ color: 'rgb(37, 99, 235)' }} />
                  <TrendingUp className="h-4 w-4" style={{ color: 'rgb(34, 197, 94)' }} />
                </div>
                <p className="text-2xl font-bold mb-1" style={{ color: 'rgb(15, 23, 42)' }}>12</p>
                <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>Dispositivos Activos</p>
              </div>

              <div className="rounded-lg p-4 transform scale-105" style={{ backgroundColor: 'rgb(240, 253, 244)' }}>
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="h-8 w-8 animate-pulse" style={{ color: 'rgb(34, 197, 94)' }} />
                  <span className="text-xs font-medium" style={{ color: 'rgb(34, 197, 94)' }}>+2</span>
                </div>
                <p className="text-2xl font-bold mb-1" style={{ color: 'rgb(15, 23, 42)' }}>8</p>
                <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>Procesos Completados</p>
              </div>

              <div className="rounded-lg p-4 transform scale-105" style={{ backgroundColor: 'rgb(254, 243, 199)' }}>
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="h-8 w-8 animate-pulse" style={{ color: 'rgb(234, 88, 12)' }} />
                  <span className="text-xs font-medium" style={{ color: 'rgb(234, 88, 12)' }}>!</span>
                </div>
                <p className="text-2xl font-bold mb-1" style={{ color: 'rgb(15, 23, 42)' }}>3</p>
                <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>Alertas Pendientes</p>
              </div>

              <div className="rounded-lg p-4 transform scale-105" style={{ backgroundColor: 'rgb(240, 249, 255)' }}>
                <div className="flex items-center justify-between mb-2">
                  <Clock className="h-8 w-8 animate-pulse" style={{ color: 'rgb(14, 165, 233)' }} />
                  <span className="text-xs font-medium" style={{ color: 'rgb(14, 165, 233)' }}>→</span>
                </div>
                <p className="text-2xl font-bold mb-1" style={{ color: 'rgb(15, 23, 42)' }}>4</p>
                <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>En Proceso</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-green-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">2</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(22, 163, 74)' }}>
            Revise las tarjetas de estadísticas que muestran: dispositivos activos, procesos completados, alertas pendientes y procesos en curso
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 3: Select a device
export const DashboardStep3: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>12 Activos</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>Dispositivos</h2>
            
            <div className="ring-4 ring-purple-500 ring-offset-4 rounded-lg">
              <div className="rounded-lg p-6 transform scale-105" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(147, 51, 234)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                      <Thermometer className="h-8 w-8" style={{ color: 'rgb(37, 99, 235)' }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
                        REEFER-001
                      </h3>
                      <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                        Madurador Norte A - Mango Kent
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                    <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(22, 163, 74)' }} />
                    Activo
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Temperatura</p>
                    <p className="text-lg font-bold" style={{ color: 'rgb(239, 68, 68)' }}>20.2°C</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Humedad</p>
                    <p className="text-lg font-bold" style={{ color: 'rgb(34, 197, 94)' }}>89%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Etileno</p>
                    <p className="text-lg font-bold" style={{ color: 'rgb(234, 88, 12)' }}>98 ppm</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>CO₂</p>
                    <p className="text-lg font-bold" style={{ color: 'rgb(147, 51, 234)' }}>2.8%</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                <MousePointer2 className="h-8 w-8 text-purple-600 animate-pulse" />
              </div>
            </div>

            <div className="opacity-30">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>REEFER-002 - Palta Hass</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-purple-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-sm font-bold flex-shrink-0">3</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>
            Haga clic en una tarjeta de dispositivo para ver sus detalles completos. Cada tarjeta muestra el ID, producto, estado y parámetros en tiempo real
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 4: View process progress
export const DashboardStep4: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <p>REEFER-001</p>
            </div>
          </div>

          <div className="ring-4 ring-orange-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(234, 88, 12)' }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'rgb(15, 23, 42)' }}>
                <Activity className="h-5 w-5 animate-pulse" style={{ color: 'rgb(234, 88, 12)' }} />
                Progreso del Proceso
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(15, 23, 42)' }}>Receta: Mango Kent Standard</p>
                    <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                      Fase actual: Maduración (2 de 4)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold animate-pulse" style={{ color: 'rgb(234, 88, 12)' }}>65%</p>
                    <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>28h restantes</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="h-3 rounded-full" style={{ backgroundColor: 'rgb(226, 232, 240)' }}>
                    <div 
                      className="h-full rounded-full animate-pulse" 
                      style={{ backgroundColor: 'rgb(234, 88, 12)', width: '65%' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgb(220, 252, 231)' }}>
                    <p className="font-medium" style={{ color: 'rgb(22, 163, 74)' }}>✓ Homog.</p>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgb(254, 243, 199)' }}>
                    <p className="font-medium" style={{ color: 'rgb(234, 88, 12)' }}>→ Madur.</p>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgb(241, 245, 249)' }}>
                    <p className="font-medium" style={{ color: 'rgb(100, 116, 139)' }}>⋯ Ventil.</p>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgb(241, 245, 249)' }}>
                    <p className="font-medium" style={{ color: 'rgb(100, 116, 139)' }}>⋯ Enfriam.</p>
                  </div>
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
            En la sección de progreso, vea el estado actual del proceso: porcentaje completado, tiempo restante y fases (homogeneización, maduración, ventilación, enfriamiento)
          </p>
        </div>
      </div>
    </div>
  );
};
