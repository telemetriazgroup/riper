import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  MapPin,
  Box,
  ClipboardCheck,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  FlaskConical,
  FileText,
  Ban,
  FileBarChart2,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { AuthedImage } from './AuthedImage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { clsx } from 'clsx';
import { getStoredUser } from '@/app/lib/auth';
import { canRegisterRipeningSampling, canCancelRipeningTracking } from '@/app/lib/permissions';
import { postRipeningSampling, fetchRipeningProcess, patchRipeningProcess } from '@/app/lib/ripeningProcessesApi';
import { buildPlanningSnapshot, mapRowToProcessView, remainingDays } from '@/app/lib/ripeningProcessMappers';
import { useSettings } from '@/app/contexts/SettingsContext';
import { ProcessTrackingReportDialog } from '@/app/components/ProcessTrackingReportDialog';
import { ProcessRecipeDetailModal } from '@/app/components/ProcessRecipeDetailModal';
import { ProcessIntegralReportDialog } from '@/app/components/ProcessIntegralReportDialog';
import {
  RipeningSamplingModal,
  type SamplingType,
  type SamplingParameter,
} from '@/app/components/RipeningSamplingModal';

interface ProcessDetailProps {
  processId?: string;
  processData?: any;
  onBack: () => void;
  onProcessUpdated?: (v: ReturnType<typeof mapRowToProcessView>) => void;
}

// --- Fallback Data if only ID is provided ---
const FALLBACK_DATA = {
  id: "PROC-2024-88",
  status: "active",
  client: { name: "Mango Aérea de Colombia S.A.", type: "external" },
  batch: { product: "Mango Tommy Atkins", origin: "Tolima", quantity_kg: 4500, quantity_m3: 12.5, box_count: 320, entry_date: "2024-02-02T08:30:00" },
  recipe: {
    name: 'Maduración Exportación',
    duration_hours: 72,
    targets: { brix: '14-16', firmness: '10-12', color: '4.5' },
    phases: [],
  },
  scheduleSummary: { estimatedEndAt: null, startedAt: "2024-02-02T08:30:00.000Z" },
  progress: 35,
  timeline: [],
};

function firstNumber(s: string) {
  const m = String(s).match(/[\d.,]+/);
  if (!m) return NaN;
  return parseFloat(m[0].replace(',', '.'));
}

/** Barra aproximada respecto a una escala típica (solo visual) */
function barPct(kind: 'brix' | 'firm' | 'color', value: string) {
  const n = firstNumber(value);
  if (!Number.isFinite(n)) return 0;
  if (kind === 'brix') return Math.min(100, Math.round((n / 25) * 100));
  if (kind === 'color') return Math.min(100, Math.round((n / 7) * 100));
  return Math.min(100, Math.round((n / 30) * 100));
}

/** Evidencia en bitácora: ruta API con token o URL pública. */
function resolveEvidencePhoto(img: { url?: string; desc?: string }): {
  alt: string;
  apiPath: string | null;
  directSrc: string | null;
} {
  const alt = (img.desc && String(img.desc).trim()) || 'evidencia';
  const raw = img.url != null ? String(img.url) : '';
  if (!raw) return { alt, apiPath: null, directSrc: null };
  if (raw.includes('/ripening-processes/')) {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        return { alt, apiPath: new URL(raw).pathname, directSrc: null };
      } catch {
        return { alt, apiPath: raw, directSrc: null };
      }
    }
    return { alt, apiPath: raw, directSrc: null };
  }
  return { alt, apiPath: null, directSrc: raw };
}

type PhotoViewerState =
  | { alt: string; apiPath: string }
  | { alt: string; directSrc: string };

export const ProcessDetail: React.FC<ProcessDetailProps> = ({
  processId,
  processData,
  onBack,
  onProcessUpdated,
}) => {
  const { t } = useSettings();
  const data = processData || FALLBACK_DATA;
  const processStatus = (data as { status?: string }).status || 'active';
  const isArchived = (data as ReturnType<typeof mapRowToProcessView>).archived === true;
  const isActiveProcess = processStatus === 'active';
  const allowSamplingWhenClosed =
    processStatus === 'cancelled' || processStatus === 'completed';
  const canRegister =
    !isArchived &&
    canRegisterRipeningSampling() &&
    (isActiveProcess || allowSamplingWhenClosed);
  const closedSamplingModal = !isActiveProcess && allowSamplingWhenClosed;
  const canCancelHere = isActiveProcess && canCancelRipeningTracking() && !isArchived;
  const [photoViewer, setPhotoViewer] = useState<PhotoViewerState | null>(null);
  const [isSamplingModalOpen, setIsSamplingModalOpen] = useState(false);
  const [cancellingTracking, setCancellingTracking] = useState(false);
  const [samplingSaving, setSamplingSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [integralReportOpen, setIntegralReportOpen] = useState(false);
  const [events, setEvents] = useState((processData || FALLBACK_DATA).timeline || []);

  useEffect(() => {
    setEvents((processData || FALLBACK_DATA).timeline || []);
  }, [processData]);

  const snap = useMemo(() => {
    const view = { ...data, timeline: events } as ReturnType<typeof mapRowToProcessView>;
    return buildPlanningSnapshot(view);
  }, [data, events]);

  const remDays = useMemo(() => {
    const est = (data as { scheduleSummary?: { estimatedEndAt?: string | null } })?.scheduleSummary
      ?.estimatedEndAt;
    return remainingDays(est);
  }, [data]);

  const idDisplay = (data as { id?: string }).id || processId || '';

  const reportView = useMemo(
    () => ({ ...data, timeline: events } as ReturnType<typeof mapRowToProcessView>),
    [data, events]
  );

  const linkedDeviceId = useMemo(() => {
    const p = reportView._row?.payload as { deviceId?: string } | undefined;
    return String(p?.deviceId ?? '').trim();
  }, [reportView]);

  const extLabel = t('client_type_external');
  const inLabel = t('client_type_internal');

  const handleSaveSampling = async (newSample: {
    type: SamplingType;
    parameters: SamplingParameter[];
    notes: string;
    imageFiles: File[];
    personaEscrita: string;
  }) => {
    const pid = (data as { id?: string }).id;
    if (!pid) return;
    setSamplingSaving(true);
    try {
      await postRipeningSampling(
        pid,
        {
          samplingType: newSample.type,
          personaEscrita: newSample.personaEscrita.trim(),
          parameters: newSample.parameters
            .filter((p) => p.value !== '')
            .map((p) => ({ name: p.name, value: p.value, unit: p.unit })),
          notes: newSample.notes || undefined,
        },
        newSample.imageFiles
      );
      const row = await fetchRipeningProcess(pid);
      const view = mapRowToProcessView(row);
      onProcessUpdated?.(view);
      setEvents(view.timeline);
      setIsSamplingModalOpen(false);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al guardar muestreo');
    } finally {
      setSamplingSaving(false);
    }
  };

  const handleCancelTracking = async () => {
    const pid = (data as { id?: string }).id;
    if (!pid || !canCancelHere) return;
    if (!window.confirm(t('process_cancel_tracking_confirm'))) return;
    setCancellingTracking(true);
    try {
      await patchRipeningProcess(pid, { status: 'cancelled' });
      const row = await fetchRipeningProcess(pid);
      const view = mapRowToProcessView(row);
      onProcessUpdated?.(view);
      setEvents(view.timeline ?? []);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setCancellingTracking(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-10">
      {isArchived && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {t('tracking_archived_readonly')}
        </div>
      )}
      {!isActiveProcess && (
        <div
          className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800 space-y-2"
          role="status"
        >
          <p>
            {processStatus === 'cancelled'
              ? t('process_cancelled_info')
              : processStatus === 'completed'
                ? t('process_completed_info')
                : t('process_not_active_generic')}
          </p>
          {processStatus === 'completed' &&
            canRegisterRipeningSampling() &&
            !isArchived && (
              <p className="text-sm text-slate-700 mt-2">{t('process_completed_sampling_note')}</p>
            )}
          {processStatus === 'cancelled' &&
            (data as ReturnType<typeof mapRowToProcessView>).cancelledMeta?.at && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 text-xs space-y-0.5">
                <p>
                  <span className="font-semibold">{t('report_cancel_by')}: </span>
                  {(data as ReturnType<typeof mapRowToProcessView>).cancelledMeta?.byName ||
                    (data as ReturnType<typeof mapRowToProcessView>).cancelledMeta?.byEmail ||
                    '—'}
                </p>
                <p>
                  <span className="font-semibold">{t('report_cancel_at')}: </span>
                  {new Date(
                    String((data as ReturnType<typeof mapRowToProcessView>).cancelledMeta?.at)
                  ).toLocaleString()}
                </p>
              </div>
            )}
        </div>
      )}

      {!isActiveProcess && (
        <div
          className="rounded-xl border-2 border-blue-200 bg-gradient-to-r from-slate-50 to-blue-50/80 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm"
          role="region"
          aria-label={t('report_title_final')}
        >
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t('report_final_banner_title')}</h2>
            <p className="text-sm text-gray-600 mt-0.5">{t('report_final_banner_desc')}</p>
          </div>
          <Button
            type="button"
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0 w-full sm:w-auto"
            onClick={() => setReportOpen(true)}
          >
            <FileText className="w-4 h-4" />
            {t('report_open_final')}
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={onBack}>
               <ArrowLeft className="w-5 h-5" />
             </Button>
             <div>
               <h1 className="text-2xl font-bold text-gray-900">{data.client.name}</h1>
               <div className="flex items-center gap-2 text-sm text-gray-500">
                 <span
                   className={clsx(
                     'px-2 py-0.5 rounded-full text-xs font-semibold',
                     data.client.type === 'external' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                   )}
                 >
                   {data.client.type === 'external' ? extLabel : inLabel}
                 </span>
                 <span>•</span>
                 <span className="font-mono text-xs" title={idDisplay}>
                   {idDisplay.length > 12 ? `${idDisplay.slice(0, 8)}…` : idDisplay}
                 </span>
               </div>
            </div>
         </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-stretch md:justify-end">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-blue-200 text-blue-800 hover:bg-blue-50"
              onClick={() => setReportOpen(true)}
            >
              <FileText className="w-4 h-4" />
              {isActiveProcess ? t('report_open_interim') : t('report_open_final')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-violet-200 text-violet-900 hover:bg-violet-50 disabled:opacity-60"
              disabled={!linkedDeviceId}
              title={!linkedDeviceId ? t('integral_report_no_device') : t('integral_report_title')}
              onClick={() => setIntegralReportOpen(true)}
            >
              <FileBarChart2 className="w-4 h-4" />
              {t('integral_report_open')}
            </Button>
            {canRegister && (
              <Button
                type="button"
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setIsSamplingModalOpen(true)}
              >
                <ClipboardCheck className="w-4 h-4" />
                {t('sampling_register')}
              </Button>
            )}
            {canCancelHere && (
              <Button
                type="button"
                variant="outline"
                disabled={cancellingTracking}
                className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => void handleCancelTracking()}
              >
                <Ban className="w-4 h-4" />
                {cancellingTracking ? t('loading') : t('process_cancel_tracking')}
              </Button>
            )}
          </div>
        </div>

        {Boolean((data as { supervisor?: { name?: string } | null }).supervisor?.name) && (
          <div className="flex items-start gap-3 pt-4">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-700">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('field_supervisor')}</p>
              <p className="font-semibold text-gray-900">
                {(data as { supervisor?: { name?: string; email?: string } | null }).supervisor?.name}
              </p>
              {(data as { supervisor?: { email?: string } | null }).supervisor?.email && (
                <p className="text-xs text-gray-500">
                  {(data as { supervisor: { email?: string } }).supervisor.email}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-gray-100">
           <div className="flex items-start gap-3">
             <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
               <Box className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Producto / Lote</p>
               <p className="font-semibold text-gray-900">{data.batch.product}</p>
               <p className="text-xs text-gray-500">
                 {data.batch.box_count != null ? `${data.batch.box_count} cajas` : '—'}
               </p>
             </div>
           </div>

           <div className="flex items-start gap-3">
             <div className="p-2 bg-green-50 rounded-lg text-green-600">
               <MapPin className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Procedencia</p>
               <p className="font-semibold text-gray-900">{data.batch.origin}</p>
               <p className="text-xs text-gray-500">
                 {data.batch.entry_date && !Number.isNaN(new Date(data.batch.entry_date).getTime())
                   ? new Date(data.batch.entry_date).toLocaleDateString()
                   : '—'}
               </p>
             </div>
           </div>

           <div className="flex items-start gap-3">
             <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
               <FlaskConical className="w-5 h-5" />
             </div>
             <button
               type="button"
               onClick={() => setRecipeModalOpen(true)}
               className="text-left rounded-lg -m-2 p-2 hover:bg-blue-50/80 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition-colors w-full min-w-0"
               aria-label={t('recipe_modal_click_hint')}
             >
               <p className="text-sm font-medium text-gray-500">{t('process_detail_active_recipe')}</p>
               <p className="font-semibold text-gray-900">{data.recipe.name}</p>
               <p className="text-xs text-gray-500">
                 {t('recipe_modal_click_hint')} · {t('report_param_brix')}: {data.recipe.targets.brix}
               </p>
             </button>
           </div>

           <div className="flex items-start gap-3">
             <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
               <TrendingUp className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Peso y volumen de lote</p>
               <p className="font-semibold text-gray-900">
                 {data.batch.quantity_kg != null
                   ? `${Number(data.batch.quantity_kg).toLocaleString()} kg`
                   : '—'}
               </p>
               <p className="text-xs text-gray-500">
                 {(data.batch.volume_m3 != null && data.batch.volume_m3 !== '') ||
                 (data.batch.quantity_m3 != null && data.batch.quantity_m3 !== '')
                   ? `m³: ${data.batch.volume_m3 ?? data.batch.quantity_m3}`
                   : 'm³: — (opcional)'}
               </p>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Timeline & Activity */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
             <div className="border-b border-gray-100 p-4">
               <h3 className="font-bold text-gray-800">Bitácora de Eventos y Muestreos</h3>
             </div>
             <div className="p-6 bg-gray-50/50 min-h-[400px]">
               <div className="relative pl-6 border-l-2 border-gray-200 space-y-8">
                 {events.map((event: any, idx: number) => (
                   <div key={event.id} className="relative animate-in slide-in-from-left duration-500">
                     <div className={clsx(
                       "absolute -left-[33px] w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
                       event.type === 'sampling' ? "bg-blue-500 text-white" :
                       event.type === 'alert' ? "bg-red-500 text-white" : "bg-gray-200 text-gray-500"
                     )}>
                       {event.type === 'sampling' ? <ClipboardCheck className="w-4 h-4" /> : 
                        event.type === 'alert' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                     </div>
                     
                     <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                       <div className="flex justify-between items-start mb-2">
                         <div>
                           <h4 className="font-bold text-gray-900">{event.title}</h4>
                           <p className="text-xs text-gray-500 flex flex-col gap-0.5">
                             <span className="flex items-center gap-1 flex-wrap">
                               <Clock className="w-3 h-3 shrink-0" />
                               {new Date(event.timestamp).toLocaleString()}
                             </span>
                             <span className="text-gray-700 font-medium">
                               {t('sampling_executed_by')}: {event.persona_escrita || event.user || '—'}
                             </span>
                             {event.registered_by_email && (
                               <span className="text-[10px] text-gray-400">
                                 {t('registered_in_system')}: {event.registered_by_email}
                               </span>
                             )}
                           </p>
                         </div>
                         <span className="text-xs font-mono text-gray-400">#{event.id.split('-')[1]}</span>
                       </div>

                       {event.description && (
                         <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                       )}

                       {/* Sampling Data Rendering */}
                       {event.data && (
                         <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                           {/* @ts-ignore */}
                           {event.data.map((item: any, i: number) => (
                             <div key={i} className="bg-blue-50 p-2 rounded border border-blue-100">
                               <p className="text-xs text-blue-600 font-medium">{item.name}</p>
                               <p className="font-bold text-gray-900">{item.value} <span className="text-xs font-normal text-gray-500">{item.unit}</span></p>
                             </div>
                           ))}
                         </div>
                       )}

                       {/* Images Rendering */}
                       {event.images && event.images.length > 0 && (
                         <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                           {event.images.map((img: { url?: string; desc?: string }, i: number) => {
                             const ev = resolveEvidencePhoto(img);
                             return (
                               <button
                                 key={img.url ? `${img.url}-${i}` : i}
                                 type="button"
                                 className="relative group min-w-[100px] w-[120px] h-[120px] rounded-lg overflow-hidden border border-gray-200 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shrink-0 cursor-zoom-in"
                                 aria-label={t('evidence_photo_zoom_aria')}
                                 onClick={() => {
                                   if (ev.apiPath) {
                                     setPhotoViewer({ alt: ev.alt, apiPath: ev.apiPath });
                                   } else if (ev.directSrc) {
                                     setPhotoViewer({ alt: ev.alt, directSrc: ev.directSrc });
                                   }
                                 }}
                               >
                                 {ev.apiPath ? (
                                   <AuthedImage
                                     apiPath={ev.apiPath}
                                     alt={ev.alt}
                                     className="w-full h-full object-cover pointer-events-none"
                                   />
                                 ) : ev.directSrc ? (
                                   <ImageWithFallback
                                     src={ev.directSrc}
                                     alt={ev.alt}
                                     className="w-full h-full object-cover pointer-events-none"
                                   />
                                 ) : null}
                                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                                   <p className="text-white text-[10px] truncate">{img.desc}</p>
                                 </div>
                               </button>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </div>
        </div>

        {/* Right Column: Planning & Status */}
        <div className="space-y-6">
           <Card className="border-gray-200 shadow-sm">
             <CardHeader className="pb-2">
               <CardTitle className="text-base">Cumplimiento vs planificación</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 <div className="space-y-1">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">Grados Brix</span>
                     <span className="font-bold text-gray-900">
                       {snap.brix.current}
                       <span className="text-gray-400 font-normal"> / {snap.brix.target}</span>
                     </span>
                   </div>
                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                     <div
                       className="h-full bg-orange-400"
                       style={{ width: `${barPct('brix', snap.brix.current)}%` }}
                     />
                   </div>
                 </div>

                 <div className="space-y-1">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">Firmeza</span>
                     <span className="font-bold text-gray-900">
                       {snap.firmness.current}
                       <span className="text-gray-400 font-normal"> / {snap.firmness.target}</span>
                     </span>
                   </div>
                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                     <div
                       className="h-full bg-blue-500"
                       style={{ width: `${barPct('firm', snap.firmness.current)}%` }}
                     />
                   </div>
                 </div>

                 <div className="space-y-1">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">Color (escala)</span>
                     <span className="font-bold text-gray-900">
                       {snap.color.current}
                       <span className="text-gray-400 font-normal"> / {snap.color.target}</span>
                     </span>
                   </div>
                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                     <div
                       className="h-full bg-green-500"
                       style={{ width: `${barPct('color', snap.color.current)}%` }}
                     />
                   </div>
                 </div>
                 <p className="text-xs text-gray-500">Valores = último muestreo registrado en la bitácora; meta = receta / objetivos.</p>
               </div>
             </CardContent>
           </Card>

           <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-blue-600 to-blue-800 text-white">
             <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-1">Días aprox. restantes</h3>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-4xl font-bold">
                    {remDays == null ? '—' : remDays < 0.01 ? '0' : remDays < 0.1 ? (remDays * 24).toFixed(0) : remDays.toFixed(1)}
                  </span>
                  <span className="text-blue-200 mb-1">
                    {remDays != null && remDays < 0.1 && remDays > 0 ? 'horas' : 'días'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-blue-100 border-t border-blue-500 pt-3">
                  <span>
                    Inicio:{' '}
                    {(
                      (data as { scheduleSummary?: { startedAt?: string } }).scheduleSummary?.startedAt ||
                      events[events.length - 1]?.timestamp
                    )
                      ? new Date(
                          (data as { scheduleSummary?: { startedAt?: string } }).scheduleSummary?.startedAt ||
                            events[events.length - 1]?.timestamp
                        ).toLocaleDateString()
                      : '—'}
                  </span>
                  <span>
                    Progreso:{' '}
                    {(data as { progress?: number }).progress != null
                      ? `${(data as { progress: number }).progress}%`
                      : '—'}
                  </span>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>

      <Dialog open={photoViewer != null} onOpenChange={(open) => !open && setPhotoViewer(null)}>
        <DialogContent className="max-w-[min(96vw,56rem)] w-full p-3 sm:p-4 gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('evidence_photo_zoom_title')}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[85vh] items-center justify-center overflow-auto rounded-md bg-black/5">
            {photoViewer && 'apiPath' in photoViewer ? (
              <AuthedImage
                key={photoViewer.apiPath}
                apiPath={photoViewer.apiPath}
                alt={photoViewer.alt}
                className="max-h-[85vh] w-auto max-w-full object-contain"
              />
            ) : photoViewer && 'directSrc' in photoViewer ? (
              <ImageWithFallback
                src={photoViewer.directSrc}
                alt={photoViewer.alt}
                className="max-h-[85vh] w-auto max-w-full object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sampling Modal */}
      {isSamplingModalOpen && (
        <RipeningSamplingModal
          isOpen={isSamplingModalOpen}
          onClose={() => !samplingSaving && setIsSamplingModalOpen(false)}
          onSave={handleSaveSampling}
          saving={samplingSaving}
          defaultPersonaName={getStoredUser()?.name || ''}
          closedProcess={closedSamplingModal}
        />
      )}

      <ProcessRecipeDetailModal
        open={recipeModalOpen}
        onOpenChange={setRecipeModalOpen}
        view={reportView}
      />

      <ProcessIntegralReportDialog
        open={integralReportOpen}
        onOpenChange={setIntegralReportOpen}
        view={reportView}
      />

      <ProcessTrackingReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        view={reportView}
        isFinal={!isActiveProcess}
        processStatus={processStatus}
      />
    </div>
  );
};
