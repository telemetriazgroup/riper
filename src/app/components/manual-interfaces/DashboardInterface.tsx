import React from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { Activity, AlertTriangle, CheckCircle, Thermometer, Wind, Droplets, Leaf, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const DashboardInterface: React.FC = () => {
  const { t } = useSettings();

  const devices = [
    {
      id: 'REEFER-001',
      name: 'Madurador Norte A',
      status: 'active',
      product: 'Mango Kent',
      temp: 20.2,
      humidity: 89,
      ethylene: 98,
      co2: 2.8,
      phase: t('ripening'),
      progress: 65,
      timeRemaining: '28h'
    },
    {
      id: 'REEFER-002',
      name: 'Madurador Sur B',
      status: 'active',
      product: 'Palta Hass',
      temp: 18.1,
      humidity: 85,
      ethylene: 147,
      co2: 2.3,
      phase: t('ripening'),
      progress: 42,
      timeRemaining: '36h'
    },
    {
      id: 'REEFER-003',
      name: 'Madurador Este C',
      status: 'warning',
      product: 'Plátano',
      temp: 19.8,
      humidity: 91,
      ethylene: 103,
      co2: 3.2,
      phase: t('ripening'),
      progress: 78,
      timeRemaining: '12h'
    },
    {
      id: 'REEFER-004',
      name: 'Madurador Oeste D',
      status: 'idle',
      product: '-',
      temp: 10.0,
      humidity: 70,
      ethylene: 0,
      co2: 0.5,
      phase: t('language') === 'es' ? 'Inactivo' : 'Idle',
      progress: 0,
      timeRemaining: '-'
    },
    {
      id: 'REEFER-005',
      name: 'Madurador Centro E',
      status: 'active',
      product: 'Mango Kent',
      temp: 12.5,
      humidity: 85,
      ethylene: 0,
      co2: 0.5,
      phase: t('cooling'),
      progress: 92,
      timeRemaining: '4h'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'rgb(220, 252, 231)', text: 'rgb(22, 163, 74)', border: 'rgb(187, 247, 208)' };
      case 'warning': return { bg: 'rgb(254, 243, 199)', text: 'rgb(234, 88, 12)', border: 'rgb(253, 224, 71)' };
      case 'idle': return { bg: 'rgb(241, 245, 249)', text: 'rgb(100, 116, 139)', border: 'rgb(203, 213, 225)' };
      default: return { bg: 'rgb(241, 245, 249)', text: 'rgb(100, 116, 139)', border: 'rgb(203, 213, 225)' };
    }
  };

  const getTrendIcon = (value: number, target: number) => {
    if (value > target) return <TrendingUp className="h-4 w-4" style={{ color: 'rgb(234, 88, 12)' }} />;
    if (value < target) return <TrendingDown className="h-4 w-4" style={{ color: 'rgb(37, 99, 235)' }} />;
    return <Minus className="h-4 w-4" style={{ color: 'rgb(34, 197, 94)' }} />;
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'rgb(15, 23, 42)' }}>
            {t('dashboard')}
          </h1>
          <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
            {t('language') === 'es' 
              ? 'Monitoreo en tiempo real de todos los dispositivos' 
              : 'Real-time monitoring of all devices'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg shadow-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
                {t('language') === 'es' ? 'Activos' : 'Active'}
              </span>
              <CheckCircle className="h-5 w-5" style={{ color: 'rgb(34, 197, 94)' }} />
            </div>
            <p className="text-3xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>3</p>
            <p className="text-xs mt-1" style={{ color: 'rgb(34, 197, 94)' }}>
              {t('language') === 'es' ? '60% operativos' : '60% operational'}
            </p>
          </div>

          <div className="p-4 rounded-lg shadow-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
                {t('language') === 'es' ? 'Advertencias' : 'Warnings'}
              </span>
              <AlertTriangle className="h-5 w-5" style={{ color: 'rgb(234, 88, 12)' }} />
            </div>
            <p className="text-3xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>1</p>
            <p className="text-xs mt-1" style={{ color: 'rgb(234, 88, 12)' }}>
              {t('language') === 'es' ? 'CO₂ elevado' : 'High CO₂'}
            </p>
          </div>

          <div className="p-4 rounded-lg shadow-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
                {t('language') === 'es' ? 'Inactivos' : 'Idle'}
              </span>
              <Activity className="h-5 w-5" style={{ color: 'rgb(100, 116, 139)' }} />
            </div>
            <p className="text-3xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>1</p>
            <p className="text-xs mt-1" style={{ color: 'rgb(100, 116, 139)' }}>
              {t('language') === 'es' ? 'Listo para uso' : 'Ready for use'}
            </p>
          </div>

          <div className="p-4 rounded-lg shadow-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
                {t('language') === 'es' ? 'Total' : 'Total'}
              </span>
              <Thermometer className="h-5 w-5" style={{ color: 'rgb(37, 99, 235)' }} />
            </div>
            <p className="text-3xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>5</p>
            <p className="text-xs mt-1" style={{ color: 'rgb(37, 99, 235)' }}>
              {t('language') === 'es' ? 'Dispositivos' : 'Devices'}
            </p>
          </div>
        </div>

        {/* Devices Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {devices.map((device) => {
            const statusColors = getStatusColor(device.status);
            return (
              <div
                key={device.id}
                className="rounded-lg shadow-sm overflow-hidden"
                style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(226, 232, 240)' }}
              >
                {/* Device Header */}
                <div className="p-4 border-b" style={{ borderColor: 'rgb(226, 232, 240)', backgroundColor: 'rgb(248, 250, 252)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>{device.name}</h3>
                      <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>{device.id}</p>
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}
                    >
                      {device.status === 'active' ? (t('language') === 'es' ? 'Activo' : 'Active') :
                       device.status === 'warning' ? (t('language') === 'es' ? 'Advertencia' : 'Warning') :
                       (t('language') === 'es' ? 'Inactivo' : 'Idle')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
                      {t('product')}:
                    </span>
                    <span className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
                      {device.product}
                    </span>
                  </div>
                </div>

                {/* Parameters */}
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                        <Thermometer className="h-5 w-5" style={{ color: 'rgb(37, 99, 235)' }} />
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>{t('temperature')}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-lg font-bold" style={{ color: 'rgb(15, 23, 42)' }}>{device.temp}°C</p>
                          {getTrendIcon(device.temp, 20)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(240, 253, 244)' }}>
                        <Droplets className="h-5 w-5" style={{ color: 'rgb(34, 197, 94)' }} />
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>{t('humidity')}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-lg font-bold" style={{ color: 'rgb(15, 23, 42)' }}>{device.humidity}%</p>
                          {getTrendIcon(device.humidity, 85)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(255, 247, 237)' }}>
                        <Leaf className="h-5 w-5" style={{ color: 'rgb(234, 88, 12)' }} />
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>{t('ethylene')}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-lg font-bold" style={{ color: 'rgb(15, 23, 42)' }}>{device.ethylene} ppm</p>
                          {getTrendIcon(device.ethylene, 100)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(254, 242, 242)' }}>
                        <Wind className="h-5 w-5" style={{ color: 'rgb(239, 68, 68)' }} />
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>CO₂</p>
                        <div className="flex items-center gap-1">
                          <p className="text-lg font-bold" style={{ color: 'rgb(15, 23, 42)' }}>{device.co2}%</p>
                          {getTrendIcon(device.co2, 2.5)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  {device.status !== 'idle' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
                          {device.phase}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
                          {device.progress}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgb(226, 232, 240)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ backgroundColor: 'rgb(37, 99, 235)', width: `${device.progress}%` }}
                        />
                      </div>
                      <p className="text-xs mt-2 text-right" style={{ color: 'rgb(100, 116, 139)' }}>
                        {t('language') === 'es' ? 'Tiempo restante:' : 'Time remaining:'} {device.timeRemaining}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
