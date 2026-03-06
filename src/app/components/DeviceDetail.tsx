import React, { useState } from 'react';
import { useDevice } from '@/app/hooks/useDevices';
import { TelemetryCharts } from './TelemetryCharts';
import { ControlPanel } from './ControlPanel';
import { WeeklySummary } from './WeeklySummary';
import { ArrowLeft, Battery, Thermometer, Calendar, Loader2, BarChart2, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/Button';
import * as Tabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import { useSettings } from '@/app/contexts/SettingsContext';

interface DeviceDetailProps {
  deviceId: string;
  onBack: () => void;
  initialView?: 'operation' | 'analysis';
}

export const DeviceDetail: React.FC<DeviceDetailProps> = ({ deviceId, onBack, initialView = 'operation' }) => {
  const { device, isLoading } = useDevice(deviceId);
  const [controlMode, setControlMode] = useState('manual');
  const [activeView, setActiveView] = useState(initialView);
  const { t, convertTemp, tempUnit } = useSettings();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!device) return <div>{t('device_not_found')}</div>;

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} title={t('back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{device.name}</h2>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              ID: {device.id} • 
              <span className={
                device.status === 'active' ? "text-green-600 font-bold" :
                device.status === 'warning' ? "text-yellow-600 font-bold" :
                device.status === 'alarm' ? "text-red-600 font-bold" : "text-gray-500"
              }>
                {t(`status_${device.status}`).toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex gap-4 text-sm text-gray-600 hidden lg:flex bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
            <div className="flex items-center gap-1">
               <Battery className="h-4 w-4 text-gray-400" /> 
               <span className="font-mono">{device.operational.battery_voltage}V</span>
            </div>
            <div className="w-px h-4 bg-gray-200"></div>
            <div className="flex items-center gap-1">
               <Thermometer className="h-4 w-4 text-gray-400" /> 
               <span className="font-mono">{convertTemp(device.operational.ambient_air)}°{tempUnit}</span>
            </div>
          </div>

          <Tabs.Root value={activeView} onValueChange={(v) => setActiveView(v as any)}>
            <Tabs.List className="flex bg-gray-100 p-1 rounded-lg">
              <Tabs.Trigger 
                value="operation" 
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeView === 'operation' ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">{t('operation')}</span>
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="analysis" 
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeView === 'analysis' ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <BarChart2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t('monitoring')}</span>
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </div>
      </div>

      {/* Main Content Area */}
      {activeView === 'operation' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-in fade-in duration-300">
          {/* Left Column: Control Panel */}
          <div className="lg:col-span-1">
            <ControlPanel mode={controlMode} onChangeMode={setControlMode} />
          </div>

          {/* Right Column: Charts & Info */}
          <div className="lg:col-span-2 space-y-6">
            <TelemetryCharts deviceId={deviceId} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-lg border shadow-sm">
                  <h3 className="font-semibold mb-4 text-gray-800">{t('current_process_status')}</h3>
                  {device.process ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                         <span className="text-gray-500">{t('recipe')}</span>
                         <span className="font-medium text-right">{device.process.name}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-gray-500">{t('phase')}</span>
                         <span className="font-medium text-blue-600">{device.process.currentPhase}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-gray-500">{t('start')}</span>
                         <span className="font-medium">{new Date(device.process.startTime).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-gray-500">{t('estimated_end')}</span>
                         <span className="font-medium">{new Date(device.process.endTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Calendar className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>{t('no_active_process')}</p>
                    </div>
                  )}
               </div>

               <div className="bg-white p-6 rounded-lg border shadow-sm">
                  <h3 className="font-semibold mb-4 text-gray-800">{t('operational_data')}</h3>
                  <div className="space-y-3 text-sm">
                     <div className="flex justify-between border-b border-gray-50 pb-2">
                       <span className="text-gray-500">{t('power_consumption')}</span>
                       <span className="font-mono">{device.operational.power_consumption} kW</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-50 pb-2">
                       <span className="text-gray-500">{t('total_accumulated')}</span>
                       <span className="font-mono">{device.operational.power_kwh} kWh</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-50 pb-2">
                       <span className="text-gray-500">{t('defrost_interval')}</span>
                       <span className="font-mono">{device.operational.defrost_interval}h</span>
                     </div>
                     <div className="flex justify-between pb-2">
                       <span className="text-gray-500">{t('evaporation_coil')}</span>
                       <span className="font-mono">{convertTemp(device.operational.evaporation_coil)}°{tempUnit}</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg border shadow-sm min-h-[600px]">
          <WeeklySummary deviceId={deviceId} />
        </div>
      )}
    </div>
  );
};
