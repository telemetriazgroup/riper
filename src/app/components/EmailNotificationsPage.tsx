import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  createEmailGroup,
  deleteEmailGroup,
  eventTypeLabel,
  fetchEmailConfig,
  fetchEmailGroups,
  linesToList,
  listToLines,
  sendTestEmail,
  updateEmailConfig,
  updateEmailGroup,
  type EmailConfig,
  type EmailEventType,
  type EmailGroup,
} from '@/app/lib/emailNotificationsApi';
import { toast } from 'sonner';

export function EmailNotificationsPage() {
  const { t } = useSettings();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [fromEmail, setFromEmail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [eventTypes, setEventTypes] = useState<EmailEventType[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupActive, setGroupActive] = useState(true);
  const [groupRecipients, setGroupRecipients] = useState('');
  const [groupDevices, setGroupDevices] = useState('');
  const [groupEvents, setGroupEvents] = useState<EmailEventType[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [cfg, grp] = await Promise.all([fetchEmailConfig(), fetchEmailGroups()]);
      setConfig(cfg);
      setFromEmail(cfg.from_email || '');
      setEnabled(cfg.enabled);
      setGroups(grp.groups);
      setEventTypes(grp.eventTypes);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('email_load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload: { from_email: string; enabled: boolean; api_key?: string } = {
        from_email: fromEmail.trim(),
        enabled,
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      const updated = await updateEmailConfig(payload);
      setConfig(updated);
      setApiKey('');
      toast.success(t('email_save_config'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestSend = async () => {
    const to = testTo.trim();
    if (!to) return;
    setTesting(true);
    try {
      await sendTestEmail(to);
      toast.success(t('email_test_ok'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setTesting(false);
    }
  };

  const openCreateGroup = () => {
    setEditing(null);
    setGroupName('');
    setGroupActive(true);
    setGroupRecipients('');
    setGroupDevices('');
    setGroupEvents([...eventTypes]);
    setDialogOpen(true);
  };

  const openEditGroup = (g: EmailGroup) => {
    setEditing(g);
    setGroupName(g.name);
    setGroupActive(g.active);
    setGroupRecipients(listToLines(g.recipients));
    setGroupDevices(listToLines(g.device_ids));
    setGroupEvents([...g.events]);
    setDialogOpen(true);
  };

  const toggleEvent = (ev: EmailEventType) => {
    setGroupEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const handleSaveGroup = async () => {
    const name = groupName.trim();
    if (!name) return;
    const payload = {
      name,
      active: groupActive,
      events: groupEvents,
      recipients: linesToList(groupRecipients),
      device_ids: linesToList(groupDevices),
    };
    setSavingGroup(true);
    try {
      if (editing) {
        await updateEmailGroup(editing.id, payload);
      } else {
        await createEmailGroup(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (g: EmailGroup) => {
    if (!window.confirm(t('email_group_delete_confirm'))) return;
    try {
      await deleteEmailGroup(g.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        {t('loading')}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-red-900">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="h-7 w-7 text-blue-600" />
          {t('email_notifications_title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('email_notifications_subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('email_config_section')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-from">{t('email_from_label')}</Label>
              <input
                id="email-from"
                type="email"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="notificaciones@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-api-key">{t('email_api_key_label')}</Label>
              <input
                id="email-api-key"
                type="password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.has_api_key ? config.api_key_hint : 're_...'}
              />
              {config?.has_api_key && (
                <p className="text-xs text-gray-500">{t('email_api_key_hint')}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="email-enabled" checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor="email-enabled">{t('email_enabled_label')}</Label>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={() => void handleSaveConfig()} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('email_save_config')}
            </Button>
          </div>
          <div className="border-t pt-4 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="email-test">{t('email_test_label')}</Label>
              <input
                id="email-test"
                type="email"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void handleTestSend()} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t('email_test_send')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('email_groups_section')}</CardTitle>
          <Button type="button" size="sm" onClick={openCreateGroup}>
            <Plus className="h-4 w-4 mr-1" />
            {t('email_group_add')}
          </Button>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">—</p>
          ) : (
            <ul className="divide-y">
              {groups.map((g) => (
                <li key={g.id} className="py-4 flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{g.name}</span>
                      {!g.active && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">off</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {g.recipients.length} dest. · {g.device_ids.length} IMEI
                    </p>
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {g.device_ids.join(', ') || '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {g.events.map((ev) => eventTypeLabel(t, ev)).join(' · ')}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEditGroup(g)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleDeleteGroup(g)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('email_group_edit') : t('email_group_add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('email_group_name')}</Label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="México"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={groupActive} onCheckedChange={setGroupActive} />
              <Label>{t('email_group_active')}</Label>
            </div>
            <div className="space-y-2">
              <Label>{t('email_group_recipients')}</Label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[80px] font-mono"
                value={groupRecipients}
                onChange={(e) => setGroupRecipients(e.target.value)}
                placeholder="ops@empresa.com&#10;supervisor@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('email_group_devices')}</Label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[80px] font-mono"
                value={groupDevices}
                onChange={(e) => setGroupDevices(e.target.value)}
                placeholder="MEX1001&#10;867856038562796"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('email_group_events')}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {eventTypes.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupEvents.includes(ev)}
                      onChange={() => toggleEvent(ev)}
                      className="rounded border-gray-300"
                    />
                    {eventTypeLabel(t, ev)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={() => void handleSaveGroup()} disabled={savingGroup || !groupName.trim()}>
              {savingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
