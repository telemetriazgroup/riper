import React from 'react';
import { Activity, Calendar, CheckCircle, Clock, Eye, Filter, MousePointer2, Search, TrendingUp } from 'lucide-react';

// Step 1: Access process list
export const ProcessStep1: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                    <Activity className="h-6 w-6" style={{ color: 'rgb(37, 99, 235)' }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
                      Historial de Procesos
                    </h1>
                    <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                      24 procesos registrados
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                    8 Completados
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgb(239, 246, 255)', color: 'rgb(37, 99, 235)' }}>
                    3 Activos
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="opacity-20">
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>Proceso 1</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>Proceso 2</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">1</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Acceda al historial de procesos desde el menú principal. Verá todos los procesos de maduración completados y actualmente en curso
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 2: Filter processes
export const ProcessStep2: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h1 className="text-2xl font-bold">Historial de Procesos</h1>
            </div>
          </div>

          <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(34, 197, 94)' }}>
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: 'rgb(100, 116, 139)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por dispositivo, producto o receta..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border"
                    style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(226, 232, 240)' }}
                  />
                </div>
                <div className="relative transform scale-110">
                  <button className="px-4 py-2 rounded-lg border-2 flex items-center gap-2 animate-pulse" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(34, 197, 94)', color: 'rgb(22, 163, 74)' }}>
                    <Filter className="h-5 w-5" />
                    Filtrar
                  </button>
                  <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                    <MousePointer2 className="h-7 w-7 text-green-600 animate-pulse" />
                  </div>
                </div>
                <select className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(226, 232, 240)' }}>
                  <option>Todos los Estados</option>
                  <option>Activos</option>
                  <option>Completados</option>
                  <option>Pausados</option>
                  <option>Con Errores</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-green-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">2</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(22, 163, 74)' }}>
            Use los filtros para buscar procesos específicos por estado, fecha, dispositivo REEFER, producto o receta aplicada
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 3: View process details
export const ProcessStep3: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="flex gap-4">
              <input type="text" className="flex-1 px-4 py-2 rounded-lg" />
              <button className="px-4 py-2 rounded-lg">Filtrar</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="ring-4 ring-purple-500 ring-offset-4 rounded-lg">
              <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(147, 51, 234)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg" style={{ color: 'rgb(15, 23, 42)' }}>
                        REEFER-001 - Mango Kent
                      </h3>
                      <div className="px-3 py-1 rounded-full text-xs font-medium animate-pulse" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                        ✓ Completado
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" style={{ color: 'rgb(100, 116, 139)' }} />
                        <span style={{ color: 'rgb(100, 116, 139)' }}>
                          Inicio: 15/02/2026 - 08:00h
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" style={{ color: 'rgb(100, 116, 139)' }} />
                        <span style={{ color: 'rgb(100, 116, 139)' }}>
                          Duración Real: 92 horas
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" style={{ color: 'rgb(34, 197, 94)' }} />
                        <span style={{ color: 'rgb(34, 197, 94)' }}>
                          Receta: Mango Kent Standard
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" style={{ color: 'rgb(37, 99, 235)' }} />
                        <span style={{ color: 'rgb(37, 99, 235)' }}>
                          4 fases completadas exitosamente
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="ml-4 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transform scale-110 animate-pulse" style={{ backgroundColor: 'rgb(147, 51, 234)', color: 'rgb(255, 255, 255)' }}>
                    <Eye className="h-5 w-5" />
                    Ver Detalles
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4" style={{ color: 'rgb(34, 197, 94)' }} />
                    <span className="text-xs font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
                      Progreso Total del Proceso
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: 'rgb(226, 232, 240)' }}>
                      <div className="h-full rounded-full" style={{ backgroundColor: 'rgb(34, 197, 94)', width: '100%' }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'rgb(34, 197, 94)' }}>100%</span>
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                <MousePointer2 className="h-8 w-8 text-purple-600 animate-pulse" />
              </div>
            </div>

            <div className="opacity-30">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>REEFER-002 - Palta Hass - En Progreso 67%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-purple-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-sm font-bold flex-shrink-0">3</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>
            Haga clic en "Ver Detalles" para acceder a la información completa del proceso: fechas exactas, receta utilizada, gráficos históricos de temperatura y gases
          </p>
        </div>
      </div>
    </div>
  );
};
