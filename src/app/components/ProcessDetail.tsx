import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Box, 
  ClipboardCheck, 
  Camera, 
  Plus, 
  Save, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  FlaskConical,
  Trash2
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { clsx } from 'clsx';

interface ProcessDetailProps {
  processId?: string; // Optional if we pass full data object
  processData?: any; // To accept full object from List
  onBack: () => void;
}

// --- Mock Data Types ---
type SamplingType = 'initial' | 'monitoring' | 'final';

interface SamplingParameter {
  id: string;
  name: string;
  value: string;
  unit: string;
  target?: string;
}

// --- Fallback Data if only ID is provided ---
const FALLBACK_DATA = {
  id: "PROC-2024-88",
  status: "active",
  client: { name: "Mango Aérea de Colombia S.A.", type: "external" },
  batch: { product: "Mango Tommy Atkins", origin: "Tolima", quantity_kg: 4500, quantity_m3: 12.5, box_count: 320, entry_date: "2024-02-02T08:30:00" },
  recipe: { name: "Maduración Exportación", duration_hours: 72, targets: { brix: "14-16", firmness: "10-12", color: "4.5" } },
  timeline: []
};

export const ProcessDetail: React.FC<ProcessDetailProps> = ({ processId, processData, onBack }) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'planning'>('timeline');
  const [isSamplingModalOpen, setIsSamplingModalOpen] = useState(false);
  
  // Use passed data or fallback
  const data = processData || FALLBACK_DATA;
  const [events, setEvents] = useState(data.timeline || []);

  const handleSaveSampling = (newSample: any) => {
    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'sampling',
      title: `Muestreo de ${newSample.type === 'initial' ? 'Inicio' : newSample.type === 'final' ? 'Cierre' : 'Seguimiento'}`,
      timestamp: new Date().toISOString(),
      user: "Usuario Actual",
      data: newSample.parameters,
      images: newSample.images
    };
    // @ts-ignore
    setEvents([newEvent, ...events]);
    setIsSamplingModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-10">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={onBack}>
               <ArrowLeft className="w-5 h-5" />
             </Button>
             <div>
               <h1 className="text-2xl font-bold text-gray-900">{data.client.name}</h1>
               <div className="flex items-center gap-2 text-sm text-gray-500">
                 <span className={clsx("px-2 py-0.5 rounded-full text-xs font-semibold", 
                   data.client.type === 'external' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                 )}>
                   {data.client.type === 'external' ? 'Servicio Externo' : 'Propio'}
                 </span>
                 <span>•</span>
                 <span>{data.id}</span>
               </div>
             </div>
          </div>
          <div className="flex gap-2">
            <Button 
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setIsSamplingModalOpen(true)}
            >
              <ClipboardCheck className="w-4 h-4" />
              Registrar Muestreo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-gray-100">
           <div className="flex items-start gap-3">
             <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
               <Box className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Producto / Lote</p>
               <p className="font-semibold text-gray-900">{data.batch.product}</p>
               <p className="text-xs text-gray-500">{data.batch.box_count} Cajas</p>
             </div>
           </div>

           <div className="flex items-start gap-3">
             <div className="p-2 bg-green-50 rounded-lg text-green-600">
               <MapPin className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Procedencia</p>
               <p className="font-semibold text-gray-900">{data.batch.origin}</p>
               <p className="text-xs text-gray-500">{new Date(data.batch.entry_date).toLocaleDateString()}</p>
             </div>
           </div>

           <div className="flex items-start gap-3">
             <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
               <FlaskConical className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Receta Activa</p>
               <p className="font-semibold text-gray-900">{data.recipe.name}</p>
               <p className="text-xs text-gray-500">Target Brix: {data.recipe.targets.brix}</p>
             </div>
           </div>

           <div className="flex items-start gap-3">
             <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
               <TrendingUp className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Volumen Ingresado</p>
               <p className="font-semibold text-gray-900">{data.batch.quantity_kg.toLocaleString()} kg</p>
               <p className="text-xs text-gray-500">{data.batch.quantity_m3} m³</p>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Timeline & Activity */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
             <div className="border-b border-gray-100 p-4">
               <h3 className="font-bold text-gray-800">Bitácora de Eventos y Muestreos</h3>
             </div>
             <div className="p-6 bg-gray-50/50 min-h-[400px]">
               <div className="relative pl-6 border-l-2 border-gray-200 space-y-8">
                 {events.map((event: any, idx: number) => (
                   <div key={event.id} className="relative animate-in slide-in-from-left duration-500">
                     <div className={clsx(
                       "absolute -left-[33px] w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
                       event.type === 'sampling' ? "bg-blue-500 text-white" :
                       event.type === 'alert' ? "bg-red-500 text-white" : "bg-gray-200 text-gray-500"
                     )}>
                       {event.type === 'sampling' ? <ClipboardCheck className="w-4 h-4" /> : 
                        event.type === 'alert' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                     </div>
                     
                     <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                       <div className="flex justify-between items-start mb-2">
                         <div>
                           <h4 className="font-bold text-gray-900">{event.title}</h4>
                           <p className="text-xs text-gray-500 flex items-center gap-1">
                             <Clock className="w-3 h-3" />
                             {new Date(event.timestamp).toLocaleString()}
                             {event.user && <span>• {event.user}</span>}
                           </p>
                         </div>
                         <span className="text-xs font-mono text-gray-400">#{event.id.split('-')[1]}</span>
                       </div>

                       {event.description && (
                         <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                       )}

                       {/* Sampling Data Rendering */}
                       {event.data && (
                         <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                           {/* @ts-ignore */}
                           {event.data.map((item: any, i: number) => (
                             <div key={i} className="bg-blue-50 p-2 rounded border border-blue-100">
                               <p className="text-xs text-blue-600 font-medium">{item.name}</p>
                               <p className="font-bold text-gray-900">{item.value} <span className="text-xs font-normal text-gray-500">{item.unit}</span></p>
                             </div>
                           ))}
                         </div>
                       )}

                       {/* Images Rendering */}
                       {event.images && event.images.length > 0 && (
                         <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                           {event.images.map((img: any, i: number) => (
                             <div key={i} className="relative group min-w-[100px] w-[120px] h-[120px] rounded-lg overflow-hidden border border-gray-200">
                               <ImageWithFallback src={img.url} alt={img.desc} className="w-full h-full object-cover" />
                               <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                 <p className="text-white text-[10px] truncate">{img.desc}</p>
                                </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </div>
        </div>

        {/* Right Column: Planning & Status */}
        <div className="space-y-6">
           <Card className="border-gray-200 shadow-sm">
             <CardHeader className="pb-2">
               <CardTitle className="text-base">Cumplimiento vs Planificación</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 <div className="space-y-1">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">Grados Brix</span>
                     <span className="font-bold text-gray-900">
                       {/* Simulate actual data for visualization */}
                       8.5 <span className="text-gray-400 font-normal">/ {data.recipe.targets.brix}</span>
                     </span>
                   </div>
                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                     <div className="h-full bg-orange-400 w-[60%]"></div>
                   </div>
                 </div>

                 <div className="space-y-1">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">Firmeza</span>
                     <span className="font-bold text-gray-900">
                       22.0 <span className="text-gray-400 font-normal">/ {data.recipe.targets.firmness}</span>
                     </span>
                   </div>
                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 w-[40%]"></div>
                   </div>
                   <p className="text-xs text-orange-600 mt-1">Alta firmeza - Retrasar proceso recomendado.</p>
                 </div>

                 <div className="space-y-1">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">Color (Escala)</span>
                     <span className="font-bold text-gray-900">
                        1.5 <span className="text-gray-400 font-normal">/ {data.recipe.targets.color}</span>
                     </span>
                   </div>
                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                     <div className="h-full bg-green-500 w-[20%]"></div>
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>

           <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-blue-600 to-blue-800 text-white">
             <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-1">Días Restantes</h3>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-4xl font-bold">
                    {/* Calculate remaining days or mock */}
                    2.5
                  </span>
                  <span className="text-blue-200 mb-1">días</span>
                </div>
                <div className="flex items-center justify-between text-sm text-blue-100 border-t border-blue-500 pt-3">
                   <span>Inicio: {new Date(data.timeline[0]?.timestamp || Date.now()).toLocaleDateString()}</span>
                   <span>Progreso: 35%</span>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>

      {/* Sampling Modal */}
      {isSamplingModalOpen && (
        <SamplingModal 
          isOpen={isSamplingModalOpen} 
          onClose={() => setIsSamplingModalOpen(false)} 
          onSave={handleSaveSampling} 
        />
      )}
    </div>
  );
};

// --- Subcomponent: Sampling Modal ---
const SamplingModal = ({ isOpen, onClose, onSave }: any) => {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<SamplingType>('monitoring');
  const [parameters, setParameters] = useState<SamplingParameter[]>([
    { id: '1', name: 'Grado Brix (°)', value: '', unit: '°Bx', target: '15' },
    { id: '2', name: 'Firmeza (lb)', value: '', unit: 'lb', target: '12' },
    { id: '3', name: 'Color (Escala 1-7)', value: '', unit: 'Escala', target: '4' },
    { id: '4', name: 'Materia Seca (%)', value: '', unit: '%', target: '20' },
    { id: '5', name: 'pH', value: '', unit: 'pH', target: '5.5' },
    { id: '6', name: 'Acidez (%)', value: '', unit: '%', target: '0.5' },
  ]);
  const [newParamName, setNewParamName] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddParam = () => {
    if (!newParamName) return;
    setParameters([...parameters, { id: Date.now().toString(), name: newParamName, value: '', unit: 'Personalizado' }]);
    setNewParamName('');
  };

  const handleValueChange = (id: string, val: string) => {
    setParameters(parameters.map(p => p.id === id ? { ...p, value: val } : p));
  };

  const handleDeleteParam = (id: string) => {
    setParameters(parameters.filter(p => p.id !== id));
  };

  const handleSave = () => {
    // Mock image for demo
    const mockImage = { 
      url: "https://images.unsplash.com/photo-1730312382518-edb3dce6f303?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", 
      desc: "Muestra tomada en laboratorio" 
    };
    
    onSave({
      type,
      parameters: parameters.filter(p => p.value !== ''),
      notes,
      images: [mockImage]
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="text-blue-600" />
            Registrar Muestreo
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="sr-only">Cerrar</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tipo de Muestreo</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'initial', label: 'Inicial / Recepción' },
                { id: 'monitoring', label: 'Seguimiento' },
                { id: 'final', label: 'Final / Liberación' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id as SamplingType)}
                  className={clsx(
                    "px-4 py-3 rounded-lg text-sm font-medium border transition-all",
                    type === t.id 
                      ? "bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500" 
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Parameters */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <label className="text-sm font-medium text-gray-700">Parámetros de Calidad</label>
               <span className="text-xs text-gray-500">Ingrese solo los valores medidos</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {parameters.map((param) => (
                <div key={param.id} className="relative">
                  <label className="block text-xs text-gray-500 mb-1">{param.name} ({param.unit})</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      placeholder={param.target ? `Meta: ${param.target}` : "-"}
                      value={param.value}
                      onChange={(e) => handleValueChange(param.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {/* Allow deleting custom params (simulated logic for custom params would go here) */}
                    {param.unit === 'Personalizado' && (
                       <button onClick={() => handleDeleteParam(param.id)} className="text-red-400 hover:text-red-600">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom Parameter */}
            <div className="flex gap-2 items-center pt-2 border-t border-gray-100 border-dashed">
              <input 
                type="text" 
                placeholder="Nombre nuevo parámetro..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={newParamName}
                onChange={(e) => setNewParamName(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={handleAddParam} disabled={!newParamName}>
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
          </div>

          {/* Evidence */}
          <div className="space-y-2">
             <label className="text-sm font-medium text-gray-700">Evidencia Fotográfica</label>
             <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer">
               <Camera className="w-8 h-8 text-gray-400 mb-2" />
               <p className="text-sm text-gray-600">Arrastra fotos aquí o haz clic para subir</p>
               <p className="text-xs text-gray-400 mt-1">Soporta JPG, PNG</p>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Observaciones / Notas</label>
            <textarea 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px] text-sm"
              placeholder="Describa condiciones anormales, apariencia visual..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" /> Guardar Muestreo
          </Button>
        </div>
      </div>
    </div>
  );
};
