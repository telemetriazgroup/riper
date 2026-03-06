import React from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, MousePointer2, CheckCircle } from 'lucide-react';

// Step 1: Open application
export const LoginStep1: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] flex items-center justify-center p-6" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
        <div className="w-full max-w-md">
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-xl">
            <div className="rounded-xl p-8" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="text-center mb-8">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4 animate-pulse" style={{ backgroundColor: 'rgb(37, 99, 235)' }}>
                  <LogIn className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold mb-2" style={{ color: 'rgb(15, 23, 42)' }}>
                  ZTRACK TELEMETRY
                </h1>
                <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                  Sistema de Control de Maduradores
                </p>
              </div>
              
              <div className="space-y-4 opacity-30">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(71, 85, 105)' }}>
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 rounded-lg border"
                    style={{ backgroundColor: 'rgb(248, 250, 252)', borderColor: 'rgb(226, 232, 240)' }}
                    placeholder="usuario@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(71, 85, 105)' }}>
                    Contraseña
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 rounded-lg border"
                    style={{ backgroundColor: 'rgb(248, 250, 252)', borderColor: 'rgb(226, 232, 240)' }}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">1</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Abra la aplicación ZTRACK TELEMETRY. Verá la pantalla de inicio de sesión con el logo y los campos de acceso
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 2: Enter email
export const LoginStep2: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] flex items-center justify-center p-6" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
        <div className="w-full max-w-md">
          <div className="rounded-xl p-8" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="text-center mb-8 opacity-30">
              <h1 className="text-3xl font-bold mb-2">ZTRACK TELEMETRY</h1>
              <p className="text-sm">Sistema de Control de Maduradores</p>
            </div>
            
            <div className="space-y-4">
              <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
                <div className="relative">
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(71, 85, 105)' }}>
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-pulse" style={{ color: 'rgb(34, 197, 94)' }} />
                    <input
                      type="email"
                      className="w-full pl-10 pr-4 py-3 rounded-lg border-2 font-medium"
                      style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(34, 197, 94)', color: 'rgb(15, 23, 42)' }}
                      value="admin@empresa.com"
                    />
                    <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                      <MousePointer2 className="h-7 w-7 text-green-600 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="opacity-30">
                <label className="block text-sm font-medium mb-2">Contraseña</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-lg border"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute top-4 right-4 bg-white border-2 border-green-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">2</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(22, 163, 74)' }}>
            Ingrese su correo electrónico en el primer campo. El sistema acepta correos corporativos registrados
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 3: Enter password
export const LoginStep3: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] flex items-center justify-center p-6" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
        <div className="w-full max-w-md">
          <div className="rounded-xl p-8" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="text-center mb-8 opacity-30">
              <h1 className="text-3xl font-bold mb-2">ZTRACK TELEMETRY</h1>
            </div>
            
            <div className="space-y-4">
              <div className="opacity-30">
                <label className="block text-sm font-medium mb-2">Correo Electrónico</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 rounded-lg border"
                  value="admin@empresa.com"
                />
              </div>
              
              <div className="ring-4 ring-purple-500 ring-offset-4 rounded-lg">
                <div className="relative">
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(71, 85, 105)' }}>
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-pulse" style={{ color: 'rgb(147, 51, 234)' }} />
                    <input
                      type="password"
                      className="w-full pl-10 pr-12 py-3 rounded-lg border-2 font-medium"
                      style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(147, 51, 234)', color: 'rgb(15, 23, 42)' }}
                      value="••••••••"
                    />
                    <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Eye className="h-5 w-5" style={{ color: 'rgb(100, 116, 139)' }} />
                    </button>
                    <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                      <MousePointer2 className="h-7 w-7 text-purple-600 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute top-4 right-4 bg-white border-2 border-purple-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-sm font-bold flex-shrink-0">3</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>
            Ingrese su contraseña en el segundo campo. Use el ícono del ojo para mostrar/ocultar la contraseña
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 4: Click sign in
export const LoginStep4: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] flex items-center justify-center p-6" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
        <div className="w-full max-w-md">
          <div className="rounded-xl p-8" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
            <div className="text-center mb-8 opacity-30">
              <h1 className="text-3xl font-bold mb-2">ZTRACK TELEMETRY</h1>
            </div>
            
            <div className="space-y-4 opacity-30">
              <div>
                <label className="block text-sm font-medium mb-2">Correo Electrónico</label>
                <input type="email" className="w-full px-4 py-3 rounded-lg border" value="admin@empresa.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contraseña</label>
                <input type="password" className="w-full px-4 py-3 rounded-lg border" value="••••••••" />
              </div>
            </div>
            
            <div className="ring-4 ring-orange-500 ring-offset-4 rounded-lg mt-6">
              <button className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transform scale-105 animate-pulse" style={{ backgroundColor: 'rgb(37, 99, 235)', color: 'rgb(255, 255, 255)' }}>
                <LogIn className="h-5 w-5" />
                Iniciar Sesión
              </button>
              <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                <MousePointer2 className="h-8 w-8 text-orange-600 animate-pulse" />
              </div>
            </div>
            
            <div className="mt-4 text-center opacity-30">
              <button className="text-sm" style={{ color: 'rgb(37, 99, 235)' }}>
                ¿Olvidó su contraseña?
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute top-4 right-4 bg-white border-2 border-orange-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-orange-600 text-white text-sm font-bold flex-shrink-0">4</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(234, 88, 12)' }}>
            Haga clic en el botón "Iniciar Sesión" para acceder al sistema. Si las credenciales son correctas, será redirigido al dashboard
          </p>
        </div>
      </div>
    </div>
  );
};