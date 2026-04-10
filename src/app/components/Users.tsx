import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Label } from '@/app/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Plus, Mail, Shield, Loader2, Trash2, Building2, Camera, X } from 'lucide-react';
import { useSettings } from '@/app/contexts/SettingsContext';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  uploadUserAvatar,
  type AppUser,
  type UserRole,
} from '@/app/lib/usersApi';
import { getStoredUser } from '@/app/lib/auth';
import { toast } from 'sonner';
import { UserAvatar } from '@/app/components/UserAvatar';

const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export const UsersList: React.FC = () => {
  const { t } = useSettings();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [active, setActive] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const current = getStoredUser();
  const canManageSuperadmin = current?.role === 'superadmin' || current?.is_superuser;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (e: unknown) {
      toast.error(t('error_users') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearPhotoSelection = () => {
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setCompany('');
    setRole('operator');
    setActive(true);
    setPhotoFile(null);
    setDialogOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setCompany(u.company === 'sin empresa' ? '' : u.company);
    setRole(u.role);
    setActive(u.active);
    setPhotoFile(null);
    setDialogOpen(true);
  };

  const roleLabel = (r: UserRole) => {
    if (r === 'superadmin') return t('role_superadmin');
    if (r === 'admin') return t('role_admin');
    if (r === 'operator') return t('role_operator');
    if (r === 'viewer') return t('role_viewer');
    return r;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const comp = company.trim() || 'sin empresa';
      if (editing) {
        const payload: Parameters<typeof updateUser>[1] = {
          name,
          email,
          role,
          active,
          company: comp,
        };
        if (password.trim()) {
          payload.password = password;
        }
        await updateUser(editing.id, payload);
        if (photoFile) {
          await uploadUserAvatar(editing.id, photoFile);
        }
        toast.success(t('user_updated'));
      } else {
        if (!password.trim()) {
          toast.error(t('password_required_new'));
          setSaving(false);
          return;
        }
        const created = await createUser({
          name,
          email,
          password: password,
          role,
          company: comp,
          active,
        });
        if (photoFile) {
          await uploadUserAvatar(created.id, photoFile);
        }
        toast.success(t('user_created'));
      }
      handleDialogOpenChange(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate') || msg.includes('already')) {
        toast.error(t('duplicate_email'));
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteUser(deleteTarget.id);
      toast.success(t('user_deleted'));
      setDeleteTarget(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t('user_management')}</h2>
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('new_user')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('system_users')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">{t('user')}</th>
                    <th className="px-4 py-3">{t('email')}</th>
                    <th className="px-4 py-3">{t('company_field')}</th>
                    <th className="px-4 py-3">{t('role')}</th>
                    <th className="px-4 py-3">{t('status')}</th>
                    <th className="px-4 py-3 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            userId={user.id}
                            hasPhoto={user.has_photo}
                            name={user.name}
                            size={32}
                          />
                          <span className="font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 shrink-0" /> {user.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {user.company || 'sin empresa'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Shield className="h-3 w-3 shrink-0" /> {roleLabel(user.role)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {user.active ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" type="button" onClick={() => openEdit(user)}>
                          {t('edit')}
                        </Button>
                        {!user.is_superuser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && (
                <p className="text-center text-gray-500 py-8">{t('no_users_yet')}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0">
          <form onSubmit={handleSubmit}>
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/80 px-6 pt-6 pb-4 border-b border-gray-100">
              <DialogHeader>
                <DialogTitle className="text-xl">{editing ? t('edit_user') : t('new_user')}</DialogTitle>
              </DialogHeader>
              <div className="mt-4 flex flex-col sm:flex-row gap-5 sm:items-start">
                <div className="flex flex-col items-center sm:items-start shrink-0">
                  <Label className="sr-only">{t('photo_label')}</Label>
                  <div
                    className="relative h-28 w-28 rounded-full border-2 border-dashed border-gray-200 bg-white shadow-inner overflow-hidden ring-1 ring-gray-100/80 flex items-center justify-center"
                    aria-hidden
                  >
                    {photoPreviewUrl ? (
                      <img
                        src={photoPreviewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : editing && editing.has_photo && !photoFile ? (
                      <div className="h-full w-full [&_img]:!rounded-none [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
                        <UserAvatar
                          userId={editing.id}
                          hasPhoto={true}
                          name={name}
                          size={112}
                        />
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 text-gray-400">
                        {name.trim() ? (
                          <span className="text-3xl font-semibold text-gray-500">
                            {name.trim().charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <Camera className="h-10 w-10 opacity-80" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-center sm:text-left text-xs text-gray-500 max-w-[140px]">
                    {photoPreviewUrl
                      ? t('photo_preview_hint')
                      : editing?.has_photo && !photoFile
                        ? t('photo_current_hint')
                        : t('photo_preview_hint')}
                  </p>
                </div>
                <div className="flex-1 min-w-0 space-y-3 pt-1">
                  <p className="text-sm font-medium text-gray-800">{t('photo_label')}</p>
                  <input
                    ref={fileInputRef}
                    id="u-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 border-blue-200 bg-white hover:bg-blue-50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4" />
                      {photoFile || (editing && editing.has_photo) ? t('photo_change_file') : t('photo_choose_file')}
                    </Button>
                    {photoFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                        onClick={clearPhotoSelection}
                      >
                        <X className="h-4 w-4" />
                        {t('photo_remove_selection')}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">JPEG, PNG, WebP o GIF · máx. 2 MB</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 px-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="u-name">{t('full_name')}</Label>
                <input
                  id="u-name"
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-email">{t('email')}</Label>
                <input
                  id="u-email"
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-company">{t('company_field')}</Label>
                <input
                  id="u-company"
                  className={inputClass}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={t('company_placeholder')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-pass">{editing ? t('password_change_hint') : t('password_new_user')}</Label>
                <input
                  id="u-pass"
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={editing ? 'new-password' : 'new-password'}
                  placeholder={editing ? t('password_optional_placeholder') : ''}
                  required={!editing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-role">{t('role')}</Label>
                <select
                  id="u-role"
                  className={inputClass}
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  {canManageSuperadmin && <option value="superadmin">{t('role_superadmin')}</option>}
                  <option value="admin">{t('role_admin')}</option>
                  <option value="operator">{t('role_operator')}</option>
                  <option value="viewer">{t('role_viewer')}</option>
                </select>
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    id="u-active"
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="u-active" className="font-normal cursor-pointer">
                    {t('active')}
                  </Label>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0 px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50/50">
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving} className="min-w-[120px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_user')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_delete_user', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
