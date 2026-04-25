let nameMapCache: { map: Record<string, string>; at: number } | null = null;
/** Se incrementa en cada invalidación; las respuestas GET más antiguas no deben escribir en caché. */
let cacheWriteEpoch = 0;
const NAME_MAP_TTL_MS = 20_000;

export function invalidateDeviceNameCache(): void {
  nameMapCache = null;
  cacheWriteEpoch++;
}

/** Tomar al iniciar un GET de red; si al completar no coincide con cacheWriteEpoch, la respuesta es obsoleta. */
export function getDeviceNameCacheEpoch(): number {
  return cacheWriteEpoch;
}

export function getCachedDeviceNameMap(now: number): Record<string, string> | null {
  if (nameMapCache && now - nameMapCache.at < NAME_MAP_TTL_MS) return nameMapCache.map;
  return null;
}

export function setCachedDeviceNameMap(
  map: Record<string, string>,
  at: number,
  fetchEpoch: number
): void {
  if (fetchEpoch !== cacheWriteEpoch) return;
  nameMapCache = { map, at };
}
