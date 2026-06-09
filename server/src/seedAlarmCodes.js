import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

function loadSeedAlarms() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'data/thermoKingMp4000Alarms.json'),
    join(here, '../../src/app/data/thermoKingMp4000Alarms.json'),
  ];
  for (const path of candidates) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      return Array.isArray(raw.alarms) ? raw.alarms : [];
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') continue;
      throw e;
    }
  }
  throw new Error(
    `thermoKingMp4000Alarms.json not found (tried: ${candidates.join(', ')})`
  );
}

/** Inserta catálogo inicial MP4000 si la tabla está vacía. */
export async function seedAlarmCodes() {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM app_alarm_codes`);
  if (rows[0].c > 0) return;

  const alarms = loadSeedAlarms();
  for (const a of alarms) {
    await pool.query(
      `INSERT INTO app_alarm_codes (
         code, title_es, title_en, description_es, description_en,
         corrective_action_es, corrective_action_en, model
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        a.code,
        a.titleEs ?? a.titleEn ?? `Alarma ${a.code}`,
        a.titleEn ?? a.titleEs ?? `Alarm ${a.code}`,
        a.descriptionEs ?? '',
        a.descriptionEn ?? '',
        a.correctiveActionEs ?? '',
        a.correctiveActionEn ?? '',
        a.model ?? 'MP4000',
      ]
    );
  }
  console.log(`[seed] app_alarm_codes: ${alarms.length} códigos MP4000 insertados`);
}
