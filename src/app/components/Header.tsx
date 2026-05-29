import React from 'react';
import { Bell, Menu, Search, User, LogOut, Sun, Moon, Languages, Thermometer, Clock } from 'lucide-react';
import { Button } from './ui/Button';
import { useSettings } from '@/app/contexts/SettingsContext';
import { gmtTimezoneOptionsForSelect } from '@/app/lib/displayTimeZone';

const ZTRACK_LOGO_SRC = `${import.meta.env.BASE_URL}ztrack-logo.png`;

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
  userEmail?: string;
  userName?: string;
  roleLabel?: string;
  onLogout?: () => void;
  onProfileClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  title,
  userEmail,
  userName,
  roleLabel,
  onLogout,
  onProfileClick,
}) => {
  const { theme, setTheme, language, setLanguage, tempUnit, toggleTempUnit, t, displayTimeZone, setDisplayTimeZone } =
    useSettings();

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const toggleLanguage = () => setLanguage(language === 'es' ? 'en' : 'es');

  return (
    <header className="bg-background border-b border-border h-16 px-4 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground hidden md:block">{title || t('dashboard')}</h1>
        {title ? (
          <div className="md:hidden font-semibold text-foreground truncate max-w-[50vw]">{title}</div>
        ) : (
          <div className="flex-1 flex justify-center md:hidden pointer-events-none">
            <img
              src={ZTRACK_LOGO_SRC}
              alt="ZTRACK"
              className="h-10 w-auto max-w-[200px] object-contain"
            />
          </div>
        )}
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
          <div
            className="hidden sm:flex items-center gap-0.5 text-muted-foreground"
            title={t('timezone_data_hint')}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <select
              className="max-w-[10.5rem] text-xs font-medium bg-transparent border border-border rounded-md px-1.5 py-1 text-foreground cursor-pointer focus:ring-1 focus:ring-blue-500 outline-none"
              value={displayTimeZone}
              onChange={(e) => setDisplayTimeZone(e.target.value)}
              aria-label={t('timezone_display_label')}
            >
              {gmtTimezoneOptionsForSelect(displayTimeZone).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

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
            <span className="text-sm font-medium text-foreground">{userName || userEmail || 'Usuario'}</span>
            <span className="text-xs text-muted-foreground">{roleLabel || t('operator')}</span>
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
             <Button type="button" variant="ghost" size="icon" onClick={onLogout} title={t('logout')}>
               <LogOut className="h-5 w-5 text-destructive" />
             </Button>
          )}
        </div>
      </div>
    </header>
  );
};
