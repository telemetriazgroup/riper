import React, { useMemo, useRef } from 'react';
import { FileText, Printer } from 'lucide-react';
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  buildParameterEvolutionSeries,
  getSamplingEventsChronological,
  hasAnyChartPoint,
  type ProcessView,
} from '@/app/lib/ripeningProcessReport';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ProcessView;
  /** true = proceso cerrado o cancelado */
  isFinal: boolean;
  processStatus: string;
};

function statusLabel(status: string, t: (k: string) => string) {
  if (status === 'active') return t('in_process');
  if (status === 'completed') return t('status_ripening_completed');
  if (status === 'cancelled') return t('status_ripening_cancelled');
  return status || '—';
}

export const ProcessTrackingReportDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  view,
  isFinal,
  processStatus,
}) => {
  const { t, language } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const events = useMemo(
    () => getSamplingEventsChronological(view.timeline),
    [view.timeline]
  );
  const chartRows = useMemo(() => buildParameterEvolutionSeries(events), [events]);
  const showChart = hasAnyChartPoint(chartRows);

  const title = isFinal ? t('report_title_final') : t('report_title_interim');
  const subtitle = isFinal
    ? processStatus === 'cancelled'
      ? t('report_subtitle_cancelled')
      : t('report_subtitle_closed')
    : t('report_subtitle_active');

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const doc = `<!DOCTYPE html><html lang="${language === 'en' ? 'en' : 'es'}"><head>
<meta charset="utf-8"/><title>${title.replace(/</g, '')}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#111;font-size:13px;line-height:1.4}
  h1{font-size:20px;margin:0 0 8px}
  h2{font-size:15px;margin:20px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  table{border-collapse:collapse;width:100%;margin:12px 0}
  th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
  th{background:#f5f5f5}
  .meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin:12px 0}
  .muted{color:#666;font-size:12px}
</style></head><body>
${el.innerHTML}
</body></html>`;
    w.document.write(doc);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const schedule = view.scheduleSummary || {};
  const started = schedule.startedAt
    ? new Date(String(schedule.startedAt)).toLocaleString()
    : '—';
  const estEnd = schedule.estimatedEndAt
    ? new Date(String(schedule.estimatedEndAt)).toLocaleString()
    : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[min(90vh,900px)] overflow-y-auto gap-3 pr-2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
            {title}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div ref={printRef} className="space-y-6 text-sm">
          <div>
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {t('report_section_process')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-gray-800">
              <p>
                <span className="text-gray-500">{t('client')}: </span>
                {view.client.name}
              </p>
              <p>
                <span className="text-gray-500">{t('product')}: </span>
                {view.batch.product}
              </p>
              <p className="font-mono text-xs break-all">
                <span className="text-gray-500 font-sans">{t('report_field_id')}: </span>
                {view.id}
              </p>
              <p>
                <span className="text-gray-500">{t('status')}: </span>
                {statusLabel(processStatus, t)}
              </p>
              {processStatus === 'cancelled' && view.cancelledMeta?.at && (
                <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2.5 text-amber-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/90 mb-1">
                    {t('report_cancel_section')}
                  </p>
                  <p>
                    <span className="text-amber-800/90">{t('report_cancel_by')}: </span>
                    {(view.cancelledMeta.byName && String(view.cancelledMeta.byName).trim()) ||
                      view.cancelledMeta.byEmail ||
                      view.cancelledMeta.byUserId ||
                      '—'}
                  </p>
                  <p className="mt-0.5">
                    <span className="text-amber-800/90">{t('report_cancel_at')}: </span>
                    {new Date(String(view.cancelledMeta.at)).toLocaleString()}
                  </p>
                </div>
              )}
              {view.display_name && (
                <p className="sm:col-span-2">
                  <span className="text-gray-500">{t('process_name_col')}: </span>
                  {view.display_name}
                </p>
              )}
              <p>
                <span className="text-gray-500">{t('report_recipe')}: </span>
                {view.recipe.name}
              </p>
              <p>
                <span className="text-gray-500">{t('report_targets')}: </span>
                Brix {view.recipe.targets.brix} · {t('report_param_firmness_short')}{' '}
                {view.recipe.targets.firmness} · {t('report_param_color_short')}{' '}
                {view.recipe.targets.color}
              </p>
              <p>
                <span className="text-gray-500">{t('report_started')}: </span>
                {started}
              </p>
              <p>
                <span className="text-gray-500">{t('report_estimated_end')}: </span>
                {estEnd}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {t('report_section_samplings')} ({events.length})
            </h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="p-2 w-10">#</th>
                    <th className="p-2 whitespace-nowrap">{t('report_col_date')}</th>
                    <th className="p-2 min-w-[120px]">{t('report_col_type')}</th>
                    <th className="p-2">{t('report_col_person')}</th>
                    <th className="p-2 min-w-[200px]">{t('report_col_params')}</th>
                    <th className="p-2 min-w-[120px] hidden md:table-cell print:table-cell">
                      {t('report_col_notes')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, idx) => (
                    <tr key={ev.id} className="border-t border-gray-100">
                      <td className="p-2 text-gray-500">{idx + 1}</td>
                      <td className="p-2 whitespace-nowrap text-gray-800">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="p-2 text-gray-800">{ev.title || t('log_sampling')}</td>
                      <td className="p-2 text-gray-800">
                        {ev.persona_escrita || ev.user || '—'}
                      </td>
                      <td className="p-2 text-gray-800">
                        {ev.data?.length
                          ? ev.data.map((d) => `${d.name}: ${d.value} ${d.unit}`.trim()).join(' · ')
                          : '—'}
                      </td>
                      <td className="p-2 text-gray-600 hidden md:table-cell print:table-cell max-w-[200px]">
                        {ev.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {events.length === 0 && (
                <p className="p-4 text-center text-gray-500">{t('report_no_samplings')}</p>
              )}
            </div>
          </div>

          {showChart && (
            <div className="print:break-inside-avoid">
              <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
                {t('report_section_evolution')}
              </h2>
              <p className="text-xs text-gray-500 mt-2 mb-2">{t('report_evolution_note')}</p>
              <div className="h-[280px] w-full min-w-0 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartRows}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="index"
                      tick={{ fontSize: 10 }}
                      label={{ value: t('report_x_axis'), position: 'insideBottom', offset: -2, fontSize: 10 }}
                    />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      labelFormatter={(_label, payload) => {
                        const row = payload?.[0]?.payload as { name?: string } | undefined;
                        return row?.name != null ? String(row.name) : '';
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="brix"
                      name={t('report_param_brix')}
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="firmness"
                      name={t('report_param_firmness')}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="color"
                      name={t('report_param_color')}
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {!showChart && events.length > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {t('report_no_numeric_params')}
            </p>
          )}

          <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">
            {t('report_generated_at')}{' '}
            {new Date().toLocaleString(language === 'en' ? 'en-US' : 'es-ES')}
          </p>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('report_close')}
          </Button>
          <Button
            type="button"
            className="gap-2 bg-slate-800 hover:bg-slate-900 text-white"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            {t('report_print')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
