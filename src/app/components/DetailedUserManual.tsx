import React, { useState, useRef } from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useManualT, type ManualStringKey } from '@/app/components/manual/userManualI18n';
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
  Eye,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  LoginStep1,
  LoginStep2,
  LoginStep3,
  LoginStep4,
} from './manual/DetailedLoginSteps';
import {
  DashboardStep1,
  DashboardStep2,
  DashboardStep3,
  DashboardStep4,
} from './manual/DetailedDashboardSteps';
import {
  ControlStep1,
  ControlStep2,
  ControlStep3,
  ControlStep4,
  ControlStep5,
} from './manual/DetailedControlSteps';
import {
  DetailStep1,
  DetailStep2,
  DetailStep3,
  DetailStep4,
  DetailStep5,
  DetailStep6,
  DetailStep7,
} from './manual/DetailedDeviceDetailSteps';
import {
  RecipeStep1,
  RecipeStep2,
  RecipeStep3,
  RecipeStep4,
} from './manual/DetailedRecipeSteps';
import {
  BuilderStep1,
  BuilderStep2,
  BuilderStep3,
  BuilderStep4,
  BuilderStep5,
} from './manual/DetailedRecipeBuilderSteps';
import { ProcessStep1, ProcessStep2, ProcessStep3 } from './manual/DetailedProcessSteps';
import {
  UsersStep1,
  UsersStep2,
  UsersStep3,
  UsersStep4,
  UsersStep5,
} from './manual/DetailedUsersSteps';

interface DetailedStep {
  id: string;
  titleKey: ManualStringKey;
  Component: React.ComponentType;
}

interface DetailedSection {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: DetailedStep[];
}

export const DetailedUserManual: React.FC = () => {
  const { t, language } = useSettings();
  const mt = useManualT();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const manualRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!manualRef.current) {
      toast.error(mt('manual_pdf_unavailable'));
      return;
    }
    setIsGeneratingPDF(true);
    toast.info(mt('manual_pdf_toast'));
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
      const suffix = language === 'en' ? 'EN' : 'ES';
      pdf.save(`ZTRACK_Telemetry_Manual_Detailed_${suffix}.pdf`);
      toast.success(mt('manual_pdf_ok'));
    } catch (err) {
      console.error('Error generando PDF:', err);
      toast.error(mt('manual_pdf_err'));
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
        { id: 'login-1', titleKey: 'manual_login_step_1_title', Component: LoginStep1 },
        { id: 'login-2', titleKey: 'manual_login_step_2_title', Component: LoginStep2 },
        { id: 'login-3', titleKey: 'manual_login_step_3_title', Component: LoginStep3 },
        { id: 'login-4', titleKey: 'manual_login_step_4_title', Component: LoginStep4 },
      ],
    },
    {
      id: 'dashboard',
      titleKey: 'section_dashboard',
      descKey: 'section_dashboard_desc',
      icon: LayoutDashboard,
      steps: [
        { id: 'dashboard-1', titleKey: 'manual_dashboard_step_1_title', Component: DashboardStep1 },
        { id: 'dashboard-2', titleKey: 'manual_dashboard_step_2_title', Component: DashboardStep2 },
        { id: 'dashboard-3', titleKey: 'manual_dashboard_step_3_title', Component: DashboardStep3 },
        { id: 'dashboard-4', titleKey: 'manual_dashboard_step_4_title', Component: DashboardStep4 },
      ],
    },
    {
      id: 'control',
      titleKey: 'section_device_control',
      descKey: 'section_device_control_desc',
      icon: Thermometer,
      steps: [
        { id: 'control-1', titleKey: 'manual_control_step_1_title', Component: ControlStep1 },
        { id: 'control-2', titleKey: 'manual_control_step_2_title', Component: ControlStep2 },
        { id: 'control-3', titleKey: 'manual_control_step_3_title', Component: ControlStep3 },
        { id: 'control-4', titleKey: 'manual_control_step_4_title', Component: ControlStep4 },
        { id: 'control-5', titleKey: 'manual_control_step_5_title', Component: ControlStep5 },
      ],
    },
    {
      id: 'detail',
      titleKey: 'section_device_detail',
      descKey: 'section_device_detail_desc',
      icon: Eye,
      steps: [
        { id: 'detail-1', titleKey: 'manual_detail_step_1_title', Component: DetailStep1 },
        { id: 'detail-2', titleKey: 'manual_detail_step_2_title', Component: DetailStep2 },
        { id: 'detail-3', titleKey: 'manual_detail_step_3_title', Component: DetailStep3 },
        { id: 'detail-4', titleKey: 'manual_detail_step_4_title', Component: DetailStep4 },
        { id: 'detail-5', titleKey: 'manual_detail_step_5_title', Component: DetailStep5 },
        { id: 'detail-6', titleKey: 'manual_detail_step_6_title', Component: DetailStep6 },
        { id: 'detail-7', titleKey: 'manual_detail_step_7_title', Component: DetailStep7 },
      ],
    },
    {
      id: 'recipe',
      titleKey: 'section_recipes',
      descKey: 'section_recipes_desc',
      icon: BookMarked,
      steps: [
        { id: 'recipe-1', titleKey: 'manual_recipe_step_1_title', Component: RecipeStep1 },
        { id: 'recipe-2', titleKey: 'manual_recipe_step_2_title', Component: RecipeStep2 },
        { id: 'recipe-3', titleKey: 'manual_recipe_step_3_title', Component: RecipeStep3 },
        { id: 'recipe-4', titleKey: 'manual_recipe_step_4_title', Component: RecipeStep4 },
      ],
    },
    {
      id: 'builder',
      titleKey: 'section_recipe_builder',
      descKey: 'section_recipe_builder_desc',
      icon: BookOpen,
      steps: [
        { id: 'builder-1', titleKey: 'manual_builder_step_1_title', Component: BuilderStep1 },
        { id: 'builder-2', titleKey: 'manual_builder_step_2_title', Component: BuilderStep2 },
        { id: 'builder-3', titleKey: 'manual_builder_step_3_title', Component: BuilderStep3 },
        { id: 'builder-4', titleKey: 'manual_builder_step_4_title', Component: BuilderStep4 },
        { id: 'builder-5', titleKey: 'manual_builder_step_5_title', Component: BuilderStep5 },
      ],
    },
    {
      id: 'process',
      titleKey: 'section_processes',
      descKey: 'section_processes_desc',
      icon: Activity,
      steps: [
        { id: 'process-1', titleKey: 'manual_process_step_1_title', Component: ProcessStep1 },
        { id: 'process-2', titleKey: 'manual_process_step_2_title', Component: ProcessStep2 },
        { id: 'process-3', titleKey: 'manual_process_step_3_title', Component: ProcessStep3 },
      ],
    },
    {
      id: 'users',
      titleKey: 'section_users',
      descKey: 'section_users_desc',
      icon: Users,
      steps: [
        { id: 'users-1', titleKey: 'manual_users_step_1_title', Component: UsersStep1 },
        { id: 'users-2', titleKey: 'manual_users_step_2_title', Component: UsersStep2 },
        { id: 'users-3', titleKey: 'manual_users_step_3_title', Component: UsersStep3 },
        { id: 'users-4', titleKey: 'manual_users_step_4_title', Component: UsersStep4 },
        { id: 'users-5', titleKey: 'manual_users_step_5_title', Component: UsersStep5 },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{mt('manual_page_title')}</h1>
            <p className="text-sm text-muted-foreground">{mt('manual_page_subtitle')}</p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <Home className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                {mt('manual_interactive_title')}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">{mt('manual_interactive_body')}</p>
            </div>
          </div>
        </div>
      </div>

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
                  'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                  selectedSection === section.id
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700'
                    : 'bg-background border-border hover:border-blue-200 dark:hover:border-blue-800'
                )}
              >
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm text-foreground">{t(section.titleKey)}</h3>
                  <p className="text-xs text-muted-foreground">
                    {section.steps.length} {mt('manual_steps_word')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={manualRef}>
        {manualSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className="bg-card border border-border rounded-lg overflow-hidden scroll-mt-6 mb-6"
            >
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
                {section.steps.map((step, index) => (
                  <div key={step.id} className="space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-border">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{mt(step.titleKey)}</h3>
                    </div>
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

      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
          <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">{mt('manual_need_help')}</h3>
        <p className="text-sm text-muted-foreground mb-4">{mt('manual_need_help_body')}</p>
        <button
          className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={downloadPDF}
          disabled={isGeneratingPDF}
        >
          {isGeneratingPDF ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          {isGeneratingPDF ? mt('manual_generating_pdf') : mt('manual_download_pdf')}
        </button>
      </div>
    </div>
  );
};
