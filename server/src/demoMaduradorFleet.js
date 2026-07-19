/**
 * Cuenta demo Madurador: fusiona empresas upstream 6001 + 7001 (lista completa).
 */

export function demoMaduradorEmailLogin() {
  return String(process.env.DEMO_MADURADOR_EMAIL || 'demo-madurador@riper.local')
    .trim()
    .toLowerCase();
}

export function isDemoMaduradorFleetEmail(email) {
  return String(email || '').trim().toLowerCase() === demoMaduradorEmailLogin();
}

/** Identificadores de empresa Madurador para la cuenta demo (default 6001,7001). */
export function demoMaduradorEmpresaIdentificadores() {
  const raw = process.env.DEMO_MADURADOR_EMPRESA_IDENTIFICADORES;
  const s = raw != null ? String(raw).trim() : '6001,7001';
  if (!s || s.toUpperCase() === 'NONE') return [];
  return s
    .split(/[,;\s]+/)
    .map((x) => String(x || '').trim())
    .filter((x) => x && x.toUpperCase() !== 'NONE' && x !== '0');
}
