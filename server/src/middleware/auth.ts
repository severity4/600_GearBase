import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AppError } from './errorHandler';

// Simple JWT-like token using HMAC (no external dep needed)
const SECRET = process.env.JWT_SECRET || 'gearbase-dev-secret-change-in-production';
const TOKEN_EXPIRY_HOURS = 24;

interface TokenPayload {
  staff_id: string;
  email: string;
  role: string;
  exp: number;
}

export function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const data: TokenPayload = {
    ...payload,
    exp: Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload: TokenPayload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Role permission matrix (mirrors GAS ROLE_PERMISSIONS)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  manager: [
    'read', 'create', 'update', 'delete',
    'approve_discount', 'approve_credit_note', 'approve_cancellation',
    'manage_staff', 'manage_rules', 'run_reports',
  ],
  staff: [
    'read', 'create', 'update',
    'process_check_in', 'process_check_out', 'create_rental', 'create_payment',
  ],
  viewer: ['read'],
};

export const ROLE_LABELS: Record<string, string> = {
  admin: '管理員', manager: '經理', staff: '員工', viewer: '僅檢視',
};

export const PERMISSION_LABELS: Record<string, string> = {
  '*': '完整權限', read: '查看資料', create: '新增資料', update: '編輯資料',
  delete: '刪除資料', approve_discount: '核准折扣', approve_credit_note: '核准折讓單',
  approve_cancellation: '核准取消', manage_staff: '管理員工', manage_rules: '管理規則',
  run_reports: '執行報表', process_check_in: '處理取件', process_check_out: '處理還件',
  create_rental: '建立租借單', create_payment: '收款',
};

export function getRolePermissions() {
  return { roles: ROLE_PERMISSIONS, labels: ROLE_LABELS, permissionLabels: PERMISSION_LABELS };
}

function hasPermission(role: string, operation: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
  if (perms.includes('*')) return true;
  return perms.includes(operation);
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication middleware - extracts and validates token
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Allow unauthenticated access with viewer role
    req.user = { staff_id: '', email: '', role: 'viewer', exp: 0 };
    return next();
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return next(new AppError('Token 無效或已過期', 401));
  }
  req.user = payload;
  next();
}

/**
 * Authorization middleware factory - requires specific permission
 */
export function requirePermission(operation: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.role || 'viewer';
    if (!hasPermission(role, operation)) {
      return next(new AppError(`權限不足：角色「${ROLE_LABELS[role] || role}」無法執行「${PERMISSION_LABELS[operation] || operation}」操作`, 403));
    }
    next();
  };
}
