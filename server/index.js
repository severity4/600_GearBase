/**
 * 映奧創意工作室 - 器材管理租借系統
 * Node.js + Express + PostgreSQL Server
 */
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { authMiddleware } = require('./middleware/auth');
const { migrate } = require('./migrate');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(authMiddleware);

// Static files
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/rentals', require('./routes/rentals'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/venues', require('./routes/venues'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/customer', require('./routes/customer-app'));

const { router: dashboardRouter, simpleCrud } = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRouter);

// Simple CRUD routes for remaining entities
app.use('/api/storage-locations', simpleCrud('Storage_Locations', 'location_id', 'LOC', 'create'));
app.use('/api/discount-rules', simpleCrud('Discount_Rules', 'rule_id', 'DR', 'manage_rules'));
app.use('/api/accessory-bindings', simpleCrud('Accessory_Bindings', 'binding_id', 'AB', 'create'));
app.use('/api/overdue-rules', simpleCrud('Overdue_Rules', 'overdue_rule_id', 'OR', 'manage_rules'));
app.use('/api/wear-tolerance', simpleCrud('Wear_Tolerance', 'tolerance_id', 'WT', 'manage_rules'));
app.use('/api/print-templates', simpleCrud('Print_Templates', 'template_id', 'TPL', 'manage_rules'));
app.use('/api/damage-records', simpleCrud('Damage_Records', 'damage_id', 'DM', 'create'));
app.use('/api/credit-notes', simpleCrud('Credit_Notes', 'credit_note_id', 'CN', 'approve_credit_note'));
app.use('/api/maintenance-logs', simpleCrud('Maintenance_Logs', 'log_id', 'ML', 'create'));
app.use('/api/inventory-logs', simpleCrud('Inventory_Logs', 'log_id', 'IL', 'create'));
app.use('/api/stocktake-plans', simpleCrud('Stocktake_Plans', 'plan_id', 'SP', 'create'));
app.use('/api/stocktake-results', simpleCrud('Stocktake_Results', 'result_id', 'SR', 'create'));

// Serve frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'staff.html'));
});

app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'customer.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  try {
    // Run migrations on startup
    await migrate();
    console.log('Database migration completed.');
  } catch (err) {
    console.error('Migration error (non-fatal):', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GearBase server running on port ${PORT}`);
    console.log(`Staff app:    http://localhost:${PORT}/`);
    console.log(`Customer app: http://localhost:${PORT}/customer`);
  });
}

start();

module.exports = app;
