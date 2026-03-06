import React from 'react';
import { Bell, Menu, Search, User, LogOut, Sun, Moon, Languages, Thermometer } from 'lucide-react';
import { Button } from './ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
  userEmail?: string;
  onLogout?: () => void;
  onProfileClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, title, userEmail, onLogout, onProfileClick }) => {
  const { theme, setTheme, language, setLanguage, tempUnit, toggleTempUnit, t } = useSettings();

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const toggleLanguage = () => setLanguage(language === 'es' ? 'en' : 'es');

  return (
    <header className="bg-background border-b border-border h-16 px-4 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground hidden md:block">{title || t('dashboard')}</h1>
        <div className="md:hidden font-semibold text-foreground">{title || 'Reefer Manager'}</div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search_placeholder')}
            className="pl-9 pr-4 py-2 bg-muted/50 border-none rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-1 border-r border-border pr-2 mr-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleTempUnit} 
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground w-12"
            title={tempUnit === 'C' ? "Switch to Fahrenheit" : "Cambiar a Celsius"}
          >
             <Thermometer className="h-4 w-4" />
             <span className="font-bold text-xs">°{tempUnit}</span>
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleLanguage} 
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            title={language === 'es' ? "Switch to English" : "Cambiar a Español"}
          >
             <Languages className="h-4 w-4" />
             <span className="font-bold text-xs">{language.toUpperCase()}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme} 
            className="text-muted-foreground hover:text-foreground"
            title={theme === 'light' ? "Modo Oscuro" : "Modo Claro"}
          >
             {theme === 'light' ? (
               <Moon className="h-5 w-5" />
             ) : (
               <Sun className="h-5 w-5 text-yellow-500" />
             )}
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border border-background"></span>
        </Button>

        <div className="flex items-center gap-2 border-l pl-4 border-border">
          <div 
            className="hidden md:flex flex-col items-end cursor-pointer hover:opacity-80"
            onClick={onProfileClick}
          >
            <span className="text-sm font-medium text-foreground">{userEmail || 'Usuario'}</span>
            <span className="text-xs text-muted-foreground">{t('operator')}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-muted/50 hover:bg-muted hover:text-blue-600 transition-colors"
            onClick={onProfileClick}
            title={t('profile')}
          >
            <User className="h-5 w-5 text-muted-foreground" />
          </Button>
          {onLogout && (
             <Button variant="ghost" size="icon" onClick={onLogout} title={t('logout')}>
               <LogOut className="h-5 w-5 text-destructive" />
             </Button>
          )}
        </div>
      </div>
    </header>
  );
};
