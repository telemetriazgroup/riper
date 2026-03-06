import React, { useState } from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { X, Maximize2 } from 'lucide-react';
import { LoginInterface, DashboardInterface, DeviceControlInterface } from './manual-interfaces';

interface InteractiveInterfaceModalProps {
  interface: 'login' | 'dashboard' | 'control';
  onClose: () => void;
}

export const InteractiveInterfaceModal: React.FC<InteractiveInterfaceModalProps> = ({ interface: interfaceType, onClose }) => {
  const { t } = useSettings();
  
  const getInterface = () => {
    switch (interfaceType) {
      case 'login':
        return <LoginInterface />;
      case 'dashboard':
        return <DashboardInterface />;
      case 'control':
        return <DeviceControlInterface />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (interfaceType) {
      case 'login':
        return t('language') === 'es' ? 'Interfaz de Inicio de Sesión' : 'Login Interface';
      case 'dashboard':
        return t('language') === 'es' ? 'Interfaz del Dashboard' : 'Dashboard Interface';
      case 'control':
        return t('language') === 'es' ? 'Interfaz de Control de Dispositivo' : 'Device Control Interface';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
      <div 
        className="w-full max-w-6xl max-h-[90vh] rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: 'rgb(255, 255, 255)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgb(226, 232, 240)', backgroundColor: 'rgb(248, 250, 252)' }}>
          <div className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5" style={{ color: 'rgb(37, 99, 235)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'rgb(15, 23, 42)' }}>
              {getTitle()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgb(241, 245, 249)', color: 'rgb(100, 116, 139)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {getInterface()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-center text-sm" style={{ borderColor: 'rgb(226, 232, 240)', backgroundColor: 'rgb(248, 250, 252)', color: 'rgb(100, 116, 139)' }}>
          {t('language') === 'es' 
            ? '✨ Interfaz interactiva de demostración - Todos los controles son funcionales' 
            : '✨ Interactive demo interface - All controls are functional'}
        </div>
      </div>
    </div>
  );
};
