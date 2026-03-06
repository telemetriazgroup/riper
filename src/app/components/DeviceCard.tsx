import React, { useState } from 'react';
import { Device } from '@/app/data';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Thermometer, Droplets, Wind, Zap, Activity, Clock, Edit2, Check, X, Loader2, Power, WifiOff, Timer } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { Button } from './ui/Button';
import { updateDeviceName } from '@/app/lib/api';
import { toast } from 'sonner';
import { useSettings } from '@/app/contexts/SettingsContext';
import { differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface DeviceCardProps {
  device: Device;
  onClick: (deviceId: string) => void;
  onRefresh?: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onClick, onRefresh }) => {
  const { convertTemp, tempUnit, t, language } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(device.name);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveName = async (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (!newName.trim() || newName === device.name) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateDeviceName(device.id, newName);
      toast.success(t('name_updated'));
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(t('error_updating_name'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewName(device.name);
    setIsEditing(false);
  };

  // Status Logic
  const isValidDate = (d: Date) => d instanceof Date && !isNaN(d.getTime());
  const lastSeenDate = device.last_seen ? new Date(device.last_seen) : new Date(0);
  const isDateValid = isValidDate(lastSeenDate);

  const minsSinceLastSeen = isDateValid ? differenceInMinutes(new Date(), lastSeenDate) : 999999;
  
  let connectionStatus: 'online' | 'standby' | 'offline' = 'online';
  if (minsSinceLastSeen > 720) connectionStatus = 'offline'; // > 12 hours
  else if (minsSinceLastSeen > 30) connectionStatus = 'standby'; // > 30 mins

  const isPoweredOff = device.telemetry.power_state === 0;

  const getStatusColor = () => {
    if (connectionStatus === 'offline') return 'border-l-4 border-l-gray-400 bg-gray-50';
    if (connectionStatus === 'standby') return 'border-l-4 border-l-orange-400 bg-orange-50/30';
    
    // Online
    if (device.status === 'alarm') return 'border-l-4 border-l-red-500';
    if (device.status === 'warning') return 'border-l-4 border-l-yellow-500';
    
    if (isPoweredOff) return 'border-l-4 border-l-gray-300';
    
    return 'border-l-4 border-l-green-500';
  };

  const getStatusBadge = () => {
    if (connectionStatus === 'offline') {
      return <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center gap-1"><WifiOff className="w-3 h-3"/> {t('status_offline').toUpperCase()}</span>;
    }
    
    if (connectionStatus === 'standby') {
      return <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center gap-1"><Timer className="w-3 h-3"/> {t('status_standby').toUpperCase()}</span>;
    }

    // Online
    if (isPoweredOff) {
      return <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1"><Power className="w-3 h-3"/> {t('status_powered_off').toUpperCase()}</span>;
    }

    if (device.status === 'alarm') {
      return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">{t('status_alarm').toUpperCase()}</span>;
    }
    if (device.status === 'warning') {
      return <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">{t('status_warning').toUpperCase()}</span>;
    }
    
    return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">{t('status_active').toUpperCase()}</span>;
  };

  const formatLastSeen = () => {
    if (!isDateValid) return '-';
    try {
      return formatDistanceToNow(lastSeenDate, { addSuffix: true, locale: language === 'es' ? es : enUS });
    } catch (error) {
      return '-';
    }
  };

  return (
    <Card 
      className={cn("cursor-pointer hover:shadow-md transition-shadow", getStatusColor())}
      onClick={() => onClick(device.id)}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 relative z-10">
        <div className="flex-1 mr-2" onClick={(e) => isEditing && e.stopPropagation()}>
          {isEditing ? (
            <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-sm font-bold text-gray-800 border-b-2 border-blue-500 focus:outline-none bg-transparent px-1 py-0.5"
                placeholder={t('device_name_placeholder')}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName(e);
                  if (e.key === 'Escape') handleCancel(e as any);
                }}
              />
              <button onClick={handleSaveName} disabled={isSaving} className="p-1 hover:bg-green-100 rounded text-green-600">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={handleCancel} disabled={isSaving} className="p-1 hover:bg-red-100 rounded text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-gray-800 truncate">{device.name}</CardTitle>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setNewName(device.name);
                  setIsEditing(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600"
                title={t('rename_device')}
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="text-xs text-gray-500 font-mono mt-1 flex items-center gap-2">
            <span>{device.id}</span>
            <span className="text-[10px] text-gray-400">• {formatLastSeen()}</span>
          </div>
        </div>
        {getStatusBadge()}
      </CardHeader>
      
      <CardContent>
        {connectionStatus === 'offline' ? (
           <div className="h-32 flex items-center justify-center text-gray-400 flex-col gap-2">
             <Zap className="h-8 w-8 opacity-20" />
             <span className="text-sm">{t('device_disconnected')}</span>
             <span className="text-xs">{t('last_connection')}: {formatLastSeen()}</span>
           </div>
        ) : (
          <div className={cn("grid grid-cols-2 gap-4", isPoweredOff && "opacity-60 grayscale")}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-red-500" />
                <div>
                  <div className="text-xs text-gray-500">{t('temperature')}</div>
                  <div className="font-bold text-gray-900">
                    {convertTemp(device.telemetry.temp_supply_1).toFixed(1)}°{tempUnit}
                    <span className="text-gray-400 font-normal ml-1">/ {convertTemp(device.telemetry.set_point)}°{tempUnit}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-xs text-gray-500">{t('humidity')}</div>
                  <div className="font-bold text-gray-900">{device.telemetry.relative_humidity}%</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-xs text-gray-500">{t('ethylene')}</div>
                  <div className="font-bold text-gray-900">{device.telemetry.ethylene ?? '-'} PPM</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">{t('co2')}</div>
                  <div className="font-bold text-gray-900">{device.telemetry.co2_reading ?? '-'} %</div>
                </div>
              </div>
            </div>

            {device.process && (
              <div className="col-span-2 mt-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-blue-600">{device.process.currentPhase}</span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {device.process.timeLeft}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full" 
                    style={{ width: `${device.process.progress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {isPoweredOff && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="bg-gray-900/10 backdrop-blur-[1px] absolute inset-0 rounded-b-xl" />
                 {/* Optional: Add an overlay text if needed */}
              </div>
            )}
          </div>
        )}
        
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 p-0 h-auto hover:bg-transparent">
            {t('view_details')} →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
