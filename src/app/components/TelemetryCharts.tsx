import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ReferenceArea, AreaChart, Area, ComposedChart 
} from 'recharts';
import { useDeviceHistory } from '@/app/hooks/useDevices';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Loader2, History, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { clsx } from 'clsx';
import { format, subHours, subDays } from 'date-fns';

interface TelemetryChartsProps {
  deviceId?: string;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ deviceId }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Default view is last 12 hours
  const [timeRange, setTimeRange] = useState<'12h' | '24h' | '7d'>('12h');
  
  const { history, isLoading } = useDeviceHistory(deviceId || null);

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-2 h-[400px] flex items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </Card>
    );
  }

  // Filter data based on selected range (mock logic since API returns fixed set)
  // In a real app, you'd pass startDate/endDate to the hook
  const now = new Date();
  const cutoff = timeRange === '12h' ? subHours(now, 12) : timeRange === '24h' ? subHours(now, 24) : subDays(now, 7);

  // Transform data
  const data = history
    ?.filter((h: any) => new Date(h.timestamp) > cutoff || true) // Mock filter: API currently returns small set so we keep all for demo if needed, but logic is here
    .map((h: any) => ({
      rawDate: new Date(h.timestamp),
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: Number(convertTemp(h.temp_supply_1).toFixed(2)),
      humidity: Number(h.relative_humidity.toFixed(2)),
      ethylene: Number((h.ethylene || 0).toFixed(2)),
      co2: Number((h.co2_reading || 0).toFixed(2)),
    })) || [];

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{t('last_12_hours')}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            {t('historical_data')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                yAxisId="left" 
                stroke="#ef4444" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => val.toFixed(2)}
                label={{ value: `Temp (°${tempUnit})`, angle: -90, position: 'insideLeft', fill: '#ef4444' }} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#10b981" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => val.toFixed(2)}
                label={{ value: 'PPM / %', angle: 90, position: 'insideRight', fill: '#10b981' }} 
              />
              <Tooltip 
                formatter={(value: number) => [value.toFixed(2), ""]}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px' }}
                labelStyle={{ color: '#374151', marginBottom: '0.25rem', fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line yAxisId="left" type="monotone" dataKey="temp" name={`${t('temperature')} (°${tempUnit})`} stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="humidity" name={`${t('humidity')} (%)`} stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="ethylene" name={`${t('ethylene')} (PPM)`} stroke="#10b981" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="co2" name={`${t('co2')} (%)`} stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>

      <HistoricalDataModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        deviceId={deviceId}
      />
    </Card>
  );
};

// --- Historical Data Modal Component ---

const HistoricalDataModal = ({ isOpen, onClose, deviceId }: { isOpen: boolean, onClose: () => void, deviceId?: string }) => {
  const { t, convertTemp, tempUnit } = useSettings();
  
  // Initialize range to last 12 hours
  const [dateRange, setDateRange] = useState({ 
    start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"), 
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm") 
  });
  
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['temp', 'humidity', 'ethylene', 'co2']);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock past processes for shading
  const pastProcesses = [
    { id: 'p1', name: 'Maduración Lote A-101', start: '08:00', end: '14:00', color: '#dbeafe', details: 'Mango Tommy, 320 cajas' },
    { id: 'p2', name: 'Ventilación', start: '14:30', end: '15:30', color: '#fef3c7', details: 'Reducción CO2 < 1%' },
  ];

  // Mock data generator for history chart - dynamically generated based on date range (simulated)
  const generateData = () => {
    setIsLoading(true);
    // Simulate API delay
    setTimeout(() => {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);

        // Simulate "No Data" if start date is after end date or if range is invalid
        if (start.getTime() >= end.getTime()) {
            setChartData([]);
            setIsLoading(false);
            return;
        }

        const points = [];
        const diffMs = end.getTime() - start.getTime();
        
        // Create roughly 40 points regardless of duration for chart appearance
        const stepMs = Math.max(diffMs / 40, 60000); 

        let current = start.getTime();
        let i = 0;
        
        while (current <= end.getTime()) {
        points.push({
            timeStr: new Date(current).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: current,
            temp: 18 + Math.random() * 2,
            humidity: 85 + Math.random() * 10,
            ethylene: i > 10 && i < 30 ? 50 + Math.random() * 20 : 0, // Ethylene spike
            co2: 1 + Math.random(),
        });
        current += stepMs;
        i++;
        }

        const formatted = points.map(d => ({
            ...d,
            temp: Number(convertTemp(d.temp).toFixed(2)),
            humidity: Number(d.humidity.toFixed(2)),
            ethylene: Number(d.ethylene.toFixed(2)),
            co2: Number(d.co2.toFixed(2)),
        }));

        setChartData(formatted);
        setIsLoading(false);
    }, 500);
  };

  // Reset range and generate initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      setDateRange({
        start: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm"),
        end: format(new Date(), "yyyy-MM-dd'T'HH:mm")
      });
      // Trigger initial generation
      // We need to call generateData, but it depends on state that might not be updated yet if we just set it.
      // However, React batching might handle it, or we can just call it with the calculated values.
      // Better to use a separate effect or just call it directly with the values.
      // For simplicity, we'll let the user click generate or generate on mount with default values.
      // User said "al hacer click en histórico ... genera datos".
      // So let's generate immediately.
      
      // We'll manually generate the mock data for the default range here to avoid state race conditions
      const now = new Date();
      const start = subHours(now, 12);
      
      const points = [];
      const diffMs = now.getTime() - start.getTime();
      const stepMs = Math.max(diffMs / 40, 60000);
      let current = start.getTime();
      let i = 0;
      while(current <= now.getTime()) {
          points.push({
            timeStr: new Date(current).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: current,
            temp: 18 + Math.random() * 2,
            humidity: 85 + Math.random() * 10,
            ethylene: i > 10 && i < 30 ? 50 + Math.random() * 20 : 0,
            co2: 1 + Math.random(),
          });
          current += stepMs;
          i++;
      }
      setChartData(points.map(d => ({
         ...d,
         temp: Number(convertTemp(d.temp).toFixed(2)),
         humidity: Number(d.humidity.toFixed(2)),
         ethylene: Number(d.ethylene.toFixed(2)),
         co2: Number(d.co2.toFixed(2)),
      })));
    }
  }, [isOpen, convertTemp, tempUnit]); // Re-run if units change, but mostly on open

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('historical_data')}</DialogTitle>
          <DialogDescription>{t('viewing_history')} - {deviceId}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden pt-4">
          {/* Sidebar Controls */}
          <div className="w-full lg:w-64 space-y-6 overflow-y-auto pr-2">
            
            {/* Date Range */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> {t('date_range')}
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Inicio</label>
                  <input 
                    type="datetime-local" 
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fin</label>
                  <input 
                    type="datetime-local" 
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm" 
                  />
                </div>
              </div>
            </div>

            {/* Metrics Selector */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                <Filter className="h-4 w-4" /> {t('data_to_visualize')}
              </h4>
              <div className="space-y-2">
                {[
                  { id: 'temp', label: t('temperature'), color: 'text-red-600' },
                  { id: 'humidity', label: t('humidity'), color: 'text-blue-600' },
                  { id: 'ethylene', label: t('ethylene'), color: 'text-green-600' },
                  { id: 'co2', label: t('co2'), color: 'text-gray-600' }
                ].map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input 
                      type="checkbox" 
                      checked={selectedMetrics.includes(m.id)}
                      onChange={() => toggleMetric(m.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={clsx("font-medium", m.color)}>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button 
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                onClick={generateData}
                disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('generate_chart')}
            </Button>

            {/* Selected Process Details */}
            {selectedProcess && (
               <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2">
                 <h5 className="text-sm font-bold text-blue-800 mb-2">{t('process_summary')}</h5>
                 <p className="font-medium text-blue-900">{selectedProcess.name}</p>
                 <p className="text-xs text-blue-700 mt-1">{selectedProcess.details}</p>
                 <div className="flex gap-2 mt-2 text-xs text-blue-600">
                   <span>{selectedProcess.start}</span>
                   <span>→</span>
                   <span>{selectedProcess.end}</span>
                 </div>
               </div>
            )}
          </div>

          {/* Chart Area */}
          <div className="flex-1 min-h-[400px] border rounded-lg bg-white p-4 relative flex items-center justify-center">
             {chartData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="timeStr" />
                     <YAxis 
                        yAxisId="left" 
                        label={{ value: `°${tempUnit}`, position: 'insideLeft', angle: -90 }} 
                        tickFormatter={(val) => val.toFixed(2)}
                     />
                     <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        label={{ value: '% / PPM', position: 'insideRight', angle: 90 }} 
                        tickFormatter={(val) => val.toFixed(2)}
                     />
                     <Tooltip formatter={(value: number) => [value.toFixed(2), ""]} />
                     <Legend />
                     
                     {/* Shaded Areas for Processes */}
                     {pastProcesses.map((proc) => (
                       <ReferenceArea 
                         key={proc.id}
                         x1={proc.start} 
                         x2={proc.end} 
                         yAxisId="left"
                         fill={proc.color} 
                         fillOpacity={0.4}
                         onClick={() => setSelectedProcess(proc)}
                         className="cursor-pointer hover:opacity-80 transition-opacity"
                         label={{ value: proc.name, position: 'insideTop', fontSize: 10, fill: '#666' }}
                       />
                     ))}
    
                     {selectedMetrics.includes('temp') && (
                       <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#ef4444" strokeWidth={2} dot={false} name={`Temp (°${tempUnit})`} />
                     )}
                     {selectedMetrics.includes('humidity') && (
                       <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Hum %" />
                     )}
                     {selectedMetrics.includes('ethylene') && (
                       <Line yAxisId="right" type="monotone" dataKey="ethylene" stroke="#10b981" strokeWidth={2} dot={false} name="C2H4 PPM" />
                     )}
                     {selectedMetrics.includes('co2') && (
                       <Line yAxisId="right" type="monotone" dataKey="co2" stroke="#6b7280" strokeWidth={2} dot={false} strokeDasharray="5 5" name="CO2 %" />
                     )}
                   </ComposedChart>
                 </ResponsiveContainer>
             ) : (
                 <div className="flex flex-col items-center justify-center text-gray-400">
                     <History className="h-16 w-16 mb-4 opacity-20" />
                     <p className="text-lg font-medium">SIN DATOS ENCONTRADOS</p>
                     <p className="text-sm">Intente con otro rango de fechas</p>
                 </div>
             )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
