import React from 'react';
import { Device } from '@/app/data';
import { useDevices } from '@/app/hooks/useDevices';
import { DeviceCard } from './DeviceCard';
import { Card, CardContent } from './ui/Card';
import { Activity, AlertTriangle, CheckCircle, Zap, Loader2 } from 'lucide-react';
import { useSettings } from '@/app/contexts/SettingsContext';

interface DashboardProps {
  onSelectDevice: (deviceId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectDevice }) => {
  const { devices, isLoading, isError, mutate } = useDevices();
  const { t } = useSettings();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isError) {
    return <div className="p-8 text-center text-red-500">{t('error_loading_devices')}</div>;
  }

  const activeCount = devices.filter(d => d.status === 'active' || d.status === 'warning').length;
  const alarmCount = devices.filter(d => d.status === 'alarm').length;
  const totalKwh = devices.reduce((acc, d) => acc + d.operational.power_kwh, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title={t('active_units')} 
          value={activeCount.toString()} 
          icon={CheckCircle} 
          color="text-green-500" 
          subtext={t('of_total', { total: devices.length.toString() })}
        />
        <SummaryCard 
          title={t('active_alarms')} 
          value={alarmCount.toString()} 
          icon={AlertTriangle} 
          color="text-red-500" 
          subtext={t('require_attention')}
        />
        <SummaryCard 
          title={t('completed_processes')} 
          value="12" 
          icon={Activity} 
          color="text-blue-500" 
          subtext={t('this_week')}
        />
        <SummaryCard 
          title={t('total_consumption')} 
          value={`${Math.round(totalKwh).toLocaleString()} kWh`} 
          icon={Zap} 
          color="text-orange-500" 
          subtext={t('historical_accumulated')}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 text-gray-800">{t('fleet_status')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {devices.map(device => (
            <DeviceCard 
              key={device.id} 
              device={device} 
              onClick={onSelectDevice} 
              onRefresh={mutate}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value, icon: Icon, color, subtext }: any) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
          <p className="text-xs text-gray-400 mt-1">{subtext}</p>
        </div>
        <div className={`p-3 rounded-full bg-gray-50 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </CardContent>
  </Card>
);
