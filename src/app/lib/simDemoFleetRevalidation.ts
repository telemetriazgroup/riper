import { mutate as swrMutate } from 'swr';
import { clearMaduradorListCache } from '@/app/lib/maduradorCache';
import { FLEET_ACTIVE_CONTROL_SESSIONS_KEY } from '@/app/hooks/useFleetActiveControlMap';
import { RIPENING_PROCESSES_FLEET_SWR_KEY } from '@/app/hooks/useFleetRipeningTrackingMap';
import { isSimulatedInkapackingDevice, shouldShowSimulatedInkapackingFleet } from '@/app/lib/simulatedInkapackingFleet';

/** Tras cambiar seguimiento o panel de control en equipos demo (localStorage). */
export function revalidateSimDemoFleetViews(deviceId?: string) {
  if (!shouldShowSimulatedInkapackingFleet()) return;
  clearMaduradorListCache();
  void swrMutate('/api/devices');
  void swrMutate('fleetDemo:/api/devices');
  void swrMutate('gourmet:/api/devices');
  void swrMutate(FLEET_ACTIVE_CONTROL_SESSIONS_KEY);
  void swrMutate(RIPENING_PROCESSES_FLEET_SWR_KEY);
  const did = String(deviceId ?? '').trim();
  if (did && isSimulatedInkapackingDevice(did)) {
    void swrMutate(`/api/devices/${did}`);
    void swrMutate(`fleetDemo:/api/devices/${did}`);
    void swrMutate(`gourmet:/api/devices/${did}`);
  }
}
