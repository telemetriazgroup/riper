import React from 'react';
import { Activity, Calendar, CheckCircle, Clock, Eye, Filter, MousePointer2, Search, TrendingUp } from 'lucide-react';
import { useManualT } from './userManualI18n';
import { ManualCallout } from './ManualCallout';
import { useSettings } from '@/app/contexts/SettingsContext';

// Step 1: Access process list
export const ProcessStep1: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

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
                      {mt('manual_ui_process_history')}
                    </h1>
                    <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                      24 {t('process')} registrados
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                    8 {t('completed')}
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgb(239, 246, 255)', color: 'rgb(37, 99, 235)' }}>
                    3 {mt('manual_ui_active')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="opacity-20">
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>{t('process')} 1</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>{t('process')} 2</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={1} variant="blue">{mt('manual_process_1_callout')}</ManualCallout>
    </div>
  );
};

// Step 2: Filter processes
export const ProcessStep2: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h1 className="text-2xl font-bold">{mt('manual_ui_process_history')}</h1>
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
                    {mt('manual_ui_filter')}
                  </button>
                  <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                    <MousePointer2 className="h-7 w-7 text-green-600 animate-pulse" />
                  </div>
                </div>
                <select className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(226, 232, 240)' }}>
                  <option>Todos los Estados</option>
                  <option>{mt('manual_ui_active')}</option>
                  <option>{t('completed')}</option>
                  <option>Pausados</option>
                  <option>Con Errores</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={2} variant="green">{mt('manual_process_2_callout')}</ManualCallout>
    </div>
  );
};

// Step 3: View process details
export const ProcessStep3: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="flex gap-4">
              <input type="text" className="flex-1 px-4 py-2 rounded-lg" />
              <button className="px-4 py-2 rounded-lg">{mt('manual_ui_filter')}</button>
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
                        ✓ {t('completed')}
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
                          {t('duration')}: 92 horas
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" style={{ color: 'rgb(34, 197, 94)' }} />
                        <span style={{ color: 'rgb(34, 197, 94)' }}>
                          {t('recipe')}: Mango Kent Standard
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
                    {mt('manual_ui_view_details')}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4" style={{ color: 'rgb(34, 197, 94)' }} />
                    <span className="text-xs font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
                      Progreso Total del {t('process')}
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
      <ManualCallout step={3} variant="purple">{mt('manual_process_3_callout')}</ManualCallout>
    </div>
  );
};
