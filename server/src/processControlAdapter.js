/**
 * Adaptador de comandos/telemetría por flota (Gourmet túnel / Greenyard / UltraOrganics TermoKing).
 * Misma lógica de procesos; cambia URL upstream, fan-out y enrutamiento por tipo.
 */
import {
  gourmetTradingEmpresaIdentificador,
  gourmetTradingTunnelUnitImeis,
  gourmetTunnelSensorImei,
  isGourmetTunnelAggregateDeviceId,
  isGourmetTunnelCommandDeviceId,
} from './gourmetFleet.js';
import { greenyardEmpresaIdentificador, isGreenyardDeviceId } from './greenyardFleet.js';
import {
  identificadorForUltraorganicsImei,
  isUltraorganicsDeviceId,
  isUltraorganicsScopedDeviceId,
  ultraorganicsCommandImeis,
  ultraorganicsFanOutUnits,
  ultraorganicsPanelDeviceIdForImei,
  ultraorganicsTelemetryImei,
} from './ultraorganicsFleet.js';
import {
  sendEthyleneDoseCommand,
  sendEthylenePollCommand,
  sendTunnelControlCommand,
} from './tunelControlClient.js';
import {
  sendTermoKingControlCommand,
  sendTermoKingEthyleneDoseCommand,
  sendTermoKingEthylenePollCommand,
} from './termokingControlClient.js';

export function isAutomatedControlDeviceId(deviceId) {
  const id = String(deviceId || '').trim();
  return (
    isGourmetTunnelCommandDeviceId(id) || isGreenyardDeviceId(id) || isUltraorganicsScopedDeviceId(id)
  );
}

/**
 * @param {string} deviceId
 */
export function resolveProcessControlAdapter(deviceId) {
  let id = String(deviceId || '').trim();
  if (!id) return null;
  if (isUltraorganicsScopedDeviceId(id) && !isUltraorganicsDeviceId(id)) {
    id = ultraorganicsPanelDeviceIdForImei(id);
  }

  if (isGourmetTunnelCommandDeviceId(id)) {
    return {
      fleet: 'gourmet',
      empresaIdentificador: gourmetTradingEmpresaIdentificador(),
      fanOutUnits(dev) {
        const d = String(dev || '').trim();
        if (isGourmetTunnelAggregateDeviceId(d)) return gourmetTradingTunnelUnitImeis();
        return [d];
      },
      sensorUnit(dev) {
        const d = String(dev || '').trim();
        if (isGourmetTunnelAggregateDeviceId(d)) return gourmetTunnelSensorImei();
        return d;
      },
      sendCommand(unitId, tipo, dato) {
        return sendTunnelControlCommand(unitId, tipo, dato);
      },
      sendEthylenePoll(unitId) {
        return sendEthylenePollCommand(unitId);
      },
      sendEthyleneDose(unitId, ppm) {
        return sendEthyleneDoseCommand(unitId, ppm);
      },
    };
  }

  if (isGreenyardDeviceId(id)) {
    return {
      fleet: 'greenyard',
      empresaIdentificador: greenyardEmpresaIdentificador(),
      fanOutUnits(dev) {
        return [String(dev || '').trim()];
      },
      sensorUnit(dev) {
        return String(dev || '').trim();
      },
      sendCommand(unitId, tipo, dato) {
        return sendTermoKingControlCommand(unitId, tipo, dato);
      },
      sendEthylenePoll(unitId) {
        return sendTermoKingEthylenePollCommand(unitId);
      },
      sendEthyleneDose(unitId, ppm) {
        return sendTermoKingEthyleneDoseCommand(unitId, ppm);
      },
    };
  }

  if (isUltraorganicsDeviceId(id)) {
    return {
      fleet: 'ultraorganics',
      empresaIdentificador: identificadorForUltraorganicsImei(id),
      identificadorForImei(imei) {
        return identificadorForUltraorganicsImei(imei);
      },
      fanOutUnits(dev) {
        return ultraorganicsFanOutUnits(String(dev || '').trim());
      },
      commandImeis(dev, tipo) {
        return ultraorganicsCommandImeis(String(dev || '').trim(), tipo);
      },
      telemetryImei(dev, field) {
        return ultraorganicsTelemetryImei(String(dev || '').trim(), field);
      },
      sensorUnit(dev) {
        return String(dev || '').trim();
      },
      sendCommand(unitId, tipo, dato) {
        return sendTermoKingControlCommand(unitId, tipo, dato);
      },
      sendEthylenePoll(unitId) {
        return sendTermoKingEthylenePollCommand(unitId);
      },
      sendEthyleneDose(unitId, ppm) {
        return sendTermoKingEthyleneDoseCommand(unitId, ppm);
      },
    };
  }

  return null;
}
