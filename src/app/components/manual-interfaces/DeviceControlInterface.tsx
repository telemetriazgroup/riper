import React, { useState } from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { Thermometer, Droplets, Leaf, Wind, Play, Pause, Square, RotateCcw, Save, AlertTriangle } from 'lucide-react';

export const DeviceControlInterface: React.FC = () => {
  const { t } = useSettings();
  const [temperature, setTemperature] = useState(20);
  const [humidity, setHumidity] = useState(85);
  const [ethylene, setEthylene] = useState(100);
  const [ventilation, setVentilation] = useState(50);
  const [isRunning, setIsRunning] = useState(true);

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgb(15, 23, 42)' }}>
                {t('language') === 'es' ? 'Control de Dispositivo' : 'Device Control'}
              </h1>
              <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>REEFER-001 - Madurador Norte A</p>
            </div>
            <div
              className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
              style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)', border: '1px solid rgb(187, 247, 208)' }}
            >
              <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(22, 163, 74)' }} />
              {t('language') === 'es' ? 'Activo' : 'Active'}
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setIsRunning(true)}
            className="p-4 rounded-lg shadow-sm transition-all"
            style={{ 
              backgroundColor: isRunning ? 'rgb(34, 197, 94)' : 'rgb(255, 255, 255)', 
              color: isRunning ? 'rgb(255, 255, 255)' : 'rgb(100, 116, 139)',
              border: '1px solid rgb(226, 232, 240)'
            }}
          >
            <Play className="h-6 w-6 mx-auto mb-2" />
            <span className="text-sm font-medium">{t('language') === 'es' ? 'Iniciar' : 'Start'}</span>
          </button>

          <button
            onClick={() => setIsRunning(false)}
            className="p-4 rounded-lg shadow-sm transition-all"
            style={{ 
              backgroundColor: !isRunning ? 'rgb(234, 88, 12)' : 'rgb(255, 255, 255)', 
              color: !isRunning ? 'rgb(255, 255, 255)' : 'rgb(100, 116, 139)',
              border: '1px solid rgb(226, 232, 240)'
            }}
          >
            <Pause className="h-6 w-6 mx-auto mb-2" />
            <span className="text-sm font-medium">{t('language') === 'es' ? 'Pausar' : 'Pause'}</span>
          </button>

          <button
            className="p-4 rounded-lg shadow-sm transition-all"
            style={{ backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(100, 116, 139)', border: '1px solid rgb(226, 232, 240)' }}
          >
            <Square className="h-6 w-6 mx-auto mb-2" />
            <span className="text-sm font-medium">{t('language') === 'es' ? 'Detener' : 'Stop'}</span>
          </button>

          <button
            className="p-4 rounded-lg shadow-sm transition-all"
            style={{ backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(100, 116, 139)', border: '1px solid rgb(226, 232, 240)' }}
          >
            <RotateCcw className="h-6 w-6 mx-auto mb-2" />
            <span className="text-sm font-medium">{t('language') === 'es' ? 'Reiniciar' : 'Reset'}</span>
          </button>
        </div>

        {/* Temperature Control */}
        <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
              <Thermometer className="h-6 w-6" style={{ color: 'rgb(37, 99, 235)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>{t('temperature')}</h3>
              <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                {t('language') === 'es' ? 'Rango: 5°C - 25°C' : 'Range: 5°C - 25°C'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: 'rgb(37, 99, 235)' }}>{temperature}°C</p>
            </div>
          </div>
          <input
            type="range"
            min="5"
            max="25"
            value={temperature}
            onChange={(e) => setTemperature(parseInt(e.target.value))}
            className="w-full h-3 rounded-lg appearance-none cursor-pointer"
            style={{ 
              background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${((temperature - 5) / 20) * 100}%, rgb(226, 232, 240) ${((temperature - 5) / 20) * 100}%, rgb(226, 232, 240) 100%)`
            }}
          />
          <div className="flex justify-between text-xs mt-2" style={{ color: 'rgb(100, 116, 139)' }}>
            <span>5°C</span>
            <span>15°C</span>
            <span>25°C</span>
          </div>
        </div>

        {/* Humidity Control */}
        <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(240, 253, 244)' }}>
              <Droplets className="h-6 w-6" style={{ color: 'rgb(34, 197, 94)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>{t('humidity')}</h3>
              <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                {t('language') === 'es' ? 'Rango: 70% - 95%' : 'Range: 70% - 95%'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: 'rgb(34, 197, 94)' }}>{humidity}%</p>
            </div>
          </div>
          <input
            type="range"
            min="70"
            max="95"
            value={humidity}
            onChange={(e) => setHumidity(parseInt(e.target.value))}
            className="w-full h-3 rounded-lg appearance-none cursor-pointer"
            style={{ 
              background: `linear-gradient(to right, rgb(34, 197, 94) 0%, rgb(34, 197, 94) ${((humidity - 70) / 25) * 100}%, rgb(226, 232, 240) ${((humidity - 70) / 25) * 100}%, rgb(226, 232, 240) 100%)`
            }}
          />
          <div className="flex justify-between text-xs mt-2" style={{ color: 'rgb(100, 116, 139)' }}>
            <span>70%</span>
            <span>82%</span>
            <span>95%</span>
          </div>
        </div>

        {/* Ethylene Control */}
        <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
              <Leaf className="h-6 w-6" style={{ color: 'rgb(234, 88, 12)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>{t('ethylene')}</h3>
              <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                {t('language') === 'es' ? 'Rango: 0 - 200 ppm' : 'Range: 0 - 200 ppm'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: 'rgb(234, 88, 12)' }}>{ethylene} ppm</p>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={ethylene}
            onChange={(e) => setEthylene(parseInt(e.target.value))}
            className="w-full h-3 rounded-lg appearance-none cursor-pointer"
            style={{ 
              background: `linear-gradient(to right, rgb(234, 88, 12) 0%, rgb(234, 88, 12) ${(ethylene / 200) * 100}%, rgb(226, 232, 240) ${(ethylene / 200) * 100}%, rgb(226, 232, 240) 100%)`
            }}
          />
          <div className="flex justify-between text-xs mt-2" style={{ color: 'rgb(100, 116, 139)' }}>
            <span>0 ppm</span>
            <span>100 ppm</span>
            <span>200 ppm</span>
          </div>
        </div>

        {/* Ventilation Control */}
        <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(240, 249, 255)' }}>
              <Wind className="h-6 w-6" style={{ color: 'rgb(14, 165, 233)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>
                {t('language') === 'es' ? 'Ventilación' : 'Ventilation'}
              </h3>
              <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                {t('language') === 'es' ? 'Velocidad del ventilador' : 'Fan speed'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: 'rgb(14, 165, 233)' }}>{ventilation}%</p>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={ventilation}
            onChange={(e) => setVentilation(parseInt(e.target.value))}
            className="w-full h-3 rounded-lg appearance-none cursor-pointer"
            style={{ 
              background: `linear-gradient(to right, rgb(14, 165, 233) 0%, rgb(14, 165, 233) ${ventilation}%, rgb(226, 232, 240) ${ventilation}%, rgb(226, 232, 240) 100%)`
            }}
          />
          <div className="flex justify-between text-xs mt-2" style={{ color: 'rgb(100, 116, 139)' }}>
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            className="flex-1 py-3 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            style={{ backgroundColor: 'rgb(37, 99, 235)', color: 'rgb(255, 255, 255)' }}
          >
            <Save className="h-5 w-5" />
            {t('language') === 'es' ? 'Guardar Configuración' : 'Save Configuration'}
          </button>
        </div>

        {/* Warning */}
        <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(254, 243, 199)', border: '1px solid rgb(253, 224, 71)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'rgb(161, 98, 7)' }} />
            <div className="text-sm" style={{ color: 'rgb(161, 98, 7)' }}>
              <p className="font-medium mb-1">
                {t('language') === 'es' ? 'Precaución' : 'Caution'}
              </p>
              <p>
                {t('language') === 'es' 
                  ? 'Los cambios en los parámetros afectan directamente el proceso de maduración. Asegúrese de que los valores sean apropiados para el producto.'
                  : 'Changes to parameters directly affect the ripening process. Ensure values are appropriate for the product.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
