import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, BarChart, Bar } from 'recharts';
import { 
  Leaf, 
  Wind, 
  Zap, 
  Activity, 
  Box, 
  Timer, 
  ClipboardCheck, 
  Droplets,
  AlertCircle,
  FlaskConical,
  ArrowUpRight
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import { Button } from './ui/Button';

// --- MOCK DATA FOR PROCESS ANALYSIS ---
const MOCK_PROCESS_DATA = {
  batch: {
    id: "L-2390-BAN",
    client: "AgroFrut Export",
    product: "Banano Cavendish",
    quantity_kg: 21500,
    quantity_boxes: 1080,
    entry_date: "2024-02-01T08:00:00",
    recipe: "Maduración Rápida v2"
  },
  status: {
    current_phase: "Aplicación de Etileno",
    phase_progress: 65, // % of current phase
    total_progress: 35, // % of total process
    start_time: "2024-02-02T14:00:00",
    estimated_end: "2024-02-06T10:00:00",
    time_elapsed: "26h 30m",
    time_remaining: "48h 15m"
  },
  metrics: {
    co2_generation_rate: 18.5, // mg CO2 / kg / h - calculated metabolic rate
    ethylene_total_injected: 2.8, // Liters
    energy_consumption: 142.5, // kWh
    ventilation_status: "Cerrada", // Open, Closed, Modulating
    ventilation_percent: 0
  },
  last_sampling: {
    timestamp: "Hoy, 10:00 AM",
    technician: "Juan Pérez",
    quality_score: 95,
    parameters: [
      { name: "Color", value: "3.5", target: "4.0", unit: "Scale" },
      { name: "Firmeza", value: "14.2", target: "13.5", unit: "lbs" },
      { name: "Brix", value: "4.8", target: "5.0", unit: "°Bx" }
    ],
    image: "figma:asset/sample_img.png" // Placeholder
  }
};

const generateProcessHistory = () => {
  const data = [];
  const hours = 48;
  const now = new Date();
  
  for (let i = 0; i < hours; i++) {
    const date = new Date(now.getTime() - (hours - i) * 3600000);
    // Simulation logic
    const phase = i < 12 ? 'Equilibrio' : i < 36 ? 'Etileno' : 'Ventilación';
    const baseTemp = phase === 'Etileno' ? 18.0 : 14.0;
    
    data.push({
      timestamp: date.toISOString(),
      timeLabel: date.getHours() + ':00',
      phase,
      temp_pulp: Number((baseTemp + Math.random() * 0.5).toFixed(2)),
      temp_air: Number((baseTemp - 0.5 + Math.random() * 0.8).toFixed(2)),
      ethylene: phase === 'Etileno' ? Number((100 + Math.random() * 10).toFixed(1)) : Number((Math.random() * 5).toFixed(1)),
      co2: Number((0.5 + (i * 0.05) + Math.random() * 0.2).toFixed(2)),
      humidity: Number((90 + Math.random() * 5).toFixed(1)),
      vent_opening: phase === 'Ventilación' ? 20 : 0
    });
  }
  return data;
};

const PROCESS_HISTORY = generateProcessHistory();

interface WeeklySummaryProps {
  deviceId: string;
}

// Renamed internally to ProcessAnalysis but exported as WeeklySummary to maintain compatibility
export const WeeklySummary: React.FC<WeeklySummaryProps> = ({ deviceId }) => {
  const [activeChart, setActiveChart] = useState('environment');
  const data = MOCK_PROCESS_DATA;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* 1. Process Header & Batch Info */}
      <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
        <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex flex-wrap md:flex-nowrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{data.batch.product} - Lote {data.batch.id}</h3>
              <p className="text-sm text-blue-700 font-medium">{data.batch.client} • {data.batch.quantity_kg.toLocaleString()} kg ({data.batch.quantity_boxes} cajas)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
             <div className="text-right">
               <span className="block text-gray-500 text-xs uppercase tracking-wider">Inicio</span>
               <span className="font-semibold text-gray-900">{new Date(data.status.start_time).toLocaleDateString()}</span>
             </div>
             <div className="h-8 w-px bg-blue-200 hidden md:block"></div>
             <div className="text-right">
               <span className="block text-gray-500 text-xs uppercase tracking-wider">Fin Estimado</span>
               <span className="font-semibold text-gray-900">{new Date(data.status.estimated_end).toLocaleDateString()}</span>
             </div>
          </div>
        </div>

        <div className="p-6">
           <div className="flex justify-between items-end mb-2">
             <div>
               <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Fase Actual</span>
               <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 {data.status.current_phase}
                 <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">
                   Paso 3/5
                 </span>
               </div>
             </div>
             <div className="text-right">
               <span className="text-3xl font-bold text-blue-600">{data.status.total_progress}%</span>
               <span className="text-sm text-gray-500 block">Completado</span>
             </div>
           </div>
           
           <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
             <div 
               className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out relative"
               style={{ width: `${data.status.total_progress}%` }}
             >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
             </div>
           </div>
           
           <div className="flex justify-between mt-2 text-xs font-medium text-gray-500">
             <span>0%</span>
             <span className="text-blue-600 font-bold">{data.status.time_elapsed} transcurridos</span>
             <span>100%</span>
           </div>
        </div>
      </div>

      {/* 2. Operational Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Tasa Generación CO2"
          value={data.metrics.co2_generation_rate}
          unit="mg/kg/h"
          icon={<Leaf className="w-5 h-5 text-green-500" />}
          trend="+2.1%"
          trendUp={true}
          description="Actividad metabólica"
        />
        <MetricCard 
          title="Etileno Inyectado"
          value={data.metrics.ethylene_total_injected}
          unit="Litros"
          icon={<FlaskConical className="w-5 h-5 text-purple-500" />}
          description="Acumulado en ciclo"
          color="purple"
        />
        <MetricCard 
          title="Consumo Energía"
          value={data.metrics.energy_consumption}
          unit="kWh"
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
          description="Eficiencia A+"
          color="yellow"
        />
        <MetricCard 
          title="Estado Ventilación"
          value={data.metrics.ventilation_status}
          unit={data.metrics.ventilation_percent > 0 ? `${data.metrics.ventilation_percent}%` : ''}
          icon={<Wind className="w-5 h-5 text-blue-500" />}
          description="Control Automático"
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Evolution Charts */}
        <div className="lg:col-span-2 space-y-4">
           <Card className="h-full border-gray-200 shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-lg text-gray-800">Evolución de Parámetros</CardTitle>
               <div className="flex bg-gray-100 p-1 rounded-lg">
                 <button 
                   onClick={() => setActiveChart('environment')}
                   className={clsx(
                     "px-3 py-1 text-xs font-medium rounded-md transition-all",
                     activeChart === 'environment' ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
                   )}
                 >
                   Ambiente
                 </button>
                 <button 
                   onClick={() => setActiveChart('gases')}
                   className={clsx(
                     "px-3 py-1 text-xs font-medium rounded-md transition-all",
                     activeChart === 'gases' ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
                   )}
                 >
                   Gases (C2H4 / CO2)
                 </button>
               </div>
             </CardHeader>
             <CardContent>
               <div className="h-[320px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   {activeChart === 'environment' ? (
                     <AreaChart data={PROCESS_HISTORY}>
                       <defs>
                         <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                       <XAxis dataKey="timeLabel" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#9ca3af'}} minTickGap={30} />
                       <YAxis yAxisId="temp" domain={['dataMin - 1', 'dataMax + 1']} fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#9ca3af'}} />
                       <YAxis yAxisId="hum" orientation="right" domain={[80, 100]} fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#9ca3af'}} />
                       <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                       <Legend wrapperStyle={{paddingTop: '10px'}}/>
                       <Area yAxisId="temp" type="monotone" dataKey="temp_pulp" name="Temp. Pulpa (°C)" stroke="#ef4444" fillOpacity={0} strokeWidth={2} />
                       <Area yAxisId="temp" type="monotone" dataKey="temp_air" name="Temp. Aire (°C)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} />
                       <Line yAxisId="hum" type="monotone" dataKey="humidity" name="Humedad (%)" stroke="#10b981" strokeWidth={2} dot={false} />
                     </AreaChart>
                   ) : (
                     <LineChart data={PROCESS_HISTORY}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                       <XAxis dataKey="timeLabel" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#9ca3af'}} minTickGap={30} />
                       <YAxis yAxisId="left" stroke="#8b5cf6" fontSize={12} tickLine={false} axisLine={false} />
                       <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                       <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                       <Legend wrapperStyle={{paddingTop: '10px'}}/>
                       <Line yAxisId="left" type="step" dataKey="ethylene" name="Etileno (ppm)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                       <Line yAxisId="right" type="monotone" dataKey="co2" name="CO2 (%)" stroke="#6b7280" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                     </LineChart>
                   )}
                 </ResponsiveContainer>
               </div>
             </CardContent>
           </Card>
        </div>

        {/* 4. Last Sampling & Quick Actions */}
        <div className="space-y-6">
           <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-white to-gray-50">
             <CardHeader className="border-b border-gray-100 pb-3">
               <div className="flex items-center justify-between">
                 <CardTitle className="text-base text-gray-800 flex items-center gap-2">
                   <ClipboardCheck className="w-5 h-5 text-blue-600" />
                   Último Muestreo
                 </CardTitle>
                 <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200 shadow-sm">
                   {data.last_sampling.timestamp}
                 </span>
               </div>
             </CardHeader>
             <CardContent className="pt-4">
               <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-lg border-2 border-white shadow-sm">
                   {data.last_sampling.quality_score}
                 </div>
                 <div>
                   <p className="text-sm font-medium text-gray-900">Score de Calidad</p>
                   <p className="text-xs text-gray-500">Inspector: {data.last_sampling.technician}</p>
                 </div>
               </div>
               
               <div className="space-y-3">
                 {data.last_sampling.parameters.map((param, idx) => (
                   <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
                     <span className="text-sm text-gray-600">{param.name}</span>
                     <div className="flex items-center gap-2">
                       <span className="font-bold text-gray-900">{param.value} <span className="text-xs text-gray-400 font-normal">{param.unit}</span></span>
                       {Number(param.value) >= Number(param.target) ? (
                         <ArrowUpRight className="w-3 h-3 text-green-500" />
                       ) : (
                         <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>

               <Button className="w-full mt-6 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50">
                 Ver Historial de Muestreos
               </Button>
             </CardContent>
           </Card>

           <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
             <div className="flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
               <div>
                 <h4 className="font-semibold text-orange-800 text-sm">Alerta Predictiva</h4>
                 <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                   La generación de CO2 (+2.1%) indica un metabolismo acelerado. Considere aumentar ventilación en la próxima fase.
                 </p>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, unit, icon, trend, trendUp, description, color = "blue" }: any) => (
  <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
    <CardContent className="p-5">
      <div className="flex justify-between items-start mb-2">
         <div className={clsx("p-2 rounded-lg bg-opacity-10", `bg-${color}-500`)}>
           {icon}
         </div>
         {trend && (
           <span className={clsx("text-xs font-bold px-2 py-1 rounded-full", trendUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
             {trend}
           </span>
         )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-0.5">{title}</p>
        <div className="flex items-baseline gap-1">
          <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
          <span className="text-sm text-gray-500 font-medium">{unit}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-2">{description}</p>
      </div>
    </CardContent>
  </Card>
);
