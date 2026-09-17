/** Meta del último listado de flota (live vs registry degradado). */

export type FleetListMeta = {
  source: 'live' | 'registry' | 'unknown';
  degraded: boolean;
  reason?: string;
  upstream_fetched_at?: string | null;
  registry_count?: number;
  at: number;
};

let lastMeta: FleetListMeta = {
  source: 'unknown',
  degraded: false,
  at: 0,
};

export function setFleetListMeta(meta: Partial<FleetListMeta> & { degraded?: boolean; source?: FleetListMeta['source'] }) {
  lastMeta = {
    source: meta.source ?? lastMeta.source,
    degraded: Boolean(meta.degraded),
    reason: meta.reason,
    upstream_fetched_at: meta.upstream_fetched_at ?? null,
    registry_count: meta.registry_count,
    at: Date.now(),
  };
}

export function getFleetListMeta(): FleetListMeta {
  return lastMeta;
}

export function isFleetDegraded(): boolean {
  return lastMeta.degraded === true;
}
