import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/app/components/Sidebar';
import { Header } from '@/app/components/Header';
import { Dashboard } from '@/app/components/Dashboard';
import { DeviceDetail } from '@/app/components/DeviceDetail';
import { Recipes } from '@/app/components/Recipes';
import { UsersList } from '@/app/components/Users';
import { ProcessList } from '@/app/components/ProcessList';
import { UserProfile } from '@/app/components/UserProfile';
import { DetailedUserManual } from '@/app/components/DetailedUserManual';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/app/lib/supabase';
import { LoginPage } from '@/app/components/LoginPage';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { SettingsProvider } from '@/app/contexts/SettingsContext';

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [deviceDetailTab, setDeviceDetailTab] = useState<'operation' | 'analysis'>('operation');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Sesión cerrada');
    } catch (error: any) {
      toast.error('Error al cerrar sesión: ' + error.message);
    }
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

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onSelectDevice={handleDeviceSelect} />;
      case 'device-detail':
        return selectedDeviceId 
          ? <DeviceDetail 
              deviceId={selectedDeviceId} 
              onBack={() => { setActiveView('dashboard'); setSelectedDeviceId(null); }} 
              initialView={deviceDetailTab}
            />
          : <Dashboard onSelectDevice={handleDeviceSelect} />;
      case 'control':
        return <Dashboard onSelectDevice={handleDeviceSelect} />; 
      case 'monitoring':
        return <Dashboard onSelectDevice={(id) => {
          setSelectedDeviceId(id);
          setDeviceDetailTab('analysis');
          setActiveView('device-detail');
        }} />;
      case 'recipes':
        return <Recipes />;
      case 'processes':
        return <ProcessList />;
      case 'users':
        return <UsersList />;
      case 'profile':
        return <UserProfile />;
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
        <LoginPage onLoginSuccess={() => {}} />
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
          title={activeView === 'device-detail' ? 'Detalle de Dispositivo' : activeView === 'profile' ? 'Perfil de Usuario' : undefined}
          userEmail={session.user.email}
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