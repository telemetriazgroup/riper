import { mapRowToProcessView } from '@/app/lib/ripeningProcessMappers';

export type ProcessView = ReturnType<typeof mapRowToProcessView>;

export type SamplingTimelineEvent = {
  id: string;
  type?: string;
  title?: string;
  timestamp: string;
  persona_escrita?: string;
  user?: string;
  registered_by_email?: string | null;
  description?: string;
  data?: { name: string; value: string; unit: string }[];
  images?: { url?: string; desc?: string }[];
};

function firstNumber(s: string) {
  const m = String(s).match(/[\d.,]+/);
  if (!m) return NaN;
  return parseFloat(m[0].replace(',', '.'));
}

function matchBrix(name: string) {
  return /brix|°/i.test(name);
}
function matchFirm(name: string) {
  return /firme/i.test(name);
}
function matchColor(name: string) {
  return /color/i.test(name);
}

export function findParamValue(
  data: { name: string; value: string; unit: string }[] | undefined,
  key: 'brix' | 'firm' | 'color'
) {
  if (!data?.length) return { value: '—' as string, unit: '' };
  const m =
    key === 'brix'
      ? matchBrix
      : key === 'firm'
        ? matchFirm
        : matchColor;
  const row = data.find((d) => m(d.name));
  return {
    value: row?.value != null && row.value !== '' ? String(row.value) : '—',
    unit: row?.unit ? String(row.unit) : '',
  };
}

/** Muestreos en orden cronológico (más antiguo primero). */
export function getSamplingEventsChronological(timeline: unknown[]): SamplingTimelineEvent[] {
  const list = (Array.isArray(timeline) ? timeline : []).filter(
    (e: unknown): e is SamplingTimelineEvent =>
      Boolean(e) && typeof e === 'object' && (e as SamplingTimelineEvent).type === 'sampling'
  );
  return list.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export type ChartRow = {
  name: string;
  index: number;
  brix: number | null;
  firmness: number | null;
  color: number | null;
};

export function buildParameterEvolutionSeries(events: SamplingTimelineEvent[]): ChartRow[] {
  return events.map((ev, i) => {
    const b = findParamValue(ev.data, 'brix');
    const f = findParamValue(ev.data, 'firm');
    const c = findParamValue(ev.data, 'color');
    const nb = b.value !== '—' ? firstNumber(b.value) : NaN;
    const nf = f.value !== '—' ? firstNumber(f.value) : NaN;
    const nc = c.value !== '—' ? firstNumber(c.value) : NaN;
    return {
      name: new Date(ev.timestamp).toLocaleString(),
      index: i + 1,
      brix: Number.isFinite(nb) ? nb : null,
      firmness: Number.isFinite(nf) ? nf : null,
      color: Number.isFinite(nc) ? nc : null,
    };
  });
}

export function hasAnyChartPoint(rows: ChartRow[]) {
  return rows.some(
    (r) => r.brix != null || r.firmness != null || r.color != null
  );
}
