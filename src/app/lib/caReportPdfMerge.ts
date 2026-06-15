import { PDFDocument } from 'pdf-lib';
import {
  apiFileUrl,
  fetchRipeningFileBlob,
  type RipeningProcessDocument,
} from '@/app/lib/ripeningProcessesApi';
import { isPdfDocument } from '@/app/lib/ripeningProcessDocuments';

/** Fusiona el informe principal con los PDF adjuntos del seguimiento (páginas al final). */
export async function mergeCaReportWithAttachmentPdfs(
  mainPdfBytes: Uint8Array,
  documents: RipeningProcessDocument[]
): Promise<Uint8Array> {
  const pdfDocs = documents.filter(isPdfDocument);
  if (!pdfDocs.length) return mainPdfBytes;

  const merged = await PDFDocument.load(mainPdfBytes);
  for (const doc of pdfDocs) {
    try {
      const blob = await fetchRipeningFileBlob(apiFileUrl(doc.apiPath));
      const buf = new Uint8Array(await blob.arrayBuffer());
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const copied = await merged.copyPages(src, src.getPageIndices());
      for (const page of copied) merged.addPage(page);
    } catch (e) {
      console.warn('[ca-report-pdf] skip attachment pdf', doc.name, e);
    }
  }
  return merged.save();
}

export function triggerPdfDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
