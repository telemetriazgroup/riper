import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';

const DEFAULT_PLACEHOLDER =
  'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&q=80';

function inferPhase(payload: RipeningProcessRow['payload']): string {
  const raw = (payload.recipe as { phases?: { enabled?: boolean; name?: string; type?: string }[] } | undefined)
    ?.phases;
  const phases = Array.isArray(raw) ? raw.filter((p) => p && p.enabled !== false) : [];
  if (phases.length) {
    return phases[0].name || 'En curso';
  }
  return 'En curso';
}

function computeProgress(startedAt: string | undefined, estimatedEndAt: string | null | undefined, totalHours: number) {
  if (!startedAt) return 0;
  const s = new Date(startedAt).getTime();
  const now = Date.now();
  let e: number;
  if (estimatedEndAt) {
    e = new Date(estimatedEndAt).getTime();
  } else if (totalHours > 0) {
    e = s + totalHours * 3600 * 1000;
  } else {
    return 0;
  }
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.min(100, Math.round(((now - s) / (e - s)) * 100));
}

function targetsFromPayload(p: RipeningProcessRow['payload']) {
  const r = p.recipe;
  if (r?.targets && typeof r.targets === 'object') {
    return {
      brix: r.targets.brix != null ? String(r.targets.brix) : '—',
      firmness: r.targets.firmness != null ? String(r.targets.firmness) : '—',
      color: r.targets.color != null ? String(r.targets.color) : '—',
    };
  }
  const objs = p.objectives;
  if (Array.isArray(objs) && objs.length) {
    const by = (s: string) => objs.find((o) => (o.name || '').toLowerCase().includes(s))?.value;
    return {
      brix: by('brix') || by('°') || '—',
      firmness: by('firme') || '—',
      color: by('color') || '—',
    };
  }
  return { brix: '—', firmness: '—', color: '—' };
}

type EvidencePhoto = { url?: string; name?: string };

/**
 * Formato de tarjeta / detalle (compatible con ProcessList y ProcessDetail)
 */
/** Nombres de fases de la receta habilitadas (pestaña Seguimiento). */
export function getRipeningRecipePhaseLabels(payload: RipeningProcessRow['payload']): string[] {
  const raw = (payload.recipe as { phases?: { enabled?: boolean; name?: string }[] } | undefined)?.phases;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && p.enabled !== false && String(p.name ?? '').trim())
    .map((p) => String(p.name));
}

export function mapRowToProcessView(row: RipeningProcessRow) {
  const p = row.payload;
  const schedule = p.scheduleSummary || {};
  const product = (p.batch as { product?: string } | undefined)?.product ?? '—';
  const photos = (p.initialSample as { evidencePhotos?: EvidencePhoto[] } | undefined)?.evidencePhotos;
  const firstRel = Array.isArray(photos) && photos[0]?.url ? String(photos[0].url) : '';
  const sup = p.supervisor as { name?: string; email?: string } | undefined;
  return {
    id: row.id,
    client: p.client || { name: '—', type: 'external' },
    supervisor: sup?.name
      ? { name: sup.name, email: sup.email }
      : null,
    batch: {
      product,
      origin: (p.batch as { origin?: string } | undefined)?.origin ?? '—',
      quantity_kg: (p.batch as { quantity_kg?: number | string } | undefined)?.quantity_kg,
      quantity_m3: (p.batch as { volume_m3?: number | string } | undefined)?.volume_m3,
      volume_m3: (p.batch as { volume_m3?: number | string } | undefined)?.volume_m3,
      box_count: (p.batch as { box_count?: number } | undefined)?.box_count,
      entry_date: schedule.startedAt || row.created_at,
    },
    status: row.status || 'active',
    phase: inferPhase(p),
    start_date: schedule.startedAt
      ? new Date(schedule.startedAt).toISOString().slice(0, 10)
      : new Date(row.created_at).toISOString().slice(0, 10),
    progress: computeProgress(
      schedule.startedAt,
      schedule.estimatedEndAt,
      Number(schedule.totalDurationHours) || 0
    ),
    recipe: {
      name: p.recipe?.name || '—',
      duration_hours: schedule.totalDurationHours ?? 0,
      targets: targetsFromPayload(p),
    },
    image: DEFAULT_PLACEHOLDER,
    firstEvidenceApiPath: firstRel,
    display_name: row.display_name,
    scheduleSummary: schedule,
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    _row: row,
  };
}

export function latestSamplingEvent(timeline: unknown[]) {
  for (const ev of timeline) {
    const o = ev as { type?: string; data?: { name: string; value: string; unit: string }[] };
    if (o?.type === 'sampling' && Array.isArray(o.data) && o.data.length) {
      return o;
    }
  }
  return null;
}

function findParam(
  data: { name: string; value: string; unit: string }[] | undefined,
  key: 'brix' | 'firm' | 'color'
) {
  if (!data) return { value: '—' as string, name: '' };
  const m =
    key === 'brix'
      ? (s: string) => /brix|°/i.test(s)
      : key === 'firm'
        ? (s: string) => /firme/i.test(s)
        : (s: string) => /color/i.test(s);
  const row = data.find((d) => m(d.name));
  return { value: row?.value != null && row.value !== '' ? row.value : '—', name: row?.name || '' };
}

export function buildPlanningSnapshot(view: ReturnType<typeof mapRowToProcessView>) {
  const targets = view.recipe.targets;
  const last = latestSamplingEvent(view.timeline);
  const data = (last as { data?: { name: string; value: string; unit: string; target?: string }[] } | null)?.data;
  const b = findParam(data, 'brix');
  const f = findParam(data, 'firm');
  const c = findParam(data, 'color');
  return {
    brix: { current: b.value, target: targets.brix },
    firmness: { current: f.value, target: targets.firmness },
    color: { current: c.value, target: targets.color },
  };
}

export function remainingDays(estimatedEndAt: string | null | undefined) {
  if (!estimatedEndAt) return null;
  const d = (Date.now() - new Date(estimatedEndAt).getTime()) / (24 * 3600 * 1000);
  if (d >= 0) return 0;
  return Math.abs(d);
}

/** Duración en horas de una fase guardada en payload (ventilación en minutos → h). */
export function phaseDurationHoursFromStored(
  p: { type?: string; duration?: number; enabled?: boolean }
): number {
  if (p.enabled === false) return 0;
  const d = Number(p.duration);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return p.type === 'venting' ? d / 60 : d;
}

export type CurrentNextPhaseInfo = {
  currentLabel: string;
  nextLabel: string | null;
  /** Índice dentro de fases habilitadas (0-based). */
  currentIndex: number;
  /** Metadatos por fase habilitada (nombre + horas). */
  phasesMeta: { label: string; hours: number; raw: Record<string, unknown> }[];
};

/**
 * Etapa actual / siguiente a partir del avance global y duraciones por fase en la receta.
 * Si no hay duraciones, reparte el avance entre las fases por igual.
 */
export function inferCurrentNextPhase(
  payload: RipeningProcessRow['payload'],
  progressPct: number
): CurrentNextPhaseInfo {
  const raw = (payload.recipe as { phases?: Record<string, unknown>[] } | undefined)?.phases;
  const phases = Array.isArray(raw)
    ? raw.filter((p) => p && (p as { enabled?: boolean }).enabled !== false)
    : [];
  const labels = getRipeningRecipePhaseLabels(payload);

  if (!phases.length && labels.length) {
    const n = labels.length;
    const pSafe = Math.min(100, Math.max(0, progressPct));
    const idx = n <= 1 ? 0 : Math.min(n - 1, Math.floor((pSafe / 100) * n));
    return {
      currentLabel: labels[idx] ?? '—',
      nextLabel: idx < n - 1 ? labels[idx + 1]! : null,
      currentIndex: idx,
      phasesMeta: labels.map((label, i) => ({
        label,
        hours: 0,
        raw: {},
      })),
    };
  }

  const phasesMeta = phases.map((p, idx) => {
    const pr = p as {
      type?: string;
      duration?: number;
      enabled?: boolean;
      name?: string;
    };
    const label =
      String(pr.name ?? '').trim() ||
      labels[idx] ||
      String(pr.type ?? '—');
    return {
      label,
      hours: phaseDurationHoursFromStored(pr),
      raw: p as Record<string, unknown>,
    };
  });

  const totalH = phasesMeta.reduce((a, x) => a + x.hours, 0);
  const pSafe = Math.min(100, Math.max(0, progressPct));
  let currentIndex = 0;
  if (totalH > 0 && phasesMeta.length) {
    const elapsed = (pSafe / 100) * totalH;
    let cum = 0;
    for (let i = 0; i < phasesMeta.length; i++) {
      cum += phasesMeta[i].hours;
      currentIndex = i;
      if (elapsed <= cum) break;
    }
  } else if (phasesMeta.length) {
    const n = phasesMeta.length;
    currentIndex = Math.min(n - 1, Math.floor((pSafe / 100) * n));
  }

  const cur = phasesMeta[currentIndex];
  const next = phasesMeta[currentIndex + 1];
  return {
    currentLabel: cur?.label ?? labels[0] ?? '—',
    nextLabel: next ? next.label : null,
    currentIndex,
    phasesMeta,
  };
}
