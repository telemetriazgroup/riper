import React, { useState } from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

export const LoginInterface: React.FC = () => {
  const { t } = useSettings();
  const [email, setEmail] = useState('demo@reefermanager.com');
  const [password, setPassword] = useState('demo123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    alert(t('language') === 'es' 
      ? '✅ Inicio de sesión exitoso (Demo)' 
      : '✅ Login successful (Demo)');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'rgb(241, 245, 249)' }}>
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4" style={{ backgroundColor: 'rgb(37, 99, 235)' }}>
            <svg className="w-12 h-12" style={{ color: 'rgb(255, 255, 255)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'rgb(15, 23, 42)' }}>Reefer Manager</h1>
          <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
            {t('language') === 'es' 
              ? 'Sistema de gestión para maduradores móviles' 
              : 'Mobile ripening chamber management system'}
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-lg shadow-lg p-8" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(226, 232, 240)', border: '1px solid' }}>
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'rgb(15, 23, 42)' }}>
            {t('language') === 'es' ? 'Iniciar Sesión' : 'Sign In'}
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(51, 65, 85)' }}>
                {t('language') === 'es' ? 'Correo Electrónico' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: 'rgb(148, 163, 184)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border"
                  style={{ 
                    backgroundColor: 'rgb(255, 255, 255)', 
                    borderColor: 'rgb(226, 232, 240)',
                    color: 'rgb(15, 23, 42)'
                  }}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(51, 65, 85)' }}>
                {t('language') === 'es' ? 'Contraseña' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: 'rgb(148, 163, 184)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2 rounded-lg border"
                  style={{ 
                    backgroundColor: 'rgb(255, 255, 255)', 
                    borderColor: 'rgb(226, 232, 240)',
                    color: 'rgb(15, 23, 42)'
                  }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: 'rgb(148, 163, 184)' }}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: 'rgb(37, 99, 235)' }}
                />
                <span className="text-sm" style={{ color: 'rgb(71, 85, 105)' }}>
                  {t('language') === 'es' ? 'Recordarme' : 'Remember me'}
                </span>
              </label>
              <button type="button" className="text-sm" style={{ color: 'rgb(37, 99, 235)' }}>
                {t('language') === 'es' ? '¿Olvidó su contraseña?' : 'Forgot password?'}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ backgroundColor: 'rgb(37, 99, 235)', color: 'rgb(255, 255, 255)' }}
            >
              <LogIn className="h-5 w-5" />
              {t('language') === 'es' ? 'Iniciar Sesión' : 'Sign In'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-3 rounded-lg" style={{ backgroundColor: 'rgb(239, 246, 255)', border: '1px solid rgb(191, 219, 254)' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'rgb(37, 99, 235)' }} />
              <div className="text-sm" style={{ color: 'rgb(30, 64, 175)' }}>
                <p className="font-medium mb-1">
                  {t('language') === 'es' ? 'Credenciales de Demo' : 'Demo Credentials'}
                </p>
                <p className="text-xs">Email: demo@reefermanager.com</p>
                <p className="text-xs">Password: demo123</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
            © 2026 Reefer Manager. {t('language') === 'es' ? 'Todos los derechos reservados' : 'All rights reserved'}.
          </p>
        </div>
      </div>
    </div>
  );
};
