import React from 'react';
import { 
  LayoutDashboard, 
  Thermometer, 
  Wind, 
  Droplets, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Power,
  BookOpen,
  Users,
  User,
  Mail,
  Phone,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar
} from 'lucide-react';
import { useSettings } from '@/app/contexts/SettingsContext';

// Login Screenshot
export const LoginScreenshot: React.FC = () => {
  const { t } = useSettings();
  return (
    <div className="w-full bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-lg">
      <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">RM</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">Reefer Manager</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">
          {t('welcome_back')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 text-center">
          {t('enter_credentials')}
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('email_label')}
            </label>
            <input
              type="email"
              placeholder="usuario@empresa.com"
              className="w-full px-4 py-2 border-2 border-slate-800 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('password')}
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 border-2 border-slate-800 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              disabled
            />
          </div>
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700">
            {t('login_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Dashboard Screenshot
export const DashboardScreenshot: React.FC = () => {
  const { t, formatTemp } = useSettings();
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{t('active_units')}</span>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">3/5</div>
          <p className="text-xs text-muted-foreground mt-1">{t('of_total', { total: '5' })}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{t('active_alarms')}</span>
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">2</div>
          <p className="text-xs text-muted-foreground mt-1">{t('require_attention')}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{t('completed_processes')}</span>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">47</div>
          <p className="text-xs text-muted-foreground mt-1">{t('this_week')}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{t('total_consumption')}</span>
            <Activity className="h-5 w-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">2,847</div>
          <p className="text-xs text-muted-foreground mt-1">kWh</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card border-2 border-green-500 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">REEFER-001</h3>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full">
              {t('status_active')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
            <div>
              <span className="text-muted-foreground">Temp:</span>
              <span className="ml-1 font-medium text-foreground">{formatTemp(18.5)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hum:</span>
              <span className="ml-1 font-medium text-foreground">85%</span>
            </div>
            <div>
              <span className="text-muted-foreground">C₂H₄:</span>
              <span className="ml-1 font-medium text-foreground">100 ppm</span>
            </div>
            <div>
              <span className="text-muted-foreground">CO₂:</span>
              <span className="ml-1 font-medium text-foreground">2.5%</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('recipe')}: Mango Kent • {t('ripening')}
          </div>
        </div>
        <div className="bg-card border-2 border-orange-500 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">REEFER-002</h3>
            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs rounded-full">
              {t('status_warning')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
            <div>
              <span className="text-muted-foreground">Temp:</span>
              <span className="ml-1 font-medium text-foreground">{formatTemp(22.3)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hum:</span>
              <span className="ml-1 font-medium text-foreground">78%</span>
            </div>
            <div>
              <span className="text-muted-foreground">C₂H₄:</span>
              <span className="ml-1 font-medium text-foreground">150 ppm</span>
            </div>
            <div>
              <span className="text-muted-foreground">CO₂:</span>
              <span className="ml-1 font-medium text-foreground">3.2%</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('recipe')}: Palta Hass • {t('ventilation')}
          </div>
        </div>
        <div className="bg-card border-2 border-blue-500 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">REEFER-003</h3>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
              {t('homogenization')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
            <div>
              <span className="text-muted-foreground">Temp:</span>
              <span className="ml-1 font-medium text-foreground">{formatTemp(20.0)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hum:</span>
              <span className="ml-1 font-medium text-foreground">90%</span>
            </div>
            <div>
              <span className="text-muted-foreground">C₂H₄:</span>
              <span className="ml-1 font-medium text-foreground">0 ppm</span>
            </div>
            <div>
              <span className="text-muted-foreground">CO₂:</span>
              <span className="ml-1 font-medium text-foreground">0.5%</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('recipe')}: Plátano • {t('homogenization')}
          </div>
        </div>
      </div>
    </div>
  );
};

// Device Control Screenshot
export const DeviceControlScreenshot: React.FC = () => {
  const { t, formatTemp } = useSettings();
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{t('device_status')}</h3>
          <div className="flex items-center gap-2">
            <Power className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">{t('status_powered_on')}</span>
          </div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {t('current_values')}
            </span>
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-blue-700 dark:text-blue-300">{t('temperature')}:</span>
              <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">{formatTemp(18.2)}</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">{t('humidity')}:</span>
              <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">86%</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">{t('ethylene')}:</span>
              <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">98 ppm</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">CO₂:</span>
              <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">2.4%</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('target_temperature')} (°C)
            </label>
            <input
              type="number"
              value="18.0"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">Rango: 5°C - 25°C</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('relative_humidity')} (%)
            </label>
            <input
              type="number"
              value="85"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">Rango: 70% - 95%</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('ethylene_injection')} (ppm)
            </label>
            <input
              type="number"
              value="100"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">Rango: 0 - 200 ppm</p>
          </div>
        </div>
        
        <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium">
          {t('apply_changes')}
        </button>
      </div>
    </div>
  );
};

// Device Detail Screenshot with 12-hour data
export const DeviceDetailScreenshot: React.FC = () => {
  const { t, formatTemp } = useSettings();
  
  // Simulated 12-hour data points (every 30 minutes = 24 points)
  const last12Hours = Array.from({ length: 24 }, (_, i) => {
    const hoursAgo = 12 - (i * 0.5);
    const temp = 18.5 + Math.sin(i * 0.3) * 1.2;
    const humidity = 85 + Math.sin(i * 0.4) * 5;
    const co2 = 2.5 + Math.cos(i * 0.2) * 0.8;
    return {
      time: `${Math.floor(hoursAgo)}:${(hoursAgo % 1) * 60 === 0 ? '00' : '30'}`,
      temp: temp.toFixed(1),
      humidity: humidity.toFixed(0),
      co2: co2.toFixed(1)
    };
  }).reverse();
  
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-16 w-16 bg-blue-600 rounded-lg flex items-center justify-center">
          <Thermometer className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">REEFER-001</h2>
          <p className="text-sm text-muted-foreground">{t('current_process_status')}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">{t('temperature')}</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{formatTemp(18.5)}</div>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span className="text-xs text-green-600">+0.3°C (1h)</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">{t('humidity')}</span>
          </div>
          <div className="text-2xl font-bold text-foreground">85%</div>
          <div className="flex items-center gap-1 mt-1">
            <TrendingDown className="h-3 w-3 text-red-600" />
            <span className="text-xs text-red-600">-2% (1h)</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wind className="h-5 w-5 text-green-600" />
            <span className="text-sm text-muted-foreground">{t('ethylene')}</span>
          </div>
          <div className="text-2xl font-bold text-foreground">100 ppm</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-muted-foreground">Estable (1h)</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-orange-600" />
            <span className="text-sm text-muted-foreground">{t('co2')}</span>
          </div>
          <div className="text-2xl font-bold text-foreground">2.5%</div>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span className="text-xs text-green-600">+0.2% (1h)</span>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">{t('recipe')}: Mango Kent Exportación</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">{t('phase')}: {t('ripening')} - Hora 32 de 48</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">67%</div>
            <p className="text-xs text-blue-700 dark:text-blue-300">{t('estimated_progress')}</p>
          </div>
        </div>
        <div className="mt-3 bg-blue-200 dark:bg-blue-900 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '67%' }}></div>
        </div>
      </div>
      
      {/* 12-hour data table */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          {t('language') === 'es' ? 'Últimas 12 Horas' : 'Last 12 Hours'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 text-muted-foreground">{t('language') === 'es' ? 'Hora' : 'Time'}</th>
                <th className="text-left p-2 text-muted-foreground">{t('temperature')}</th>
                <th className="text-left p-2 text-muted-foreground">{t('humidity')}</th>
                <th className="text-left p-2 text-muted-foreground">CO₂</th>
              </tr>
            </thead>
            <tbody>
              {last12Hours.slice(0, 8).map((point, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2 text-foreground">{point.time}h</td>
                  <td className="p-2 text-foreground">{formatTemp(parseFloat(point.temp))}</td>
                  <td className="p-2 text-foreground">{point.humidity}%</td>
                  <td className="p-2 text-foreground">{point.co2}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {t('language') === 'es' ? 'Mostrando 8 de 24 registros' : 'Showing 8 of 24 records'}
        </p>
      </div>
    </div>
  );
};

// Monitoring Screenshot with real chart
export const MonitoringScreenshot: React.FC = () => {
  const { t, formatTemp } = useSettings();
  
  // Simulated 48-hour ripening process data
  const processData = [
    // Homogenization phase (0-24h)
    { hour: 0, temp: 20.0, humidity: 90, ethylene: 0, co2: 0.5, phase: 'Homogenization' },
    { hour: 6, temp: 20.1, humidity: 90, ethylene: 0, co2: 0.5, phase: 'Homogenization' },
    { hour: 12, temp: 20.0, humidity: 89, ethylene: 0, co2: 0.5, phase: 'Homogenization' },
    { hour: 18, temp: 20.1, humidity: 90, ethylene: 0, co2: 0.6, phase: 'Homogenization' },
    { hour: 24, temp: 20.0, humidity: 90, ethylene: 0, co2: 0.5, phase: 'Homogenization' },
    // Ripening phase (24-72h)
    { hour: 30, temp: 20.0, humidity: 85, ethylene: 100, co2: 1.5, phase: 'Ripening' },
    { hour: 36, temp: 20.2, humidity: 85, ethylene: 100, co2: 2.0, phase: 'Ripening' },
    { hour: 42, temp: 20.1, humidity: 84, ethylene: 100, co2: 2.5, phase: 'Ripening' },
    { hour: 48, temp: 20.0, humidity: 85, ethylene: 100, co2: 2.8, phase: 'Ripening' },
    { hour: 54, temp: 20.1, humidity: 85, ethylene: 100, co2: 3.0, phase: 'Ripening' },
    { hour: 60, temp: 20.0, humidity: 85, ethylene: 100, co2: 2.9, phase: 'Ripening' },
    { hour: 66, temp: 20.1, humidity: 85, ethylene: 100, co2: 2.8, phase: 'Ripening' },
    { hour: 72, temp: 20.0, humidity: 85, ethylene: 100, co2: 2.7, phase: 'Ripening' },
    // Ventilation phase (72-80h)
    { hour: 74, temp: 18.0, humidity: 80, ethylene: 50, co2: 2.0, phase: 'Ventilation' },
    { hour: 76, temp: 18.0, humidity: 80, ethylene: 20, co2: 1.2, phase: 'Ventilation' },
    { hour: 78, temp: 18.0, humidity: 80, ethylene: 5, co2: 0.8, phase: 'Ventilation' },
    { hour: 80, temp: 18.0, humidity: 80, ethylene: 0, co2: 0.5, phase: 'Ventilation' },
    // Cooling phase (80-92h)
    { hour: 84, temp: 15.0, humidity: 85, ethylene: 0, co2: 0.5, phase: 'Cooling' },
    { hour: 88, temp: 12.0, humidity: 85, ethylene: 0, co2: 0.5, phase: 'Cooling' },
    { hour: 92, temp: 10.0, humidity: 85, ethylene: 0, co2: 0.5, phase: 'Cooling' },
  ];
  
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground mb-2">{t('historical_data')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('language') === 'es' 
            ? 'Proceso de Maduración Mango Kent - 92 horas completas' 
            : 'Mango Kent Ripening Process - 92 complete hours'}
        </p>
      </div>
      
      <div className="bg-card border border-border rounded-lg p-6">
        {/* Chart Title */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(37, 99, 235)' }}></div>
              <span className="text-xs text-muted-foreground">{t('temperature')} (°C)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(34, 197, 94)' }}></div>
              <span className="text-xs text-muted-foreground">{t('humidity')} (%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(249, 115, 22)' }}></div>
              <span className="text-xs text-muted-foreground">{t('ethylene')} (ppm)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(239, 68, 68)' }}></div>
              <span className="text-xs text-muted-foreground">CO₂ (%)</span>
            </div>
          </div>
        </div>
        
        {/* Visual Chart Area */}
        <div className="relative h-80 border-2 rounded-lg p-4" style={{ borderColor: 'rgb(226, 232, 240)', backgroundColor: 'rgb(255, 255, 255)' }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs" style={{ color: 'rgb(100, 116, 139)' }}>
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>
          
          {/* Phase backgrounds */}
          <div className="absolute left-10 right-4 top-4 bottom-8 flex" style={{ zIndex: 1 }}>
            <div className="flex-1 border-r border-dashed flex items-end justify-center pb-2" style={{ backgroundColor: 'rgb(239, 246, 255)', borderColor: 'rgb(147, 197, 253)' }}>
              <span className="text-xs font-medium" style={{ color: 'rgb(37, 99, 235)' }}>{t('homogenization')}</span>
            </div>
            <div className="flex-[2] border-r border-dashed flex items-end justify-center pb-2" style={{ backgroundColor: 'rgb(240, 253, 244)', borderColor: 'rgb(134, 239, 172)' }}>
              <span className="text-xs font-medium" style={{ color: 'rgb(22, 163, 74)' }}>{t('ripening')}</span>
            </div>
            <div className="flex-[0.3] border-r border-dashed flex items-end justify-center pb-2" style={{ backgroundColor: 'rgb(255, 247, 237)', borderColor: 'rgb(253, 186, 116)' }}>
              <span className="text-xs font-medium" style={{ color: 'rgb(234, 88, 12)' }}>{t('ventilation')}</span>
            </div>
            <div className="flex-[0.5] flex items-end justify-center pb-2" style={{ backgroundColor: 'rgb(250, 245, 255)' }}>
              <span className="text-xs font-medium" style={{ color: 'rgb(147, 51, 234)' }}>{t('cooling')}</span>
            </div>
          </div>
          
          {/* Temperature line (blue) */}
          <svg className="absolute left-10 right-4 top-4 bottom-8" style={{ width: 'calc(100% - 56px)', height: 'calc(100% - 48px)', zIndex: 10 }}>
            <polyline
              points={processData.map((d, i) => {
                const x = (i / (processData.length - 1)) * 100;
                const y = 100 - (d.temp / 25) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="rgb(37, 99, 235)"
              strokeWidth="2"
            />
            {/* Ethylene line (orange) */}
            <polyline
              points={processData.map((d, i) => {
                const x = (i / (processData.length - 1)) * 100;
                const y = 100 - (d.ethylene / 200) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="rgb(249, 115, 22)"
              strokeWidth="2"
            />
            {/* CO2 line (red) - scaled x10 for visibility */}
            <polyline
              points={processData.map((d, i) => {
                const x = (i / (processData.length - 1)) * 100;
                const y = 100 - ((d.co2 * 10) / 100) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="rgb(239, 68, 68)"
              strokeWidth="2"
              strokeDasharray="4,2"
            />
            {/* Humidity line (green) */}
            <polyline
              points={processData.map((d, i) => {
                const x = (i / (processData.length - 1)) * 100;
                const y = 100 - (d.humidity / 100) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="rgb(34, 197, 94)"
              strokeWidth="2"
              strokeDasharray="2,2"
            />
          </svg>
          
          {/* X-axis labels */}
          <div className="absolute left-10 right-4 bottom-0 h-8 flex justify-between items-center text-xs" style={{ color: 'rgb(100, 116, 139)', zIndex: 10 }}>
            <span>0h</span>
            <span>24h</span>
            <span>48h</span>
            <span>72h</span>
            <span>80h</span>
            <span>92h</span>
          </div>
        </div>
        
        {/* Data table */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg p-3 border" style={{ backgroundColor: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)' }}>
            <div className="text-xs mb-1" style={{ color: 'rgb(37, 99, 235)' }}>{t('phase')} 1: {t('homogenization')}</div>
            <div className="text-sm font-semibold" style={{ color: 'rgb(30, 58, 138)' }}>20°C | 90% | 0 ppm</div>
            <div className="text-xs" style={{ color: 'rgb(29, 78, 216)' }}>24 {t('hours')}</div>
          </div>
          <div className="rounded-lg p-3 border" style={{ backgroundColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' }}>
            <div className="text-xs mb-1" style={{ color: 'rgb(22, 163, 74)' }}>{t('phase')} 2: {t('ripening')}</div>
            <div className="text-sm font-semibold" style={{ color: 'rgb(20, 83, 45)' }}>20°C | 85% | 100 ppm</div>
            <div className="text-xs" style={{ color: 'rgb(21, 128, 61)' }}>48 {t('hours')}</div>
          </div>
          <div className="rounded-lg p-3 border" style={{ backgroundColor: 'rgb(255, 247, 237)', borderColor: 'rgb(254, 215, 170)' }}>
            <div className="text-xs mb-1" style={{ color: 'rgb(234, 88, 12)' }}>{t('phase')} 3: {t('ventilation')}</div>
            <div className="text-sm font-semibold" style={{ color: 'rgb(124, 45, 18)' }}>18°C | 80% | 0 ppm</div>
            <div className="text-xs" style={{ color: 'rgb(194, 65, 12)' }}>8 {t('hours')}</div>
          </div>
          <div className="rounded-lg p-3 border" style={{ backgroundColor: 'rgb(250, 245, 255)', borderColor: 'rgb(233, 213, 255)' }}>
            <div className="text-xs mb-1" style={{ color: 'rgb(147, 51, 234)' }}>{t('phase')} 4: {t('cooling')}</div>
            <div className="text-sm font-semibold" style={{ color: 'rgb(88, 28, 135)' }}>10°C | 85% | 0 ppm</div>
            <div className="text-xs" style={{ color: 'rgb(126, 34, 206)' }}>12 {t('hours')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Process List Screenshot with more examples
export const ProcessListScreenshot: React.FC = () => {
  const { t } = useSettings();
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">{t('process_tracking')}</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          {t('new_process')}
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Process 1 - In Progress */}
        <div className="bg-card border-2 border-green-500 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">Lote #MAG-2024-001</h3>
              <p className="text-sm text-muted-foreground">Exportadora San Miguel SAC</p>
            </div>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
              {t('in_process')}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
            <div>
              <span className="text-muted-foreground">{t('product')}:</span>
              <span className="ml-1 font-medium text-foreground">Mango Kent</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('device')}:</span>
              <span className="ml-1 font-medium text-foreground">REEFER-001</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('current_phase')}:</span>
              <span className="ml-1 font-medium text-green-600">{t('ripening')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('estimated_progress')}:</span>
              <span className="ml-1 font-medium text-foreground">67% (32/48h)</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="font-medium text-green-700 dark:text-green-300">{t('homogenization')}</div>
              <div className="text-muted-foreground">24h ✓</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded border-2 border-green-500">
              <div className="font-medium text-green-700 dark:text-green-300">{t('ripening')}</div>
              <div className="text-muted-foreground">32/48h</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-medium text-muted-foreground">{t('ventilation')}</div>
              <div className="text-muted-foreground">0/8h</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-medium text-muted-foreground">{t('cooling')}</div>
              <div className="text-muted-foreground">0/12h</div>
            </div>
          </div>
        </div>
        
        {/* Process 2 - Homogenization */}
        <div className="bg-card border-2 border-blue-500 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">Lote #PAL-2024-015</h3>
              <p className="text-sm text-muted-foreground">Agrícola Valle Verde</p>
            </div>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
              {t('homogenization')}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
            <div>
              <span className="text-muted-foreground">{t('product')}:</span>
              <span className="ml-1 font-medium text-foreground">Palta Hass</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('device')}:</span>
              <span className="ml-1 font-medium text-foreground">REEFER-002</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('current_phase')}:</span>
              <span className="ml-1 font-medium text-blue-600">{t('homogenization')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('estimated_progress')}:</span>
              <span className="ml-1 font-medium text-foreground">23% (8/36h)</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded border-2 border-blue-500">
              <div className="font-medium text-blue-700 dark:text-blue-300">{t('homogenization')}</div>
              <div className="text-muted-foreground">8/36h</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-medium text-muted-foreground">{t('ripening')}</div>
              <div className="text-muted-foreground">0/24h</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-medium text-muted-foreground">{t('ventilation')}</div>
              <div className="text-muted-foreground">0/6h</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-medium text-muted-foreground">{t('cooling')}</div>
              <div className="text-muted-foreground">0/6h</div>
            </div>
          </div>
        </div>
        
        {/* Process 3 - Ventilation */}
        <div className="bg-card border-2 border-orange-500 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">Lote #PLA-2024-008</h3>
              <p className="text-sm text-muted-foreground">Tropical Fruits Export</p>
            </div>
            <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs rounded-full font-medium">
              {t('ventilation')}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
            <div>
              <span className="text-muted-foreground">{t('product')}:</span>
              <span className="ml-1 font-medium text-foreground">Plátano</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('device')}:</span>
              <span className="ml-1 font-medium text-foreground">REEFER-003</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('current_phase')}:</span>
              <span className="ml-1 font-medium text-orange-600">{t('ventilation')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('estimated_progress')}:</span>
              <span className="ml-1 font-medium text-foreground">88% (63/72h)</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="font-medium text-green-700 dark:text-green-300">{t('homogenization')}</div>
              <div className="text-muted-foreground">18h ✓</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="font-medium text-green-700 dark:text-green-300">{t('ripening')}</div>
              <div className="text-muted-foreground">36h ✓</div>
            </div>
            <div className="text-center p-2 bg-orange-50 dark:bg-orange-950 rounded border-2 border-orange-500">
              <div className="font-medium text-orange-700 dark:text-orange-300">{t('ventilation')}</div>
              <div className="text-muted-foreground">9/12h</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-medium text-muted-foreground">{t('cooling')}</div>
              <div className="text-muted-foreground">0/6h</div>
            </div>
          </div>
        </div>
        
        {/* Process 4 - Completed */}
        <div className="bg-card border border-border rounded-lg p-4 opacity-75">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">Lote #MAN-2024-042</h3>
              <p className="text-sm text-muted-foreground">Agrícola del Sur</p>
            </div>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
              {t('completed')}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
            <div>
              <span className="text-muted-foreground">{t('product')}:</span>
              <span className="ml-1 font-medium text-foreground">Mango Edward</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('device')}:</span>
              <span className="ml-1 font-medium text-foreground">REEFER-004</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('language') === 'es' ? 'Finalizado:' : 'Completed:'}:</span>
              <span className="ml-1 font-medium text-foreground">02/03/2026</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('language') === 'es' ? 'Duración Total:' : 'Total Duration:'}:</span>
              <span className="ml-1 font-medium text-foreground">84h</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="font-medium text-green-700 dark:text-green-300">{t('homogenization')}</div>
              <div className="text-muted-foreground">20h ✓</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="font-medium text-green-700 dark:text-green-300">{t('ripening')}</div>
              <div className="text-muted-foreground">48h ✓</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="font-medium text-green-700 dark:text-green-300">{t('ventilation')}</div>
              <div className="text-muted-foreground">8h ✓</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="font-medium text-green-700 dark:text-green-300">{t('cooling')}</div>
              <div className="text-muted-foreground">8h ✓</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Recipe Library Screenshot
export const RecipeLibraryScreenshot: React.FC = () => {
  const { t } = useSettings();
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">{t('recipe_library')}</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          {t('new_recipe')}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Mango Kent Exportación</h3>
              <p className="text-xs text-muted-foreground">{t('total_duration')}: 92 {t('hours')}</p>
            </div>
          </div>
          <div className="space-y-2 text-xs mb-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">1. {t('homogenization')}</span>
              <span className="font-medium text-foreground">24h @ 20°C, 90%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">2. {t('ripening')}</span>
              <span className="font-medium text-foreground">48h @ 20°C, 85%, 100ppm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">3. {t('ventilation')}</span>
              <span className="font-medium text-foreground">8h @ 18°C, 80%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">4. {t('cooling')}</span>
              <span className="font-medium text-foreground">12h @ 10°C, 85%</span>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
              {t('short_homog')}: 24h
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              {t('short_ripening')}: 48h
            </span>
            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
              {t('short_venting')}: 8h
            </span>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Palta Hass Premium</h3>
              <p className="text-xs text-muted-foreground">{t('total_duration')}: 72 {t('hours')}</p>
            </div>
          </div>
          <div className="space-y-2 text-xs mb-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">1. {t('homogenization')}</span>
              <span className="font-medium text-foreground">36h @ 18°C, 85%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">2. {t('ripening')}</span>
              <span className="font-medium text-foreground">24h @ 20°C, 80%, 150ppm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">3. {t('ventilation')}</span>
              <span className="font-medium text-foreground">6h @ 16°C, 75%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">4. {t('cooling')}</span>
              <span className="font-medium text-foreground">6h @ 8°C, 80%</span>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
              {t('short_homog')}: 36h
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              {t('short_ripening')}: 24h
            </span>
            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
              {t('short_venting')}: 6h
            </span>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Plátano Orgánico</h3>
              <p className="text-xs text-muted-foreground">{t('total_duration')}: 72 {t('hours')}</p>
            </div>
          </div>
          <div className="space-y-2 text-xs mb-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">1. {t('homogenization')}</span>
              <span className="font-medium text-foreground">18h @ 18°C, 90%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">2. {t('ripening')}</span>
              <span className="font-medium text-foreground">36h @ 19°C, 85%, 100ppm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">3. {t('ventilation')}</span>
              <span className="font-medium text-foreground">12h @ 17°C, 80%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">4. {t('cooling')}</span>
              <span className="font-medium text-foreground">6h @ 14°C, 85%</span>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
              {t('short_homog')}: 18h
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              {t('short_ripening')}: 36h
            </span>
            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
              {t('short_venting')}: 12h
            </span>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Mango Edward Rápido</h3>
              <p className="text-xs text-muted-foreground">{t('total_duration')}: 68 {t('hours')}</p>
            </div>
          </div>
          <div className="space-y-2 text-xs mb-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">1. {t('homogenization')}</span>
              <span className="font-medium text-foreground">20h @ 21°C, 88%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">2. {t('ripening')}</span>
              <span className="font-medium text-foreground">36h @ 21°C, 83%, 120ppm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">3. {t('ventilation')}</span>
              <span className="font-medium text-foreground">6h @ 18°C, 78%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">4. {t('cooling')}</span>
              <span className="font-medium text-foreground">6h @ 12°C, 82%</span>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
              {t('short_homog')}: 20h
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              {t('short_ripening')}: 36h
            </span>
            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
              {t('short_venting')}: 6h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Recipe Builder Screenshot with detailed configuration
export const RecipeBuilderScreenshot: React.FC = () => {
  const { t } = useSettings();
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <h2 className="text-xl font-bold text-foreground mb-6">{t('new_recipe')}</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('protocol_name')}
          </label>
          <input
            type="text"
            placeholder={t('protocol_placeholder')}
            value="Mango Kent Exportación Premium"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            disabled
          />
        </div>
        
        {/* Phase 1: Homogenization */}
        <div className="bg-card border-2 border-blue-500 rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="h-6 w-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
            {t('phase_homogenization')}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t('language') === 'es' 
              ? 'Iguala la temperatura de toda la fruta para iniciar la maduración de forma uniforme.'
              : 'Equalizes the temperature of all fruit to start ripening uniformly.'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_temperature')} (°C)</label>
              <input
                type="number"
                value="20"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_humidity')} (%)</label>
              <input
                type="number"
                value="90"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_time')} ({t('unit_hours')})</label>
              <input
                type="number"
                value="24"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            {t('language') === 'es' ? 'ℹ️ Sin inyección de etileno' : 'ℹ️ No ethylene injection'}
          </p>
        </div>
        
        {/* Phase 2: Ripening */}
        <div className="bg-card border-2 border-green-500 rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="h-6 w-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
            {t('phase_ripening')}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t('language') === 'es' 
              ? 'Aplica etileno para acelerar el proceso de maduración hasta el punto óptimo.'
              : 'Applies ethylene to accelerate the ripening process to the optimal point.'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_temperature')} (°C)</label>
              <input
                type="number"
                value="20"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_humidity')} (%)</label>
              <input
                type="number"
                value="85"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_ethylene')} (ppm)</label>
              <input
                type="number"
                value="100"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_time')} (h)</label>
              <input
                type="number"
                value="48"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2">
            {t('language') === 'es' ? 'ℹ️ Fase crítica - Monitorear CO₂ constantemente' : 'ℹ️ Critical phase - Monitor CO₂ constantly'}
          </p>
        </div>
        
        {/* Phase 3: Ventilation */}
        <div className="bg-card border-2 border-orange-500 rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="h-6 w-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm">3</span>
            {t('phase_ventilation')}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t('language') === 'es' 
              ? 'Elimina gases residuales (etileno y CO₂) del contenedor mediante ventilación forzada.'
              : 'Removes residual gases (ethylene and CO₂) from the container through forced ventilation.'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_temperature')} (°C)</label>
              <input
                type="number"
                value="18"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_humidity')} (%)</label>
              <input
                type="number"
                value="80"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_time')} (h)</label>
              <input
                type="number"
                value="8"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
          </div>
          <p className="text-xs text-orange-600 mt-2">
            {t('language') === 'es' ? 'ℹ️ Ventilación al 100% - Sin etileno' : 'ℹ️ 100% ventilation - No ethylene'}
          </p>
        </div>
        
        {/* Phase 4: Cooling */}
        <div className="bg-card border-2 border-purple-500 rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="h-6 w-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm">4</span>
            {t('phase_cooling')}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t('language') === 'es' 
              ? 'Reduce la temperatura para detener la maduración y preparar para almacenamiento/transporte.'
              : 'Reduces temperature to stop ripening and prepare for storage/transport.'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_temperature')} (°C)</label>
              <input
                type="number"
                value="10"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_humidity')} (%)</label>
              <input
                type="number"
                value="85"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('set_time')} (h)</label>
              <input
                type="number"
                value="12"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                disabled
              />
            </div>
          </div>
          <p className="text-xs text-purple-600 mt-2">
            {t('language') === 'es' ? 'ℹ️ Enfriamiento gradual - Evitar choque térmico' : 'ℹ️ Gradual cooling - Avoid thermal shock'}
          </p>
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
        <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
          {t('language') === 'es' ? 'Duración Total del Protocolo' : 'Total Protocol Duration'}
        </p>
        <p className="text-2xl font-bold text-blue-600">92 {t('hours')}</p>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
          24h + 48h + 8h + 12h = 92h (≈ 3.8 {t('language') === 'es' ? 'días' : 'days'})
        </p>
      </div>
      
      <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium mt-6">
        {t('save')}
      </button>
    </div>
  );
};

// Users Management Screenshot
export const UsersManagementScreenshot: React.FC = () => {
  const { t } = useSettings();
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">{t('user_management')}</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          {t('new_user')}
        </button>
      </div>
      
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-foreground">{t('user')}</th>
              <th className="text-left p-3 text-sm font-medium text-foreground">{t('email')}</th>
              <th className="text-left p-3 text-sm font-medium text-foreground">{t('role')}</th>
              <th className="text-left p-3 text-sm font-medium text-foreground">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    JD
                  </div>
                  <span className="text-sm text-foreground">Juan Domínguez</span>
                </div>
              </td>
              <td className="p-3 text-sm text-muted-foreground">juan@empresa.com</td>
              <td className="p-3">
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded">
                  Admin
                </span>
              </td>
              <td className="p-3">
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                  {t('active')}
                </span>
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    MP
                  </div>
                  <span className="text-sm text-foreground">María Pérez</span>
                </div>
              </td>
              <td className="p-3 text-sm text-muted-foreground">maria@empresa.com</td>
              <td className="p-3">
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                  {t('operator')}
                </span>
              </td>
              <td className="p-3">
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                  {t('active')}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// User Profile Screenshot
export const UserProfileScreenshot: React.FC = () => {
  const { t } = useSettings();
  return (
    <div className="w-full bg-background p-6 rounded-lg border border-border">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-20 w-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
          JD
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Juan Domínguez</h2>
          <p className="text-sm text-muted-foreground">juan@empresa.com</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">{t('language') === 'es' ? 'Información Personal' : 'Personal Information'}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {t('language') === 'es' ? 'Nombre Completo' : 'Full Name'}
              </label>
              <input
                type="text"
                value="Juan Domínguez"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {t('email_label')}
              </label>
              <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg bg-muted">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">juan@empresa.com</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {t('language') === 'es' ? 'Teléfono' : 'Phone'}
              </label>
              <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg bg-background">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  value="+51 987 654 321"
                  className="flex-1 bg-transparent text-foreground outline-none"
                  disabled
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">
            {t('language') === 'es' ? 'Preferencias' : 'Preferences'}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {t('language') === 'es' ? 'Idioma' : 'Language'}
              </span>
              <span className="text-sm font-medium text-blue-600">Español</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {t('language') === 'es' ? 'Tema' : 'Theme'}
              </span>
              <span className="text-sm font-medium text-blue-600">
                {t('language') === 'es' ? 'Claro' : 'Light'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {t('language') === 'es' ? 'Unidad Temperatura' : 'Temperature Unit'}
              </span>
              <span className="text-sm font-medium text-blue-600">Celsius (°C)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
