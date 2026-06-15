import type { RipeningProcessDocument } from '@/app/lib/ripeningProcessesApi';

export function isPdfDocument(doc: RipeningProcessDocument): boolean {
  const mime = String(doc.mime || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  return String(doc.name || '').toLowerCase().endsWith('.pdf');
}

export function isImageDocument(doc: RipeningProcessDocument): boolean {
  const mime = String(doc.mime || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(String(doc.name || ''));
}

export function formatDocumentBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
