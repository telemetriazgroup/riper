import { getStoredUser } from '@/app/lib/auth';
import { isGourmetSession } from '@/app/lib/gourmet';

/** Reglas de rol: Visualizador sólo lectura; Operador sin recetas ni nuevo seguimiento; Administrador escritura recetas y nuevos seguimientos. */

export function getAppRole(): string | undefined {
  return getStoredUser()?.role;
}

export function isViewer(): boolean {
  return getAppRole() === 'viewer';
}

export function canCreateRipeningProcess(): boolean {
  const r = getAppRole();
  return r === 'admin' || r === 'superadmin';
}

export function canCancelRipeningTracking(): boolean {
  const r = getAppRole();
  return r === 'operator' || r === 'admin' || r === 'superadmin';
}

export function canPauseRipeningTracking(): boolean {
  return canCancelRipeningTracking();
}

export function canReactivateRipeningTracking(): boolean {
  return getAppRole() === 'superadmin';
}

export function canRegisterRipeningSampling(): boolean {
  return canCancelRipeningTracking();
}

export function canEditRecipesAndCatalog(): boolean {
  const r = getAppRole();
  return r === 'admin' || r === 'superadmin';
}

/** CRUD catálogo de empresas (mismo criterio que recetas/productos). */
export function canManageCompanies(): boolean {
  return canEditRecipesAndCatalog();
}

/** Ver las 5 máquinas del túnel (solo superadmin / admin fuera de cuenta Gourmet). */
export function canViewGourmetTunnelUnitDevices(): boolean {
  if (isGourmetSession()) return false;
  const r = getAppRole();
  return r === 'admin' || r === 'superadmin';
}

/** Panel Homogenización / manual: Visualizador no ejecuta ni inicia procesos del panel. */
export function canOperateDeviceControl(): boolean {
  return !isViewer();
}

/** Archivar/eliminar fila soft seguimiento (API DELETE) sólo admins. */
export function canHardDeleteRipeningRow(): boolean {
  return canEditRecipesAndCatalog();
}

/** Eliminar historial tabla sesiones control sólo admins. */
export function canDeleteDeviceControlRecord(): boolean {
  return canEditRecipesAndCatalog();
}
