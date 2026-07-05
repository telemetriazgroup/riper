/**
 * Especificación exportable de la lógica de control TUNEL / TermoKing (Riper).
 * Para implementación en sistemas externos.
 */
import { maduradorApiBase } from './tunelControlClient.js';
import {
  AUTOMATED_PROCESS_TYPES,
  CONTROL_AUTOMATION_PROCESS_TYPES,
  CO2_MAX_ADJUST_ATTEMPTS,
  CO2_MAINTENANCE_MS,
  CO2_VERIFY_MS,
  COOLING_RETURN_EXCESS_THRESHOLD_C,
  COOLING_TEMP_AGGRESSIVE_OFFSET_C,
  COOLING_TEMP_OFFSET_C,
  ETHYLENE_CYCLE_MS,
  ETHYLENE_STEADY_MONITOR_MS,
  GOURMET_PROCESS_POLL_MS,
  HOURLY_REVIEW_MS,
  HUMIDITY_MAX_ADJUST_ATTEMPTS,
  HUMIDITY_VERIFY_MS,
  STOP_PLAN_END_DATO,
  STOP_PLAN_END_LEAD_MS,
  STOP_PLAN_HOURLY_MS,
  STOP_PLAN_MAINTAIN_DATO,
  STOP_PLAN_PHASE_MAX_A,
  STOP_PLAN_PHASE_VIOLATION_MS,
  STOP_PLAN_POLL_MS,
  TEMP_HUMIDITY_MAINTENANCE_MS,
  TEMP_MAX_ADJUST_ATTEMPTS,
  TEMP_VERIFY_MS,
  VENTILATION_END_LEAD_MS,
  VENTILATION_VERIFY_MS,
} from './gourmetProcessControl.js';
import {
  ETHYLENE_POLL_INTERVAL_MS,
  ETHYLENE_READINGS_NEEDED,
  ETHYLENE_VERIFY_DELAY_MS,
  POLL_INTERVAL_MS,
  SIMPLE_VERIFY_DELAY_MS,
} from './tunnelCommandCompliance.js';
import {
  ETHYLENE_MAX_DOSE,
  ETHYLENE_MAX_READING,
  ETHYLENE_NONZERO_HISTORY_MAX,
  ETHYLENE_RECENT_DOSE_MS,
} from './ethyleneReading.js';
import { IDLE_COMMAND_QUIET_MS } from './deviceCommandLedger.js';
import {
  gourmetTradingDeviceImeis,
  gourmetTradingEmailLogin,
  gourmetTradingEmpresaIdentificador,
  gourmetTradingStandaloneImei,
  gourmetTradingTunnelUnitImeis,
  gourmetTunnelDeviceId,
  gourmetTunnelEthyleneImei,
} from './gourmetFleet.js';
import { greenyardDeviceImeis, greenyardEmailLogin, greenyardEmpresaIdentificador } from './greenyardFleet.js';
import {
  ultraorganicsPanelImeis,
  ultraorganicsDeviceGroupsMap,
} from './ultraorganicsFleet.js';

const COMMAND_TYPES = [
  {
    tipo: 0,
    name: 'ethylene_poll_or_legacy',
    datoFormat: 'integer',
    description:
      'Consulta etileno: dato=1 (dispara lectura campo_1). Legacy: dato=ppm en algunos flujos antiguos.',
  },
  { tipo: 1, name: 'temperature_setpoint', datoFormat: 'celsius_one_decimal', description: 'Consigna temperatura (°C, un decimal).' },
  { tipo: 2, name: 'humidity_setpoint', datoFormat: 'integer', description: 'Consigna humedad relativa (%).' },
  { tipo: 3, name: 'co2_limit', datoFormat: 'one_decimal', description: 'Límite / objetivo CO₂ (%).' },
  { tipo: 5, name: 'ethylene_dose', datoFormat: 'integer_ppm', description: 'Inyección incremental etileno (ppm, máx. 120 por comando).' },
  { tipo: 6, name: 'ventilation', datoFormat: 'integer', description: 'Ventilación: objetivo AVL ~220 CFM; si CO₂ alto en maduración, AVL < 30.' },
  {
    tipo: 10,
    name: 'stop_plan',
    datoFormat: 'integer',
    description: 'STOP PLAN: dato 7200 mantiene suspendido (reenviar cada hora); dato 300 a 5 min del fin.',
  },
];

const MANUAL_COMMAND_KINDS = {
  temperature: { tunnelTipo: 1, verifyField: 'set_point', tolerance: 0.3 },
  humidity: { tunnelTipo: 2, verifyField: 'humidity_set_point', tolerance: 1 },
  ventilation: { tunnelTipo: 6, verifyField: 'avl', tolerance: 2 },
  ethylene: { tunnelTipo: 5, verifyField: 'campo_1', tolerance: 0.5 },
};

import { loadControlAutomationConfig } from './controlAutomationConfig.js';

export async function buildControlLogicExport() {
  const base = maduradorApiBase();
  const automationCfg = await loadControlAutomationConfig();
  return {
    meta: {
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      product: 'riper',
      description:
        'Especificación de control automático y manual vía links TUNEL y TermoKing. Use esta estructura para replicar la lógica en otro sistema.',
    },
    upstream: {
      baseUrl: base,
      tunnel: {
        method: 'GET',
        pathTemplate: '/Tunel/comando_control_tunel/{imei}',
        queryParams: { tipo: 'number', dato: 'number|string' },
        exampleUrl: `${base}/Tunel/comando_control_tunel/{imei}?tipo=1&dato=14.0`,
      },
      termoKing: {
        method: 'GET',
        pathTemplate: '/TermoKing/comando_control/{deviceId}',
        queryParams: { tipo: 'number', dato: 'number|string' },
        exampleUrl: `${base}/TermoKing/comando_control/{deviceId}?tipo=0&dato=1`,
      },
      datoFormatting: {
        tipo1_temperature: '°C con un decimal (ej. 14.1)',
        tipo3_co2: 'un decimal',
        tipo2_5_0_6_10: 'entero redondeado',
      },
    },
    commandTypes: COMMAND_TYPES,
    manualControl: {
      note: 'Comandos manuales desde panel (Gourmet): jobs en app_tunnel_command_jobs con verificación telemétrica.',
      kinds: MANUAL_COMMAND_KINDS,
      verifyDelaysMs: {
        simple: SIMPLE_VERIFY_DELAY_MS,
        ethylene: ETHYLENE_VERIFY_DELAY_MS,
        ethylenePollInterval: ETHYLENE_POLL_INTERVAL_MS,
        ethyleneReadingsNeeded: ETHYLENE_READINGS_NEEDED,
      },
      compliancePollIntervalMs: POLL_INTERVAL_MS,
      gourmetFanOut: {
        temperatureAndVentilation: '5 IMEIs del túnel',
        humidity: 'solo IMEI sensor (UNIT333 / ethylene IMEI)',
        ethylene: 'solo IMEI con sensor etileno',
      },
    },
    automatedProcesses: {
      processTypes: AUTOMATED_PROCESS_TYPES,
      controlAutomationTypes: CONTROL_AUTOMATION_PROCESS_TYPES,
      sequenceNote:
        'Homogenización / Maduración / Ventilación / Enfriamiento: temperatura → humedad → CO₂ → etileno (según proceso). Máx. 3 intentos por fase antes de avanzar.',
      maxAdjustAttempts: {
        temperature: TEMP_MAX_ADJUST_ATTEMPTS,
        humidity: HUMIDITY_MAX_ADJUST_ATTEMPTS,
        co2: CO2_MAX_ADJUST_ATTEMPTS,
      },
      verifyIntervalsMs: {
        temperature: TEMP_VERIFY_MS,
        humidity: HUMIDITY_VERIFY_MS,
        co2: CO2_VERIFY_MS,
        ventilation: VENTILATION_VERIFY_MS,
      },
      maintenanceIntervalsMs: {
        co2: CO2_MAINTENANCE_MS,
        tempHumidity: TEMP_HUMIDITY_MAINTENANCE_MS,
        hourlyReview: HOURLY_REVIEW_MS,
      },
      pollIntervalMs: GOURMET_PROCESS_POLL_MS,
      tolerances: {
        temperatureC: 0.35,
        humidityPct: 1,
        co2Pct: 0.25,
        avlVentTarget: 220,
        avlVentCo2TriggerMax: 30,
      },
      cooling: {
        normalOffsetC: COOLING_TEMP_OFFSET_C,
        aggressiveOffsetC: COOLING_TEMP_AGGRESSIVE_OFFSET_C,
        returnExcessThresholdC: COOLING_RETURN_EXCESS_THRESHOLD_C,
        rule: 'Consigna = objetivo − 2 °C; si return_air > objetivo + 3 °C → objetivo − 3 °C.',
      },
      ventilation: {
        endLeadMs: VENTILATION_END_LEAD_MS,
        rule: '5 min antes del fin de ventilación enviar tipo 3 con CO₂ objetivo (ej. 0.5). AVL ≠ 220 durante fase ventilación.',
      },
      ripeningEthylene: {
        cycleMs: ETHYLENE_CYCLE_MS,
        steadyMonitorMs: ETHYLENE_STEADY_MONITOR_MS,
        initialTestDosePpm: 2,
        maxDosePerCommandPpm: ETHYLENE_MAX_DOSE,
        co2FailureFallback:
          'Si CO₂ no se ajusta en 3 intentos durante maduración, continuar con control de etileno (núcleo del proceso).',
        co2HighVentilation220: {
          enabledByDefault: false,
          currentAdminSetting: Boolean(automationCfg.ripening_co2_ventilation_220),
          avlTargetCfm: 220,
          avlTriggerMaxCfm: 30,
          co2ExcessPct: 0.5,
          rule:
            'Tras ajustar límite CO₂, si lectura > objetivo + 0.5 % y AVL < 30, enviar tipo 6 dato 220 (solo si admin lo activó).',
        },
      },
    },
    ethyleneReading: {
      maxReadingPpm: ETHYLENE_MAX_READING,
      maxDosePpm: ETHYLENE_MAX_DOSE,
      nonZeroHistoryMax: ETHYLENE_NONZERO_HISTORY_MAX,
      recentDoseIgnoreZeroMs: ETHYLENE_RECENT_DOSE_MS,
      rules: [
        'Ignorar lecturas 0 ppm tras inyección reciente o con historial ascendente (evita sobredosis por fallo momentáneo del sensor).',
        'Mantener últimos 5 valores distintos > 0; si llega 0 espurio, conservar última lectura válida y seguir sondeando.',
        'Dosis proporcional según incremento observado; tope 120 ppm por comando tipo 5.',
      ],
    },
    stopPlan: {
      tipo: 10,
      maintainDato: STOP_PLAN_MAINTAIN_DATO,
      endDato: STOP_PLAN_END_DATO,
      hourlyResendMs: STOP_PLAN_HOURLY_MS,
      endLeadMs: STOP_PLAN_END_LEAD_MS,
      pollMs: STOP_PLAN_POLL_MS,
      phaseFields: ['consumption_ph_1', 'consumption_ph_2', 'consumption_ph_3'],
      phaseMaxAmps: STOP_PLAN_PHASE_MAX_A,
      phaseViolationResendMs: STOP_PLAN_PHASE_VIOLATION_MS,
      rules: [
        'Al programar APAGAR / STOP PLAN: enviar tipo 10 dato 7200 cada hora mientras fases > 0.5 A.',
        'Si > 10 min sobre 0.5 A, reenviar 7200.',
        'A 5 min del fin: tipo 10 dato 300.',
      ],
    },
    idleEthylenePoll: {
      command: { tipo: 0, dato: 1 },
      quietPeriodMs: IDLE_COMMAND_QUIET_MS,
      rule: 'En equipos en línea, si no hubo comandos al IMEI en ≥ 10 min, consultar etileno (tipo 0, dato 1).',
    },
    fleetRouting: {
      gourmet: {
        email: gourmetTradingEmailLogin(),
        empresaIdentificador: gourmetTradingEmpresaIdentificador(),
        upstream: 'tunnel',
        aggregateDeviceId: gourmetTunnelDeviceId(),
        tunnelUnitImeis: gourmetTradingTunnelUnitImeis(),
        ethyleneSensorImei: gourmetTunnelEthyleneImei(),
        standaloneImei: gourmetTradingStandaloneImei(),
        deviceImeis: gourmetTradingDeviceImeis(),
      },
      greenyard: {
        email: greenyardEmailLogin(),
        empresaIdentificador: greenyardEmpresaIdentificador(),
        upstream: 'termoKing',
        deviceImeis: greenyardDeviceImeis(),
        note: 'Misma lógica de procesos; un IMEI por equipo (sin túnel agregado).',
      },
      ultraorganics: {
        upstream: 'termoKing',
        panelImeis: ultraorganicsPanelImeis(),
        deviceGroups: ultraorganicsDeviceGroupsMap(),
        note: 'Etileno desde MEX1001/MEX2001/MEX3001; humedad desde MEX1002/MEX2002/MEX3001.',
      },
    },
    implementationNotes: [
      'Manual control bloqueado mientras exista un proceso activo en el mismo dispositivo.',
      'Telemetría de verificación vía API Madurador (lista dispositivos / ultimo_dato).',
      'Bitácora: tunnelEventLog en params de sesión + app_tunnel_command_jobs.steps.',
      'Seguimiento de maduración (ripening) reutiliza la misma lógica vía ripeningTrackingControl.',
    ],
  };
}
