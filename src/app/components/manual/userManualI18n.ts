import { useSettings } from '@/app/contexts/SettingsContext';

/** Traducciones del manual detallado (ES/EN). Las capturas siguen la UI en inglés cuando language=en. */
const es = {
  manual_page_title: 'Manual de Usuario Detallado',
  manual_page_subtitle: 'Guía paso a paso con capturas de pantalla de cada acción',
  manual_interactive_title: 'Manual Interactivo',
  manual_interactive_body:
    'Cada paso incluye una interfaz visual que muestra exactamente dónde hacer clic y qué acción realizar. Las áreas resaltadas indican el elemento activo.',
  manual_steps_word: 'pasos',
  manual_need_help: '¿Necesita más ayuda?',
  manual_need_help_body: 'Contacte al soporte técnico o consulte la documentación completa en línea.',
  manual_download_pdf: 'Descargar PDF',
  manual_generating_pdf: 'Generando PDF...',
  manual_pdf_toast: 'Generando PDF, espere...',
  manual_pdf_ok: 'Manual descargado.',
  manual_pdf_err: 'No se pudo generar el PDF. Pruebe de nuevo.',
  manual_pdf_unavailable: 'Contenido no disponible para exportar.',
  manual_ui_login_subtitle: 'Sistema de Control de Maduradores',
  manual_ui_email: 'Correo Electrónico',
  manual_ui_sign_in: 'Iniciar Sesión',
  manual_ui_forgot_password: '¿Olvidó su contraseña?',
  manual_ui_welcome_admin: 'Bienvenido, Administrador',
  manual_ui_system_operational: 'Sistema Operativo',
  manual_ui_active: 'Activo',
  manual_ui_devices: 'Dispositivos',
  manual_ui_save_config: 'Guardar Configuración',
  manual_ui_new_recipe: 'Nueva Receta',
  manual_ui_view_details: 'Ver Detalles',
  manual_ui_filters: 'Filtros',
  manual_ui_filter: 'Filtrar',
  manual_ui_new_user: 'Nuevo Usuario',
  manual_ui_recipe_library: 'Biblioteca de Recetas',
  manual_ui_device_control: 'Control de Dispositivo',
  manual_ui_process_history: 'Historial de Procesos',
  manual_ui_user_management: 'Gestión de Usuarios',
  manual_ui_recipe_builder: 'Constructor de Recetas de Maduración',
  manual_login_step_1_title: 'Paso 1: Abrir la aplicación',
  manual_login_step_2_title: 'Paso 2: Ingresar correo electrónico',
  manual_login_step_3_title: 'Paso 3: Ingresar contraseña',
  manual_login_step_4_title: 'Paso 4: Hacer clic en Iniciar Sesión',
  manual_login_1_callout:
    'Abra la aplicación ZTRACK TELEMETRY. Verá la pantalla de inicio de sesión con el logo y los campos de acceso.',
  manual_login_2_callout:
    'Ingrese su correo electrónico en el primer campo. El sistema acepta correos corporativos registrados.',
  manual_login_3_callout:
    'Ingrese su contraseña en el segundo campo. Use el ícono del ojo para mostrar u ocultar la contraseña.',
  manual_login_4_callout:
    'Haga clic en el botón "Iniciar Sesión" para acceder al sistema. Si las credenciales son correctas, será redirigido al dashboard.',
  manual_dashboard_step_1_title: 'Paso 1: Ver resumen del dashboard',
  manual_dashboard_step_2_title: 'Paso 2: Revisar tarjetas de estadísticas',
  manual_dashboard_step_3_title: 'Paso 3: Seleccionar un dispositivo',
  manual_dashboard_step_4_title: 'Paso 4: Ver progreso del proceso',
  manual_dashboard_1_callout:
    'Después de iniciar sesión, verá el panel de control principal con el encabezado que muestra su nombre de usuario y el estado del sistema.',
  manual_dashboard_2_callout:
    'Revise las tarjetas de estadísticas: dispositivos activos, procesos completados, alertas pendientes y procesos en curso.',
  manual_dashboard_3_callout:
    'Haga clic en una tarjeta de dispositivo para ver sus detalles. Cada tarjeta muestra ID, producto, estado y parámetros en tiempo real.',
  manual_dashboard_4_callout:
    'En la sección de progreso, vea el estado del proceso: porcentaje completado, tiempo restante y fases (homogeneización, maduración, ventilación, enfriamiento).',
  manual_control_step_1_title: 'Paso 1: Acceder al control del dispositivo',
  manual_control_step_2_title: 'Paso 2: Ajustar temperatura',
  manual_control_step_3_title: 'Paso 3: Ajustar humedad',
  manual_control_step_4_title: 'Paso 4: Ajustar etileno',
  manual_control_step_5_title: 'Paso 5: Guardar configuración',
  manual_control_1_callout:
    'Acceda a la pantalla de control del dispositivo seleccionado. Verá el nombre, ID y estado actual.',
  manual_control_2_callout:
    'Ajuste la temperatura deseada entre 5°C y 25°C. El valor se muestra en tiempo real.',
  manual_control_3_callout:
    'Configure la humedad relativa entre 70% y 95%. Mantenga niveles óptimos para el producto.',
  manual_control_4_callout:
    'Establezca el nivel de etileno (0–200 ppm). Este gas acelera la maduración de frutas climatéricas.',
  manual_control_5_callout:
    'Presione "Guardar Configuración" para aplicar los cambios al dispositivo. Los parámetros se actualizarán de inmediato.',
  manual_detail_step_1_title: 'Paso 1: Ver detalles del dispositivo',
  manual_detail_step_2_title: 'Paso 2: Revisar parámetros en tiempo real',
  manual_detail_step_3_title: 'Paso 3: Ver línea de tiempo del proceso',
  manual_detail_step_4_title: 'Paso 4: Cambiar a pestaña Análisis',
  manual_detail_step_5_title: 'Paso 5: Ver gráfica de temperatura',
  manual_detail_step_6_title: 'Paso 6: Ver gráfica comparativa de parámetros',
  manual_detail_step_7_title: 'Paso 7: Ver tabla de datos históricos',
  manual_detail_1_callout:
    'Acceda al detalle del dispositivo desde el dashboard. Verá el encabezado con nombre, producto y estado.',
  manual_detail_2_callout:
    'Observe los parámetros en tiempo real: temperatura, humedad, etileno y CO₂. Las flechas muestran la tendencia.',
  manual_detail_3_callout:
    'Revise la línea de tiempo del proceso. Vea la fase actual (verde) y las fases pendientes (gris).',
  manual_detail_4_callout:
    'Cambie a la pestaña "Análisis" para ver gráficos históricos y tendencias de los parámetros.',
  manual_detail_5_callout:
    'Visualice la gráfica histórica de temperatura con estadísticas: promedio, máximo, mínimo y desviación estándar.',
  manual_detail_6_callout:
    'Analice todos los parámetros en una sola gráfica para identificar patrones y correlaciones.',
  manual_detail_7_callout:
    'Revise la tabla de datos históricos con todas las mediciones registradas e indicadores de tendencia.',
  manual_detail_5_chart_title: 'Gráfica de Temperatura - Últimas 24 Horas',
  manual_detail_5_chart_desc: 'Monitoreo continuo de temperatura con mediciones cada 2 horas',
  manual_detail_6_chart_title: 'Gráfica Comparativa de Todos los Parámetros',
  manual_detail_6_chart_desc:
    'Visualización simultánea de temperatura, humedad, etileno y CO₂ para análisis correlacional',
  manual_detail_7_table_title: 'Tabla de Datos Históricos',
  manual_detail_7_table_subtitle: 'Últimas 12 mediciones registradas en las últimas 24 horas',
  manual_recipe_step_1_title: 'Paso 1: Acceder a biblioteca de recetas',
  manual_recipe_step_2_title: 'Paso 2: Buscar y filtrar recetas',
  manual_recipe_step_3_title: 'Paso 3: Seleccionar una receta',
  manual_recipe_step_4_title: 'Paso 4: Crear nueva receta',
  manual_recipe_1_callout:
    'Acceda a la biblioteca de recetas desde el menú. Verá todas las recetas disponibles para maduración de frutas.',
  manual_recipe_2_callout:
    'Use la barra de búsqueda para encontrar recetas por tipo de fruta. También puede aplicar filtros por duración.',
  manual_recipe_3_callout:
    'Haga clic en una tarjeta de receta para ver duración total, número de fases y parámetros de cada etapa.',
  manual_recipe_4_callout:
    'Para crear una receta, haga clic en "Nueva Receta". Se abrirá el constructor guiado con las 4 fases.',
  manual_builder_step_1_title: 'Paso 1: Iniciar el constructor de recetas',
  manual_builder_step_2_title: 'Paso 2: Configurar fase de homogeneización',
  manual_builder_step_3_title: 'Paso 3: Configurar fase de maduración',
  manual_builder_step_4_title: 'Paso 4: Configurar fase de ventilación',
  manual_builder_step_5_title: 'Paso 5: Configurar fase de enfriamiento',
  manual_builder_1_callout:
    'Comience ingresando el nombre de la receta. Este campo es obligatorio e identifica el proceso de maduración.',
  manual_builder_2_callout:
    'Configure la fase de homogeneización: temperatura, duración, humedad y CO₂. Esta fase nivela la temperatura del producto.',
  manual_builder_3_callout:
    'Configure la fase de maduración: temperatura, duración, humedad, etileno, CO₂ y ventilación. Es la fase más crítica.',
  manual_builder_4_callout:
    'Configure la fase de ventilación para eliminar gases residuales (etileno y CO₂) del contenedor.',
  manual_builder_5_callout:
    'Configure la fase de enfriamiento para conservar el producto. Luego haga clic en "Guardar Receta".',
  manual_process_step_1_title: 'Paso 1: Acceder al historial de procesos',
  manual_process_step_2_title: 'Paso 2: Filtrar procesos por estado',
  manual_process_step_3_title: 'Paso 3: Ver detalles del proceso',
  manual_process_1_callout:
    'Acceda al historial de procesos desde el menú principal. Verá procesos completados y en curso.',
  manual_process_2_callout:
    'Use los filtros para buscar por estado, fecha, dispositivo, producto o receta aplicada.',
  manual_process_3_callout:
    'Haga clic en "Ver Detalles" para acceder a fechas, receta utilizada y gráficos históricos.',
  manual_users_step_1_title: 'Paso 1: Acceder a gestión de usuarios',
  manual_users_step_2_title: 'Paso 2: Agregar nuevo usuario',
  manual_users_step_3_title: 'Paso 3: Buscar usuarios',
  manual_users_step_4_title: 'Paso 4: Editar usuario',
  manual_users_step_5_title: 'Paso 5: Gestionar permisos por rol',
  manual_users_1_callout:
    'Acceda a la gestión de usuarios desde el menú principal (solo administradores).',
  manual_users_2_callout:
    'Complete el formulario con nombre, correo y rol (Operador, Supervisor o Administrador).',
  manual_users_3_callout:
    'Use la barra de búsqueda para encontrar usuarios por nombre o correo. Puede filtrar por rol.',
  manual_users_4_callout:
    'Haga clic en el ícono de editar para modificar nombre, correo o rol de acceso.',
  manual_users_5_callout:
    'Revise los permisos de cada rol y asígnelos según las responsabilidades del usuario.',
} as const;

const en: Record<keyof typeof es, string> = {
  manual_page_title: 'Detailed User Manual',
  manual_page_subtitle: 'Step-by-step guide with screenshots of each action',
  manual_interactive_title: 'Interactive Manual',
  manual_interactive_body:
    'Each step includes a visual interface showing exactly where to click and what action to perform. Highlighted areas indicate the active element.',
  manual_steps_word: 'steps',
  manual_need_help: 'Need More Help?',
  manual_need_help_body: 'Contact technical support or check the complete online documentation.',
  manual_download_pdf: 'Download PDF',
  manual_generating_pdf: 'Generating PDF...',
  manual_pdf_toast: 'Generating PDF, please wait...',
  manual_pdf_ok: 'Manual downloaded.',
  manual_pdf_err: 'Could not generate PDF. Try again.',
  manual_pdf_unavailable: 'Content not available to export.',
  manual_ui_login_subtitle: 'Ripening Room Control System',
  manual_ui_email: 'Email',
  manual_ui_sign_in: 'Log In',
  manual_ui_forgot_password: 'Forgot your password?',
  manual_ui_welcome_admin: 'Welcome, Administrator',
  manual_ui_system_operational: 'System Operational',
  manual_ui_active: 'Active',
  manual_ui_devices: 'Devices',
  manual_ui_save_config: 'Save Configuration',
  manual_ui_new_recipe: 'New Recipe',
  manual_ui_view_details: 'View Details',
  manual_ui_filters: 'Filters',
  manual_ui_filter: 'Filter',
  manual_ui_new_user: 'New User',
  manual_ui_recipe_library: 'Recipe Library',
  manual_ui_device_control: 'Device Control',
  manual_ui_process_history: 'Process History',
  manual_ui_user_management: 'User Management',
  manual_ui_recipe_builder: 'Ripening Recipe Builder',
  manual_login_step_1_title: 'Step 1: Open the application',
  manual_login_step_2_title: 'Step 2: Enter email address',
  manual_login_step_3_title: 'Step 3: Enter password',
  manual_login_step_4_title: 'Step 4: Click Log In',
  manual_login_1_callout:
    'Open the ZTRACK TELEMETRY application. You will see the login screen with the logo and access fields.',
  manual_login_2_callout:
    'Enter your email in the first field. The system accepts registered corporate email addresses.',
  manual_login_3_callout:
    'Enter your password in the second field. Use the eye icon to show or hide the password.',
  manual_login_4_callout:
    'Click the "Log In" button to access the system. If credentials are correct, you will be redirected to the dashboard.',
  manual_dashboard_step_1_title: 'Step 1: View dashboard overview',
  manual_dashboard_step_2_title: 'Step 2: Review statistics cards',
  manual_dashboard_step_3_title: 'Step 3: Select a device',
  manual_dashboard_step_4_title: 'Step 4: View process progress',
  manual_dashboard_1_callout:
    'After logging in, you will see the main dashboard header with your username and system status.',
  manual_dashboard_2_callout:
    'Review the statistics cards: active devices, completed processes, pending alerts, and processes in progress.',
  manual_dashboard_3_callout:
    'Click a device card to view details. Each card shows ID, product, status, and real-time parameters.',
  manual_dashboard_4_callout:
    'In the progress section, see process status: completion percentage, time remaining, and phases (homogenization, ripening, ventilation, cooling).',
  manual_control_step_1_title: 'Step 1: Access device control',
  manual_control_step_2_title: 'Step 2: Adjust temperature',
  manual_control_step_3_title: 'Step 3: Adjust humidity',
  manual_control_step_4_title: 'Step 4: Adjust ethylene',
  manual_control_step_5_title: 'Step 5: Save configuration',
  manual_control_1_callout:
    'Access the control screen for the selected device. You will see the name, ID, and current status.',
  manual_control_2_callout:
    'Adjust the desired temperature between 5°C and 25°C. The value updates in real time.',
  manual_control_3_callout:
    'Set relative humidity between 70% and 95%. Maintain optimal levels for the product.',
  manual_control_4_callout:
    'Set ethylene level (0–200 ppm). This gas accelerates ripening of climacteric fruit.',
  manual_control_5_callout:
    'Press "Save Configuration" to apply changes to the device. Parameters update immediately.',
  manual_detail_step_1_title: 'Step 1: View device details',
  manual_detail_step_2_title: 'Step 2: Review real-time parameters',
  manual_detail_step_3_title: 'Step 3: View process timeline',
  manual_detail_step_4_title: 'Step 4: Switch to Analysis tab',
  manual_detail_step_5_title: 'Step 5: View temperature chart',
  manual_detail_step_6_title: 'Step 6: View multi-parameter chart',
  manual_detail_step_7_title: 'Step 7: View historical data table',
  manual_detail_1_callout:
    'Open device detail from the dashboard. You will see the header with name, product, and status.',
  manual_detail_2_callout:
    'Observe real-time parameters: temperature, humidity, ethylene, and CO₂. Arrows show trends.',
  manual_detail_3_callout:
    'Review the process timeline. See the current phase (green) and pending phases (gray).',
  manual_detail_4_callout:
    'Switch to the "Analysis" tab to view historical charts and parameter trends.',
  manual_detail_5_callout:
    'View the temperature history chart with statistics: average, maximum, minimum, and standard deviation.',
  manual_detail_6_callout:
    'Analyze all parameters in one chart to identify patterns and correlations.',
  manual_detail_7_callout:
    'Review the historical data table with all recorded measurements and trend indicators.',
  manual_detail_5_chart_title: 'Temperature Chart - Last 24 Hours',
  manual_detail_5_chart_desc: 'Continuous temperature monitoring with readings every 2 hours',
  manual_detail_6_chart_title: 'Comparative Chart - All Parameters',
  manual_detail_6_chart_desc:
    'Simultaneous view of temperature, humidity, ethylene, and CO₂ for correlation analysis',
  manual_detail_7_table_title: 'Historical Data Table',
  manual_detail_7_table_subtitle: 'Last 12 readings recorded in the past 24 hours',
  manual_recipe_step_1_title: 'Step 1: Access recipe library',
  manual_recipe_step_2_title: 'Step 2: Search and filter recipes',
  manual_recipe_step_3_title: 'Step 3: Select a recipe',
  manual_recipe_step_4_title: 'Step 4: Create new recipe',
  manual_recipe_1_callout:
    'Access the recipe library from the menu. You will see all available ripening recipes.',
  manual_recipe_2_callout:
    'Use the search bar to find recipes by fruit type. You can also filter by duration.',
  manual_recipe_3_callout:
    'Click a recipe card to view total duration, number of phases, and parameters for each stage.',
  manual_recipe_4_callout:
    'To create a recipe, click "New Recipe". The guided builder opens with all 4 phases.',
  manual_builder_step_1_title: 'Step 1: Start recipe builder',
  manual_builder_step_2_title: 'Step 2: Configure homogenization phase',
  manual_builder_step_3_title: 'Step 3: Configure ripening phase',
  manual_builder_step_4_title: 'Step 4: Configure ventilation phase',
  manual_builder_step_5_title: 'Step 5: Configure cooling phase',
  manual_builder_1_callout:
    'Start by entering the recipe name. This required field identifies the ripening process.',
  manual_builder_2_callout:
    'Configure homogenization: temperature, duration, humidity, and CO₂. This phase evens product temperature.',
  manual_builder_3_callout:
    'Configure ripening: temperature, duration, humidity, ethylene, CO₂, and ventilation. This is the critical phase.',
  manual_builder_4_callout:
    'Configure ventilation to remove residual gases (ethylene and CO₂) from the container.',
  manual_builder_5_callout:
    'Configure cooling to preserve the product. Then click "Save Recipe".',
  manual_process_step_1_title: 'Step 1: Access process history',
  manual_process_step_2_title: 'Step 2: Filter processes by status',
  manual_process_step_3_title: 'Step 3: View process details',
  manual_process_1_callout:
    'Access process history from the main menu. You will see completed and active processes.',
  manual_process_2_callout:
    'Use filters to search by status, date, device, product, or applied recipe.',
  manual_process_3_callout:
    'Click "View Details" to access dates, recipe used, and historical charts.',
  manual_users_step_1_title: 'Step 1: Access user management',
  manual_users_step_2_title: 'Step 2: Add new user',
  manual_users_step_3_title: 'Step 3: Search users',
  manual_users_step_4_title: 'Step 4: Edit user',
  manual_users_step_5_title: 'Step 5: Manage role permissions',
  manual_users_1_callout:
    'Access user management from the main menu (administrators only).',
  manual_users_2_callout:
    'Complete the form with name, email, and role (Operator, Supervisor, or Administrator).',
  manual_users_3_callout:
    'Use the search bar to find users by name or email. You can filter by role.',
  manual_users_4_callout:
    'Click the edit icon to modify name, email, or access role.',
  manual_users_5_callout:
    'Review permissions for each role and assign them according to user responsibilities.',
};

export type ManualStringKey = keyof typeof es;

export function useManualT() {
  const { language } = useSettings();
  const dict = language === 'en' ? en : es;
  return (key: ManualStringKey) => dict[key];
}
