import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Upload, Eye, Download, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  apiFileUrl,
  deleteRipeningProcessDocument,
  fetchRipeningFileBlob,
  uploadRipeningProcessDocument,
  type RipeningProcessDocument,
} from '@/app/lib/ripeningProcessesApi';
import { canRegisterRipeningSampling } from '@/app/lib/permissions';
import { toast } from 'sonner';

function isPdfDoc(doc: RipeningProcessDocument): boolean {
  const mime = String(doc.mime || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  return String(doc.name || '').toLowerCase().endsWith('.pdf');
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  processId: string;
  documents: RipeningProcessDocument[];
  isArchived?: boolean;
  onDocumentsUpdated?: () => void | Promise<void>;
};

export const ProcessDocumentsPanel: React.FC<Props> = ({
  processId,
  documents,
  isArchived = false,
  onDocumentsUpdated,
}) => {
  const { t, formatDateTime } = useSettings();
  const canUpload = canRegisterRipeningSampling() && !isArchived;
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [observations, setObservations] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RipeningProcessDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<RipeningProcessDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const closePreview = useCallback(() => {
    setPreviewDoc(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    if (!previewDoc || !isPdfDoc(previewDoc)) return undefined;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    fetchRipeningFileBlob(apiFileUrl(previewDoc.apiPath))
      .then((blob) => {
        if (cancelled) return;
        const pdfBlob =
          blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
        setPreviewUrl(URL.createObjectURL(pdfBlob));
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Error');
        setPreviewDoc(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewDoc]);

  const handleUpload = async (file: File | null) => {
    if (!file || !processId || !canUpload) return;
    const desc = description.trim();
    if (!desc) {
      toast.error(t('tracking_docs_description_required'));
      return;
    }
    setUploading(true);
    try {
      await uploadRipeningProcessDocument(
        processId,
        file,
        desc,
        observations.trim() || undefined
      );
      setDescription('');
      setObservations('');
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
      toast.success(t('tracking_docs_uploaded'));
      await onDocumentsUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: RipeningProcessDocument) => {
    if (!processId || !canUpload) return;
    setDeletingId(doc.id);
    try {
      await deleteRipeningProcessDocument(processId, doc.id);
      toast.success(t('tracking_docs_deleted'));
      setDeleteTarget(null);
      await onDocumentsUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (doc: RipeningProcessDocument) => {
    try {
      const blob = await fetchRipeningFileBlob(apiFileUrl(doc.apiPath));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 p-4 flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-slate-600" />
          <h3 className="font-bold text-gray-800">{t('tracking_docs_title')}</h3>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">{t('tracking_docs_hint')}</p>

          {canUpload && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,application/pdf"
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-violet-100 file:text-violet-900 file:font-medium hover:file:bg-violet-200"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPendingFile(f);
                }}
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('tracking_docs_description_label')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('tracking_docs_description_placeholder')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={uploading}
                  maxLength={300}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('tracking_docs_observations_label')}
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder={t('tracking_docs_observations_placeholder')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[72px] resize-y"
                  disabled={uploading}
                  maxLength={2000}
                />
              </div>
              {pendingFile && (
                <p className="text-xs text-gray-600">
                  {t('tracking_docs_selected_file')}: <span className="font-medium">{pendingFile.name}</span>
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="gap-2 bg-violet-700 hover:bg-violet-800 text-white"
                disabled={uploading || !description.trim() || !pendingFile}
                onClick={() => {
                  if (pendingFile) void handleUpload(pendingFile);
                  else fileRef.current?.click();
                }}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? t('loading') : t('tracking_docs_upload')}
              </Button>
            </div>
          )}

          {documents.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-2">{t('tracking_docs_empty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {documents.map((doc) => {
                const pdf = isPdfDoc(doc);
                return (
                  <li key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-white hover:bg-gray-50/80">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-red-50 text-red-700 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        {doc.description && (
                          <p className="font-medium text-gray-900 truncate" title={doc.description}>
                            {doc.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 truncate" title={doc.name}>
                          {doc.name}
                        </p>
                        {doc.observations && (
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{doc.observations}</p>
                        )}
                        <p className="text-[11px] text-gray-500 mt-1">
                          {formatBytes(doc.size)} · {doc.uploadedAt ? formatDateTime(doc.uploadedAt) : '—'}
                          {doc.uploadedByName || doc.uploadedByEmail
                            ? ` · ${doc.uploadedByName || doc.uploadedByEmail}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0 sm:ml-2">
                      {pdf && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1 h-8"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t('tracking_docs_preview')}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 h-8"
                        onClick={() => void handleDownload(doc)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t('tracking_docs_download')}
                      </Button>
                      {canUpload && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1 h-8 text-red-700 border-red-200 hover:bg-red-50"
                          disabled={deletingId === doc.id}
                          onClick={() => setDeleteTarget(doc)}
                        >
                          {deletingId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={previewDoc != null} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-base truncate pr-8">{previewDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-slate-100 relative">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-700" />
              </div>
            )}
            {previewUrl && !previewLoading && (
              <iframe
                title={previewDoc?.name || 'PDF'}
                src={previewUrl}
                className="w-full h-full border-0 bg-white"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && !deletingId && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tracking_docs_delete_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>{t('cancel')}</AlertDialogCancel>
            <Button
              type="button"
              className="bg-red-700 hover:bg-red-800 text-white"
              disabled={Boolean(deletingId)}
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
            >
              {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : t('action_delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
