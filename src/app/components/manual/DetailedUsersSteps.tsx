import React from 'react';
import { Users, Plus, Search, Shield, Mail, MousePointer2, Edit, Trash2, UserCog } from 'lucide-react';

// Step 1: Access users management
export const UsersStep1: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgb(239, 246, 255)' }}>
                    <Users className="h-6 w-6" style={{ color: 'rgb(37, 99, 235)' }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
                      Gestión de Usuarios
                    </h1>
                    <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                      12 usuarios registrados en el sistema
                    </p>
                  </div>
                </div>
                <button className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 opacity-30" style={{ backgroundColor: 'rgb(37, 99, 235)', color: 'rgb(255, 255, 255)' }}>
                  <Plus className="h-5 w-5" />
                  Nuevo Usuario
                </button>
              </div>
            </div>
          </div>

          <div className="opacity-20">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <p>Lista de usuarios</p>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">1</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Acceda a la gestión de usuarios desde el menú principal (solo disponible para usuarios con rol de administrador)
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 2: Add new user
export const UsersStep2: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
            </div>
          </div>

          <div className="ring-4 ring-green-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(34, 197, 94)' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
                  Agregar Nuevo Usuario
                </h2>
                <button className="p-2 rounded-lg animate-pulse" style={{ backgroundColor: 'rgb(34, 197, 94)', color: 'rgb(255, 255, 255)' }}>
                  <Plus className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(15, 23, 42)' }}>
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value="Juan Pérez Rodríguez"
                    className="w-full px-4 py-2 rounded-lg border-2"
                    style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(34, 197, 94)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(15, 23, 42)' }}>
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-pulse" style={{ color: 'rgb(34, 197, 94)' }} />
                    <input
                      type="email"
                      value="juan.perez@empresa.com"
                      className="w-full pl-10 pr-4 py-2 rounded-lg border-2"
                      style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(34, 197, 94)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(15, 23, 42)' }}>
                    Rol de Usuario
                  </label>
                  <select className="w-full px-4 py-2 rounded-lg border-2" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(34, 197, 94)' }}>
                    <option>Operador</option>
                    <option>Supervisor</option>
                    <option>Administrador</option>
                  </select>
                </div>

                <button className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: 'rgb(34, 197, 94)', color: 'rgb(255, 255, 255)' }}>
                  <Plus className="h-5 w-5" />
                  Crear Usuario
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-green-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">2</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(22, 163, 74)' }}>
            Complete el formulario con los datos del nuevo usuario: nombre, correo y rol (Operador, Supervisor o Administrador)
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 3: Search users
export const UsersStep3: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[600px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
            </div>
          </div>

          <div className="ring-4 ring-purple-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(147, 51, 234)' }}>
              <div className="flex gap-4">
                <div className="flex-1 relative transform scale-105">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-pulse" style={{ color: 'rgb(147, 51, 234)' }} />
                  <input
                    type="text"
                    placeholder="Buscar usuario por nombre o correo..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border-2"
                    style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(147, 51, 234)', color: 'rgb(15, 23, 42)' }}
                    value="Juan"
                  />
                  <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                    <MousePointer2 className="h-7 w-7 text-purple-600 animate-pulse" />
                  </div>
                </div>
                <select className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(226, 232, 240)' }}>
                  <option>Todos los Roles</option>
                  <option>Administrador</option>
                  <option>Supervisor</option>
                  <option>Operador</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-purple-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white text-sm font-bold flex-shrink-0">3</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(147, 51, 234)' }}>
            Use la barra de búsqueda para encontrar usuarios específicos por nombre o correo. Puede filtrar por rol de usuario
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 4: Edit user
export const UsersStep4: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="flex gap-4">
              <input type="text" className="flex-1 px-4 py-2 rounded-lg" placeholder="Buscar..." />
            </div>
          </div>

          <div className="space-y-4">
            <div className="ring-4 ring-orange-500 ring-offset-4 rounded-lg">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(234, 88, 12)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: 'rgb(239, 246, 255)', color: 'rgb(37, 99, 235)' }}>
                      JP
                    </div>
                    <div>
                      <h3 className="font-bold" style={{ color: 'rgb(15, 23, 42)' }}>Juan Pérez Rodríguez</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4" style={{ color: 'rgb(100, 116, 139)' }} />
                        <span style={{ color: 'rgb(100, 116, 139)' }}>juan.perez@empresa.com</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1" style={{ backgroundColor: 'rgb(239, 246, 255)', color: 'rgb(37, 99, 235)' }}>
                      <Shield className="h-3 w-3" />
                      Supervisor
                    </div>
                    <button className="p-2 rounded-lg transform scale-110 animate-pulse" style={{ backgroundColor: 'rgb(234, 88, 12)', color: 'rgb(255, 255, 255)' }}>
                      <Edit className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(254, 242, 242)', color: 'rgb(239, 68, 68)' }}>
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 top-1/2 transform -translate-y-1/2">
                <MousePointer2 className="h-8 w-8 text-orange-600 animate-pulse" />
              </div>
            </div>

            <div className="opacity-30">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
                <p>María González - Operadora</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-orange-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-orange-600 text-white text-sm font-bold flex-shrink-0">4</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(234, 88, 12)' }}>
            Haga clic en el ícono de editar (lápiz) para modificar los datos del usuario: nombre, correo o cambiar su rol de acceso
          </p>
        </div>
      </div>
    </div>
  );
};

// Step 5: Manage permissions
export const UsersStep5: React.FC = () => {
  return (
    <div className="relative">
      <div className="min-h-[700px] p-6" style={{ backgroundColor: 'rgb(248, 250, 252)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="opacity-20">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
              <p>Lista de usuarios</p>
            </div>
          </div>

          <div className="ring-4 ring-blue-500 ring-offset-4 rounded-lg">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(37, 99, 235)' }}>
              <div className="flex items-center gap-3 mb-6">
                <UserCog className="h-8 w-8 animate-pulse" style={{ color: 'rgb(37, 99, 235)' }} />
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'rgb(15, 23, 42)' }}>
                    Permisos por Rol
                  </h2>
                  <p className="text-sm" style={{ color: 'rgb(100, 116, 139)' }}>
                    Configure los permisos de acceso para cada rol de usuario
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(254, 242, 242)', border: '1px solid rgb(254, 226, 226)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'rgb(15, 23, 42)' }}>
                      <Shield className="h-5 w-5" style={{ color: 'rgb(239, 68, 68)' }} />
                      Administrador
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'rgb(239, 68, 68)', color: 'rgb(255, 255, 255)' }}>
                      Acceso Total
                    </span>
                  </div>
                  <ul className="text-sm space-y-1" style={{ color: 'rgb(100, 116, 139)' }}>
                    <li>✓ Gestión completa de usuarios</li>
                    <li>✓ Creación y edición de recetas</li>
                    <li>✓ Control total de dispositivos</li>
                    <li>✓ Acceso a reportes y estadísticas</li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(254, 249, 195)', border: '1px solid rgb(254, 240, 138)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'rgb(15, 23, 42)' }}>
                      <Shield className="h-5 w-5" style={{ color: 'rgb(234, 88, 12)' }} />
                      Supervisor
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'rgb(234, 88, 12)', color: 'rgb(255, 255, 255)' }}>
                      Acceso Intermedio
                    </span>
                  </div>
                  <ul className="text-sm space-y-1" style={{ color: 'rgb(100, 116, 139)' }}>
                    <li>✓ Ver usuarios (sin crear/eliminar)</li>
                    <li>✓ Usar recetas existentes</li>
                    <li>✓ Control de dispositivos asignados</li>
                    <li>✓ Ver reportes de sus procesos</li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(239, 246, 255)', border: '1px solid rgb(219, 234, 254)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'rgb(15, 23, 42)' }}>
                      <Shield className="h-5 w-5" style={{ color: 'rgb(37, 99, 235)' }} />
                      Operador
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'rgb(37, 99, 235)', color: 'rgb(255, 255, 255)' }}>
                      Acceso Básico
                    </span>
                  </div>
                  <ul className="text-sm space-y-1" style={{ color: 'rgb(100, 116, 139)' }}>
                    <li>✓ Monitorear dispositivos</li>
                    <li>✓ Iniciar procesos con recetas</li>
                    <li>✓ Ver estado de maduración</li>
                    <li>⨯ Sin acceso a gestión de usuarios</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white border-2 border-blue-500 rounded-lg p-4 shadow-xl max-w-xs">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">5</div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>
            Revise los permisos de cada rol: Administrador (acceso total), Supervisor (intermedio) y Operador (básico). Asigne roles según las responsabilidades
          </p>
        </div>
      </div>
    </div>
  );
};
