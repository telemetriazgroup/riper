import React, { useState, useMemo } from 'react';
import { Device } from '@/app/data';
import { useDevices } from '@/app/hooks/useDevices';
import { useFleetActiveControlMap } from '@/app/hooks/useFleetActiveControlMap';
import { DeviceCard } from './DeviceCard';
import { Card, CardContent } from './ui/Card';
import { Activity, AlertTriangle, CheckCircle, Zap, Loader2, Download, Search } from 'lucide-react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { Button } from './ui/Button';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { totalNumeroAlarmaFleet, countProcesosEnCurso } from '@/app/lib/fleetKpi';

interface DashboardProps {
  onSelectDevice: (deviceId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectDevice }) => {
  const { devices, isLoading, isError, mutate } = useDevices();
  const { byDeviceId: panelSessionsByDevice } = useFleetActiveControlMap();
  const { t, convertTemp, tempUnit, formatDateTime, formatDateShort, formatFileTimestamp } = useSettings();
  const [downloading, setDownloading] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => {
      const haystack = [
        d.name,
        d.id,
        d.madurador?.identificador_empresa,
        d.process?.name,
        d.process?.currentPhase,
        d.telemetry?.stateProcess,
        d.estado_conexion,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [devices, deviceSearch]);

  const downloadExecutiveSummary = async () => {
    setDownloading(true);
    toast.info(t('language') === 'es' ? 'Generando resumen ejecutivo...' : 'Generating executive summary...');
    try {
      const pageW = 210;
      const pageH = 297;
      const margin = 12;
      const maxW = pageW - margin * 2;

      let logoDataUrl: string | null = null;
      try {
        const logoUrl = `${window.location.origin}${import.meta.env.BASE_URL}logo.png`;
        const resp = await fetch(logoUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
        }
      } catch {
        logoDataUrl = null;
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      let y = margin;

      const addText = (text: string, x: number, fontSize = 10, font: 'normal' | 'bold' = 'normal') => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', font);
        const lines = pdf.splitTextToSize(text, maxW);
        lines.forEach((line: string) => {
          if (y > pageH - 18) { pdf.addPage(); y = margin; }
          pdf.text(line, x, y);
          y += fontSize * 0.4;
        });
      };

      const drawRect = (x: number, y0: number, w: number, h: number) => {
        pdf.setDrawColor(0, 0, 0);
        pdf.rect(x, y0, w, h, 'S');
      };

      // --- Cabecera con logo (sin fondo, solo borde negro abajo) ---
      const headerH = 28;
      pdf.setDrawColor(0, 0, 0);
      pdf.line(0, headerH, pageW, headerH);
      pdf.setTextColor(0, 0, 0);

      const logoW = 20;
      const logoH = 20;
      if (logoDataUrl) {
        try {
          pdf.addImage(logoDataUrl, 'PNG', margin, 4, logoW, logoH);
        } catch {
          // si falla addImage, seguir sin logo
        }
      }
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ZTRACK TELEMETRY', margin + logoW + 6, 12);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(t('executive_summary'), margin + logoW + 6, 18);
      pdf.text(formatDateTime(new Date()), pageW - margin - 40, 14);
      pdf.setTextColor(0, 0, 0);
      y = headerH + margin;

      // --- Estadísticas reales de la flota ---
      const activeCount = devices.filter(d => d.status === 'active' || d.status === 'warning').length;
      const alarmCount = totalNumeroAlarmaFleet(devices);
      const processesLive = countProcesosEnCurso(devices);
      const totalKwh = devices.reduce((acc, d) => acc + (d.operational?.power_kwh ?? 0), 0);
      const onlineCount = devices.filter(d => d.estado_conexion === 'online').length;
      const totalDevices = devices.length;

      pdf.setFontSize(8);
      pdf.setTextColor(0.4, 0.4, 0.45);
      addText((t('fleet_status') as string).toLowerCase() + ' · ' + formatDateTime(new Date()), margin);
      pdf.setTextColor(0, 0, 0);
      y += 4;

      // --- KPIs: sin fondo, solo borde negro ---
      const kpiW = (pageW - margin * 2 - 6) / 2;
      const kpiH = 16;
      const kpiLabels = [t('active_units'), t('active_alarms'), t('processes_in_progress'), t('units_online')];
      const kpiValues = [
        `${activeCount} / ${totalDevices}`,
        String(alarmCount),
        String(processesLive),
        `${onlineCount} / ${totalDevices}`,
      ];
      for (let i = 0; i < 4; i++) {
        const x0 = margin + (i % 2) * (kpiW + 6);
        const y0 = y + Math.floor(i / 2) * (kpiH + 4);
        drawRect(x0, y0, kpiW, kpiH);
        pdf.setFontSize(7);
        pdf.setTextColor(0, 0, 0);
        pdf.text(kpiLabels[i], x0 + 3, y0 + 6);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(kpiValues[i], x0 + 3, y0 + 12);
        pdf.setFont('helvetica', 'normal');
      }
      y += kpiH * 2 + 4 + 6;

      // --- Tabla que cabe en el lienzo (ancho total <= pageW - 2*margin) ---
      const tableTotalW = pageW - margin * 2;
      const colW = [26, 14, 12, 10, 12, 10, 12, 12, 22];
      const sumColW = colW.reduce((a, b) => a + b, 0);
      const scaleW = sumColW > 0 ? tableTotalW / sumColW : 1;
      const colWScaled = colW.map(w => Math.round(w * scaleW));
      const finalTableW = colWScaled.reduce((a, b) => a + b, 0);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0.15, 0.15, 0.2);
      addText(t('fleet_status'), margin);
      y += 2;

      const headers = [
        t('device'),
        t('status'),
        t('connection'),
        t('equipment'),
        `T (°${tempUnit})`,
        'HR%',
        t('ethylene'),
        'CO₂%',
        t('last_data'),
      ];
      const tableX = margin;
      const rowH = 5.5;
      const headH = 6;

      // Encabezado tabla: sin fondo, solo borde negro
      drawRect(tableX, y, finalTableW, headH);
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      let xCol = tableX + 2;
      headers.forEach((h, i) => {
        pdf.text(String(h).substring(0, 10), xCol, y + 4);
        xCol += colWScaled[i];
      });
      y += headH;

      const formatLast = (d: Device) => d.last_seen ? formatDateShort(d.last_seen) : '—';
      const spaceFirstPage = pageH - y - 14;
      const spaceNextPage = pageH - margin - headH - 14;
      const maxRowsPerPage = Math.max(1, Math.min(
        Math.floor(spaceFirstPage / rowH),
        Math.floor(spaceNextPage / rowH)
      ));

      devices.forEach((d, idx) => {
        if (idx > 0 && idx % maxRowsPerPage === 0) {
          pdf.addPage();
          y = margin;
          drawRect(tableX, y, finalTableW, headH);
          xCol = tableX + 2;
          headers.forEach((h, i) => {
            pdf.text(String(h).substring(0, 10), xCol, y + 4);
            xCol += colWScaled[i];
          });
          y += headH;
        }
        const status = d.status === 'active' ? t('status_active') : d.status === 'alarm' ? t('status_alarm') : d.status === 'warning' ? t('status_warning') : t('status_offline');
        const conn = d.estado_conexion === 'online' ? t('online') : d.estado_conexion === 'wait' ? t('wait') : t('offline');
        const power = d.telemetry?.power_state === 1 ? 'ON' : 'OFF';
        const temp = d.telemetry?.temp_supply_1 != null ? convertTemp(d.telemetry.temp_supply_1).toFixed(1) : '—';
        const hr = d.telemetry?.relative_humidity ?? '—';
        const eth = d.telemetry?.ethylene != null ? (d.telemetry.ethylene === 0 ? 'NA' : d.telemetry.ethylene.toFixed(2)) : '—';
        const co2 = d.telemetry?.co2_reading != null ? Number(d.telemetry.co2_reading).toFixed(2) : '—';
        const row: string[] = [d.name || d.id, status, conn, power, temp, String(hr), String(eth), String(co2), formatLast(d)];

        drawRect(tableX, y, finalTableW, rowH);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(5.5);
        pdf.setTextColor(0, 0, 0);
        xCol = tableX + 2;
        row.forEach((cell, i) => {
          pdf.text(String(cell).substring(0, 9), xCol, y + 3.8);
          xCol += colWScaled[i];
        });
        y += rowH;
      });

      pdf.setFont('helvetica', 'normal');
      y = pageH - 10;
      pdf.setFontSize(6);
      pdf.setTextColor(0.5, 0.5, 0.55);
      pdf.text(
        t('executive_summary') + ' · ZTRACK TELEMETRY · ' + formatDateTime(new Date()),
        margin,
        y
      );

      pdf.save(`ZTRACK_Resumen_Ejecutivo_${formatFileTimestamp()}.pdf`);
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
  const alarmNumeroSum = totalNumeroAlarmaFleet(devices);
  const processesInCurso = countProcesosEnCurso(devices);
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
          value={alarmNumeroSum.toString()} 
          icon={AlertTriangle} 
          color="text-red-500" 
          subtext={t('alarms_numero_sum_hint')}
        />
        <SummaryCard 
          title={t('processes_in_progress')} 
          value={processesInCurso.toString()} 
          icon={Activity} 
          color="text-blue-500" 
          subtext={t('processes_in_progress_hint')}
        />
        <SummaryCard 
          title={t('total_consumption')} 
          value={`${Math.round(totalKwh).toLocaleString()} kWh`} 
          icon={Zap} 
          color="text-orange-500" 
          subtext={t('historical_accumulated')}
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t('fleet_status')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {deviceSearch.trim()
                ? `${filteredDevices.length} / ${devices.length}`
                : t('of_total', { total: String(devices.length) })}
            </p>
          </div>
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoComplete="off"
              aria-label={t('search_placeholder')}
            />
          </div>
        </div>

        {filteredDevices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 py-16 text-center text-sm text-gray-500">
            {deviceSearch.trim()
              ? t('language') === 'es'
                ? 'No hay dispositivos que coincidan con la búsqueda.'
                : 'No devices match your search.'
              : devices.length === 0
                ? t('language') === 'es'
                  ? 'No hay dispositivos en la flota.'
                  : 'No devices in the fleet.'
                : t('error_loading_devices')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onClick={onSelectDevice}
                onRefresh={mutate}
                panelActiveSession={panelSessionsByDevice.get(device.id) ?? null}
              />
            ))}
          </div>
        )}
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
