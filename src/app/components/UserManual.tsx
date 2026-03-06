import React, { useState, useRef } from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { 
  BookOpen, 
  ChevronRight, 
  Home, 
  LogIn, 
  LayoutDashboard, 
  Thermometer, 
  Activity, 
  Wind, 
  BookMarked, 
  Users, 
  User, 
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  LoginScreenshot,
  DashboardScreenshot,
  DeviceControlScreenshot,
  DeviceDetailScreenshot,
  MonitoringScreenshot,
  ProcessListScreenshot,
  RecipeLibraryScreenshot,
  RecipeBuilderScreenshot,
  UsersManagementScreenshot,
  UserProfileScreenshot
} from './manual/ManualScreenshots';
import { MangoKentChart, PaltaHassChart, PlatanoChart } from './manual/ProcessCharts';
import { normalizeColors } from '@/app/utils/colorConversion';
import { LoginInterface, DashboardInterface, DeviceControlInterface } from './manual-interfaces';

interface ManualSection {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<any>;
  ScreenshotComponent: React.ComponentType;
  InteractiveComponent?: React.ComponentType;
  steps: string[];
  noteKey: string;
}

export const UserManual: React.FC = () => {
  const { t } = useSettings();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showInteractive, setShowInteractive] = useState<string | null>(null);
  const manualRef = useRef<HTMLDivElement>(null);

  const manualSections: ManualSection[] = [
    {
      id: 'login',
      titleKey: 'section_login',
      descKey: 'section_login_desc',
      icon: LogIn,
      ScreenshotComponent: LoginScreenshot,
      InteractiveComponent: LoginInterface,
      steps: [
        'login_step1',
        'login_step2',
        'login_step3',
        'login_step4'
      ],
      noteKey: 'login_note'
    },
    {
      id: 'dashboard',
      titleKey: 'section_dashboard',
      descKey: 'section_dashboard_desc',
      icon: LayoutDashboard,
      ScreenshotComponent: DashboardScreenshot,
      InteractiveComponent: DashboardInterface,
      steps: [
        'dashboard_step1',
        'dashboard_step2',
        'dashboard_step3',
        'dashboard_step4',
        'dashboard_step5',
        'dashboard_step6'
      ],
      noteKey: 'dashboard_note'
    },
    {
      id: 'control',
      titleKey: 'section_device_control',
      descKey: 'section_device_control_desc',
      icon: Thermometer,
      ScreenshotComponent: DeviceControlScreenshot,
      InteractiveComponent: DeviceControlInterface,
      steps: [
        'control_step1',
        'control_step2',
        'control_step3',
        'control_step4',
        'control_step5',
        'control_step6',
        'control_step7'
      ],
      noteKey: 'control_note'
    },
    {
      id: 'detail',
      titleKey: 'section_device_detail',
      descKey: 'section_device_detail_desc',
      icon: Activity,
      ScreenshotComponent: DeviceDetailScreenshot,
      steps: [
        'detail_step1',
        'detail_step2',
        'detail_step3',
        'detail_step4',
        'detail_step5',
        'detail_step6'
      ],
      noteKey: 'detail_note'
    },
    {
      id: 'monitoring',
      titleKey: 'section_monitoring',
      descKey: 'section_monitoring_desc',
      icon: Wind,
      ScreenshotComponent: MonitoringScreenshot,
      steps: [
        'monitoring_step1',
        'monitoring_step2',
        'monitoring_step3',
        'monitoring_step4',
        'monitoring_step5'
      ],
      noteKey: 'monitoring_note'
    },
    {
      id: 'processes',
      titleKey: 'section_processes',
      descKey: 'section_processes_desc',
      icon: Activity,
      ScreenshotComponent: ProcessListScreenshot,
      steps: [
        'processes_step1',
        'processes_step2',
        'processes_step3',
        'processes_step4',
        'processes_step5',
        'processes_step6',
        'processes_step7'
      ],
      noteKey: 'processes_note'
    },
    {
      id: 'recipes',
      titleKey: 'section_recipes',
      descKey: 'section_recipes_desc',
      icon: BookMarked,
      ScreenshotComponent: RecipeLibraryScreenshot,
      steps: [
        'recipes_step1',
        'recipes_step2',
        'recipes_step3',
        'recipes_step4',
        'recipes_step5'
      ],
      noteKey: 'recipes_note'
    },
    {
      id: 'builder',
      titleKey: 'section_recipe_builder',
      descKey: 'section_recipe_builder_desc',
      icon: BookOpen,
      ScreenshotComponent: RecipeBuilderScreenshot,
      steps: [
        'builder_step1',
        'builder_step2',
        'builder_step3',
        'builder_step4',
        'builder_step5',
        'builder_step6',
        'builder_step7',
        'builder_step8',
        'builder_step9',
        'builder_step10'
      ],
      noteKey: 'builder_note'
    },
    {
      id: 'users',
      titleKey: 'section_users',
      descKey: 'section_users_desc',
      icon: Users,
      ScreenshotComponent: UsersManagementScreenshot,
      steps: ['users_step1', 'users_step2', 'users_step3', 'users_step4', 'users_step5'],
      noteKey: 'users_note'
    },
    {
      id: 'profile',
      titleKey: 'section_profile',
      descKey: 'section_profile_desc',
      icon: User,
      ScreenshotComponent: UserProfileScreenshot,
      steps: ['profile_step1', 'profile_step2', 'profile_step3', 'profile_step4'],
      noteKey: 'profile_note'
    }
  ];

  const scrollToSection = (sectionId: string) => {
    setSelectedSection(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const downloadPDF = async () => {
    if (!manualRef.current) return;
    
    setIsGeneratingPDF(true);
    toast.info(t('language') === 'es' ? 'Generando PDF, por favor espere...' : 'Generating PDF, please wait...');
    
    try {
      const element = manualRef.current;
      
      // Force light mode temporarily
      const htmlElement = document.documentElement;
      const originalTheme = htmlElement.classList.contains('dark');
      if (originalTheme) {
        htmlElement.classList.remove('dark');
      }
      
      // Wait for theme change to take effect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create a complete clone of the element
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Create a hidden container with white background
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = element.offsetWidth + 'px';
      container.style.backgroundColor = 'rgb(255, 255, 255)';
      container.style.color = 'rgb(15, 23, 42)';
      document.body.appendChild(container);
      container.appendChild(clone);
      
      // Force ALL elements to use inline RGB styles - aggressive approach
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el: any) => {
        const computed = window.getComputedStyle(el);
        
        // Apply ALL computed color-related styles as inline RGB
        const colorProps = [
          'backgroundColor',
          'color',
          'borderTopColor',
          'borderRightColor',
          'borderBottomColor',
          'borderLeftColor',
          'borderColor',
          'outlineColor',
          'textDecorationColor',
          'fill',
          'stroke'
        ];
        
        colorProps.forEach(prop => {
          const value = computed.getPropertyValue(prop === 'backgroundColor' ? 'background-color' : 
                                                   prop === 'borderTopColor' ? 'border-top-color' :
                                                   prop === 'borderRightColor' ? 'border-right-color' :
                                                   prop === 'borderBottomColor' ? 'border-bottom-color' :
                                                   prop === 'borderLeftColor' ? 'border-left-color' :
                                                   prop === 'borderColor' ? 'border-color' :
                                                   prop === 'outlineColor' ? 'outline-color' :
                                                   prop === 'textDecorationColor' ? 'text-decoration-color' :
                                                   prop);
          
          if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
            el.style[prop] = value;
          }
        });
        
        // Apply other important styles
        if (computed.display) el.style.display = computed.display;
        if (computed.fontSize) el.style.fontSize = computed.fontSize;
        if (computed.fontWeight) el.style.fontWeight = computed.fontWeight;
        if (computed.fontFamily) el.style.fontFamily = computed.fontFamily;
        if (computed.padding) el.style.padding = computed.padding;
        if (computed.margin) el.style.margin = computed.margin;
        if (computed.width) el.style.width = computed.width;
        if (computed.height) el.style.height = computed.height;
        
        // Remove all class names to prevent CSS variable usage
        if (el instanceof SVGElement) {
          el.removeAttribute('class');
          // For SVG elements, ensure fill and stroke are RGB
          if (el.hasAttribute('fill')) {
            const fillColor = computed.fill;
            if (fillColor && !fillColor.includes('oklch') && !fillColor.includes('oklab')) {
              el.setAttribute('fill', fillColor);
            } else {
              el.setAttribute('fill', 'rgb(0, 0, 0)');
            }
          }
          if (el.hasAttribute('stroke')) {
            const strokeColor = computed.stroke;
            if (strokeColor && !strokeColor.includes('oklch') && !strokeColor.includes('oklab')) {
              el.setAttribute('stroke', strokeColor);
            } else {
              el.setAttribute('stroke', 'rgb(0, 0, 0)');
            }
          }
        } else {
          el.className = '';
        }
      });
      
      // Remove all <style> and <link> tags from the clone to prevent CSS variable resolution
      clone.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
      
      // Wait for styles to be fully applied
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Capture with strict options
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
        ignoreElements: (el) => {
          return el.tagName === 'IFRAME' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE';
        },
        onclone: (clonedDoc) => {
          // Final pass: replace any remaining oklch/oklab in the cloned document
          const walker = clonedDoc.createTreeWalker(
            clonedDoc.body,
            NodeFilter.SHOW_ELEMENT
          );
          
          let node;
          while (node = walker.nextNode()) {
            const el = node as HTMLElement;
            
            // Check inline styles
            const styleAttr = el.getAttribute('style');
            if (styleAttr) {
              let cleanedStyle = styleAttr
                .replace(/oklch\([^)]+\)/g, 'rgb(255, 255, 255)')
                .replace(/oklab\([^)]+\)/g, 'rgb(255, 255, 255)')
                .replace(/color-mix\([^)]+\)/g, 'rgb(255, 255, 255)')
                .replace(/var\([^)]+\)/g, 'rgb(255, 255, 255)');
              el.setAttribute('style', cleanedStyle);
            }
            
            // Check SVG attributes
            if (el instanceof SVGElement) {
              ['fill', 'stroke'].forEach(attr => {
                const value = el.getAttribute(attr);
                if (value && (value.includes('oklch') || value.includes('oklab') || value.includes('var('))) {
                  el.setAttribute(attr, 'rgb(0, 0, 0)');
                }
              });
            }
          }
          
          // Remove all style tags and link tags
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
        }
      });
      
      // Clean up
      document.body.removeChild(container);
      
      // Restore original theme
      if (originalTheme) {
        htmlElement.classList.add('dark');
      }
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      // Calculate how many pages we need
      const pageHeight = pdfHeight;
      const heightLeft = imgHeight * ratio;
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      let heightAdded = pageHeight;
      
      // Add additional pages if content is longer
      while (heightAdded < heightLeft) {
        position = heightAdded - heightLeft;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', imgX, position, imgWidth * ratio, imgHeight * ratio);
        heightAdded += pageHeight;
      }
      
      const fileName = `ZTRACK_Telemetry_Manual_${t('language') === 'es' ? 'ES' : 'EN'}.pdf`;
      pdf.save(fileName);
      
      toast.success(t('language') === 'es' ? 'Manual descargado exitosamente' : 'Manual downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('language') === 'es' ? `Error al generar el PDF: ${error}` : `Error generating PDF: ${error}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('user_manual')}</h1>
            <p className="text-sm text-muted-foreground">{t('user_manual_desc')}</p>
          </div>
        </div>

        {/* Introduction */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <Home className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">{t('manual_intro')}</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">{t('manual_intro_desc')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ChevronRight className="h-5 w-5 text-blue-600" />
          {t('table_of_contents')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {manualSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                  selectedSection === section.id
                    ? "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700"
                    : "bg-background border-border hover:border-blue-200 dark:hover:border-blue-800"
                )}
              >
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm text-foreground">{t(section.titleKey)}</h3>
                  <p className="text-xs text-muted-foreground truncate">{t(section.descKey)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Sections */}
      <div ref={manualRef}>
        {manualSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className="bg-card border border-border rounded-lg overflow-hidden scroll-mt-6 mb-6"
            >
              {/* Section Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{t(section.titleKey)}</h2>
                    <p className="text-blue-100 text-sm">{t(section.descKey)}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Screenshot */}
                <div className="rounded-lg overflow-hidden border border-border shadow-lg">
                  <section.ScreenshotComponent />
                </div>

                {/* Steps */}
                <div>
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Pasos / Steps
                  </h3>
                  <div className="space-y-3">
                    {section.steps.map((stepKey, index) => (
                      <div
                        key={stepKey}
                        className="flex gap-3 p-4 bg-background border border-border rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex-shrink-0 h-7 w-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <p className="text-sm text-foreground pt-0.5">{t(stepKey)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Important Note */}
                <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-orange-900 dark:text-orange-100 text-sm mb-1">
                        {t('language') === 'es' ? 'Nota Importante' : 'Important Note'}
                      </h4>
                      <p className="text-sm text-orange-700 dark:text-orange-300">{t(section.noteKey)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Historical Process Charts Section */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {t('language') === 'es' ? 'Gráficas Históricas de Procesos' : 'Historical Process Charts'}
              </h2>
              <p className="text-green-100 text-sm">
                {t('language') === 'es' 
                  ? 'Ejemplos reales de procesos de maduración con parámetros de control'
                  : 'Real examples of ripening processes with control parameters'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('language') === 'es'
                ? 'Las siguientes gráficas muestran datos reales de temperatura, humedad, etileno y CO₂ a lo largo de diferentes procesos de maduración. Cada gráfica representa un protocolo específico con sus 4 fases: Homogenización, Maduración, Ventilación y Enfriamiento.'
                : 'The following charts show real data of temperature, humidity, ethylene, and CO₂ throughout different ripening processes. Each chart represents a specific protocol with its 4 phases: Homogenization, Ripening, Ventilation, and Cooling.'}
            </p>
          </div>

          {/* Mango Kent Chart */}
          <div className="space-y-3">
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold text-foreground">
                {t('language') === 'es' ? 'Proceso 1: Mango Kent Exportación' : 'Process 1: Mango Kent Export'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('language') === 'es'
                  ? 'Protocolo estándar de 92 horas para mango Kent destinado a exportación.'
                  : 'Standard 92-hour protocol for export-grade Kent mango.'}
              </p>
            </div>
            <MangoKentChart />
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs" style={{ color: 'rgb(161, 98, 7)' }}>
                {t('language') === 'es'
                  ? '📊 Observaciones: Temperatura constante de 20°C durante homogenización y maduración. CO₂ alcanza pico de 3% en hora 54. Etileno se mantiene en 100 ppm durante 48 horas de maduración.'
                  : '📊 Observations: Constant temperature of 20°C during homogenization and ripening. CO₂ reaches peak of 3% at hour 54. Ethylene maintained at 100 ppm during 48 hours of ripening.'}
              </p>
            </div>
          </div>

          {/* Palta Hass Chart */}
          <div className="space-y-3">
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-foreground">
                {t('language') === 'es' ? 'Proceso 2: Palta Hass Premium' : 'Process 2: Avocado Hass Premium'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('language') === 'es'
                  ? 'Protocolo de 72 horas con homogenización extendida para palta Hass.'
                  : '72-hour protocol with extended homogenization for Hass avocado.'}
              </p>
            </div>
            <PaltaHassChart />
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs" style={{ color: 'rgb(21, 128, 61)' }}>
                {t('language') === 'es'
                  ? '📊 Observaciones: Homogenización prolongada de 36h a 18°C. Maduración intensiva con 150 ppm de etileno. Enfriamiento final a 8°C para conservación óptima.'
                  : '📊 Observations: Extended homogenization of 36h at 18°C. Intensive ripening with 150 ppm ethylene. Final cooling to 8°C for optimal preservation.'}
              </p>
            </div>
          </div>

          {/* Plátano Chart */}
          <div className="space-y-3">
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="font-semibold text-foreground">
                {t('language') === 'es' ? 'Proceso 3: Plátano Orgánico' : 'Process 3: Organic Banana'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('language') === 'es'
                  ? 'Protocolo de 72 horas con maduración extendida para plátano orgánico.'
                  : '72-hour protocol with extended ripening for organic banana.'}
              </p>
            </div>
            <PlatanoChart />
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <p className="text-xs" style={{ color: 'rgb(194, 65, 12)' }}>
                {t('language') === 'es'
                  ? '📊 Observaciones: Homogenización corta de 18h seguida de maduración prolongada de 36h a 19°C. Ventilación extendida de 12h para eliminar completamente gases residuales. Enfriamiento moderado a 14°C.'
                  : '📊 Observations: Short homogenization of 18h followed by extended ripening of 36h at 19°C. Extended ventilation of 12h to completely remove residual gases. Moderate cooling to 14°C.'}
              </p>
            </div>
          </div>

          {/* Summary Table */}
          <div className="bg-background border border-border rounded-lg p-4">
            <h4 className="font-semibold text-foreground mb-3">
              {t('language') === 'es' ? 'Comparativa de Protocolos' : 'Protocol Comparison'}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'rgb(241, 245, 249)' }}>
                  <tr>
                    <th className="text-left p-2 font-medium" style={{ color: 'rgb(51, 65, 85)' }}>
                      {t('product')}
                    </th>
                    <th className="text-center p-2 font-medium" style={{ color: 'rgb(51, 65, 85)' }}>
                      {t('language') === 'es' ? 'Total' : 'Total'}
                    </th>
                    <th className="text-center p-2 font-medium" style={{ color: 'rgb(51, 65, 85)' }}>
                      {t('homogenization')}
                    </th>
                    <th className="text-center p-2 font-medium" style={{ color: 'rgb(51, 65, 85)' }}>
                      {t('ripening')}
                    </th>
                    <th className="text-center p-2 font-medium" style={{ color: 'rgb(51, 65, 85)' }}>
                      {t('ventilation')}
                    </th>
                    <th className="text-center p-2 font-medium" style={{ color: 'rgb(51, 65, 85)' }}>
                      {t('cooling')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                    <td className="p-2" style={{ color: 'rgb(15, 23, 42)' }}>Mango Kent</td>
                    <td className="text-center p-2 font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>92h</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>24h @ 20°C</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>48h @ 100ppm</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>8h @ 18°C</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>12h → 10°C</td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                    <td className="p-2" style={{ color: 'rgb(15, 23, 42)' }}>Palta Hass</td>
                    <td className="text-center p-2 font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>72h</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>36h @ 18°C</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>24h @ 150ppm</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>6h @ 16°C</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>6h → 8°C</td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: 'rgb(226, 232, 240)' }}>
                    <td className="p-2" style={{ color: 'rgb(15, 23, 42)' }}>Plátano</td>
                    <td className="text-center p-2 font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>72h</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>18h @ 18°C</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>36h @ 100ppm</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>12h @ 17°C</td>
                    <td className="text-center p-2" style={{ color: 'rgb(100, 116, 139)' }}>6h → 14°C</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
          <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">
          {t('language') === 'es' ? '¿Necesita más ayuda?' : 'Need More Help?'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('language') === 'es' 
            ? 'Contacte al soporte técnico o consulte la documentación completa en línea.' 
            : 'Contact technical support or check the complete online documentation.'}
        </p>
        <div className="flex flex-wrap gap-3 justify-center text-sm">
          <div className="px-4 py-2 bg-background border border-border rounded-lg">
            <span className="font-medium text-foreground">Email:</span>{' '}
            <span className="text-blue-600">soporte@reefermanager.com</span>
          </div>
          <div className="px-4 py-2 bg-background border border-border rounded-lg">
            <span className="font-medium text-foreground">
              {t('language') === 'es' ? 'Teléfono' : 'Phone'}:
            </span>{' '}
            <span className="text-blue-600">+51 1 234 5678</span>
          </div>
        </div>
        <button
          className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={downloadPDF}
          disabled={isGeneratingPDF}
        >
          {isGeneratingPDF ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          {isGeneratingPDF 
            ? (t('language') === 'es' ? 'Generando PDF...' : 'Generating PDF...') 
            : (t('language') === 'es' ? 'Descargar PDF' : 'Download PDF')
          }
        </button>
      </div>
    </div>
  );
};