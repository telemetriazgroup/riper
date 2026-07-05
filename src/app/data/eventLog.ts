/**
 * Bitácora de eventos y muestreos.
 * Tipos y datos simulados que imitan una operación real de maduración.
 */

export type LogEntryType = 'event' | 'sampling';

export type EventKind =
  | 'process_start'
  | 'process_stop'
  | 'phase_change'
  | 'alarm'
  | 'alarm_cleared'
  | 'setpoint_change'
  | 'power_on'
  | 'power_off'
  | 'manual_sample'
  | 'defrost'
  | 'door_open'
  | 'process_action'
  | 'control_process_start'
  | 'control_process_cancel'
  | 'control_process_complete'
  | 'control_temperature'
  | 'control_humidity'
  | 'control_co2'
  | 'control_ethylene'
  | 'control_ventilation'
  | 'control_general';

export interface LogEvent {
  id: string;
  type: 'event';
  timestamp: string; // ISO
  kind: EventKind;
  description: string;
  detail?: string;
  phase?: string;
  recipe?: string;
  /** Lecturas opcionales para columnas de trazabilidad (eventos de control). */
  temp?: number;
  humidity?: number;
  ethylene?: number;
  co2?: number;
}

export interface LogSampling {
  id: string;
  type: 'sampling';
  timestamp: string;
  temp: number;
  humidity: number;
  ethylene: number;
  co2: number;
  note?: string;
}

export type LogEntry = LogEvent | LogSampling;

/**
 * Bitácora simulada desactivada: los eventos reales vienen de sesiones de control.
 */
export function getMockEventLog(_deviceId: string): LogEntry[] {
  return [];
}
