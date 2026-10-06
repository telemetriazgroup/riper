/**
 * Madurador de carne (p. ej. MAD_CARNE): sin fases etileno/CO₂ en automatización.
 */

const DEFAULT_MEAT_RIPENER_IDS = ['MAD_CARNE'];

function parseIdList(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function meatRipenerDeviceIds() {
  const fromEnv = parseIdList(process.env.MEAT_RIPENER_DEVICE_IDS);
  const merged = [...DEFAULT_MEAT_RIPENER_IDS, ...fromEnv];
  const seen = new Set();
  return merged.filter((id) => {
    const k = id.toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function isMeatRipenerDeviceId(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) return false;
  const upper = id.toUpperCase();
  if (upper === 'MAD_CARNE' || upper.replace(/[\s-]+/g, '_') === 'MAD_CARNE') return true;
  if (upper.includes('MAD_CARNE') || upper.includes('MADCARNE')) return true;
  return meatRipenerDeviceIds().some((x) => {
    const t = String(x).trim().toUpperCase();
    return t === upper || upper.includes(t) || t.includes(upper);
  });
}

/** Ripening con meatControl o dispositivo carne → solo temp + humedad. */
export function ripeningPhasesForDevice(deviceId, params) {
  const meat =
    isMeatRipenerDeviceId(deviceId) ||
    params?.meatControl === true ||
    params?.meat_control === true;
  if (meat) return ['temperature', 'humidity'];
  return ['temperature', 'humidity', 'co2', 'ethylene'];
}
