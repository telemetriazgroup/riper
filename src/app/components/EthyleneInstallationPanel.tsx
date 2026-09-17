import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Beaker,
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  Play,
  Plus,
  Square,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  ETHYLENE_INSTALL_SWR_KEY,
  cancelEthyleneInstallTest,
  createEthyleneInstallation,
  getEthyleneInstallation,
  installationPhotoAbsoluteUrl,
  listEthyleneInstallations,
  startEthyleneInstallTest,
  type EthyleneInstallation,
} from '@/app/lib/ethyleneInstallationsApi';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

type Props = { deviceId: string };

function statusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    documented: t('install_status_documented'),
    testing: t('install_status_testing'),
    completed: t('install_status_completed'),
    cancelled: t('install_status_cancelled'),
    failed: t('install_status_failed'),
  };
  return map[status] ?? status;
}

function PhotoSlot({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  return (
    <label className="block border border-dashed border-slate-300 rounded-lg p-3 cursor-pointer hover:bg-slate-50">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
        <Camera className="h-4 w-4" />
        {label}
      </div>
      {preview ? (
        <img src={preview} alt="" className="h-28 w-full object-cover rounded-md mb-2" />
      ) : (
        <div className="h-28 flex items-center justify-center text-xs text-slate-400 bg-slate-100 rounded-md mb-2">
          JPG / PNG
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="text-xs w-full"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

async function downloadReportPdf(row: EthyleneInstallation, t: (k: string) => string, formatDateTime: (s: string) => string) {
  const doc = new jsPDF();
  let y = 14;
  const line = (text: string, size = 11) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 14, y);
    y += lines.length * (size * 0.45) + 4;
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  };
  line(t('install_report_title'), 16);
  line(`${t('install_device')}: ${row.device_id}`);
  line(`${t('install_status')}: ${statusLabel(row.status, t)}`);
  if (row.created_at) line(`${t('install_date')}: ${formatDateTime(row.created_at)}`);
  if (row.user_name || row.user_email) line(`${t('install_user')}: ${row.user_name || row.user_email}`);
  if (row.flowmeter_lpm != null) line(`LPM: ${row.flowmeter_lpm}`);
  if (row.notes) line(`${t('install_notes')}: ${row.notes}`);
  if (row.test_target_ppm != null) line(`${t('install_test_target')}: ${row.test_target_ppm} ppm`);
  if (row.test_baseline_ppm != null) line(`${t('install_baseline')}: ${row.test_baseline_ppm} ppm`);
  if (row.test_final_ppm != null) line(`${t('install_final')}: ${row.test_final_ppm} ppm`);
  if (row.test_elapsed_seconds != null) {
    line(`${t('install_elapsed')}: ${row.test_elapsed_seconds}s`);
  }
  if (row.test_total_injection_seconds != null) {
    line(`${t('install_injection_seconds')}: ${row.test_total_injection_seconds}s`);
  }
  line(t('install_doses'), 13);
  for (const d of row.doses ?? []) {
    line(
      `· ${d.occurred_at ? formatDateTime(d.occurred_at) : '—'} — ${d.dose_ppm ?? '—'} ppm` +
        (d.reading_before != null ? ` (antes ${d.reading_before})` : '') +
        (d.injection_seconds != null ? ` · ${d.injection_seconds}s` : '')
    );
  }
  doc.save(`instalacion-etileno-${row.device_id}-${row.id.slice(0, 8)}.pdf`);
}

export const EthyleneInstallationPanel: React.FC<Props> = ({ deviceId }) => {
  const { t, formatDateTime } = useSettings();
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [lpm, setLpm] = useState('');
  const [cylinder, setCylinder] = useState<File | null>(null);
  const [flowmeter, setFlowmeter] = useState<File | null>(null);
  const [flowmeterLpmPhoto, setFlowmeterLpmPhoto] = useState<File | null>(null);
  const [targetPpm, setTargetPpm] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const listKey = [ETHYLENE_INSTALL_SWR_KEY, deviceId] as const;
  const { data: list = [], mutate, isLoading } = useSWR(listKey, () => listEthyleneInstallations(deviceId), {
    refreshInterval: 15_000,
  });

  const detailKey = selectedId ? ([ETHYLENE_INSTALL_SWR_KEY, 'detail', selectedId] as const) : null;
  const { data: detail, mutate: mutateDetail } = useSWR(
    detailKey,
    () => getEthyleneInstallation(selectedId!),
    { refreshInterval: selectedId && list.find((x) => x.id === selectedId)?.status === 'testing' ? 8_000 : 0 }
  );

  const activeTesting = list.find((x) => x.status === 'testing');

  const resetForm = () => {
    setNotes('');
    setLpm('');
    setCylinder(null);
    setFlowmeter(null);
    setFlowmeterLpmPhoto(null);
    setTargetPpm(20);
  };

  const onCreate = async () => {
    if (!cylinder || !flowmeter || !flowmeterLpmPhoto) {
      toast.error(t('install_photos_required'));
      return;
    }
    setBusy(true);
    try {
      const row = await createEthyleneInstallation({
        deviceId,
        notes: notes.trim() || undefined,
        flowmeterLpm: lpm.trim() ? Number(lpm) : null,
        cylinder,
        flowmeter,
        flowmeterLpmPhoto,
      });
      toast.success(t('install_created'));
      resetForm();
      setShowForm(false);
      setSelectedId(row.id);
      await mutate();
      await mutateDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('install_error'));
    } finally {
      setBusy(false);
    }
  };

  const onStartTest = async (id: string) => {
    setBusy(true);
    try {
      await startEthyleneInstallTest(id, targetPpm);
      toast.success(t('install_test_started'));
      await mutate();
      await mutateDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('install_error'));
    } finally {
      setBusy(false);
    }
  };

  const onCancelTest = async (id: string) => {
    setBusy(true);
    try {
      await cancelEthyleneInstallTest(id);
      toast.success(t('install_test_cancelled'));
      await mutate();
      await mutateDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('install_error'));
    } finally {
      setBusy(false);
    }
  };

  const onDownload = useCallback(async () => {
    if (!selectedId) return;
    try {
      const full = await getEthyleneInstallation(selectedId);
      await downloadReportPdf(full, t, formatDateTime);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('install_error'));
    }
  }, [selectedId, t, formatDateTime]);

  const view = detail ?? list.find((x) => x.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b bg-slate-50/80">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-violet-100 text-violet-900">
              <Beaker className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('install_title')}</CardTitle>
              <p className="text-sm text-slate-600 mt-1">{t('install_subtitle')}</p>
            </div>
          </div>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {t('install_new')}
          </Button>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {showForm ? (
            <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-white">
              <p className="text-sm font-medium text-slate-800">{t('install_evidence')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PhotoSlot label={t('install_photo_cylinder')} file={cylinder} onChange={setCylinder} />
                <PhotoSlot label={t('install_photo_flowmeter')} file={flowmeter} onChange={setFlowmeter} />
                <PhotoSlot
                  label={t('install_photo_lpm')}
                  file={flowmeterLpmPhoto}
                  onChange={setFlowmeterLpmPhoto}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm block">
                  <span className="text-slate-600">{t('install_lpm_value')}</span>
                  <input
                    type="number"
                    step="0.1"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={lpm}
                    onChange={(e) => setLpm(e.target.value)}
                  />
                </label>
                <label className="text-sm block sm:col-span-2">
                  <span className="text-slate-600">{t('install_notes')}</span>
                  <textarea
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[72px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="button" disabled={busy} onClick={() => void onCreate()} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {t('install_save')}
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setShowForm(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="py-10 flex justify-center text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">{t('install_history_empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('install_date')}</th>
                    <th className="px-3 py-2 text-left">{t('install_status')}</th>
                    <th className="px-3 py-2 text-left">{t('install_test_target')}</th>
                    <th className="px-3 py-2 text-left">{t('install_user')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {list.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer hover:bg-slate-50 ${selectedId === row.id ? 'bg-violet-50' : ''}`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.created_at ? formatDateTime(row.created_at) : '—'}
                      </td>
                      <td className="px-3 py-2">{statusLabel(row.status, t)}</td>
                      <td className="px-3 py-2">
                        {row.test_target_ppm != null ? `${row.test_target_ppm} ppm` : '—'}
                      </td>
                      <td className="px-3 py-2">{row.user_name || row.user_email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {view ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80 flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {t('install_detail')}
            </CardTitle>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void onDownload()}>
              <Download className="h-4 w-4" />
              {t('install_download_report')}
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-500">{t('install_status')}</div>
                <div className="font-medium">{statusLabel(view.status, t)}</div>
              </div>
              <div>
                <div className="text-slate-500">LPM</div>
                <div className="font-medium">{view.flowmeter_lpm ?? '—'}</div>
              </div>
              <div>
                <div className="text-slate-500">{t('install_test_target')}</div>
                <div className="font-medium">
                  {view.test_target_ppm != null ? `${view.test_target_ppm} ppm` : '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-500">{t('install_final')}</div>
                <div className="font-medium">
                  {view.test_final_ppm != null ? `${view.test_final_ppm} ppm` : '—'}
                </div>
              </div>
            </div>
            {view.notes ? <p className="text-sm text-slate-700">{view.notes}</p> : null}

            {view.photos?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {view.photos.map((p) => (
                  <div key={p.id} className="rounded-lg border overflow-hidden bg-slate-50">
                    <img
                      src={installationPhotoAbsoluteUrl(p.url)}
                      alt={p.kind}
                      className="h-36 w-full object-cover"
                    />
                    <div className="px-2 py-1 text-xs text-slate-600">{p.kind}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {(view.status === 'documented' || view.status === 'cancelled' || view.status === 'failed') &&
            !activeTesting ? (
              <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                <label className="text-sm">
                  <span className="text-slate-600">{t('install_test_target')} (10–50)</span>
                  <input
                    type="number"
                    min={10}
                    max={50}
                    className="mt-1 block w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={targetPpm}
                    onChange={(e) => setTargetPpm(Number(e.target.value))}
                  />
                </label>
                <Button
                  type="button"
                  disabled={busy}
                  className="gap-2"
                  onClick={() => void onStartTest(view.id)}
                >
                  <Play className="h-4 w-4" />
                  {t('install_test_start')}
                </Button>
              </div>
            ) : null}

            {view.status === 'testing' ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-2">
                <p className="font-medium">{t('install_test_running')}</p>
                <p>
                  {t('install_last_reading')}:{' '}
                  {view.test_summary && typeof view.test_summary.lastReading === 'number'
                    ? `${view.test_summary.lastReading} ppm`
                    : '—'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className="gap-2"
                  onClick={() => void onCancelTest(view.id)}
                >
                  <Square className="h-3.5 w-3.5" />
                  {t('install_test_cancel')}
                </Button>
              </div>
            ) : null}

            {view.doses && view.doses.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold mb-2">{t('install_doses')}</h4>
                <ul className="text-sm space-y-1 text-slate-700">
                  {view.doses.map((d) => (
                    <li key={d.id}>
                      {d.occurred_at ? formatDateTime(d.occurred_at) : '—'} — {d.dose_ppm} ppm
                      {d.injection_seconds != null ? ` · ${d.injection_seconds}s` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
