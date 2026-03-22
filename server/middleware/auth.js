/**
 * Authentication Middleware
 * Simple session-based auth with JWT tokens
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getFiltered } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'gearbase-dev-secret-change-in-production';

const ROLE_PERMISSIONS = {
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

function generateToken(staff) {
  return jwt.sign(
    { staff_id: staff.staff_id, email: staff.email, role: staff.role, name: staff.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Middleware: attach user to req if token present
 */
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Middleware: require authenticated user
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: '請先登入' });
  }
  next();
}

/**
 * Check if user has permission
 */
function hasPermission(user, operation) {
  if (!user) return false;
  const role = user.role || 'viewer';
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
  if (perms.includes('*')) return true;
  return perms.includes(operation);
}

/**
 * Middleware factory: require specific permission
 */
function requirePermission(operation, message) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '請先登入' });
    }
    if (!hasPermission(req.user, operation)) {
      return res.status(403).json({ error: message || `權限不足：無法執行「${operation}」操作` });
    }
    next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  JWT_SECRET,
  generateToken,
  hashPassword,
  verifyPassword,
  authMiddleware,
  requireAuth,
  hasPermission,
  requirePermission,
};
