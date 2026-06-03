import type { Device, TelemetryData } from '@/app/data';
import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import { controlSessionProgressPct } from '@/app/lib/deviceControlProcessApi';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { getPanelControlProcessTitle } from '@/app/lib/fleetProcessLabels';
import { getUltraorganicsPanelForImei, isUltraorganicsSession } from '@/app/lib/fleetDemo';
import { mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';

function labelToStateProcess(label: string): TelemetryData['stateProcess'] {
  const p = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (p.includes('homogen')) return 'Homogenization';
  if (p.includes('madur') || p.includes('ripen')) return 'Ripening';
  if (p.includes('ventil')) return 'Ventilation';
  if (p.includes('cool') || p.includes('enfri')) return 'Cooling';
  return 'Integral';
}

function panelTypeToState(processType: string): TelemetryData['stateProcess'] {
  const pt = String(processType || '').trim();
  if (pt === 'Homogenization') return 'Homogenization';
  if (pt === 'Ripening') return 'Ripening';
  if (pt === 'Ventilation') return 'Ventilation';
  if (pt === 'Cooling') return 'Cooling';
  return 'Integral';
}

/** Refleja sesiones de panel y seguimientos activos en `device.process` (KPI flota + tarjetas). */
export function applyFleetProcessOverlay(
  devices: Device[],
  panelByDevice: Map<string, DeviceControlSessionRow>,
  trackingByDevice: Map<string, RipeningProcessRow>,
  t: (key: string) => string
): Device[] {
  const trackingByPanel = new Map<string, RipeningProcessRow>();
  if (isUltraorganicsSession()) {
    for (const [did, row] of trackingByDevice) {
      const panelId = getUltraorganicsPanelForImei(did);
      if (!trackingByPanel.has(panelId)) trackingByPanel.set(panelId, row);
    }
  }

  return devices.map((device) => {
    const id = String(device.id ?? '').trim();
    const tracking = isUltraorganicsSession()
      ? trackingByPanel.get(id) ?? trackingByDevice.get(id)
      : trackingByDevice.get(id);
    const panel = panelByDevice.get(id);

    if (tracking) {
      const view = mapRowToProcessView(tracking);
      const sched = tracking.payload?.scheduleSummary as
        | { startedAt?: string; estimatedEndAt?: string | null }
        | undefined;
      const phaseLabel = view.phase || tracking.display_name || 'Seguimiento';
      return {
        ...device,
        process: {
          name: tracking.display_name || phaseLabel,
          progress: Number.isFinite(view.progress) ? Math.min(100, Math.max(0, view.progress)) : 0,
          startTime: sched?.startedAt ?? device.process?.startTime ?? new Date().toISOString(),
          endTime: sched?.estimatedEndAt ?? device.process?.endTime ?? new Date().toISOString(),
          currentPhase: phaseLabel,
          showProgressBar: true,
        },
        telemetry: {
          ...device.telemetry,
          stateProcess: labelToStateProcess(phaseLabel),
        },
      };
    }

    if (panel?.status === 'active') {
      const title = getPanelControlProcessTitle(panel.process_type, panel.display_label, t);
      return {
        ...device,
        process: {
          name: title,
          progress: controlSessionProgressPct(panel),
          startTime: panel.started_at,
          endTime: panel.estimated_end_at,
          currentPhase: panel.process_type,
          showProgressBar: true,
        },
        telemetry: {
          ...device.telemetry,
          stateProcess: panelTypeToState(panel.process_type),
        },
      };
    }

    return device;
  });
}
