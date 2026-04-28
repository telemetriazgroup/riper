import React, { useState, useEffect, useRef } from 'react';
import { ClipboardCheck, Camera, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { clsx } from 'clsx';
import { useSettings } from '@/app/contexts/SettingsContext';

export type SamplingType = 'initial' | 'monitoring' | 'final';

export interface SamplingParameter {
  id: string;
  name: string;
  value: string;
  unit: string;
  target?: string;
}

export type RipeningSamplingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  saving: boolean;
  defaultPersonaName: string;
  onSave: (payload: {
    type: SamplingType;
    parameters: SamplingParameter[];
    notes: string;
    imageFiles: File[];
    personaEscrita: string;
  }) => void | Promise<void>;
};

/** Mismo modal que «Registrar muestreo» en detalle de proceso (Seguimiento). */
export function RipeningSamplingModal({
  isOpen,
  onClose,
  onSave,
  saving,
  defaultPersonaName,
}: RipeningSamplingModalProps) {
  const { t, language } = useSettings();
  const [type, setType] = useState<SamplingType>('monitoring');
  const [personaEscrita, setPersonaEscrita] = useState(() => (defaultPersonaName || '').trim());
  const [parameters, setParameters] = useState<SamplingParameter[]>([
    { id: '1', name: 'Grado Brix (°)', value: '', unit: '°Bx', target: '15' },
    { id: '2', name: 'Firmeza (lb)', value: '', unit: 'lb', target: '12' },
    { id: '3', name: 'Color (Escala 1-7)', value: '', unit: 'Escala', target: '4' },
    { id: '4', name: 'Materia Seca (%)', value: '', unit: '%', target: '20' },
    { id: '5', name: 'pH', value: '', unit: 'pH', target: '5.5' },
    { id: '6', name: 'Acidez (%)', value: '', unit: '%', target: '0.5' },
  ]);
  const [newParamName, setNewParamName] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<{ file: File; preview: string }[]>([]);
  const evidenceRef = useRef(evidence);
  evidenceRef.current = evidence;

  useEffect(() => {
    if (isOpen) {
      setPersonaEscrita((defaultPersonaName || '').trim());
      setType('monitoring');
      setNotes('');
      setNewParamName('');
      evidenceRef.current.forEach((e) => URL.revokeObjectURL(e.preview));
      setEvidence([]);
    }
  }, [isOpen, defaultPersonaName]);

  useEffect(() => {
    return () => {
      evidenceRef.current.forEach((e) => URL.revokeObjectURL(e.preview));
    };
  }, []);

  const handleAddParam = () => {
    if (!newParamName) return;
    setParameters([
      ...parameters,
      { id: Date.now().toString(), name: newParamName, value: '', unit: 'Personalizado' },
    ]);
    setNewParamName('');
  };

  const handleValueChange = (id: string, val: string) => {
    setParameters(parameters.map((p) => (p.id === id ? { ...p, value: val } : p)));
  };

  const handleDeleteParam = (id: string) => {
    setParameters(parameters.filter((p) => p.id !== id));
  };

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    const more = Array.from(list)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setEvidence((prev) => {
      if (!more.length) return prev;
      return [...prev, ...more];
    });
    e.target.value = '';
  };

  const removeEvidence = (index: number) => {
    setEvidence((prev) => {
      const row = prev[index];
      if (row) URL.revokeObjectURL(row.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async () => {
    if (!personaEscrita.trim()) return;
    await onSave({
      type,
      parameters: parameters.filter((p) => p.value !== ''),
      notes,
      imageFiles: evidence.map((e) => e.file),
      personaEscrita: personaEscrita.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="text-blue-600" />
            {t('sampling_register')}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="sr-only">Cerrar</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {t('sampling_person_field')} <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={personaEscrita}
              onChange={(e) => setPersonaEscrita(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder={t('sampling_person_ph')}
            />
            <p className="text-xs text-gray-500">{t('sampling_person_field_hint')}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {language === 'es' ? 'Tipo de muestreo' : 'Sampling type'}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { id: 'initial' as const, labelEs: 'Inicial / Recepción', labelEn: 'Initial / Reception' },
                  { id: 'monitoring' as const, labelEs: 'Seguimiento', labelEn: 'Monitoring' },
                  { id: 'final' as const, labelEs: 'Final / Liberación', labelEn: 'Final / Release' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  className={clsx(
                    'px-4 py-3 rounded-lg text-sm font-medium border transition-all',
                    type === opt.id
                      ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {language === 'es' ? opt.labelEs : opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">
                {language === 'es' ? 'Parámetros de calidad' : 'Quality parameters'}
              </label>
              <span className="text-xs text-gray-500">
                {language === 'es' ? 'Ingrese solo los valores medidos' : 'Enter measured values only'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {parameters.map((param) => (
                <div key={param.id} className="relative">
                  <label className="block text-xs text-gray-500 mb-1">
                    {param.name} ({param.unit})
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      placeholder={param.target ? `Meta: ${param.target}` : '-'}
                      value={param.value}
                      onChange={(e) => handleValueChange(param.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {param.unit === 'Personalizado' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteParam(param.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 items-center pt-2 border-t border-gray-100 border-dashed">
              <input
                type="text"
                placeholder={language === 'es' ? 'Nombre nuevo parámetro…' : 'New parameter name…'}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={newParamName}
                onChange={(e) => setNewParamName(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={handleAddParam} disabled={!newParamName}>
                <Plus className="w-4 h-4 mr-1" /> {language === 'es' ? 'Agregar' : 'Add'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t('sampling_photo_evidence')}</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={addFiles}
              className="w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5"
            />
            {evidence.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {evidence.map((row, i) => (
                  <div
                    key={row.preview + i}
                    className="relative group rounded-lg border border-gray-200 overflow-hidden aspect-square bg-gray-50"
                  >
                    <img src={row.preview} alt={row.file.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeEvidence(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white"
                      aria-label={t('sampling_remove_photo')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <p className="absolute bottom-0 left-0 right-0 text-[10px] truncate bg-black/40 text-white px-1 py-0.5">
                      {row.file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="border border-dashed border-gray-200 rounded-lg p-3 text-center text-gray-400 text-xs">
              <Camera className="w-5 h-5 mx-auto mb-1" />
              {t('sampling_photos_multi_hint')}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t('sampling_notes')}</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px] text-sm"
              placeholder={t('sampling_notes_ph')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => void handleSave()}
            disabled={saving || !personaEscrita.trim()}
          >
            <Save className="w-4 h-4 mr-2" /> {saving ? t('saving_process') : t('sampling_save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
