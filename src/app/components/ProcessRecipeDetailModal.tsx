import React, { useMemo } from 'react';
import { ChefHat, Clock, FlaskConical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  buildPhaseScheduleForModal,
  mapRowToProcessView,
  payloadForRecipeModal,
} from '@/app/lib/ripeningProcessMappers';

export type ProcessRecipeDetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ReturnType<typeof mapRowToProcessView>;
};

export const ProcessRecipeDetailModal: React.FC<ProcessRecipeDetailModalProps> = ({
  open,
  onOpenChange,
  view,
}) => {
  const { t, formatDateTime } = useSettings();
  const payload = useMemo(() => payloadForRecipeModal(view), [view]);
  const schedule = useMemo(() => buildPhaseScheduleForModal(payload, t), [payload, t]);
  const st = String(view.status || 'active').toLowerCase();
  const tg = view.recipe.targets;

  const fmt = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : formatDateTime(iso);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,720px)] overflow-y-auto text-gray-900 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8 text-left">
            <span className="inline-flex rounded-lg bg-blue-100 p-2 text-blue-700">
              <ChefHat className="h-5 w-5" />
            </span>
            <span className="leading-tight">{view.recipe.name}</span>
          </DialogTitle>
          <DialogDescription className="text-left text-gray-600">
            {t('recipe_modal_subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {(view.recipe as { fruit?: string }).fruit && (
            <p>
              <span className="font-semibold text-gray-700">{t('recipe_modal_product')}: </span>
              <span>{(view.recipe as { fruit?: string }).fruit}</span>
            </p>
          )}
          {(view.recipe as { description?: string }).description?.trim() && (
            <p className="text-gray-600 border-l-2 border-blue-200 pl-3">
              {(view.recipe as { description: string }).description}
            </p>
          )}

          <div className="rounded-lg border border-gray-200 bg-slate-50/80 p-3 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {t('recipe_modal_times_title')}
            </h3>
            <dl className="space-y-2 text-gray-800">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                <dt className="text-gray-500">{t('recipe_modal_tracking_start')}</dt>
                <dd className="font-mono text-xs sm:text-sm text-right">{fmt(schedule.startedAt)}</dd>
              </div>
              {st === 'cancelled' && view.cancelledMeta?.at && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 rounded-md bg-amber-50 px-2 py-1.5 border border-amber-100">
                  <dt className="text-amber-900 font-medium">{t('recipe_modal_cancelled')}</dt>
                  <dd className="font-mono text-xs sm:text-sm text-amber-950 text-right">
                    {fmt(view.cancelledMeta.at)}
                  </dd>
                </div>
              )}
              {st === 'completed' && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 rounded-md bg-emerald-50 px-2 py-1.5 border border-emerald-100">
                  <dt className="text-emerald-900 font-medium">{t('recipe_modal_completed')}</dt>
                  <dd className="font-mono text-xs sm:text-sm text-emerald-950 text-right">
                    {fmt(schedule.estimatedFullEndAt)}
                  </dd>
                </div>
              )}
              {st === 'completed' && (
                <p className="text-[11px] text-emerald-800/90">{t('recipe_modal_completed_hint')}</p>
              )}
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 pt-1 border-t border-gray-200">
                <dt className="text-gray-500">{t('recipe_modal_full_end')}</dt>
                <dd className="font-mono text-xs sm:text-sm text-right">{fmt(schedule.estimatedFullEndAt)}</dd>
              </div>
            </dl>
            <p className="text-[11px] text-gray-500">{t('recipe_modal_phase_end_hint')}</p>
          </div>

          {(tg.brix && tg.brix !== '—') ||
          (tg.firmness && tg.firmness !== '—') ||
          (tg.color && tg.color !== '—') ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">
                {t('recipe_modal_targets')}
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {tg.brix && tg.brix !== '—' && (
                  <li className="rounded-md border border-gray-100 bg-white px-3 py-2">
                    <span className="text-[11px] text-gray-500">°Bx</span>
                    <div className="font-mono font-medium">{tg.brix}</div>
                  </li>
                )}
                {tg.firmness && tg.firmness !== '—' && (
                  <li className="rounded-md border border-gray-100 bg-white px-3 py-2">
                    <span className="text-[11px] text-gray-500">{t('detail_tracking_firmness_short')}</span>
                    <div className="font-mono font-medium">{tg.firmness}</div>
                  </li>
                )}
                {tg.color && tg.color !== '—' && (
                  <li className="rounded-md border border-gray-100 bg-white px-3 py-2">
                    <span className="text-[11px] text-gray-500">{t('detail_tracking_color_short')}</span>
                    <div className="font-mono font-medium">{tg.color}</div>
                  </li>
                )}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              {t('recipe_modal_phases_title')}
            </h3>
            {schedule.phases.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('recipe_modal_no_phases')}</p>
            ) : (
              <ul className="space-y-3">
                {schedule.phases.map((ph) => (
                  <li
                    key={`${ph.order}-${ph.label}`}
                    className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-2">
                      <span className="font-semibold text-gray-900">
                        {ph.order}. {ph.label}
                      </span>
                      <span className="text-[11px] sm:text-xs font-mono text-blue-800 bg-blue-50 rounded px-2 py-0.5 w-fit">
                        {t('recipe_modal_phase_end_planned')}: {fmt(ph.plannedEndAt)}
                      </span>
                    </div>
                    {ph.paramLines.length > 0 ? (
                      <ul className="space-y-1 text-xs text-gray-700 border-t border-gray-100 pt-2 mt-1">
                        {ph.paramLines.map((line, i) => (
                          <li key={i} className="font-mono border-l-2 border-blue-200 pl-2">
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400 italic">{t('recipe_modal_no_params')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
