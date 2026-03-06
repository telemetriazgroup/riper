import React from 'react';
import { LineChart, BarChart3, Table, TrendingUp } from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Datos históricos simulados para 24 horas
const historicalData = [
  { time: '00:00', temperatura: 19.8, humedad: 87, etileno: 95, co2: 2.5 },
  { time: '02:00', temperatura: 19.9, humedad: 88, etileno: 96, co2: 2.6 },
  { time: '04:00', temperatura: 20.1, humedad: 89, etileno: 97, co2: 2.7 },
  { time: '06:00', temperatura: 20.0, humedad: 88, etileno: 98, co2: 2.8 },
  { time: '08:00', temperatura: 20.2, humedad: 89, etileno: 99, co2: 2.9 },
  { time: '10:00', temperatura: 20.3, humedad: 90, etileno: 100, co2: 3.0 },
  { time: '12:00', temperatura: 20.5, humedad: 89, etileno: 101, co2: 3.1 },
  { time: '14:00', temperatura: 20.4, humedad: 88, etileno: 100, co2: 3.0 },
  { time: '16:00', temperatura: 20.2, humedad: 89, etileno: 99, co2: 2.9 },
  { time: '18:00', temperatura: 20.1, humedad: 90, etileno: 98, co2: 2.8 },
  { time: '20:00', temperatura: 20.0, humedad: 89, etileno: 97, co2: 2.7 },
  { time: '22:00', temperatura: 19.9, humedad: 88, etileno: 96, co2: 2.6 },
  { time: '24:00', temperatura: 19.8, humedad: 87, etileno: 95, co2: 2.5 }
];

interface HistoricalChartProps {
  title: string;
  description: string;
  highlightColor: string;
}

export const HistoricalTemperatureChart: React.FC<HistoricalChartProps> = ({ title, description, highlightColor }) => {
  return (
    <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid ' + highlightColor }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'rgb(15, 23, 42)' }}>
            <LineChart className="h-5 w-5 animate-pulse" style={{ color: highlightColor }} />
            {title}
          </h3>
          <p className="text-sm mt-1" style={{ color: 'rgb(100, 116, 139)' }}>{description}</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded text-xs font-medium" style={{ backgroundColor: highlightColor, color: 'rgb(255, 255, 255)' }}>
            24h
          </button>
          <button className="px-3 py-1 rounded text-xs" style={{ backgroundColor: 'rgb(241, 245, 249)', color: 'rgb(100, 116, 139)' }}>
            7d
          </button>
          <button className="px-3 py-1 rounded text-xs" style={{ backgroundColor: 'rgb(241, 245, 249)', color: 'rgb(100, 116, 139)' }}>
            30d
          </button>
        </div>
      </div>

      {/* Gráfica de Temperatura */}
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={300}>
          <RechartsLineChart data={historicalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(226, 232, 240)" />
            <XAxis 
              dataKey="time" 
              stroke="rgb(100, 116, 139)"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="rgb(100, 116, 139)"
              style={{ fontSize: '12px' }}
              label={{ value: '°C', angle: -90, position: 'insideLeft', style: { fill: 'rgb(100, 116, 139)' } }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgb(255, 255, 255)', 
                border: '1px solid rgb(226, 232, 240)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
              labelStyle={{ color: 'rgb(15, 23, 42)', fontWeight: 'bold' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="temperatura" 
              stroke="rgb(239, 68, 68)" 
              strokeWidth={3}
              name="Temperatura (°C)"
              dot={{ fill: 'rgb(239, 68, 68)', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4 pt-4 border-t" style={{ borderColor: 'rgb(226, 232, 240)' }}>
        <div className="text-center">
          <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Promedio</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(239, 68, 68)' }}>20.1°C</p>
        </div>
        <div className="text-center">
          <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Máximo</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(239, 68, 68)' }}>20.5°C</p>
        </div>
        <div className="text-center">
          <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Mínimo</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(37, 99, 235)' }}>19.8°C</p>
        </div>
        <div className="text-center">
          <p className="text-xs mb-1" style={{ color: 'rgb(100, 116, 139)' }}>Desviación</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(100, 116, 139)' }}>±0.25°C</p>
        </div>
      </div>
    </div>
  );
};

export const MultiParameterChart: React.FC<HistoricalChartProps> = ({ title, description, highlightColor }) => {
  return (
    <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid ' + highlightColor }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'rgb(15, 23, 42)' }}>
            <BarChart3 className="h-5 w-5 animate-pulse" style={{ color: highlightColor }} />
            {title}
          </h3>
          <p className="text-sm mt-1" style={{ color: 'rgb(100, 116, 139)' }}>{description}</p>
        </div>
      </div>

      {/* Gráfica Multi-Parámetro */}
      <ResponsiveContainer width="100%" height={350}>
        <RechartsLineChart data={historicalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(226, 232, 240)" />
          <XAxis 
            dataKey="time" 
            stroke="rgb(100, 116, 139)"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            yAxisId="left"
            stroke="rgb(100, 116, 139)"
            style={{ fontSize: '12px' }}
            label={{ value: '°C / %', angle: -90, position: 'insideLeft', style: { fill: 'rgb(100, 116, 139)' } }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="rgb(100, 116, 139)"
            style={{ fontSize: '12px' }}
            label={{ value: 'ppm / %', angle: 90, position: 'insideRight', style: { fill: 'rgb(100, 116, 139)' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgb(255, 255, 255)', 
              border: '1px solid rgb(226, 232, 240)',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="line"
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="temperatura" 
            stroke="rgb(239, 68, 68)" 
            strokeWidth={2}
            name="Temperatura (°C)"
            dot={{ r: 3 }}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="humedad" 
            stroke="rgb(34, 197, 94)" 
            strokeWidth={2}
            name="Humedad (%)"
            dot={{ r: 3 }}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="etileno" 
            stroke="rgb(234, 88, 12)" 
            strokeWidth={2}
            name="Etileno (ppm)"
            dot={{ r: 3 }}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="co2" 
            stroke="rgb(147, 51, 234)" 
            strokeWidth={2}
            name="CO₂ (%)"
            dot={{ r: 3 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DataTable: React.FC<{ highlightColor: string }> = ({ highlightColor }) => {
  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid ' + highlightColor }}>
      <div className="p-4" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'rgb(15, 23, 42)' }}>
          <Table className="h-5 w-5 animate-pulse" style={{ color: highlightColor }} />
          Tabla de Datos Históricos
        </h3>
        <p className="text-sm mt-1" style={{ color: 'rgb(100, 116, 139)' }}>
          Últimas 12 mediciones registradas en las últimas 24 horas
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(71, 85, 105)' }}>Hora</th>
              <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(239, 68, 68)' }}>Temperatura</th>
              <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(34, 197, 94)' }}>Humedad</th>
              <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(234, 88, 12)' }}>Etileno</th>
              <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>CO₂</th>
              <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(71, 85, 105)' }}>Tendencia</th>
            </tr>
          </thead>
          <tbody>
            {historicalData.map((row, index) => (
              <tr 
                key={index} 
                className={index % 2 === 0 ? '' : 'bg-gray-50'}
                style={{ 
                  backgroundColor: index % 2 === 0 ? 'rgb(255, 255, 255)' : 'rgb(249, 250, 251)',
                  borderBottom: '1px solid rgb(226, 232, 240)'
                }}
              >
                <td className="px-4 py-3 text-sm font-medium" style={{ color: 'rgb(15, 23, 42)' }}>
                  {row.time}
                </td>
                <td className="px-4 py-3 text-sm text-center" style={{ color: 'rgb(239, 68, 68)' }}>
                  {row.temperatura.toFixed(1)}°C
                </td>
                <td className="px-4 py-3 text-sm text-center" style={{ color: 'rgb(34, 197, 94)' }}>
                  {row.humedad}%
                </td>
                <td className="px-4 py-3 text-sm text-center" style={{ color: 'rgb(234, 88, 12)' }}>
                  {row.etileno} ppm
                </td>
                <td className="px-4 py-3 text-sm text-center" style={{ color: 'rgb(147, 51, 234)' }}>
                  {row.co2.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-center">
                  {index < historicalData.length - 1 && (
                    <div className="flex items-center justify-center gap-1">
                      {row.temperatura > historicalData[index + 1]?.temperatura ? (
                        <TrendingUp className="h-4 w-4" style={{ color: 'rgb(239, 68, 68)' }} />
                      ) : (
                        <TrendingUp className="h-4 w-4 transform rotate-180" style={{ color: 'rgb(37, 99, 235)' }} />
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen estadístico */}
      <div className="p-4" style={{ backgroundColor: 'rgb(248, 250, 252)', borderTop: '2px solid rgb(226, 232, 240)' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-medium mb-1" style={{ color: 'rgb(71, 85, 105)' }}>Temperatura</p>
            <p style={{ color: 'rgb(239, 68, 68)' }}>Min: 19.8°C | Max: 20.5°C</p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'rgb(71, 85, 105)' }}>Humedad</p>
            <p style={{ color: 'rgb(34, 197, 94)' }}>Min: 87% | Max: 90%</p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'rgb(71, 85, 105)' }}>Etileno</p>
            <p style={{ color: 'rgb(234, 88, 12)' }}>Min: 95 ppm | Max: 101 ppm</p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'rgb(71, 85, 105)' }}>CO₂</p>
            <p style={{ color: 'rgb(147, 51, 234)' }}>Min: 2.5% | Max: 3.1%</p>
          </div>
        </div>
      </div>
    </div>
  );
};
