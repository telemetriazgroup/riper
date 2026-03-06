import React from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';

interface DataPoint {
  hour: number;
  temp: number;
  humidity: number;
  ethylene: number;
  co2: number;
  phase: string;
}

interface ProcessChartProps {
  title: string;
  data: DataPoint[];
  totalHours: number;
  phases: Array<{
    name: string;
    hours: number;
    color: string;
    bgColor: string;
    borderColor: string;
  }>;
}

export const ProcessChart: React.FC<ProcessChartProps> = ({ title, data, totalHours, phases }) => {
  const { t } = useSettings();
  
  return (
    <div className="w-full p-6 rounded-lg border" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(226, 232, 240)' }}>
      <div className="mb-4">
        <h3 className="font-semibold mb-2" style={{ color: 'rgb(15, 23, 42)' }}>{title}</h3>
        <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
          {t('language') === 'es' ? `Duración total: ${totalHours} horas` : `Total duration: ${totalHours} hours`}
        </p>
      </div>
      
      <div className="border rounded-lg p-6" style={{ borderColor: 'rgb(226, 232, 240)', backgroundColor: 'rgb(255, 255, 255)' }}>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(37, 99, 235)' }}></div>
            <span className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>{t('temperature')} (°C)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(34, 197, 94)' }}></div>
            <span className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>{t('humidity')} (%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(249, 115, 22)' }}></div>
            <span className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>{t('ethylene')} (ppm)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'rgb(239, 68, 68)' }}></div>
            <span className="text-xs" style={{ color: 'rgb(100, 116, 139)' }}>CO₂ (%)</span>
          </div>
        </div>
        
        {/* Chart Area */}
        <div className="relative h-80 border-2 rounded-lg p-4" style={{ borderColor: 'rgb(226, 232, 240)', backgroundColor: 'rgb(255, 255, 255)' }}>
          {/* Y-axis */}
          <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs" style={{ color: 'rgb(100, 116, 139)' }}>
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>
          
          {/* Phase backgrounds - Lower z-index */}
          <div className="absolute left-10 right-4 top-4 bottom-8 flex" style={{ zIndex: 1 }}>
            {phases.map((phase, idx) => (
              <div
                key={idx}
                className="border-r border-dashed flex items-end justify-center pb-2"
                style={{
                  flex: phase.hours / totalHours,
                  backgroundColor: phase.bgColor,
                  borderColor: phase.borderColor,
                  borderRight: idx === phases.length - 1 ? 'none' : undefined
                }}
              >
                <span className="text-xs font-medium" style={{ color: phase.color }}>
                  {phase.name}
                </span>
              </div>
            ))}
          </div>
          
          {/* SVG Lines - Higher z-index */}
          <svg className="absolute left-10 right-4 top-4 bottom-8" style={{ width: 'calc(100% - 56px)', height: 'calc(100% - 48px)', zIndex: 10 }}>
            {/* Temperature line */}
            <polyline
              points={data.map((d, i) => {
                const x = (i / (data.length - 1)) * 100;
                const y = 100 - (d.temp / 25) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="rgb(37, 99, 235)"
              strokeWidth="2"
            />
            {/* Humidity line */}
            <polyline
              points={data.map((d, i) => {
                const x = (i / (data.length - 1)) * 100;
                const y = 100 - (d.humidity / 100) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="rgb(34, 197, 94)"
              strokeWidth="2"
              strokeDasharray="2,2"
            />
            {/* Ethylene line */}
            <polyline
              points={data.map((d, i) => {
                const x = (i / (data.length - 1)) * 100;
                const y = 100 - (d.ethylene / 200) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="rgb(249, 115, 22)"
              strokeWidth="2"
            />
            {/* CO2 line */}
            <polyline
              points={data.map((d, i) => {
                const x = (i / (data.length - 1)) * 100;
                const y = 100 - ((d.co2 * 10) / 100) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="rgb(239, 68, 68)"
              strokeWidth="2"
              strokeDasharray="4,2"
            />
          </svg>
          
          {/* X-axis - Highest z-index */}
          <div className="absolute left-10 right-4 bottom-0 h-8 flex justify-between items-center text-xs" style={{ color: 'rgb(100, 116, 139)', zIndex: 10 }}>
            {phases.map((phase, idx) => {
              const cumulativeHours = phases.slice(0, idx + 1).reduce((sum, p) => sum + p.hours, 0);
              return <span key={idx}>{cumulativeHours}h</span>;
            })}
          </div>
        </div>
        
        {/* Phase summary */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {phases.map((phase, idx) => (
            <div
              key={idx}
              className="rounded-lg p-3 border"
              style={{ backgroundColor: phase.bgColor, borderColor: phase.borderColor }}
            >
              <div className="text-xs mb-1" style={{ color: phase.color }}>
                {t('phase')} {idx + 1}: {phase.name}
              </div>
              <div className="text-sm font-semibold" style={{ color: phase.color }}>
                {data.find(d => d.phase === phase.name)?.temp}°C | {data.find(d => d.phase === phase.name)?.humidity}% | {data.find(d => d.phase === phase.name)?.ethylene} ppm
              </div>
              <div className="text-xs" style={{ color: phase.color }}>
                {phase.hours} {t('hours')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Mango Kent Process
export const MangoKentChart: React.FC = () => {
  const { t } = useSettings();
  
  const data: DataPoint[] = [
    { hour: 0, temp: 20.0, humidity: 90, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 6, temp: 20.1, humidity: 90, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 12, temp: 20.0, humidity: 89, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 18, temp: 20.1, humidity: 90, ethylene: 0, co2: 0.6, phase: t('homogenization') },
    { hour: 24, temp: 20.0, humidity: 90, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 30, temp: 20.0, humidity: 85, ethylene: 100, co2: 1.5, phase: t('ripening') },
    { hour: 36, temp: 20.2, humidity: 85, ethylene: 100, co2: 2.0, phase: t('ripening') },
    { hour: 48, temp: 20.0, humidity: 85, ethylene: 100, co2: 2.8, phase: t('ripening') },
    { hour: 60, temp: 20.0, humidity: 85, ethylene: 100, co2: 2.9, phase: t('ripening') },
    { hour: 72, temp: 20.0, humidity: 85, ethylene: 100, co2: 2.7, phase: t('ripening') },
    { hour: 76, temp: 18.0, humidity: 80, ethylene: 20, co2: 1.2, phase: t('ventilation') },
    { hour: 80, temp: 18.0, humidity: 80, ethylene: 0, co2: 0.5, phase: t('ventilation') },
    { hour: 86, temp: 12.0, humidity: 85, ethylene: 0, co2: 0.5, phase: t('cooling') },
    { hour: 92, temp: 10.0, humidity: 85, ethylene: 0, co2: 0.5, phase: t('cooling') },
  ];
  
  const phases = [
    { name: t('homogenization'), hours: 24, color: 'rgb(37, 99, 235)', bgColor: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)' },
    { name: t('ripening'), hours: 48, color: 'rgb(22, 163, 74)', bgColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' },
    { name: t('ventilation'), hours: 8, color: 'rgb(234, 88, 12)', bgColor: 'rgb(255, 247, 237)', borderColor: 'rgb(254, 215, 170)' },
    { name: t('cooling'), hours: 12, color: 'rgb(147, 51, 234)', bgColor: 'rgb(250, 245, 255)', borderColor: 'rgb(233, 213, 255)' },
  ];
  
  return <ProcessChart title="Mango Kent Exportación" data={data} totalHours={92} phases={phases} />;
};

// Palta Hass Process
export const PaltaHassChart: React.FC = () => {
  const { t } = useSettings();
  
  const data: DataPoint[] = [
    { hour: 0, temp: 18.0, humidity: 85, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 9, temp: 18.1, humidity: 85, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 18, temp: 18.0, humidity: 86, ethylene: 0, co2: 0.6, phase: t('homogenization') },
    { hour: 27, temp: 18.1, humidity: 85, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 36, temp: 18.0, humidity: 85, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 42, temp: 20.0, humidity: 80, ethylene: 150, co2: 1.8, phase: t('ripening') },
    { hour: 48, temp: 20.1, humidity: 80, ethylene: 150, co2: 2.3, phase: t('ripening') },
    { hour: 54, temp: 20.0, humidity: 80, ethylene: 150, co2: 2.5, phase: t('ripening') },
    { hour: 60, temp: 20.0, humidity: 80, ethylene: 150, co2: 2.4, phase: t('ripening') },
    { hour: 64, temp: 16.0, humidity: 75, ethylene: 30, co2: 1.0, phase: t('ventilation') },
    { hour: 66, temp: 16.0, humidity: 75, ethylene: 0, co2: 0.5, phase: t('ventilation') },
    { hour: 69, temp: 10.0, humidity: 80, ethylene: 0, co2: 0.5, phase: t('cooling') },
    { hour: 72, temp: 8.0, humidity: 80, ethylene: 0, co2: 0.5, phase: t('cooling') },
  ];
  
  const phases = [
    { name: t('homogenization'), hours: 36, color: 'rgb(37, 99, 235)', bgColor: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)' },
    { name: t('ripening'), hours: 24, color: 'rgb(22, 163, 74)', bgColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' },
    { name: t('ventilation'), hours: 6, color: 'rgb(234, 88, 12)', bgColor: 'rgb(255, 247, 237)', borderColor: 'rgb(254, 215, 170)' },
    { name: t('cooling'), hours: 6, color: 'rgb(147, 51, 234)', bgColor: 'rgb(250, 245, 255)', borderColor: 'rgb(233, 213, 255)' },
  ];
  
  return <ProcessChart title="Palta Hass Premium" data={data} totalHours={72} phases={phases} />;
};

// Plátano Process
export const PlatanoChart: React.FC = () => {
  const { t } = useSettings();
  
  const data: DataPoint[] = [
    { hour: 0, temp: 18.0, humidity: 90, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 6, temp: 18.1, humidity: 90, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 12, temp: 18.0, humidity: 91, ethylene: 0, co2: 0.6, phase: t('homogenization') },
    { hour: 18, temp: 18.0, humidity: 90, ethylene: 0, co2: 0.5, phase: t('homogenization') },
    { hour: 24, temp: 19.0, humidity: 85, ethylene: 100, co2: 1.2, phase: t('ripening') },
    { hour: 30, temp: 19.1, humidity: 85, ethylene: 100, co2: 1.8, phase: t('ripening') },
    { hour: 36, temp: 19.0, humidity: 85, ethylene: 100, co2: 2.2, phase: t('ripening') },
    { hour: 42, temp: 19.1, humidity: 85, ethylene: 100, co2: 2.5, phase: t('ripening') },
    { hour: 48, temp: 19.0, humidity: 85, ethylene: 100, co2: 2.6, phase: t('ripening') },
    { hour: 54, temp: 19.0, humidity: 85, ethylene: 100, co2: 2.4, phase: t('ripening') },
    { hour: 60, temp: 17.0, humidity: 80, ethylene: 40, co2: 1.5, phase: t('ventilation') },
    { hour: 66, temp: 17.0, humidity: 80, ethylene: 0, co2: 0.5, phase: t('ventilation') },
    { hour: 69, temp: 14.5, humidity: 85, ethylene: 0, co2: 0.5, phase: t('cooling') },
    { hour: 72, temp: 14.0, humidity: 85, ethylene: 0, co2: 0.5, phase: t('cooling') },
  ];
  
  const phases = [
    { name: t('homogenization'), hours: 18, color: 'rgb(37, 99, 235)', bgColor: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)' },
    { name: t('ripening'), hours: 36, color: 'rgb(22, 163, 74)', bgColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' },
    { name: t('ventilation'), hours: 12, color: 'rgb(234, 88, 12)', bgColor: 'rgb(255, 247, 237)', borderColor: 'rgb(254, 215, 170)' },
    { name: t('cooling'), hours: 6, color: 'rgb(147, 51, 234)', bgColor: 'rgb(250, 245, 255)', borderColor: 'rgb(233, 213, 255)' },
  ];
  
  return <ProcessChart title="Plátano Orgánico" data={data} totalHours={72} phases={phases} />;
};