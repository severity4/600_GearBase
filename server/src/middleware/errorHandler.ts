import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Log to ErrorLog table
  prisma.errorLog.create({
    data: {
      function_name: (err as any).source || 'unknown',
      error_message: err.message,
      stack_trace: err.stack || '',
      severity: err instanceof AppError ? 'warning' : 'error',
    },
  }).catch(() => { /* don't crash on logging failure */ });

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
}
