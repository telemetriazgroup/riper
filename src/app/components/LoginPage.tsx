import React, { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Loader2, Lock, Mail } from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useSettings } from '@/app/contexts/SettingsContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { t } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const handleCreateAdmin = async () => {
    setCreatingAdmin(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-d24c9284/create-admin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        }
      });
      
      const data = await response.json();
      if (response.ok || data.status === 'user_exists') {
        toast.success(t('admin_ready'));
        setEmail('admin@reefer.com');
        setPassword('admin-password-123');
      } else {
        toast.error('Error: ' + (data.error || 'Falló la creación'));
      }
    } catch (e: any) {
      toast.error('Error de conexión: ' + e.message);
    } finally {
        setCreatingAdmin(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      toast.success(t('session_success'));
      onLoginSuccess();
    } catch (error: any) {
      toast.error(error.message || t('login_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Left Side - Image/Branding */}
      <div className="md:w-1/2 bg-blue-600 relative overflow-hidden flex flex-col justify-center items-center text-white p-8">
        <div className="absolute inset-0 z-0 opacity-40">
           <ImageWithFallback 
             //src="https://images.unsplash.com/photo-1766827199468-43e9675a4a55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaGlwcGluZyUyMGNvbnRhaW5lciUyMGxvZ2lzdGljcyUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzcwMTI5NTU3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
             src="https://www.zgroup.com.pe/web/image/1847-f275e5b5/ZGROUP%20STORE%20MAQUINA.png"
             alt="Logistics Background"
             className="w-full h-full object-cover"
           />
        </div>
        <div className="z-10 text-center max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold mb-4">ZTRACK  TELEMETRY</h1>
            <p className="text-xl text-blue-100">
              {t('login_subtitle')}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="md:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex flex-col items-center">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="ZTRACK Live Telemetry"
              className="h-20 sm:h-24 md:h-28 lg:h-32 w-auto max-w-full object-contain mb-6"
            />
            <h2 className="text-2xl font-bold text-gray-900">{t('welcome_back')}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {t('enter_credentials')}
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  {t('email_label')}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors text-blue-900"
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('password')}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors text-blue-900"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  t('login_button')
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="text-center text-xs text-gray-400">
              v1.0.0 ZTRACK TELEMETRY
            </div>
            
            <button 
              type="button"
              onClick={handleCreateAdmin}
              disabled={creatingAdmin}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              {creatingAdmin ? t('configuring') : t('init_admin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
