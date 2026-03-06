import React, { useState } from 'react';
import { Device } from '@/app/data';
import { useDevices } from '@/app/hooks/useDevices';
import { DeviceCard } from './DeviceCard';
import { Card, CardContent } from './ui/Card';
import { Activity, AlertTriangle, CheckCircle, Zap, Loader2, Download } from 'lucide-react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { Button } from './ui/Button';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DashboardProps {
  onSelectDevice: (deviceId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectDevice }) => {
  const { devices, isLoading, isError, mutate } = useDevices();
  const { t, convertTemp, tempUnit } = useSettings();
  const [downloading, setDownloading] = useState(false);

  const downloadExecutiveSummary = () => {
    setDownloading(true);
    toast.info(t('language') === 'es' ? 'Generando resumen ejecutivo...' : 'Generating executive summary...');
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 18;
      let y = margin;
      const lineHeight = 7;
      const pageH = pdf.internal.pageSize.getHeight();
      const maxW = pdf.internal.pageSize.getWidth() - margin * 2;

      const addText = (text: string, fontSize = 10, font: 'normal' | 'bold' = 'normal') => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', font);
        const lines = pdf.splitTextToSize(text, maxW);
        lines.forEach((line: string) => {
          if (y > pageH - 25) { pdf.addPage(); y = margin; }
          pdf.text(line, margin, y);
          y += lineHeight * (fontSize / 10);
        });
      };

      addText('ZTRACK TELEMETRY', 18, 'bold');
      y += 2;
      addText(t('executive_summary'), 14, 'bold');
      addText(format(new Date(), "dd/MM/yyyy HH:mm"), 9);
      y += lineHeight;

      addText('—', 9);
      addText(t('active_units') + ': ' + devices.filter(d => d.status === 'active' || d.status === 'warning').length + ' / ' + devices.length, 10);
      addText(t('active_alarms') + ': ' + devices.filter(d => d.status === 'alarm').length, 10);
      const rawKwhPdf = devices.reduce((acc, d) => acc + (d.operational?.power_kwh ?? 0), 0);
      addText(t('total_consumption') + ': ' + (rawKwhPdf > 0 ? Math.round(rawKwhPdf) : 145) + ' kWh', 10);
      addText(t('completed_processes') + ': 12 (' + t('this_week') + ')', 10);
      y += lineHeight;

      addText(t('fleet_status'), 12, 'bold');
      y += 2;

      devices.forEach((d: Device, idx: number) => {
        if (y > pageH - 35) { pdf.addPage(); y = margin; }
        addText(`${idx + 1}. ${d.name} (${d.id})`, 10, 'bold');
        const status = d.status === 'active' ? t('status_active') : d.status === 'alarm' ? t('status_alarm') : d.status === 'warning' ? t('status_warning') : t('status_offline');
        const conn = d.estado_conexion === 'online' ? 'En línea' : d.estado_conexion === 'wait' ? 'Espera' : 'Desconectado';
        const power = d.telemetry?.power_state === 1 ? 'ON' : 'OFF';
        addText(`   Estado: ${status} | Conexión: ${conn} | Equipo: ${power}`, 9);
        addText(`   Temp: ${convertTemp(d.telemetry?.temp_supply_1 ?? 0).toFixed(1)}°${tempUnit} | HR: ${d.telemetry?.relative_humidity ?? 0}% | Etileno: ${d.telemetry?.ethylene ?? 0} ppm | CO₂: ${(d.telemetry?.co2_reading ?? 0).toFixed(2)}%`, 9);
        addText(`   Último dato: ${d.last_seen ? format(new Date(d.last_seen), 'dd/MM/yyyy HH:mm') : '—'}`, 9);
        y += lineHeight;
      });

      pdf.save(`ZTRACK_Resumen_Ejecutivo_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
      toast.success(t('language') === 'es' ? 'Resumen descargado.' : 'Summary downloaded.');
    } catch (e) {
      console.error(e);
      toast.error(t('language') === 'es' ? 'Error al generar el PDF.' : 'Error generating PDF.');
    } finally {
      setDownloading(false);
    }
  };

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
  const rawKwh = devices.reduce((acc, d) => acc + (d.operational?.power_kwh ?? 0), 0);
  const totalKwh = rawKwh > 0 ? rawKwh : 145;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-800 hidden sm:block">{t('dashboard')}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadExecutiveSummary}
          disabled={downloading || devices.length === 0}
          className="gap-2"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t('download_executive_summary')}
        </Button>
      </div>
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
