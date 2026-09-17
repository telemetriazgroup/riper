import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-JWT_SECRET-in-production';

export function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  const q =
    typeof req.query?.access_token === 'string'
      ? req.query.access_token
      : typeof req.query?.token === 'string'
        ? req.query.token
        : null;
  const token = h && h.startsWith('Bearer ') ? h.slice(7) : q;
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'missing token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      is_superuser: Boolean(payload.is_superuser),
    };
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token', message: 'invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  const r = req.user?.role;
  if (r === 'superadmin' || r === 'admin') return next();
  return res.status(403).json({ error: 'forbidden', message: 'admin required' });
}

/** Auditoría — solo cuenta con rol superadmin */
export function requireSuperAdmin(req, res, next) {
  if (req.user?.role === 'superadmin') return next();
  return res.status(403).json({ error: 'forbidden', message: 'superadmin only' });
}

/** Superusuario: rol superadmin o flag is_superuser */
export function requireSuperUser(req, res, next) {
  if (req.user?.role === 'superadmin' || req.user?.is_superuser) return next();
  return res.status(403).json({ error: 'forbidden', message: 'superuser required' });
}

/** Operador, admin o superadmin (uso legacy; nuevas rutas preferir requireOperatorPlus) */
export function requireStaff(req, res, next) {
  const r = req.user?.role;
  if (r === 'superadmin' || r === 'admin' || r === 'operator') return next();
  return res.status(403).json({ error: 'forbidden', message: 'staff required' });
}

/** Seguimiento: muestreo, aplicar valores, cancelar proceso — Visualizador excluido */
export function requireOperatorPlus(req, res, next) {
  const r = req.user?.role;
  if (r === 'superadmin' || r === 'admin' || r === 'operator') return next();
  return res.status(403).json({ error: 'forbidden', message: 'operator or admin required' });
}
