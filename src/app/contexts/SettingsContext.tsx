import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'es' | 'en';
type Theme = 'light' | 'dark';
type TempUnit = 'C' | 'F';

interface SettingsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  tempUnit: TempUnit;
  toggleTempUnit: () => void;
  convertTemp: (celsius: number) => number;
  formatTemp: (celsius: number) => string;
  t: (key: string, replacements?: Record<string, string> | string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  es: {
    // Navigation
    'dashboard': 'Panel de Control',
    'control': 'Control de Dispositivos',
    'monitoring': 'Monitoreo y Análisis',
    'processes': 'Seguimiento (Plus)',
    'recipes': 'Recetas (Plus)',
    'users': 'Usuarios (Plus)',
    'settings': 'Configuración',
    'help': 'Manual de Usuario',
    'logout': 'Cerrar Sesión',
    'profile': 'Mi Perfil',
    'operator': 'Operador',
    'search_placeholder': 'Buscar dispositivo...',
    'search_process_placeholder': 'Buscar por cliente, lote o producto...',

    // Login
    'welcome_back': 'Bienvenido de nuevo',
    'enter_credentials': 'Ingresa tus credenciales para acceder al panel de control',
    'password': 'Contraseña',
    'login_button': 'Iniciar Sesión',
    'login_subtitle': 'Sistema de gestión y monitoreo en tiempo real para soluciones refrigeradas de ZGROUP.',
    'configuring': 'Configurando...',
    'init_admin': 'Inicializar cuenta Admin (Dev)',
    'session_success': 'Sesión iniciada correctamente',
    'admin_ready': 'Cuenta administrativa lista',
    'login_error': 'Error al iniciar sesión',
    'email_label': 'Correo Electrónico',

    // Dashboard
    'active_units': 'Unidades Activas',
    'active_alarms': 'Alarmas Activas',
    'completed_processes': 'Procesos Completados',
    'total_consumption': 'Consumo Total',
    'fleet_status': 'Estado de Flota',
    'of_total': 'De {{total}} total',
    'require_attention': 'Requieren atención',
    'this_week': 'Esta semana',
    'historical_accumulated': 'Acumulado histórico',
    'error_loading_devices': 'Error al cargar dispositivos',

    // Device Detail
    'device_not_found': 'Dispositivo no encontrado',
    'operation': 'Operación',
    'analysis': 'Análisis',
    'current_process_status': 'Estado del Proceso Actual',
    'operational_data': 'Datos Operacionales',
    'no_active_process': 'No hay proceso activo',
    'power_consumption': 'Consumo Energía',
    'energy_consumption_period': 'Consumo de energía (período)',
    'total_accumulated': 'Total Acumulado',
    'defrost_interval': 'Intervalo Defrost',
    'evaporation_coil': 'Bobina Evaporación',
    'recipe': 'Receta',
    'phase': 'Fase',
    'start': 'Inicio',
    'estimated_end': 'Fin Estimado',
    'back': 'Volver',
    'historical_data': 'Datos Históricos',
    'last_12_hours': 'Últimas 12 Horas',

    // Control Panel
    'manual_mode': 'Manual',
    'homogenization': 'Homogenización',
    'ripening': 'Maduración',
    'ventilation': 'Ventilación',
    'cooling': 'Enfriamiento',
    'device_status': 'Estado del Equipo',
    'equipo_estado_actual': 'Estado actual del equipo',
    'controls_available_when_on': 'Los controles de temperatura, humedad y gases están disponibles con el equipo encendido.',
    'climatization': 'Climatización',
    'target_temperature': 'Temperatura Objetivo',
    'relative_humidity': 'Humedad Relativa',
    'gases_ventilation': 'Gases y Ventilación',
    'ethylene_injection': 'Inyección Etileno',
    'ventilation_speed': 'Velocidad Ventilación',
    'apply_changes': 'Aplicar Cambios',
    'confirm_changes': 'Confirmar Cambios',
    'applying': 'Aplicando...',
    'confirm_changes_desc': 'Se aplicarán los siguientes cambios en el dispositivo:',
    'environmental_conditions': 'Condiciones Ambientales',
    'target_co2': 'CO2 Objetivo',
    'duration': 'Duración',
    'preview': 'Previsualización',
    'start_process': 'Iniciar Proceso',
    'starting': 'Iniciando...',
    'cancel': 'Cancelar',
    'final_temperature': 'Temperatura Final',
    'estimated_duration': 'Duración Estimada',
    'co2_limit': 'Límite CO2',
    'process_time': 'Tiempo de Proceso',
    'max_duration': 'Duración Máxima',
    'cooling_ramp': 'Rampa de Enfriamiento',

    // Process List
    'process_tracking': 'Seguimiento de Procesos',
    'process_tracking_desc': 'Gestione lotes activos, historial y nuevos servicios.',
    'new_process': 'Nuevo Proceso',
    'filters': 'Filtros',
    'in_process': 'EN PROCESO',
    'attention': 'ATENCIÓN',
    'current_phase': 'Fase Actual',
    'estimated_progress': 'Progreso Estimado',
    'view_details': 'Ver Detalles',
    'start_new_process': 'Iniciar Nuevo Proceso',
    'start_new_process_desc': 'Configure un nuevo lote y asigne una receta de maduración.',

    // Create Process Form
    'new_maturation_process': 'Nuevo Proceso de Maduración',
    'new_process_desc': 'Ingrese los datos del lote y configure los parámetros iniciales.',
    'client_info': 'Información del Cliente',
    'client_type': 'Tipo de Cliente',
    'client_name': 'Nombre del Cliente / Empresa',
    'batch_details': 'Detalles del Lote',
    'product': 'Producto',
    'quantity_kg': 'Cantidad (kg)',
    'control_device': 'Dispositivo Control',
    'recipe_planning': 'Receta y Planificación',
    'select_recipe_library': 'Seleccionar Receta de Biblioteca',
    'create_edit_custom': 'Crear/Editar Personalizada',

    // Users
    'user_management': 'Gestión de Usuarios',
    'new_user': 'Nuevo Usuario',
    'system_users': 'Usuarios del Sistema',
    'user': 'Usuario',
    'email': 'Email',
    'role': 'Rol',
    'status': 'Estado',
    'actions': 'Acciones',
    'edit': 'Editar',
    'active': 'Activo',
    'inactive': 'Inactivo',
    
    // Status
    'status_active': 'Activo',
    'status_warning': 'Advertencia',
    'status_alarm': 'Alarma',
    'status_offline': 'Fuera de Línea',
    'status_standby': 'En Espera',
    'status_powered_on': 'Encendido',
    'status_powered_off': 'Apagado',
    'completed': 'Completado',
    'turn_on': 'Encender',
    'turn_off': 'Apagar',
    'device_on': 'Dispositivo Encendido',
    'device_off': 'Dispositivo Apagado',
    'confirm_power_on': 'Encender equipo',
    'confirm_power_on_desc': 'Control no está activado para este equipo.',

    // Historical Modal
    'date_range': 'Rango de Fechas',
    'data_to_visualize': 'Datos a Visualizar',
    'generate_chart': 'Generar Gráfico',
    'temperature': 'Temperatura',
    'humidity': 'Humedad',
    'ethylene': 'Etileno',
    'co2': 'CO2',
    'process_summary': 'Resumen del Proceso',
    'viewing_history': 'Visualizando Historial',
    'close': 'Cerrar',

    // Device Card
    'rename_device': 'Renombrar dispositivo',
    'device_name_placeholder': 'Nombre del dispositivo',
    'name_updated': 'Nombre actualizado',
    'error_updating_name': 'Error al actualizar nombre',
    'device_disconnected': 'Dispositivo Desconectado',
    'last_connection': 'Última conexión',

    // Bitácora
    'event_log': 'Bitácora',
    'event_log_desc': 'Eventos y muestreos del equipo',
    'log_type': 'Tipo',
    'log_event': 'Evento',
    'log_sampling': 'Muestreo',
    'log_date_time': 'Fecha y hora',
    'log_description': 'Descripción',
    'log_temp': 'T°',
    'log_humidity': 'HR%',
    'log_ethylene': 'Etileno',
    'log_co2': 'CO₂%',
    'log_filter_all': 'Todos',
    'log_filter_events': 'Solo eventos',
    'log_filter_samplings': 'Solo muestreos',

    // Recipes
    'recipe_library': 'Biblioteca de Recetas',
    'recipe_library_desc': 'Protocolos estandarizados para operaciones en Perú.',
    'new_recipe': 'Nueva Receta',
    'edit_recipe': 'Editar Receta',
    'search_recipe_placeholder': 'Buscar receta (ej. Mango, Palta)...',
    'no_description': 'Sin descripción.',
    'total_duration': 'Duración Total',
    'hours': 'horas',
    'minutes': 'minutos',
    'save': 'Guardar',
    
    // Recipe Builder
    'protocol_name': 'Nombre del Protocolo',
    'protocol_placeholder': 'Ej. Mango Kent Exportación Europa',
    'product_label': 'Producto',
    'description_notes': 'Descripción / Notas',
    'description_placeholder': 'Detalles adicionales...',
    'logical_process_sequence': 'Secuencia Lógica de Proceso',
    
    // Phases
    'phase_homogenization': '1. Homogeneización',
    'phase_homogenization_desc': 'Uniformizar temperatura de la pulpa.',
    'phase_ripening': '2. Maduración / Disparo',
    'phase_ripening_desc': 'Inyección de etileno y control de gases.',
    'phase_venting': '3. Ventilación',
    'phase_venting_desc': 'Extracción de CO2 y aire fresco.',
    'phase_cooling': '4. Enfriamiento / Cooling',
    'phase_cooling_desc': 'Reducción temperatura a nivel de despacho.',
    
    // Phase Status/Controls
    'set_temperature': 'Set Temperatura',
    'set_time': 'Tiempo',
    'set_ethylene': 'Set Etileno',
    'set_co2': 'Set CO2',
    'set_humidity': 'Set Humedad',
    'target_product_temp': 'Temp. Objetivo Producto',
    'pulp_temp_control_note': '*Se controla por temp de pulpa',
    
    // Units/Labels
    'unit_hours': 'Horas',
    'unit_minutes': 'Minutos',
    'unit_ppm': 'ppm',
    'short_homog': 'Homog.',
    'short_ripening': 'Maduración',
    'short_venting': 'Vent.',
    'short_cooling': 'Frío',

    // User Manual
    'user_manual': 'Manual de Usuario',
    'user_manual_desc': 'Guía completa del sistema con capturas y explicaciones.',
    'table_of_contents': 'Tabla de Contenidos',
    'manual_intro': 'Introducción al Sistema',
    'manual_intro_desc': 'Sistema integral de gestión y monitoreo en tiempo real para contenedores refrigerados REEFER de 40 pies, diseñado para el control automatizado de procesos de maduración de frutas.',
    
    // Manual Sections
    'section_login': '1. Inicio de Sesión',
    'section_login_desc': 'Acceso al sistema mediante credenciales de usuario.',
    'section_dashboard': '2. Panel de Control',
    'section_dashboard_desc': 'Vista general de la flota y métricas operacionales.',
    'section_device_control': '3. Control de Dispositivos',
    'section_device_control_desc': 'Gestión individual de equipos en modo manual.',
    'section_device_detail': '4. Detalle de Dispositivo',
    'section_device_detail_desc': 'Información completa y telemetría en tiempo real.',
    'section_monitoring': '5. Monitoreo y Análisis',
    'section_monitoring_desc': 'Gráficas históricas y métricas de rendimiento.',
    'section_processes': '6. Seguimiento de Procesos (PLUS)',
    'section_processes_desc': 'Gestión de lotes y seguimiento de maduración.',
    'section_recipes': '7. Biblioteca de Recetas (PLUS)',
    'section_recipes_desc': 'Protocolos estandarizados y recetas personalizadas.',
    'section_recipe_builder': '8. Constructor de Recetas',
    'section_recipe_builder_desc': 'Creación de protocolos paso a paso.',
    'section_users': '9. Gestión de Usuarios (PLUS)',
    'section_users_desc': 'Administración de cuentas y permisos.',
    'section_profile': '10. Perfil de Usuario',
    'section_profile_desc': 'Configuración personal y preferencias.',
    
    // Login Section Details
    'login_step1': 'Ingrese su correo electrónico corporativo.',
    'login_step2': 'Ingrese su contraseña asignada.',
    'login_step3': 'Presione \"Iniciar Sesión\" para acceder al sistema.',
    'login_step4': 'El sistema validará las credenciales y lo redirigirá automáticamente al Dashboard.',
    'login_note': 'Si olvida su contraseña, contacte al administrador del sistema para restablecerla.',
    
    // Dashboard Section Details
    'dashboard_step1': 'Visualice las 4 métricas generales en la parte superior: Unidades Activas (3/5), Alarmas Activas (2), Procesos Completados (47 esta semana) y Consumo Total (2,847 kWh).',
    'dashboard_step2': 'Cada tarjeta de dispositivo muestra el estado con código de colores: Verde (Activo), Naranja (Advertencia), Azul (Homogenización), Gris (Offline).',
    'dashboard_step3': 'Revise los valores en tiempo real de cada REEFER: Temperatura, Humedad, Etileno (C₂H₄) y CO₂.',
    'dashboard_step4': 'Observe la receta activa y fase actual del proceso en la parte inferior de cada tarjeta.',
    'dashboard_step5': 'Use la barra de búsqueda superior para filtrar dispositivos por ID o estado.',
    'dashboard_step6': 'Haga clic en cualquier tarjeta para acceder al panel de control detallado del dispositivo.',
    'dashboard_note': 'Los colores de borde indican urgencia: Verde (Normal), Naranja (Requiere Atención), Rojo (Alarma Crítica). El Dashboard se actualiza automáticamente cada 30 segundos.',
    
    // Device Control Details
    'control_step1': 'Seleccione un dispositivo haciendo clic en su tarjeta desde el Dashboard.',
    'control_step2': 'Verifique el estado de encendido en la parte superior (Power ON/OFF con indicador verde).',
    'control_step3': 'Revise los valores actuales en el panel azul: Temperatura actual, Humedad actual, Etileno actual y CO₂ actual.',
    'control_step4': 'Active el modo de control manual desactivando el control automático.',
    'control_step5': 'Ajuste los parámetros objetivo respetando los rangos permitidos: Temperatura (5°C - 25°C), Humedad (70% - 95%), Etileno (0 - 200 ppm).',
    'control_step6': 'Observe las indicaciones de rango debajo de cada campo de entrada.',
    'control_step7': 'Presione \"Aplicar Cambios\" y confirme en el diálogo de confirmación para enviar los nuevos setpoints al dispositivo.',
    'control_note': 'Los cambios solo se pueden aplicar si el dispositivo está encendido y en modo manual. El sistema confirmará la aplicación exitosa de los cambios con una notificación.',
    
    // Device Detail Details
    'detail_step1': 'Acceda haciendo clic en cualquier tarjeta de dispositivo del Dashboard para ver su información completa.',
    'detail_step2': 'En la vista superior, observe las 4 métricas principales con tendencias: Temperatura (↑+0.3°C en 1h), Humedad (↓-2% en 1h), Etileno (Estable), CO₂ (↑+0.2% en 1h).',
    'detail_step3': 'Revise el panel azul de progreso del proceso activo: nombre de receta (ej: Mango Kent Exportación), fase actual (Maduración - Hora 32 de 48), y porcentaje de progreso (67%).',
    'detail_step4': 'Consulte la tabla de \"Últimas 12 Horas\" que muestra registros cada 30 minutos con Temperatura, Humedad y CO₂.',
    'detail_step5': 'Use el botón \"Datos Históricos\" para abrir el modal de calendario y consultar rangos de fechas específicos.',
    'detail_step6': 'Navegue entre las pestañas \"Operación\" (control manual) y \"Análisis\" (gráficas históricas) según necesidad.',
    'detail_note': 'Los datos históricos se almacenan por 90 días. Las flechas de tendencia (↑↓) indican cambios en la última hora. La tabla muestra 8 de 24 registros disponibles.',
    
    // Monitoring Details
    'monitoring_step1': 'Navegue a \"Monitoreo y Análisis\" desde el menú lateral izquierdo.',
    'monitoring_step2': 'Seleccione un dispositivo del selector para ver sus métricas detalladas en gráficas.',
    'monitoring_step3': 'Configure el rango de fechas usando el calendario: puede consultar desde 1 hora hasta 90 días atrás.',
    'monitoring_step4': 'Active o desactive las métricas en la leyenda de la gráfica: Temperatura (azul), Humedad (verde), CO₂ (naranja).',
    'monitoring_step5': 'Use los botones de zoom y pan para explorar períodos específicos con detalle.',
    'monitoring_note': 'Las gráficas muestran las últimas 12 horas por defecto. Puede exportar los datos en formato CSV para análisis offline o generar reportes en PDF.',
    
    // Processes Details
    'processes_step1': 'Acceda a \"Seguimiento (Plus)\" desde el menú lateral para ver todos los lotes de maduración.',
    'processes_step2': 'Visualice los 4 estados de procesos: En Proceso (verde), Homogenización (azul), Ventilación (naranja), Completado (gris).',
    'processes_step3': 'Para cada proceso, observe: Lote# (ej: MAG-2024-001), Cliente (Exportadora San Miguel SAC), Producto (Mango Kent), Dispositivo (REEFER-001).',
    'processes_step4': 'Revise el progreso de las 4 fases en la barra inferior: Homogenización (24h ✓), Maduración (32/48h activo), Ventilación (0/8h), Enfriamiento (0/12h).',
    'processes_step5': 'Haga clic en \"Nuevo Proceso\" para iniciar un nuevo lote de maduración.',
    'processes_step6': 'Complete el formulario: datos del cliente, número de lote, producto, peso, seleccione receta de la biblioteca.',
    'processes_step7': 'Asigne un dispositivo disponible y confirme para que el sistema inicie automáticamente el proceso siguiendo la receta.',
    'processes_note': 'El sistema rastreará automáticamente cada fase y enviará notificaciones al completar cada etapa. Los procesos completados se archivan y pueden consultarse en el historial.',
    
    // Recipes Details
    'recipes_step1': 'Navegue a \"Recetas (Plus)\" desde el menú para acceder a la biblioteca de protocolos de maduración.',
    'recipes_step2': 'Visualice las recetas precargadas: Mango Kent (92h), Palta Hass (72h), Plátano (72h), Mango Edward (68h).',
    'recipes_step3': 'Cada tarjeta muestra: producto, duración total, y configuración de las 4 fases con tiempos específicos.',
    'recipes_step4': 'Observe los detalles de cada fase: 1. Homogenización (temp, humedad, tiempo), 2. Maduración (temp, humedad, etileno, tiempo), 3. Ventilación (temp, humedad, tiempo), 4. Enfriamiento (temp, humedad, tiempo).',
    'recipes_step5': 'Haga clic en \"Nueva Receta\" para crear un protocolo personalizado siguiendo la secuencia obligatoria de fases.',
    'recipes_note': 'Las recetas precargadas están optimizadas para productos peruanos de exportación. No puede modificar recetas del sistema, pero puede duplicarlas y ajustarlas.',
    
    // Recipe Builder Details
    'builder_step1': 'Desde \"Recetas\", presione \"Nueva Receta\" para abrir el constructor de protocolos.',
    'builder_step2': 'Ingrese un nombre descriptivo (ej: \"Mango Kent Exportación Premium\") y seleccione el producto.',
    'builder_step3': 'Configure FASE 1 - HOMOGENIZACIÓN: Temperatura (°C), Humedad (%), Tiempo (horas). Esta fase iguala la temperatura de toda la fruta sin aplicar etileno.',
    'builder_step4': 'Configure FASE 2 - MADURACIÓN: Temperatura (°C), Humedad (%), Etileno (ppm), Tiempo (horas). Esta es la fase crítica donde se acelera la maduración.',
    'builder_step5': 'Configure FASE 3 - VENTILACIÓN: Temperatura (°C), Humedad (%), Tiempo (horas). Elimina gases residuales (C₂H₄ y CO₂) con ventilación al 100%.',
    'builder_step6': 'Configure FASE 4 - ENFRIAMIENTO: Temperatura (°C), Humedad (%), Tiempo (horas). Reduce temperatura gradualmente para detener maduración.',
    'builder_step7': 'Respete los rangos permitidos: Temperatura (5-25°C), Humedad (70-95%), Etileno (0-200ppm), Tiempo (1-72h por fase).',
    'builder_step8': 'Observe la duración total calculada automáticamente en el panel inferior (suma de las 4 fases).',
    'builder_step9': 'Revise las notas informativas de cada fase (ℹ️) que explican el propósito y consideraciones especiales.',
    'builder_step10': 'Presione \"Guardar\" para agregar la receta a la biblioteca y usarla en nuevos procesos de maduración.',
    'builder_note': 'La secuencia de fases es inviolable (Homog→Maduración→Ventilación→Enfriamiento) y sigue la lógica técnica de maduración controlada. Evite tiempos muy cortos (<6h) o temperaturas extremas.',
  },
  en: {
    // Navigation
    'dashboard': 'Dashboard',
    'control': 'Device Control',
    'monitoring': 'Monitoring & Analysis',
    'processes': 'Tracking (Plus)',
    'recipes': 'Recipes (Plus)',
    'users': 'Users (Plus)',
    'settings': 'Settings',
    'help': 'User Manual',
    'logout': 'Log Out',
    'profile': 'My Profile',
    'operator': 'Operator',
    'search_placeholder': 'Search device...',
    'search_process_placeholder': 'Search by client, batch or product...',

    // Login
    'welcome_back': 'Welcome back',
    'enter_credentials': 'Enter your credentials to access the control panel',
    'password': 'Password',
    'login_button': 'Log In',
    'login_subtitle': 'Real-time management and monitoring system for refrigerated containers.',
    'configuring': 'Configuring...',
    'init_admin': 'Initialize Admin Account (Dev)',
    'session_success': 'Session started successfully',
    'admin_ready': 'Admin account ready',
    'login_error': 'Error logging in',
    'email_label': 'Email Address',

    // Dashboard
    'active_units': 'Active Units',
    'active_alarms': 'Active Alarms',
    'completed_processes': 'Completed Processes',
    'total_consumption': 'Total Consumption',
    'fleet_status': 'Fleet Status',
    'of_total': 'Of {{total}} total',
    'require_attention': 'Require attention',
    'this_week': 'This week',
    'historical_accumulated': 'Historical accumulated',
    'error_loading_devices': 'Error loading devices',

    // Device Detail
    'device_not_found': 'Device not found',
    'operation': 'Operation',
    'analysis': 'Analysis',
    'current_process_status': 'Current Process Status',
    'operational_data': 'Operational Data',
    'no_active_process': 'No active process',
    'power_consumption': 'Power Consumption',
    'energy_consumption_period': 'Energy consumption (period)',
    'total_accumulated': 'Total Accumulated',
    'defrost_interval': 'Defrost Interval',
    'evaporation_coil': 'Evaporation Coil',
    'recipe': 'Recipe',
    'phase': 'Phase',
    'start': 'Start',
    'estimated_end': 'Estimated End',
    'back': 'Back',
    'historical_data': 'Historical Data',
    'last_12_hours': 'Last 12 Hours',

    // Control Panel
    'manual_mode': 'Manual',
    'homogenization': 'Homogenization',
    'ripening': 'Ripening',
    'ventilation': 'Ventilation',
    'cooling': 'Cooling',
    'device_status': 'Device Status',
    'equipo_estado_actual': 'Current equipment state',
    'controls_available_when_on': 'Temperature, humidity and gas controls are available when the equipment is on.',
    'climatization': 'Climatization',
    'target_temperature': 'Target Temperature',
    'relative_humidity': 'Relative Humidity',
    'gases_ventilation': 'Gases & Ventilation',
    'ethylene_injection': 'Ethylene Injection',
    'ventilation_speed': 'Ventilation Speed',
    'apply_changes': 'Apply Changes',
    'confirm_changes': 'Confirm Changes',
    'applying': 'Applying...',
    'confirm_changes_desc': 'The following changes will be applied to the device:',
    'environmental_conditions': 'Environmental Conditions',
    'target_co2': 'Target CO2',
    'duration': 'Duration',
    'preview': 'Preview',
    'start_process': 'Start Process',
    'starting': 'Starting...',
    'cancel': 'Cancel',
    'final_temperature': 'Final Temperature',
    'estimated_duration': 'Estimated Duration',
    'co2_limit': 'CO2 Limit',
    'process_time': 'Process Time',
    'max_duration': 'Max Duration',
    'cooling_ramp': 'Cooling Ramp',

    // Process List
    'process_tracking': 'Process Tracking',
    'process_tracking_desc': 'Manage active batches, history, and new services.',
    'new_process': 'New Process',
    'filters': 'Filters',
    'in_process': 'IN PROCESS',
    'attention': 'ATTENTION',
    'current_phase': 'Current Phase',
    'estimated_progress': 'Estimated Progress',
    'view_details': 'View Details',
    'start_new_process': 'Start New Process',
    'start_new_process_desc': 'Configure a new batch and assign a maturation recipe.',

    // Create Process Form
    'new_maturation_process': 'New Maturation Process',
    'new_process_desc': 'Enter batch data and configure initial parameters.',
    'client_info': 'Client Information',
    'client_type': 'Client Type',
    'client_name': 'Client Name / Company',
    'batch_details': 'Batch Details',
    'product': 'Product',
    'quantity_kg': 'Quantity (kg)',
    'control_device': 'Control Device',
    'recipe_planning': 'Recipe & Planning',
    'select_recipe_library': 'Select Recipe from Library',
    'create_edit_custom': 'Create/Edit Custom',

    // Users
    'user_management': 'User Management',
    'new_user': 'New User',
    'system_users': 'System Users',
    'user': 'User',
    'email': 'Email',
    'role': 'Role',
    'status': 'Status',
    'actions': 'Actions',
    'edit': 'Edit',
    'active': 'Active',
    'inactive': 'Inactive',

    // Status
    'status_active': 'Active',
    'status_warning': 'Warning',
    'status_alarm': 'Alarm',
    'status_offline': 'Offline',
    'status_standby': 'Standby',
    'status_powered_on': 'On',
    'status_powered_off': 'Off',
    'completed': 'Completed',
    'turn_on': 'Turn On',
    'turn_off': 'Turn Off',
    'device_on': 'Device On',
    'device_off': 'Device Off',
    'confirm_power_on': 'Turn on device',
    'confirm_power_on_desc': 'Control is not enabled for this device.',

    // Historical Modal
    'date_range': 'Date Range',
    'data_to_visualize': 'Data to Visualize',
    'generate_chart': 'Generate Chart',
    'temperature': 'Temperature',
    'humidity': 'Humidity',
    'ethylene': 'Ethylene',
    'co2': 'CO2',
    'process_summary': 'Process Summary',
    'viewing_history': 'Viewing History',
    'close': 'Close',

    // Device Card
    'rename_device': 'Rename device',
    'device_name_placeholder': 'Device name',
    'name_updated': 'Name updated',
    'error_updating_name': 'Error updating name',
    'device_disconnected': 'Device Disconnected',
    'last_connection': 'Last connection',

    // Event log
    'event_log': 'Event Log',
    'event_log_desc': 'Events and samplings for this unit',
    'log_type': 'Type',
    'log_event': 'Event',
    'log_sampling': 'Sampling',
    'log_date_time': 'Date & time',
    'log_description': 'Description',
    'log_temp': 'Temp',
    'log_humidity': 'RH%',
    'log_ethylene': 'Ethylene',
    'log_co2': 'CO₂%',
    'log_filter_all': 'All',
    'log_filter_events': 'Events only',
    'log_filter_samplings': 'Samplings only',

    // Recipes
    'recipe_library': 'Recipe Library',
    'recipe_library_desc': 'Standardized protocols for operations.',
    'new_recipe': 'New Recipe',
    'edit_recipe': 'Edit Recipe',
    'search_recipe_placeholder': 'Search recipe (e.g., Mango, Avocado)...',
    'no_description': 'No description.',
    'total_duration': 'Total Duration',
    'hours': 'hours',
    'minutes': 'minutes',
    'save': 'Save',
    
    // Recipe Builder
    'protocol_name': 'Protocol Name',
    'protocol_placeholder': 'E.g., Mango Kent Export Europe',
    'product_label': 'Product',
    'description_notes': 'Description / Notes',
    'description_placeholder': 'Additional details...',
    'logical_process_sequence': 'Logical Process Sequence',
    
    // Phases
    'phase_homogenization': '1. Homogenization',
    'phase_homogenization_desc': 'Uniformize pulp temperature.',
    'phase_ripening': '2. Ripening / Trigger',
    'phase_ripening_desc': 'Ethylene injection and gas control.',
    'phase_venting': '3. Venting',
    'phase_venting_desc': 'CO2 extraction and fresh air.',
    'phase_cooling': '4. Cooling',
    'phase_cooling_desc': 'Reduce temperature to dispatch level.',
    
    // Phase Status/Controls
    'set_temperature': 'Set Temperature',
    'set_time': 'Time',
    'set_ethylene': 'Set Ethylene',
    'set_co2': 'Set CO2',
    'set_humidity': 'Set Humidity',
    'target_product_temp': 'Target Product Temp',
    'pulp_temp_control_note': '*Controlled by pulp temp',
    
    // Units/Labels
    'unit_hours': 'Hours',
    'unit_minutes': 'Minutes',
    'unit_ppm': 'ppm',
    'short_homog': 'Homog.',
    'short_ripening': 'Ripening',
    'short_venting': 'Vent.',
    'short_cooling': 'Cooling',

    // User Manual
    'user_manual': 'User Manual',
    'user_manual_desc': 'Complete system guide with screenshots and explanations.',
    'table_of_contents': 'Table of Contents',
    'manual_intro': 'System Introduction',
    'manual_intro_desc': 'Comprehensive real-time management and monitoring system for 40-foot REEFER refrigerated containers, designed for automated control of fruit ripening processes.',
    
    // Manual Sections
    'section_login': '1. Login',
    'section_login_desc': 'System access through user credentials.',
    'section_dashboard': '2. Dashboard',
    'section_dashboard_desc': 'Fleet overview and operational metrics.',
    'section_device_control': '3. Device Control',
    'section_device_control_desc': 'Individual equipment management in manual mode.',
    'section_device_detail': '4. Device Detail',
    'section_device_detail_desc': 'Complete information and real-time telemetry.',
    'section_monitoring': '5. Monitoring & Analysis',
    'section_monitoring_desc': 'Historical charts and performance metrics.',
    'section_processes': '6. Process Tracking (PLUS)',
    'section_processes_desc': 'Batch management and ripening tracking.',
    'section_recipes': '7. Recipe Library (PLUS)',
    'section_recipes_desc': 'Standardized protocols and custom recipes.',
    'section_recipe_builder': '8. Recipe Builder',
    'section_recipe_builder_desc': 'Step-by-step protocol creation.',
    'section_users': '9. User Management (PLUS)',
    'section_users_desc': 'Account and permissions administration.',
    'section_profile': '10. User Profile',
    'section_profile_desc': 'Personal settings and preferences.',
    
    // Login Section Details
    'login_step1': 'Enter your corporate email address.',
    'login_step2': 'Enter your assigned password.',
    'login_step3': 'Press "Log In" to access the system.',
    'login_note': 'The system will validate your credentials and redirect you to the Dashboard if correct.',
    
    // Dashboard Section Details
    'dashboard_step1': 'View general metrics: Active Units, Alarms, Completed Processes, and Consumption.',
    'dashboard_step2': 'Review each device status through information cards.',
    'dashboard_step3': 'Use the search bar to filter specific devices.',
    'dashboard_step4': 'Click any card to access device details.',
    'dashboard_note': 'Colors indicate status: Green (operational), Orange (warning), Red (alarm), Gray (offline).',
    
    // Device Control Details
    'control_step1': 'Select the device from the Dashboard.',
    'control_step2': 'Verify that the equipment is powered on (top toggle).',
    'control_step3': 'Activate manual control mode.',
    'control_step4': 'Adjust desired parameters: temperature, humidity, ethylene, ventilation.',
    'control_step5': 'Press "Apply Changes" and confirm the operation.',
    'control_note': 'You can only modify parameters if the equipment is on and manual control is active.',
    
    // Device Detail Details
    'detail_step1': 'Access from Dashboard by clicking on a card.',
    'detail_step2': 'The "Operation" tab shows real-time telemetry and manual control.',
    'detail_step3': 'The "Analysis" tab presents historical charts.',
    'detail_step4': 'Use the "Historical Data" button to query specific ranges.',
    'detail_note': 'Data updates automatically every 30 seconds.',
    
    // Monitoring Details
    'monitoring_step1': 'Navigate to "Monitoring & Analysis" from the side menu.',
    'monitoring_step2': 'Select a device to view detailed metrics.',
    'monitoring_step3': 'Configure date range for historical analysis.',
    'monitoring_step4': 'Toggle metrics on/off in charts as needed.',
    'monitoring_note': 'You can export data or generate reports for offline analysis.',
    
    // Processes Details
    'processes_step1': 'Access "Tracking (Plus)" from the menu.',
    'processes_step2': 'View all active batches with their status and progress.',
    'processes_step3': 'Use "New Process" to start a ripening batch.',
    'processes_step4': 'Complete client data, batch info, and select recipe.',
    'processes_step5': 'Assign device and confirm to start.',
    'processes_note': 'The system will automatically track each process phase.',
    
    // Recipes Details
    'recipes_step1': 'Navigate to "Recipes (Plus)" from the menu.',
    'recipes_step2': 'Search recipes by product (Mango, Avocado, etc).',
    'recipes_step3': 'Click "View Details" to inspect the protocol.',
    'recipes_step4': 'Use "New Recipe" to create custom protocols.',
    'recipes_note': 'Pre-loaded recipes are optimized for the Peruvian market.',
    
    // Recipe Builder Details
    'builder_step1': 'From "Recipes", press "New Recipe".',
    'builder_step2': 'Enter protocol name and product.',
    'builder_step3': 'Configure each phase in order: Homogenization → Ripening → Venting → Cooling.',
    'builder_step4': 'Define specific parameters for each phase.',
    'builder_step5': 'Save the recipe to use in future processes.',
    'builder_note': 'The phase sequence is mandatory and follows the technical ripening logic.',
    
    // Users Details
    'users_step1': 'Access "Users (Plus)" from the menu.',
    'users_step2': 'View the complete list of system users.',
    'users_step3': 'Use "New User" to add accounts.',
    'users_step4': 'Assign roles (Administrator, Operator, Supervisor).',
    'users_step5': 'Activate or deactivate users as needed.',
    'users_note': 'Only administrators can manage users.',
    
    // Profile Details
    'profile_step1': 'Click on your avatar or name in the header.',
    'profile_step2': 'Update your personal information: name, email, phone.',
    'profile_step3': 'Change your password if needed.',
    'profile_step4': 'Configure preferences: language, theme, temperature units.',
    'profile_note': 'Changes are applied immediately throughout the system.',
  }
};

const defaultContext: SettingsContextType = {
  language: 'es',
  setLanguage: () => {},
  theme: 'light',
  setTheme: () => {},
  tempUnit: 'C',
  toggleTempUnit: () => {},
  convertTemp: (c) => c,
  formatTemp: (c) => `${c}°C`,
  t: (key) => key,
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');
  const [theme, setThemeState] = useState<Theme>('light');
  const [tempUnit, setTempUnit] = useState<TempUnit>('C');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') as Language;
    const savedTheme = localStorage.getItem('app_theme') as Theme;
    const savedUnit = localStorage.getItem('app_temp_unit') as TempUnit;

    if (savedLang && (savedLang === 'es' || savedLang === 'en')) {
      setLanguageState(savedLang);
    }

    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeState(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
       setThemeState('dark');
    }

    if (savedUnit && (savedUnit === 'C' || savedUnit === 'F')) {
      setTempUnit(savedUnit);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app_theme', newTheme);
  };

  const toggleTempUnit = () => {
    const newUnit = tempUnit === 'C' ? 'F' : 'C';
    setTempUnit(newUnit);
    localStorage.setItem('app_temp_unit', newUnit);
  };

  const convertTemp = (celsius: number): number => {
    if (tempUnit === 'C') return celsius;
    return parseFloat(((celsius * 9/5) + 32).toFixed(1));
  };

  const formatTemp = (celsius: number): string => {
    return `${convertTemp(celsius)}°${tempUnit}`;
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const t = (key: string, replacements?: Record<string, string> | string) => {
    let term = translations[language][key] || key;
    
    if (typeof replacements === 'string') {
        return term === key ? replacements : term;
    }

    if (replacements && typeof replacements === 'object') {
      Object.entries(replacements).forEach(([k, v]) => {
        term = term.replace(`{{${k}}}`, v);
      });
    }
    
    return term;
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, theme, setTheme, tempUnit, toggleTempUnit, convertTemp, formatTemp, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    // Return default context for isolated renders/previews instead of throwing
    return defaultContext;
  }
  return context;
};