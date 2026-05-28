import React from 'react';
import { LayoutDashboard, Activity, AlertCircle, CheckCircle, Clock, MousePointer2, TrendingUp, Thermometer } from 'lucide-react';
import { useManualT } from './userManualI18n';
import { ManualCallout } from './ManualCallout';
import { useSettings } from '@/app/contexts/SettingsContext';

// Step 1: View dashboard overview
export const DashboardStep1: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

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
                    <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>{t('dashboard')}</h1>
                    <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                      {mt('manual_ui_welcome_admin')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                    {mt('manual_ui_system_operational')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={1} variant="blue">{mt('manual_dashboard_1_callout')}</ManualCallout>
    </div>
  );
};

// Step 2: Review statistics cards
export const DashboardStep2: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
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
                <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>{mt('manual_ui_devices')} {mt('manual_ui_active')}</p>
              </div>

              <div className="rounded-lg p-4 transform scale-105" style={{ backgroundColor: 'rgb(240, 253, 244)' }}>
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="h-8 w-8 animate-pulse" style={{ color: 'rgb(34, 197, 94)' }} />
                  <span className="text-xs font-medium" style={{ color: 'rgb(34, 197, 94)' }}>+2</span>
                </div>
                <p className="text-2xl font-bold mb-1" style={{ color: 'rgb(15, 23, 42)' }}>8</p>
                <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>{t('process')} {t('completed')}</p>
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
                <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>En {t('process')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={2} variant="green">{mt('manual_dashboard_2_callout')}</ManualCallout>
    </div>
  );
};

// Step 3: Select a device
export const DashboardStep3: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>12 {mt('manual_ui_active')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>{mt('manual_ui_devices')}</h2>
            
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
                    {mt('manual_ui_active')}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>{t('temperature')}</p>
                    <p className="text-lg font-bold" style={{ color: 'rgb(239, 68, 68)' }}>20.2°C</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>{t('humidity')}</p>
                    <p className="text-lg font-bold" style={{ color: 'rgb(34, 197, 94)' }}>89%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>{t('ethylene')}</p>
                    <p className="text-lg font-bold" style={{ color: 'rgb(234, 88, 12)' }}>98 ppm</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>{t('co2')}</p>
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
      <ManualCallout step={3} variant="purple">{mt('manual_dashboard_3_callout')}</ManualCallout>
    </div>
  );
};

// Step 4: View process progress
export const DashboardStep4: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

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
                Progreso del {t('process')}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(15, 23, 42)' }}>{t('recipe')}: Mango Kent Standard</p>
                    <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                      Fase actual: {t('ripening')} (2 de 4)
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
                    <p className="font-medium" style={{ color: 'rgb(22, 163, 74)' }}>✓ {t('homogenization').slice(0, 5)}.</p>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgb(254, 243, 199)' }}>
                    <p className="font-medium" style={{ color: 'rgb(234, 88, 12)' }}>→ {t('ripening').slice(0, 5)}.</p>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgb(241, 245, 249)' }}>
                    <p className="font-medium" style={{ color: 'rgb(100, 116, 139)' }}>⋯ {t('ventilation').slice(0, 5)}.</p>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgb(241, 245, 249)' }}>
                    <p className="font-medium" style={{ color: 'rgb(100, 116, 139)' }}>⋯ {t('cooling').slice(0, 7)}.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={4} variant="orange">{mt('manual_dashboard_4_callout')}</ManualCallout>
    </div>
  );
};
