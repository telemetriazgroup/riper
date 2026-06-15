import type { DailyCaAnalysis } from '@/app/lib/caReportAnalysis';
import { PDF_A4_CONTENT_HEIGHT_PX } from '@/app/lib/reportPdfExport';

/** Altura aproximada de una fila de la tabla diaria (celdas multilínea). */
const DAILY_TABLE_ROW_HEIGHT_PX = 52;

/** Cabecera + título + párrafo introductorio + thead de tabla (primera página §5). */
const DAILY_FIRST_PAGE_OVERHEAD_PX = 300;

/** Cabecera + subtítulo continuación + thead (páginas siguientes §5). */
const DAILY_CONTINUATION_OVERHEAD_PX = 130;

/** Pie de página reservado al calcular capacidad de filas. */
const DAILY_FOOTER_RESERVE_PX = 48;

function capacityForOverhead(overheadPx: number): number {
  const usable = PDF_A4_CONTENT_HEIGHT_PX - overheadPx - DAILY_FOOTER_RESERVE_PX;
  return Math.max(3, Math.floor((usable / DAILY_TABLE_ROW_HEIGHT_PX) * 0.88));
}

/** Divide filas del análisis diario en bloques que caben en una página PDF con cabecera y pie. */
export function chunkDailyRowsForPdf(rows: DailyCaAnalysis[]): DailyCaAnalysis[][] {
  if (!rows.length) return [];

  const firstCap = capacityForOverhead(DAILY_FIRST_PAGE_OVERHEAD_PX);
  const nextCap = capacityForOverhead(DAILY_CONTINUATION_OVERHEAD_PX);
  const chunks: DailyCaAnalysis[][] = [];

  chunks.push(rows.slice(0, firstCap));
  let offset = firstCap;
  while (offset < rows.length) {
    chunks.push(rows.slice(offset, offset + nextCap));
    offset += nextCap;
  }
  return chunks;
}

export const CA_PDF_PAGE_CONTENT_HEIGHT_PX = PDF_A4_CONTENT_HEIGHT_PX;
