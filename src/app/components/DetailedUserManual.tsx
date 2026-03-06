import React, { useState, useRef } from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { 
  BookOpen, 
  ChevronRight, 
  Home, 
  LogIn, 
  LayoutDashboard, 
  Thermometer,
  Download,
  Loader2,
  Activity,
  BookMarked,
  Users,
  Eye
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  LoginStep1, 
  LoginStep2, 
  LoginStep3, 
  LoginStep4 
} from './manual/DetailedLoginSteps';
import { 
  DashboardStep1, 
  DashboardStep2, 
  DashboardStep3, 
  DashboardStep4 
} from './manual/DetailedDashboardSteps';
import {
  ControlStep1,
  ControlStep2,
  ControlStep3,
  ControlStep4,
  ControlStep5
} from './manual/DetailedControlSteps';
import {
  DetailStep1,
  DetailStep2,
  DetailStep3,
  DetailStep4,
  DetailStep5,
  DetailStep6,
  DetailStep7
} from './manual/DetailedDeviceDetailSteps';
import {
  RecipeStep1,
  RecipeStep2,
  RecipeStep3,
  RecipeStep4
} from './manual/DetailedRecipeSteps';
import {
  BuilderStep1,
  BuilderStep2,
  BuilderStep3,
  BuilderStep4,
  BuilderStep5
} from './manual/DetailedRecipeBuilderSteps';
import {
  ProcessStep1,
  ProcessStep2,
  ProcessStep3
} from './manual/DetailedProcessSteps';
import {
  UsersStep1,
  UsersStep2,
  UsersStep3,
  UsersStep4,
  UsersStep5
} from './manual/DetailedUsersSteps';

interface DetailedStep {
  id: string;
  titleKey: string;
  Component: React.ComponentType;
}

interface DetailedSection {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<any>;
  steps: DetailedStep[];
}

export const DetailedUserManual: React.FC = () => {
  const { t } = useSettings();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const manualRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!manualRef.current) {
      toast.error(t('language') === 'es' ? 'Contenido no disponible para exportar.' : 'Content not available to export.');
      return;
    }
    setIsGeneratingPDF(true);
    toast.info(t('language') === 'es' ? 'Generando PDF, espere...' : 'Generating PDF, please wait...');
    try {
      const element = manualRef.current;
      const htmlElement = document.documentElement;
      const originalTheme = htmlElement.classList.contains('dark');
      if (originalTheme) htmlElement.classList.remove('dark');
      await new Promise((r) => setTimeout(r, 400));

      const clone = element.cloneNode(true) as HTMLElement;
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = String(element.offsetWidth) + 'px';
      container.style.backgroundColor = '#fff';
      container.style.color = 'rgb(15, 23, 42)';
      document.body.appendChild(container);
      container.appendChild(clone);
      clone.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => el.remove());
      clone.querySelectorAll('*').forEach((el) => {
        if (!(el instanceof SVGElement)) (el as HTMLElement).className = '';
      });
      await new Promise((r) => setTimeout(r, 200));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      });
      document.body.removeChild(container);
      if (originalTheme) htmlElement.classList.add('dark');

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
      const imgX = (pdfW - canvas.width * ratio) / 2;
      pdf.addImage(imgData, 'PNG', imgX, 0, canvas.width * ratio, canvas.height * ratio);
      let h = pdfH;
      while (h < canvas.height * ratio) {
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', imgX, h - canvas.height * ratio, canvas.width * ratio, canvas.height * ratio);
        h += pdfH;
      }
      pdf.save('ZTRACK_Telemetry_Manual_Detallado_ES.pdf');
      toast.success(t('language') === 'es' ? 'Manual descargado.' : 'Manual downloaded.');
    } catch (err) {
      console.error('Error generando PDF:', err);
      toast.error(t('language') === 'es' ? 'No se pudo generar el PDF. Pruebe de nuevo.' : 'Could not generate PDF. Try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    setSelectedSection(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const manualSections: DetailedSection[] = [
    {
      id: 'login',
      titleKey: 'section_login',
      descKey: 'section_login_desc',
      icon: LogIn,
      steps: [
        {
          id: 'login-1',
          titleKey: 'Paso 1: Abrir la aplicación',
          Component: LoginStep1
        },
        {
          id: 'login-2',
          titleKey: 'Paso 2: Ingresar correo electrónico',
          Component: LoginStep2
        },
        {
          id: 'login-3',
          titleKey: 'Paso 3: Ingresar contraseña',
          Component: LoginStep3
        },
        {
          id: 'login-4',
          titleKey: 'Paso 4: Hacer clic en Iniciar Sesión',
          Component: LoginStep4
        }
      ]
    },
    {
      id: 'dashboard',
      titleKey: 'section_dashboard',
      descKey: 'section_dashboard_desc',
      icon: LayoutDashboard,
      steps: [
        {
          id: 'dashboard-1',
          titleKey: 'Paso 1: Ver resumen del dashboard',
          Component: DashboardStep1
        },
        {
          id: 'dashboard-2',
          titleKey: 'Paso 2: Revisar tarjetas de estadísticas',
          Component: DashboardStep2
        },
        {
          id: 'dashboard-3',
          titleKey: 'Paso 3: Seleccionar un dispositivo',
          Component: DashboardStep3
        },
        {
          id: 'dashboard-4',
          titleKey: 'Paso 4: Ver progreso del proceso',
          Component: DashboardStep4
        }
      ]
    },
    {
      id: 'control',
      titleKey: 'section_device_control',
      descKey: 'section_device_control_desc',
      icon: Thermometer,
      steps: [
        {
          id: 'control-1',
          titleKey: 'Paso 1: Acceder al control del dispositivo',
          Component: ControlStep1
        },
        {
          id: 'control-2',
          titleKey: 'Paso 2: Ajustar temperatura',
          Component: ControlStep2
        },
        {
          id: 'control-3',
          titleKey: 'Paso 3: Ajustar humedad',
          Component: ControlStep3
        },
        {
          id: 'control-4',
          titleKey: 'Paso 4: Ajustar etileno',
          Component: ControlStep4
        },
        {
          id: 'control-5',
          titleKey: 'Paso 5: Guardar configuración',
          Component: ControlStep5
        }
      ]
    },
    {
      id: 'detail',
      titleKey: 'section_device_detail',
      descKey: 'section_device_detail_desc',
      icon: Eye,
      steps: [
        {
          id: 'detail-1',
          titleKey: 'Paso 1: Ver detalles del dispositivo',
          Component: DetailStep1
        },
        {
          id: 'detail-2',
          titleKey: 'Paso 2: Revisar parámetros en tiempo real',
          Component: DetailStep2
        },
        {
          id: 'detail-3',
          titleKey: 'Paso 3: Ver línea de tiempo del proceso',
          Component: DetailStep3
        },
        {
          id: 'detail-4',
          titleKey: 'Paso 4: Cambiar a pestaña Análisis',
          Component: DetailStep4
        },
        {
          id: 'detail-5',
          titleKey: 'Paso 5: Ver gráfica de temperatura',
          Component: DetailStep5
        },
        {
          id: 'detail-6',
          titleKey: 'Paso 6: Ver gráfica comparativa de parámetros',
          Component: DetailStep6
        },
        {
          id: 'detail-7',
          titleKey: 'Paso 7: Ver tabla de datos históricos',
          Component: DetailStep7
        }
      ]
    },
    {
      id: 'recipe',
      titleKey: 'section_recipe',
      descKey: 'section_recipe_desc',
      icon: BookMarked,
      steps: [
        {
          id: 'recipe-1',
          titleKey: 'Paso 1: Acceder a biblioteca de recetas',
          Component: RecipeStep1
        },
        {
          id: 'recipe-2',
          titleKey: 'Paso 2: Buscar y filtrar recetas',
          Component: RecipeStep2
        },
        {
          id: 'recipe-3',
          titleKey: 'Paso 3: Seleccionar una receta',
          Component: RecipeStep3
        },
        {
          id: 'recipe-4',
          titleKey: 'Paso 4: Crear nueva receta',
          Component: RecipeStep4
        }
      ]
    },
    {
      id: 'builder',
      titleKey: 'section_recipe_builder',
      descKey: 'section_recipe_builder_desc',
      icon: BookOpen,
      steps: [
        {
          id: 'builder-1',
          titleKey: 'Paso 1: Iniciar el constructor de recetas',
          Component: BuilderStep1
        },
        {
          id: 'builder-2',
          titleKey: 'Paso 2: Configurar fase de homogeneización',
          Component: BuilderStep2
        },
        {
          id: 'builder-3',
          titleKey: 'Paso 3: Configurar fase de maduración',
          Component: BuilderStep3
        },
        {
          id: 'builder-4',
          titleKey: 'Paso 4: Configurar fase de ventilación',
          Component: BuilderStep4
        },
        {
          id: 'builder-5',
          titleKey: 'Paso 5: Configurar fase de enfriamiento',
          Component: BuilderStep5
        }
      ]
    },
    {
      id: 'process',
      titleKey: 'section_process',
      descKey: 'section_process_desc',
      icon: Activity,
      steps: [
        {
          id: 'process-1',
          titleKey: 'Paso 1: Acceder al historial de procesos',
          Component: ProcessStep1
        },
        {
          id: 'process-2',
          titleKey: 'Paso 2: Filtrar procesos por estado',
          Component: ProcessStep2
        },
        {
          id: 'process-3',
          titleKey: 'Paso 3: Ver detalles del proceso',
          Component: ProcessStep3
        }
      ]
    },
    {
      id: 'users',
      titleKey: 'section_users',
      descKey: 'section_users_desc',
      icon: Users,
      steps: [
        {
          id: 'users-1',
          titleKey: 'Paso 1: Acceder a gestión de usuarios',
          Component: UsersStep1
        },
        {
          id: 'users-2',
          titleKey: 'Paso 2: Agregar nuevo usuario',
          Component: UsersStep2
        },
        {
          id: 'users-3',
          titleKey: 'Paso 3: Buscar usuarios',
          Component: UsersStep3
        },
        {
          id: 'users-4',
          titleKey: 'Paso 4: Editar usuario',
          Component: UsersStep4
        },
        {
          id: 'users-5',
          titleKey: 'Paso 5: Gestionar permisos por rol',
          Component: UsersStep5
        }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('language') === 'es' ? 'Manual de Usuario Detallado' : 'Detailed User Manual'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('language') === 'es' 
                ? 'Guía paso a paso con capturas de pantalla de cada acción'
                : 'Step-by-step guide with screenshots of each action'}
            </p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <Home className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                {t('language') === 'es' ? 'Manual Interactivo' : 'Interactive Manual'}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('language') === 'es'
                  ? 'Cada paso incluye una interfaz visual que muestra exactamente dónde hacer clic y qué acción realizar. Las áreas resaltadas indican el elemento activo.'
                  : 'Each step includes a visual interface showing exactly where to click and what action to perform. Highlighted areas indicate the active element.'}
              </p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  <p className="text-xs text-muted-foreground">
                    {section.steps.length} {t('language') === 'es' ? 'pasos' : 'steps'}
                  </p>
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

              <div className="p-6 space-y-8">
                {/* Each Step */}
                {section.steps.map((step, index) => (
                  <div key={step.id} className="space-y-4">
                    {/* Step Title */}
                    <div className="flex items-center gap-3 pb-3 border-b border-border">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{step.titleKey}</h3>
                    </div>
                    
                    {/* Step Screenshot */}
                    <div className="rounded-lg overflow-hidden border border-border shadow-lg">
                      <step.Component />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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