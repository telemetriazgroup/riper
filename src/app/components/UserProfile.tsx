import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { User, Mail, Building, Save, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMe, type AuthUser } from '@/app/lib/auth';
import { updateUser, uploadUserAvatar } from '@/app/lib/usersApi';
import { UserAvatar } from '@/app/components/UserAvatar';

interface UserProfileProps {
  onProfileUpdated?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onProfileUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await fetchMe();
        setUser(u);
        setFullName(u.name);
        setCompany(u.company === 'sin empresa' ? '' : u.company);
      } catch {
        toast.error('Error al cargar perfil');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const payload: Parameters<typeof updateUser>[1] = {
        name: fullName,
        company: company.trim() || 'sin empresa',
      };
      if (password.trim()) {
        payload.password = password;
      }
      const updated = await updateUser(user.id, payload);
      setUser(updated);
      if (photoFile) {
        await uploadUserAvatar(user.id, photoFile);
        setPhotoFile(null);
        const u = await fetchMe();
        setUser(u);
      }
      setPassword('');
      toast.success('Perfil actualizado correctamente');
      onProfileUpdated?.();
    } catch (error: unknown) {
      toast.error('Error al actualizar: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500 text-sm">Administre su información personal y preferencias.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="border-gray-200">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="mb-4">
                <UserAvatar
                  userId={user?.id || ''}
                  hasPhoto={user?.has_photo}
                  name={fullName || user?.name}
                  size={96}
                />
              </div>
              <h3 className="font-bold text-lg">{fullName || user?.name || 'Usuario'}</h3>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium mt-2 mb-4">
                {user?.role}
              </span>
              <div className="w-full border-t border-gray-100 pt-4 text-left text-sm space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate" title={user?.email}>
                    {user?.email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>ID: {user?.id?.slice(0, 8)}…</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={updateProfile} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Foto de perfil</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                    className="text-sm w-full"
                  />
                  <p className="text-xs text-gray-500">Si no sube imagen, se muestra avatar genérico o inicial del nombre.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Nombre completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Empresa / Organización</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="pl-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Vacío se guarda como «sin empresa»"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Nueva contraseña (opcional)</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Dejar vacío para no cambiar"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar cambios
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-start gap-3">
            <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold mb-1">Seguridad</h4>
              <p>El acceso al sistema se valida contra el módulo de usuarios. Use una contraseña segura.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
