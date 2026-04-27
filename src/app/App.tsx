import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/app/components/Sidebar';
import { Header } from '@/app/components/Header';
import { Dashboard } from '@/app/components/Dashboard';
import { DeviceDetail } from '@/app/components/DeviceDetail';
import { Recipes } from '@/app/components/Recipes';
import { UsersList } from '@/app/components/Users';
import { ProcessList } from '@/app/components/ProcessList';
import { DeviceControlAdmin } from '@/app/components/DeviceControlAdmin';
import { UserProfile } from '@/app/components/UserProfile';
import { DetailedUserManual } from '@/app/components/DetailedUserManual';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { LoginPage } from '@/app/components/LoginPage';
import { Loader2 } from 'lucide-react';
import { SettingsProvider, useSettings } from '@/app/contexts/SettingsContext';
import { getToken, fetchMe, clearAuth, type AuthUser } from '@/app/lib/auth';
import { GOURMET_USER_EMAIL } from '@/app/lib/gourmet';
import { FLEET_DEMO_EMAIL, ULTRAORGANICS_DEMO_EMAIL } from '@/app/lib/fleetDemo';

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

function AppContent() {
  const { t } = useSettings();
  const [session, setSession] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [deviceDetailTab, setDeviceDetailTab] = useState<'operation' | 'analysis'>('operation');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const refreshSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setSession(null);
      return;
    }
    try {
      const user = await fetchMe();
      setSession(user);
    } catch {
      clearAuth();
      setSession(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshSession();
      setLoading(false);
    })();
  }, [refreshSession]);

  const isRestrictedDemoUser =
    session?.email?.toLowerCase() === GOURMET_USER_EMAIL.toLowerCase() ||
    session?.email?.toLowerCase() === FLEET_DEMO_EMAIL.toLowerCase() ||
    session?.email?.toLowerCase() === ULTRAORGANICS_DEMO_EMAIL.toLowerCase();

  useEffect(() => {
    if (!isRestrictedDemoUser) return;
    if (activeView === 'users' || activeView === 'settings') {
      setActiveView('dashboard');
    }
  }, [isRestrictedDemoUser, activeView]);

  const handleLogout = () => {
    clearAuth();
    setSession(null);
    toast.success(t('logout') + ' — OK');
  };

  const handleLoginSuccess = () => {
    void refreshSession();
  };

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setDeviceDetailTab('operation');
    setActiveView('device-detail');
  };

  const handleChangeView = (view: string) => {
    setActiveView(view);
    if (view !== 'device-detail') setSelectedDeviceId(null);
  };

  const roleLabel = (role: string) => {
    if (role === 'superadmin') return t('role_superadmin');
    if (role === 'admin') return t('role_admin');
    if (role === 'operator') return t('role_operator');
    if (role === 'viewer') return t('role_viewer');
    return role;
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onSelectDevice={handleDeviceSelect} />;
      case 'device-detail':
        return selectedDeviceId ? (
          <DeviceDetail
            deviceId={selectedDeviceId}
            onBack={() => {
              setActiveView('dashboard');
              setSelectedDeviceId(null);
            }}
            initialView={deviceDetailTab}
          />
        ) : (
          <Dashboard onSelectDevice={handleDeviceSelect} />
        );
      case 'control':
        return <DeviceControlAdmin />;
      case 'monitoring':
        return (
          <Dashboard
            onSelectDevice={(id) => {
              setSelectedDeviceId(id);
              setDeviceDetailTab('analysis');
              setActiveView('device-detail');
            }}
          />
        );
      case 'recipes':
        return <Recipes />;
      case 'processes':
        return <ProcessList />;
      case 'control-sessions':
        return <DeviceControlAdmin />;
      case 'users':
        return <UsersList />;
      case 'profile':
        return <UserProfile onProfileUpdated={refreshSession} />;
      case 'manual':
        return <DetailedUserManual />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <h2 className="text-xl font-semibold mb-2">En Construcción</h2>
            <p>Esta sección estará disponible próximamente.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex font-sans text-foreground transition-colors duration-200">
      <Sidebar
        activeView={activeView === 'device-detail' ? 'dashboard' : activeView}
        onChangeView={handleChangeView}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-200 relative">
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          title={
            activeView === 'device-detail'
              ? 'Detalle de Dispositivo'
              : activeView === 'profile'
                ? 'Perfil de Usuario'
                : undefined
          }
          userEmail={session.email}
          userName={session.name}
          roleLabel={roleLabel(session.role)}
          onLogout={handleLogout}
          onProfileClick={() => setActiveView('profile')}
        />

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView + (selectedDeviceId || '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}
