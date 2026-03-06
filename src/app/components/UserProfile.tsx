import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { User, Mail, Phone, Building, Save, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export const UserProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    company: '',
    role: ''
  });

  useEffect(() => {
    getProfile();
  }, []);

  const getProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setFormData({
          fullName: user.user_metadata?.name || '',
          phone: user.user_metadata?.phone || '',
          company: user.user_metadata?.company || '',
          role: user.user_metadata?.role || 'Operador'
        });
      }
    } catch (error) {
      toast.error('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: formData.fullName,
          phone: formData.phone,
          company: formData.company
        }
      });

      if (error) throw error;
      toast.success('Perfil actualizado correctamente');
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message);
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
        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="border-gray-200">
             <CardContent className="p-6 flex flex-col items-center text-center">
               <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-4 text-blue-600 text-3xl font-bold">
                 {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User />}
               </div>
               <h3 className="font-bold text-lg">{formData.fullName || 'Usuario'}</h3>
               <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium mt-2 mb-4">
                 {formData.role}
               </span>
               <div className="w-full border-t border-gray-100 pt-4 text-left text-sm space-y-2">
                 <div className="flex items-center gap-2 text-gray-600">
                   <Mail className="w-4 h-4" />
                   <span className="truncate" title={user?.email}>{user?.email}</span>
                 </div>
                 <div className="flex items-center gap-2 text-gray-600">
                   <Shield className="w-4 h-4" />
                   <span>ID: {user?.id?.slice(0, 8)}...</span>
                 </div>
               </div>
             </CardContent>
          </Card>
        </div>

        {/* Edit Form */}
        <div className="md:col-span-2">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={updateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Nombre Completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input 
                        type="text" 
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        className="pl-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej. Juan Pérez"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Teléfono</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input 
                        type="tel" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="pl-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+51 999 999 999"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Empresa / Organización</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input 
                        type="text" 
                        value={formData.company}
                        onChange={(e) => setFormData({...formData, company: e.target.value})}
                        className="pl-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre de la empresa"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-start gap-3">
             <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
             <div>
               <h4 className="font-bold mb-1">Seguridad de la Cuenta</h4>
               <p>Para cambiar su contraseña o correo electrónico, contacte al administrador del sistema o use la opción de recuperación en el inicio de sesión.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
