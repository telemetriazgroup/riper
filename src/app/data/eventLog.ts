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
  | 'door_open';

export interface LogEvent {
  id: string;
  type: 'event';
  timestamp: string; // ISO
  kind: EventKind;
  description: string;
  detail?: string;
  phase?: string;
  recipe?: string;
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

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60 * 1000);
}

function toISO(d: Date): string {
  return d.toISOString();
}

/**
 * Genera una bitácora simulada de eventos y muestreos para un equipo (últimas ~48 h).
 */
export function getMockEventLog(_deviceId: string): LogEntry[] {
  const now = new Date();
  const entries: LogEntry[] = [];
  let id = 1;

  // Hace 48 h: inicio de proceso
  const t0 = addHours(now, -48);
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(t0),
    kind: 'process_start',
    description: 'Proceso iniciado',
    detail: 'Receta: Mango Kent Exportación',
    recipe: 'Mango Kent Exportación',
  });
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(addMinutes(t0, 2)),
    kind: 'phase_change',
    description: 'Cambio de fase',
    phase: 'Homogenización',
    detail: 'Hora 0/24',
  });

  // Muestreos cada ~4 h durante homogenización (24 h)
  for (let i = 0; i <= 6; i++) {
    const ts = addHours(t0, i * 4);
    entries.push({
      id: `s-${id++}`,
      type: 'sampling',
      timestamp: toISO(ts),
      temp: 18.5 + Math.random() * 1.5,
      humidity: 92 + Math.floor(Math.random() * 5),
      ethylene: 0,
      co2: 0.4 + Math.random() * 0.2,
      note: i === 0 ? 'Muestreo inicial' : undefined,
    });
  }

  // Fin homogenización, inicio maduración (24 h)
  const t24 = addHours(t0, 24);
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(t24),
    kind: 'phase_change',
    description: 'Cambio de fase',
    phase: 'Maduración',
    detail: 'Inyección etileno 100 ppm. Hora 24/48',
  });
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(addMinutes(t24, 5)),
    kind: 'setpoint_change',
    description: 'Setpoints actualizados',
    detail: 'Temp 20°C, HR 90%, Etileno 100 ppm',
  });

  // Muestreos durante maduración (cada 4 h)
  for (let i = 1; i <= 6; i++) {
    const ts = addHours(t24, i * 4);
    entries.push({
      id: `s-${id++}`,
      type: 'sampling',
      timestamp: toISO(ts),
      temp: 19.8 + Math.random() * 0.6,
      humidity: 87 + Math.floor(Math.random() * 6),
      ethylene: 98 + Math.floor(Math.random() * 8),
      co2: 1.2 + Math.random() * 1.5,
    });
  }

  // Alarma simulada hace 18 h (temperatura alta) y posterior clearing
  const tAlarm = addHours(now, -18);
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(tAlarm),
    kind: 'alarm',
    description: 'Alarma: Temperatura retorno alta',
    detail: 'Límite 22°C — Valor 23.1°C. Verificar ventilación.',
  });
  entries.push({
    id: `s-${id++}`,
    type: 'sampling',
    timestamp: toISO(addMinutes(tAlarm, 15)),
    temp: 22.8,
    humidity: 85,
    ethylene: 102,
    co2: 2.1,
    note: 'Muestreo post-alarma',
  });
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(addMinutes(tAlarm, 32)),
    kind: 'alarm_cleared',
    description: 'Alarma despejada',
    detail: 'Temperatura en rango.',
  });

  // Ciclo deshielo hace 12 h
  const tDefrost = addHours(now, -12);
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(tDefrost),
    kind: 'defrost',
    description: 'Ciclo de deshielo',
    detail: 'Duración 18 min.',
  });

  // Cambio a fase Ventilación hace 8 h
  const tVent = addHours(now, -8);
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(tVent),
    kind: 'phase_change',
    description: 'Cambio de fase',
    phase: 'Ventilación',
    detail: 'Hora 48/56. Reducción etileno.',
  });

  // Muestreos recientes (cada 2 h, última 8 h)
  for (let i = 0; i <= 4; i++) {
    const ts = addHours(tVent, i * 2);
    entries.push({
      id: `s-${id++}`,
      type: 'sampling',
      timestamp: toISO(ts),
      temp: 17.5 + Math.random() * 1,
      humidity: 82 + Math.floor(Math.random() * 6),
      ethylene: i < 2 ? 40 - i * 15 : 0,
      co2: 0.8 - i * 0.15 + Math.random() * 0.2,
    });
  }

  // Ajuste manual hace 2 h
  const tManual = addHours(now, -2);
  entries.push({
    id: `e-${id++}`,
    type: 'event',
    timestamp: toISO(tManual),
    kind: 'setpoint_change',
    description: 'Ajuste manual desde panel',
    detail: 'Temp 18°C, HR 88%',
  });
  entries.push({
    id: `s-${id++}`,
    type: 'sampling',
    timestamp: toISO(tManual),
    temp: 18.2,
    humidity: 87,
    ethylene: 5,
    co2: 0.5,
    note: 'Muestreo manual',
  });

  // Ordenar por timestamp descendente (más reciente primero)
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return entries;
}
