import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, Server, Sliders, ClipboardCheck, Trash2, ArrowLeft, Camera, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { RecipeBuilder, type Recipe } from './recipes/RecipeBuilder';
import { ProductCombobox, type ProductRow } from './recipes/ProductCombobox';
import { PERUVIAN_RECIPES } from '@/app/data/recipes';
import { useSettings } from '@/app/contexts/SettingsContext';
import { fetchProducts, type AppProduct } from '@/app/lib/productsApi';
import { fetchRecipes } from '@/app/lib/recipesApi';
import { getStoredUser } from '@/app/lib/auth';
import { createRipeningProcess, fetchActiveProcessForDevice } from '@/app/lib/ripeningProcessesApi';
import type { ActiveDeviceSummary } from '@/app/lib/ripeningProcessesApi';
import { useDevices } from '@/app/hooks/useDevices';
import type { Device } from '@/app/data';

type TargetFieldState = { id: string; name: string; value: string; unit: string; builtIn: boolean };

const defaultTargetParams = (): TargetFieldState[] => [
  { id: 'brix', name: 'Grado Brix (°)', value: '', unit: '°Bx', builtIn: true },
  { id: 'firm', name: 'Firmeza (lb)', value: '', unit: 'lb', builtIn: true },
  { id: 'color', name: 'Color (Escala 1-7)', value: '', unit: 'Escala', builtIn: true },
  { id: 'ms', name: 'Materia Seca (%)', value: '', unit: '%', builtIn: true },
  { id: 'ph', name: 'pH', value: '', unit: 'pH', builtIn: true },
  { id: 'acid', name: 'Acidez (%)', value: '', unit: '%', builtIn: true },
];

const defaultSamplingParams = (): TargetFieldState[] => defaultTargetParams().map((p) => ({ ...p }));

/** Suma horas de fases homog/mad/vent(→h)/enf, igual que en la biblioteca de recetas. */
export function sumRecipeTotalHours(recipe: Recipe | null): number {
  if (!recipe?.phases) return 0;
  return recipe.phases.reduce((acc, p) => {
    if (!p.enabled) return acc;
    if (p.type === 'venting') return acc + p.duration / 60;
    return acc + p.duration;
  }, 0);
}

export function formatDateDayMonthYear(d: Date) {
  const z = (n: number) => n.toString().padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Recetas cuyo producto (fruit) encaja con el producto de catálogo elegido. */
export function filterRecipesByProduct(recipes: Recipe[], productName: string): Recipe[] {
  const p = productName.trim().toLowerCase();
  if (!p) return [];
  return recipes.filter((r) => {
    const rf = (r.fruit || '').trim().toLowerCase();
    if (!rf) return false;
    if (rf === p) return true;
    if (p.includes(rf) || rf.includes(p)) return true;
    const pFirst = p.split(/\s+/)[0] ?? p;
    const rFirst = rf.split(/\s+/)[0] ?? rf;
    return pFirst === rFirst;
  });
}

/** Seguimiento requiere dispositivo conectado (no figurar como Fuera de línea). */
function isDeviceOfflineForTracking(d: Device | undefined): boolean {
  if (!d) return false;
  return d.status === 'offline' || d.estado_conexion === 'offline';
}

function isValidRequiredQuantityKg(s: string): boolean {
  const raw = s.trim().replace(',', '.');
  if (!raw) return false;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0;
}

function deviceSnapshot(d: Device, t: (k: string) => string) {
  const m = d.madurador;
  const on = d.telemetry?.power_state === 1;
  const setTemp = d.telemetry?.set_point;
  const hum = m?.humidity_set_point;
  const co2 =
    m?.set_point_co2_value != null && Number.isFinite(m.set_point_co2_value)
      ? String(m.set_point_co2_value)
      : m?.set_point_co2_display != null
        ? String(m.set_point_co2_display)
        : '—';
  const spE =
    m?.sp_ethyleno != null && Number.isFinite(m.sp_ethyleno)
      ? `${m.sp_ethyleno % 1 === 0 ? m.sp_ethyleno : m.sp_ethyleno.toFixed(1)} ${t('sp_ethyleno_unit')}`
      : '—';
  return { on, setTemp, hum, co2, spE };
}

type CreateProcessFormProps = {
  onCancel: () => void;
  /** Llamado tras guardar en servidor */
  onSave: (created?: { id: string }) => void;
};

export const CreateProcessForm: React.FC<CreateProcessFormProps> = ({ onCancel, onSave }) => {
  const { t, formatTemp, language } = useSettings();
  const { devices, isLoading: devicesLoading } = useDevices();
  const role = getStoredUser()?.role;
  const canManageProducts = role === 'superadmin' || role === 'admin';

  const [step, setStep] = useState<'form' | 'custom-recipe'>('form');
  const [productRows, setProductRows] = useState<AppProduct[]>([]);
  const [recipesCatalog, setRecipesCatalog] = useState<Recipe[]>(PERUVIAN_RECIPES);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [processName, setProcessName] = useState('');
  const [clientType, setClientType] = useState<'external' | 'internal'>('external');
  const [clientName, setClientName] = useState('');
  const [origin, setOrigin] = useState('');
  const [productName, setProductName] = useState('');
  const [quantityKg, setQuantityKg] = useState<string>('');
  const [volumeM3, setVolumeM3] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [customRecipe, setCustomRecipe] = useState<Recipe | null>(null);
  const [startNow, setStartNow] = useState(true);
  const [scheduledStart, setScheduledStart] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [skipObjectives, setSkipObjectives] = useState(false);
  const [targetParams, setTargetParams] = useState<TargetFieldState[]>(defaultTargetParams);
  const [newTargetName, setNewTargetName] = useState('');
  const [initialSamplingParams, setInitialSamplingParams] = useState<TargetFieldState[]>(defaultSamplingParams);
  const [newSampleParamName, setNewSampleParamName] = useState('');
  const [initialSampleNotes, setInitialSampleNotes] = useState('');
  const [samplingFiles, setSamplingFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [notesError, setNotesError] = useState('');
  const [originError, setOriginError] = useState('');
  const [quantityKgError, setQuantityKgError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const initUser = getStoredUser();
  const [supervisorName, setSupervisorName] = useState(() => (initUser?.name || '').trim());
  const [supervisorEmail, setSupervisorEmail] = useState(() => (initUser?.email || '').trim());
  const [initialPersona, setInitialPersona] = useState(() => (initUser?.name || '').trim());
  const [activeOnDevice, setActiveOnDevice] = useState<ActiveDeviceSummary | null>(null);
  const [activeOnDeviceLoading, setActiveOnDeviceLoading] = useState(false);
  const [ackCancelPrevious, setAckCancelPrevious] = useState(false);
  const samplingUrlsRef = useRef(samplingFiles);
  samplingUrlsRef.current = samplingFiles;

  const hasDeviceConflict = Boolean(deviceId && activeOnDevice);
  const mustAckReplace = hasDeviceConflict && !ackCancelPrevious;

  useEffect(() => {
    setAckCancelPrevious(false);
    setActiveOnDevice(null);
    if (!deviceId) {
      return;
    }
    const ac = new AbortController();
    setActiveOnDeviceLoading(true);
    fetchActiveProcessForDevice(deviceId, ac.signal)
      .then((d) => setActiveOnDevice(d?.summary ?? null))
      .catch(() => setActiveOnDevice(null))
      .finally(() => setActiveOnDeviceLoading(false));
    return () => ac.abort();
  }, [deviceId]);

  const loadCatalog = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([fetchProducts(), fetchRecipes().catch(() => [] as Recipe[])]);
      setProductRows(p);
      if (r.length) setRecipesCatalog(r);
      else setRecipesCatalog(PERUVIAN_RECIPES);
    } catch {
      setRecipesCatalog(PERUVIAN_RECIPES);
    } finally {
      setCatalogLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    return () => {
      samplingUrlsRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  const productOptions = useMemo(
    () => productRows.map((p) => ({ id: p.id, name: p.name })),
    [productRows]
  );

  const fruitOptionRows: ProductRow[] = useMemo(() => {
    const base = productOptions.map((o) => ({ id: o.id, name: o.name }));
    if (productName && !base.some((b) => b.name === productName)) {
      return [...base, { id: `__x-${productName}`, name: productName }];
    }
    return base;
  }, [productOptions, productName]);

  const filteredRecipes = useMemo(
    () => filterRecipesByProduct(recipesCatalog, productName),
    [recipesCatalog, productName]
  );

  const activeRecipe: Recipe | null =
    customRecipe && selectedRecipeId === 'custom'
      ? customRecipe
      : recipesCatalog.find((r) => r.id === selectedRecipeId) ?? null;

  const recipeOk = useMemo(() => {
    if (!productName.trim()) return false;
    if (selectedRecipeId === 'custom') {
      return !!(customRecipe && filterRecipesByProduct([customRecipe], productName).length);
    }
    if (!activeRecipe) return false;
    return filterRecipesByProduct([activeRecipe], productName).length > 0;
  }, [selectedRecipeId, customRecipe, productName, activeRecipe]);

  const selectedDevice = useMemo(() => devices.find((d) => d.id === deviceId), [devices, deviceId]);

  const deviceOfflineBlocked = useMemo(
    () => isDeviceOfflineForTracking(selectedDevice),
    [selectedDevice]
  );

  useEffect(() => {
    if (!deviceOfflineBlocked) setSaveError('');
  }, [deviceOfflineBlocked]);

  const totalRecipeHours = useMemo(() => sumRecipeTotalHours(activeRecipe), [activeRecipe]);

  const startAsDate = useMemo(() => {
    if (startNow) return new Date();
    const d = new Date(scheduledStart);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [startNow, scheduledStart]);

  const estimatedEndDate = useMemo(() => {
    if (totalRecipeHours <= 0) return null;
    return new Date(startAsDate.getTime() + totalRecipeHours * 60 * 60 * 1000);
  }, [startAsDate, totalRecipeHours]);

  const autoProcessName = useMemo(() => {
    const devLabel = selectedDevice?.name || selectedDevice?.id || t('no_device');
    const parts = [productName.trim(), clientName.trim(), devLabel, formatDateDayMonthYear(new Date())].filter(
      Boolean
    );
    return parts.join(' ').replace(/\s+/g, ' ').trim() || t('new_maturation_process');
  }, [productName, clientName, selectedDevice, t]);

  const handleCustomRecipeSave = (recipe: Recipe) => {
    setCustomRecipe(recipe);
    setSelectedRecipeId('custom');
    setStep('form');
  };

  const updateTarget = (id: string, value: string) => {
    setTargetParams((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
  };
  const updateSample = (id: string, value: string) => {
    setInitialSamplingParams((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
  };

  const addCustom = (
    name: string,
    setter: React.Dispatch<React.SetStateAction<TargetFieldState[]>>,
    list: TargetFieldState[]
  ) => {
    if (!name.trim()) return;
    if (list.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) return;
    setter((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, name: name.trim(), value: '', unit: t('unit_custom'), builtIn: false },
    ]);
  };

  const removeParam = (id: string, setter: React.Dispatch<React.SetStateAction<TargetFieldState[]>>) => {
    setter((prev) => prev.filter((p) => p.id !== id));
  };

  const addSamplingPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    const next: { file: File; previewUrl: string }[] = [];
    Array.from(list).forEach((f) => {
      if (f.type.startsWith('image/')) {
        next.push({ file: f, previewUrl: URL.createObjectURL(f) });
      }
    });
    if (next.length) setSamplingFiles((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const removeSamplingPhoto = (index: number) => {
    setSamplingFiles((prev) => {
      const row = prev[index];
      if (row) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeOk) return;
    if (deviceOfflineBlocked) {
      setSaveError(t('tracking_offline_device_body'));
      return;
    }
    if (!origin.trim()) {
      setOriginError(t('origin_required_error'));
      return;
    }
    setOriginError('');
    if (!isValidRequiredQuantityKg(quantityKg)) {
      setQuantityKgError(t('quantity_kg_required_error'));
      return;
    }
    setQuantityKgError('');
    if (!initialSampleNotes.trim()) {
      setNotesError(t('sampling_observations_required'));
      return;
    }
    if (!supervisorName.trim()) {
      setSaveError(t('supervisor_required'));
      return;
    }
    if (!initialPersona.trim()) {
      setSaveError(t('sampling_person_required'));
      return;
    }
    setNotesError('');
    setSaveError('');
    const nameFinal = processName.trim() || autoProcessName;
    const _payload = {
      name: nameFinal,
      replaceActiveProcess: hasDeviceConflict ? ackCancelPrevious : false,
      supervisor: {
        name: supervisorName.trim(),
        email: supervisorEmail.trim() || undefined,
      },
      client: { type: clientType, name: clientName },
      batch: {
        product: productName,
        origin,
        quantity_kg: quantityKg,
        volume_m3: volumeM3,
      },
      deviceId,
      recipe: activeRecipe,
      start: startNow ? { mode: 'now' as const } : { mode: 'scheduled' as const, at: scheduledStart },
      scheduleSummary: {
        totalDurationHours: totalRecipeHours,
        startedAt: startAsDate.toISOString(),
        estimatedEndAt: estimatedEndDate?.toISOString() ?? null,
      },
      objectives: skipObjectives
        ? null
        : targetParams
            .filter((p) => p.value !== '')
            .map((p) => ({ name: p.name, value: p.value, unit: p.unit })),
      /** Muestreo inicial: registro de seguimiento; observaciones obligatorias; imágenes opcionales */
      initialSample: {
        type: 'initial' as const,
        personaEscrita: initialPersona.trim(),
        parameters: initialSamplingParams.filter((p) => p.value !== '').map((p) => ({ name: p.name, value: p.value, unit: p.unit })),
        notes: initialSampleNotes.trim(),
        evidencePhotos: samplingFiles.map((s) => ({
          name: s.file.name,
          type: s.file.type,
          size: s.file.size,
        })),
        followsProcessTracking: true,
      },
    };
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('create process', _payload, { files: samplingFiles.map((s) => s.file) });
    }
    setSaving(true);
    try {
      const row = await createRipeningProcess(
        _payload as Record<string, unknown>,
        samplingFiles.map((s) => s.file)
      );
      onSave({ id: row.id });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('load_processes_error'));
    } finally {
      setSaving(false);
    }
  };

  if (step === 'custom-recipe') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-3 flex items-center">
          <Button type="button" variant="ghost" onClick={onCancel} className="gap-2 -ml-2 text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            {t('back_to_process_list')}
          </Button>
        </div>
        <div className="pt-2 max-w-4xl mx-auto">
          <RecipeBuilder
            key="custom"
            products={productOptions}
            onCancel={() => setStep('form')}
            onSave={handleCustomRecipeSave}
            initialData={customRecipe || undefined}
            canCreateProduct={canManageProducts}
            onProductCreated={() => {
              void loadCatalog();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-300">
      <div className="mb-2 flex items-center">
        <Button type="button" variant="ghost" onClick={onCancel} className="gap-2 -ml-2 text-gray-700">
          <ArrowLeft className="w-4 h-4" />
          {t('back_to_process_list')}
        </Button>
      </div>
      <Card className="border-gray-200 shadow-lg">
        <CardContent className="p-8">
          <div className="mb-6 border-b border-gray-100 pb-4 space-y-3">
            <h2 className="text-2xl font-bold text-gray-900">{t('new_maturation_process')}</h2>
            <p className="text-gray-500 mt-1">{t('new_process_desc')}</p>
            <p className="text-sm text-blue-950 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 leading-snug">
              {t('create_tracking_required_banner')}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('process_display_name')}</label>
              <input
                type="text"
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
                placeholder={autoProcessName}
                className="w-full border border-gray-300 rounded-lg shadow-sm px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('process_name_auto_hint')}</p>
            </div>

            <div className="space-y-3 border border-amber-100 bg-amber-50/40 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800">{t('process_supervisor_title')}</h3>
              <p className="text-xs text-gray-600">{t('process_supervisor_desc')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('supervisor_name')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg shadow-sm px-3 py-2 text-sm"
                    required
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('supervisor_email_optional')}
                  </label>
                  <input
                    type="email"
                    value={supervisorEmail}
                    onChange={(e) => setSupervisorEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg shadow-sm px-3 py-2 text-sm"
                    autoComplete="email"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                  1
                </span>
                {t('client_info')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('client_type')}</label>
                  <select
                    value={clientType}
                    onChange={(e) => setClientType(e.target.value as 'external' | 'internal')}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="external">{t('client_type_external')}</option>
                    <option value="internal">{t('client_type_internal')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('client_name')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej. Empresa o cliente"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                  2
                </span>
                {t('batch_details')}
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('product_label')}</label>
                {!catalogLoaded ? (
                  <p className="text-sm text-gray-500">{t('loading_catalog')}</p>
                ) : fruitOptionRows.length > 0 || canManageProducts ? (
                  <ProductCombobox
                    value={productName}
                    onChange={setProductName}
                    items={fruitOptionRows}
                    canCreateProduct={canManageProducts}
                    onProductCreated={() => {
                      void loadCatalog();
                    }}
                    createSortOrder={productRows.length}
                  />
                ) : (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    {t('products_empty')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('lot_origin')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => {
                    setOrigin(e.target.value);
                    if (originError) setOriginError('');
                  }}
                  className={clsx(
                    'w-full rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500',
                    originError ? 'border-red-400 border-2' : 'border-gray-300 border'
                  )}
                  placeholder={t('lot_origin_ph')}
                  required
                  aria-invalid={Boolean(originError)}
                />
                {originError && <p className="text-xs text-red-600 mt-1">{originError}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('quantity_kg')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={quantityKg}
                    onChange={(e) => {
                      setQuantityKg(e.target.value);
                      if (quantityKgError) setQuantityKgError('');
                    }}
                    className={clsx(
                      'w-full rounded-lg shadow-sm',
                      quantityKgError ? 'border-red-400 border-2' : 'border-gray-300 border'
                    )}
                    placeholder="0.00"
                    required
                    aria-invalid={Boolean(quantityKgError)}
                  />
                  {quantityKgError && <p className="text-xs text-red-600 mt-1">{quantityKgError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('batch_volume_m3')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={volumeM3}
                    onChange={(e) => setVolumeM3(e.target.value)}
                    className="w-full border-gray-300 rounded-lg shadow-sm"
                    placeholder="m³"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                  3
                </span>
                {t('control_device')}
              </h3>
              {devicesLoading ? (
                <p className="text-sm text-gray-500">{t('loading_devices')}</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">{t('control_device_list_hint')}</p>
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-gray-400" />
                    <select
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg shadow-sm py-2 px-3"
                      required
                    >
                      <option value="">{t('select_device_placeholder')}</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} — {d.id}
                          {isDeviceOfflineForTracking(d) ? ` (${t('status_offline')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {deviceOfflineBlocked && (
                    <div
                      className="rounded-lg border-2 border-red-200 bg-red-50 p-4 text-sm text-red-900 space-y-1"
                      role="alert"
                    >
                      <p className="font-semibold">{t('tracking_offline_device_title')}</p>
                      <p>{t('tracking_offline_device_body')}</p>
                    </div>
                  )}
                </>
              )}
              {activeOnDeviceLoading && deviceId && (
                <p className="text-sm text-gray-500">{t('device_active_check_loading')}</p>
              )}

              {hasDeviceConflict && !activeOnDeviceLoading && (
                <div
                  className="rounded-lg border-2 border-amber-300 bg-amber-50/90 p-4 text-sm space-y-3"
                  role="status"
                >
                  <p className="font-semibold text-amber-900">{t('device_active_process_title')}</p>
                  <p className="text-amber-800">{t('device_active_process_body')}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-amber-950 text-sm">
                    <li>
                      <span className="text-amber-700">{t('field_process_name')}: </span>
                      {activeOnDevice?.display_name}
                    </li>
                    <li>
                      <span className="text-amber-700">{t('client')}: </span>
                      {activeOnDevice?.client}
                    </li>
                    <li>
                      <span className="text-amber-700">{t('product')}: </span>
                      {activeOnDevice?.product}
                    </li>
                    <li>
                      <span className="text-amber-700">{t('estimated_progress')}: </span>
                      {activeOnDevice?.progress != null ? `${activeOnDevice.progress}%` : '—'}
                    </li>
                  </ul>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={ackCancelPrevious}
                      onChange={(e) => setAckCancelPrevious(e.target.checked)}
                    />
                    <span className="text-sm text-amber-950 leading-snug">{t('device_active_ack_replace')}</span>
                  </label>
                </div>
              )}

              {selectedDevice && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-medium text-slate-800 mb-2">{t('equipo_estado_actual')}</p>
                  {(() => {
                    const snap = deviceSnapshot(selectedDevice, t);
                    return (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">
                        <li>
                          <span className="text-gray-500">{t('estado')}: </span>
                          {snap.on ? t('estado_on') : t('estado_off')}
                        </li>
                        <li>
                          <span className="text-gray-500">{t('set_temp_label')}: </span>
                          {snap.setTemp != null && Number.isFinite(snap.setTemp) ? formatTemp(snap.setTemp) : '—'}
                        </li>
                        <li>
                          <span className="text-gray-500">{t('humidity_set_point_label')}: </span>
                          {snap.hum != null && Number.isFinite(snap.hum) ? `${snap.hum} %` : '—'}
                        </li>
                        <li>
                          <span className="text-gray-500">{t('set_point_co2_label')}: </span>
                          {snap.co2}
                        </li>
                        <li className="sm:col-span-2">
                          <span className="text-gray-500">{t('status_sp_ethylene')}: </span>
                          {snap.spE}
                        </li>
                      </ul>
                    );
                  })()}
                  <p className="text-xs text-amber-800 mt-3 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                    {t('control_device_off_note')}
                  </p>
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100" />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                    4
                  </span>
                  {t('recipe_planning')}
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={() => setStep('custom-recipe')}>
                  <Plus className="w-3 h-3 mr-1" /> {t('create_edit_custom')}
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-blue-800 mb-1 font-medium">
                    {t('select_recipe_library')}
                  </label>
                  {!productName ? (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      {t('select_product_first_for_recipes')}
                    </p>
                  ) : filteredRecipes.length === 0 && !customRecipe ? (
                    <p className="text-sm text-gray-600">{t('no_recipes_for_product')}</p>
                  ) : null}
                  <select
                    value={selectedRecipeId}
                    onChange={(e) => {
                      setSelectedRecipeId(e.target.value);
                      if (e.target.value !== 'custom') setCustomRecipe(null);
                    }}
                    className="w-full border border-blue-200 rounded-lg shadow-sm bg-white py-2 px-2 mt-1"
                    disabled={!productName}
                  >
                    <option value="">{t('select_recipe_option')}</option>
                    {customRecipe && <option value="custom">★ {t('custom_recipe_current')}</option>}
                    {filteredRecipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.fruit})
                      </option>
                    ))}
                  </select>
                </div>
                {activeRecipe && (
                  <div className="bg-blue-50/80 p-3 rounded-md border border-blue-100 text-sm">
                    <p className="font-semibold text-blue-900 mb-1">{activeRecipe.name}</p>
                    <p className="text-gray-600 text-xs mb-2">{activeRecipe.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {activeRecipe.phases
                        .filter((p) => p.enabled)
                        .map((p, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-white border border-blue-100 rounded text-xs text-blue-700 font-medium"
                          >
                            {i + 1}. {p.type}{' '}
                            {p.type === 'venting'
                              ? `(${p.duration} min)`
                              : `(${p.duration} h)`}
                          </span>
                        ))}
                    </div>
                    {totalRecipeHours > 0 && (
                      <div className="mt-3 space-y-1 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
                        <p>
                          {t('process_recipe_total_hours', { hours: totalRecipeHours.toFixed(1) })}
                        </p>
                        {estimatedEndDate && (
                          <p>
                            {t('process_estimated_end', {
                              date: estimatedEndDate.toLocaleString(
                                language === 'es' ? 'es' : 'en',
                                { dateStyle: 'short', timeStyle: 'short' }
                              ),
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-800">{t('process_start_time')}</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="start"
                        checked={startNow}
                        onChange={() => setStartNow(true)}
                      />
                      {t('start_now_button')}
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="start"
                        checked={!startNow}
                        onChange={() => setStartNow(false)}
                      />
                      {t('start_schedule_label')}
                    </label>
                  </div>
                  {!startNow && (
                    <input
                      type="datetime-local"
                      value={scheduledStart}
                      onChange={(e) => setScheduledStart(e.target.value)}
                      className="w-full max-w-sm border border-gray-300 rounded-lg shadow-sm py-2 px-2"
                    />
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-gray-800 flex items-center gap-2">
                      <Sliders className="w-4 h-4" /> {t('target_objectives_title')}
                    </h4>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={skipObjectives}
                        onChange={(e) => setSkipObjectives(e.target.checked)}
                      />
                      {t('no_objectives_check')}
                    </label>
                  </div>
                  {!skipObjectives && (
                    <>
                      <p className="text-xs text-gray-500">{t('objectives_optional')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {targetParams.map((p) => (
                          <div key={p.id} className="relative">
                            <label className="block text-xs text-gray-500 mb-1">
                              {p.name} ({p.unit})
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={p.value}
                                onChange={(e) => updateTarget(p.id, e.target.value)}
                                className="w-full border border-gray-300 rounded-md py-1.5 px-2 text-sm"
                                placeholder="—"
                              />
                              {p.builtIn === false && (
                                <button
                                  type="button"
                                  onClick={() => removeParam(p.id, setTargetParams)}
                                  className="text-red-400 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 items-center border-t border-dashed border-gray-200 pt-2">
                        <input
                          type="text"
                          className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          value={newTargetName}
                          onChange={(e) => setNewTargetName(e.target.value)}
                          placeholder={t('new_param_name_placeholder')}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            addCustom(newTargetName, setTargetParams, targetParams);
                            setNewTargetName('');
                          }}
                          disabled={!newTargetName.trim()}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                  5
                </span>
                <ClipboardCheck className="w-4 h-4" />
                {t('initial_sampling_block_title')}
              </h3>
              <p className="text-xs text-gray-500">{t('initial_sampling_block_desc')}</p>
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                {t('sampling_result_tracking_note')}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('initial_sampling_person')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={initialPersona}
                  onChange={(e) => setInitialPersona(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={t('initial_sampling_person_ph')}
                />
                <p className="text-xs text-gray-500 mt-0.5">{t('initial_sampling_person_hint')}</p>
              </div>
              <div className="rounded-md bg-blue-50/50 border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 inline-block">
                {t('sampling_type_initial_only')}
              </div>
              <p className="text-xs text-gray-500">{t('sampling_params_all_optional')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {initialSamplingParams.map((p) => (
                  <div key={p.id}>
                    <label className="block text-xs text-gray-500 mb-1">
                      {p.name} ({p.unit})
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={p.value}
                        onChange={(e) => updateSample(p.id, e.target.value)}
                        className="w-full border border-gray-300 rounded-md py-1.5 px-2 text-sm"
                        placeholder="—"
                      />
                      {p.builtIn === false && (
                        <button
                          type="button"
                          onClick={() => removeParam(p.id, setInitialSamplingParams)}
                          className="text-red-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  value={newSampleParamName}
                  onChange={(e) => setNewSampleParamName(e.target.value)}
                  placeholder={t('new_param_name_placeholder')}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    addCustom(newSampleParamName, setInitialSamplingParams, initialSamplingParams);
                    setNewSampleParamName('');
                  }}
                  disabled={!newSampleParamName.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <label className="text-sm text-gray-700 mb-1 block">
                  {t('sampling_notes')} <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={initialSampleNotes}
                  onChange={(e) => {
                    setInitialSampleNotes(e.target.value);
                    if (notesError) setNotesError('');
                  }}
                  className={clsx(
                    'w-full border rounded-lg text-sm p-2 min-h-[80px]',
                    notesError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300'
                  )}
                  placeholder={t('sampling_notes_ph')}
                  required
                />
                {notesError && <p className="text-xs text-red-600 mt-1">{notesError}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  {t('sampling_photo_evidence')}
                </label>
                <p className="text-xs text-gray-500">{t('sampling_photos_optional')}</p>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-3">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={addSamplingPhotos}
                    className="w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5"
                  />
                </div>
                {samplingFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {samplingFiles.map((s, i) => (
                      <div key={s.previewUrl + i} className="relative group rounded-lg border border-gray-200 overflow-hidden aspect-square bg-gray-50">
                        <img
                          src={s.previewUrl}
                          alt={s.file.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeSamplingPhoto(i)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
                          aria-label={t('sampling_remove_photo')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <p className="absolute bottom-0 left-0 right-0 text-[10px] truncate bg-black/40 text-white px-1 py-0.5">
                          {s.file.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-red-600" role="alert">
                {saveError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-6">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[150px] gap-2"
                disabled={
                  saving ||
                  !recipeOk ||
                  !deviceId ||
                  !clientName.trim() ||
                  !origin.trim() ||
                  !isValidRequiredQuantityKg(quantityKg) ||
                  !productName.trim() ||
                  !initialSampleNotes.trim() ||
                  !supervisorName.trim() ||
                  !initialPersona.trim() ||
                  mustAckReplace ||
                  deviceOfflineBlocked
                }
              >
                <Save className="w-4 h-4" />
                {saving ? t('saving_process') : t('start_process')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
