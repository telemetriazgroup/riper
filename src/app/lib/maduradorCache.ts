import type { Device } from '@/app/data';

let maduradorListCache: Device[] | null = null;
let maduradorListCacheAt = 0;

export const MADURADOR_LIST_TTL_MS = 25_000;

export function getMaduradorListCache(): { list: Device[] | null; at: number } {
  return { list: maduradorListCache, at: maduradorListCacheAt };
}

export function setMaduradorListCache(list: Device[], at: number) {
  maduradorListCache = list;
  maduradorListCacheAt = at;
}

export function clearMaduradorListCache() {
  maduradorListCache = null;
  maduradorListCacheAt = 0;
}
