import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Clock, Loader2, Lock, Mail } from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useSettings } from '@/app/contexts/SettingsContext';
import { loginRequest } from '@/app/lib/auth';
import { formatBrowserOffsetGmtLabel, formatBrowserWallClock } from '@/app/lib/systemLocale';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { t, language, dateFormat } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const deviceTime = useMemo(
    () => formatBrowserWallClock(now, language, dateFormat, true),
    [now, language, dateFormat]
  );
  const deviceGmt = useMemo(() => formatBrowserOffsetGmtLabel(now), [now]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginRequest(email, password);
      toast.success(t('session_success'));
      onLoginSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg || t('login_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <div className="md:w-1/2 bg-blue-600 relative overflow-hidden flex flex-col justify-center items-center text-white p-8">
        <div className="absolute inset-0 z-0 opacity-40">
          <ImageWithFallback
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
            <h1 className="text-4xl font-bold mb-4">ZTRACK TELEMETRY</h1>
            <p className="text-xl text-blue-100">{t('login_subtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="md:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex flex-col items-center">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="ZTRACK Live Telemetry"
              className="h-20 sm:h-24 md:h-28 lg:h-32 w-auto max-w-full object-contain mb-6"
            />
            <h2 className="text-2xl font-bold text-gray-900">{t('welcome_back')}</h2>
            <p className="mt-2 text-sm text-gray-600 text-center">{t('enter_credentials')}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <Clock className="h-4 w-4 shrink-0 text-blue-600" />
                {t('login_device_time')}
              </div>
              <p className="font-mono text-sm sm:text-base font-semibold text-slate-900 tabular-nums">
                {deviceGmt} · {deviceTime}
              </p>
            </div>
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
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : t('login_button')}
              </button>
            </div>
          </form>

          <div className="mt-4 text-center text-xs text-gray-400">v1.0.0 ZTRACK TELEMETRY</div>
        </div>
      </div>
    </div>
  );
};
