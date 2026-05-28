import React from 'react';
import { Thermometer, Droplets, Leaf, Wind, Play, Save, MousePointer2, Hand } from 'lucide-react';
import { useManualT } from './userManualI18n';
import { ManualCallout } from './ManualCallout';
import { useSettings } from '@/app/contexts/SettingsContext';

// Step 1: Access device control
export const ControlStep1: React.FC = () => {
  const mt = useManualT();

  return (
    <div className="relative">
      <div className="min-h-[500px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                    {mt('manual_ui_device_control')}
                  </h1>
                  <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>REEFER-001 - Madurador Norte A</p>
                </div>
                <div className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}>
                  <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(22, 163, 74)' }} />
                  {mt('manual_ui_active')}
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
      <ManualCallout step={1} variant="blue">{mt('manual_control_1_callout')}</ManualCallout>
    </div>
  );
};

// Step 2: Adjust temperature
export const ControlStep2: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-lg p-6 opacity-20" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
              {mt('manual_ui_device_control')}
            </h1>
          </div>

          <div className="ring-4 ring-red-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(239, 68, 68)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg animate-pulse" style={{ backgroundColor: 'rgb(254, 242, 242)' }}>
                  <Thermometer className="h-6 w-6" style={{ color: 'rgb(239, 68, 68)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>{t('temperature')}</h3>
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
                  readOnly
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
              <h3>{t('humidity')}</h3>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={2} variant="orange">{mt('manual_control_2_callout')}</ManualCallout>
    </div>
  );
};

// Step 3: Adjust humidity
export const ControlStep3: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

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

          <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(34, 197, 94)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg animate-pulse" style={{ backgroundColor: 'rgb(240, 253, 244)' }}>
                  <Droplets className="h-6 w-6" style={{ color: 'rgb(34, 197, 94)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>{t('relative_humidity')}</h3>
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
                  readOnly
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
              <h3>{t('ethylene')}</h3>
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={3} variant="green">{mt('manual_control_3_callout')}</ManualCallout>
    </div>
  );
};

// Step 4: Adjust ethylene
export const ControlStep4: React.FC = () => {
  const mt = useManualT();
  const { t } = useSettings();

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

          <div className="ring-4 ring-orange-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(234, 88, 12)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg animate-pulse" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                  <Leaf className="h-6 w-6" style={{ color: 'rgb(234, 88, 12)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>{t('ethylene')}</h3>
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
                  readOnly
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
      <ManualCallout step={4} variant="orange">{mt('manual_control_4_callout')}</ManualCallout>
    </div>
  );
};

// Step 5: Save configuration
export const ControlStep5: React.FC = () => {
  const mt = useManualT();

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

          <div className="relative ring-4 ring-purple-500 ring-offset-4 rounded-lg">
            <button
              className="w-full py-4 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transform scale-105"
              style={{ backgroundColor: 'rgb(147, 51, 234)', color: 'rgb(255, 255, 255)', border: '2px solid rgb(147, 51, 234)' }}
            >
              <Save className="h-6 w-6 animate-pulse" />
              <span className="text-lg">
                {mt('manual_ui_save_config')}
              </span>
            </button>
            <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
              <MousePointer2 className="h-8 w-8 text-purple-600 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <ManualCallout step={5} variant="purple">{mt('manual_control_5_callout')}</ManualCallout>
    </div>
  );
};
