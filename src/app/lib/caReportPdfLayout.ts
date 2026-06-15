import type { DailyCaAnalysis } from '@/app/lib/caReportAnalysis';
import { PDF_A4_CONTENT_HEIGHT_PX } from '@/app/lib/reportPdfExport';

/** Primera página §5 incluye título e intro — menos filas para evitar corte. */
export const CA_REPORT_DAILY_ROWS_FIRST_PAGE = 7;

/** Máximo de días por página en continuaciones del §5. */
export const CA_REPORT_DAILY_ROWS_PER_PAGE = 10;

/** Divide el análisis diario en bloques de hasta 7 / 10 filas por página PDF. */
export function chunkDailyRowsForPdf(rows: DailyCaAnalysis[]): DailyCaAnalysis[][] {
  if (!rows.length) return [];

  const chunks: DailyCaAnalysis[][] = [];
  chunks.push(rows.slice(0, CA_REPORT_DAILY_ROWS_FIRST_PAGE));
  let offset = CA_REPORT_DAILY_ROWS_FIRST_PAGE;
  while (offset < rows.length) {
    chunks.push(rows.slice(offset, offset + CA_REPORT_DAILY_ROWS_PER_PAGE));
    offset += CA_REPORT_DAILY_ROWS_PER_PAGE;
  }
  return chunks;
}

export const CA_PDF_PAGE_CONTENT_HEIGHT_PX = PDF_A4_CONTENT_HEIGHT_PX;
