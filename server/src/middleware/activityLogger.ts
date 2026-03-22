import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

const LOGGED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function activityLogger(req: Request, res: Response, next: NextFunction) {
  if (!LOGGED_METHODS.includes(req.method)) return next();
  // Skip auth and health endpoints
  if (req.path.startsWith('/api/auth') || req.path === '/api/health') return next();

  const startTime = Date.now();

  res.on('finish', () => {
    if (res.statusCode >= 400) return; // Don't log failed requests

    const action = `${req.method} ${req.path}`;
    const pathParts = req.path.replace('/api/', '').split('/');
    const targetType = pathParts[0] || '';
    const targetId = pathParts[1] || '';

    prisma.activityLog.create({
      data: {
        staff_id: req.user?.staff_id || 'anonymous',
        staff_name: req.user?.email || '',
        action,
        target_type: targetType,
        target_id: targetId,
        description: `${action} (${res.statusCode}) ${Date.now() - startTime}ms`,
        ip_info: req.ip || '',
      },
    }).catch(() => { /* silent */ });
  });

  next();
}
