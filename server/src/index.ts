import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// ==================== API Routes ====================
// Equipment Types
app.get('/api/equipment-types', async (_req, res) => {
  const types = await prisma.equipmentType.findMany({ where: { is_deleted: false, active: true } });
  res.json(types);
});

app.get('/api/equipment-types/:id', async (req, res) => {
  const type = await prisma.equipmentType.findFirst({ where: { type_id: req.params.id, is_deleted: false } });
  if (!type) return res.status(404).json({ error: 'Not found' });
  res.json(type);
});

app.post('/api/equipment-types', async (req, res) => {
  const type = await prisma.equipmentType.create({ data: req.body });
  res.status(201).json(type);
});

app.put('/api/equipment-types/:id', async (req, res) => {
  const type = await prisma.equipmentType.update({ where: { type_id: req.params.id }, data: req.body });
  res.json(type);
});

app.delete('/api/equipment-types/:id', async (req, res) => {
  await prisma.equipmentType.update({ where: { type_id: req.params.id }, data: { is_deleted: true } });
  res.json({ success: true });
});

// Equipment Units
app.get('/api/equipment-units', async (_req, res) => {
  const units = await prisma.equipmentUnit.findMany({
    where: { is_deleted: false },
    include: { equipment_type: true, storage_location: true },
  });
  res.json(units);
});

app.get('/api/equipment-units/:id', async (req, res) => {
  const unit = await prisma.equipmentUnit.findFirst({
    where: { unit_id: req.params.id, is_deleted: false },
    include: { equipment_type: true, storage_location: true },
  });
  if (!unit) return res.status(404).json({ error: 'Not found' });
  res.json(unit);
});

app.post('/api/equipment-units', async (req, res) => {
  const unit = await prisma.equipmentUnit.create({ data: req.body });
  res.status(201).json(unit);
});

app.put('/api/equipment-units/:id', async (req, res) => {
  const unit = await prisma.equipmentUnit.update({ where: { unit_id: req.params.id }, data: req.body });
  res.json(unit);
});

app.delete('/api/equipment-units/:id', async (req, res) => {
  await prisma.equipmentUnit.update({ where: { unit_id: req.params.id }, data: { is_deleted: true } });
  res.json({ success: true });
});

// Customers
app.get('/api/customers', async (_req, res) => {
  const customers = await prisma.customer.findMany({ where: { is_deleted: false } });
  res.json(customers);
});

app.get('/api/customers/:id', async (req, res) => {
  const customer = await prisma.customer.findFirst({
    where: { customer_id: req.params.id, is_deleted: false },
    include: { rentals: true, venue_bookings: true },
  });
  if (!customer) return res.status(404).json({ error: 'Not found' });
  res.json(customer);
});

app.post('/api/customers', async (req, res) => {
  const customer = await prisma.customer.create({ data: req.body });
  res.status(201).json(customer);
});

app.put('/api/customers/:id', async (req, res) => {
  const customer = await prisma.customer.update({ where: { customer_id: req.params.id }, data: req.body });
  res.json(customer);
});

app.delete('/api/customers/:id', async (req, res) => {
  await prisma.customer.update({ where: { customer_id: req.params.id }, data: { is_deleted: true } });
  res.json({ success: true });
});

// Staff
app.get('/api/staff', async (_req, res) => {
  const staff = await prisma.staff.findMany({ where: { is_deleted: false, active: true } });
  res.json(staff);
});

app.post('/api/staff', async (req, res) => {
  const staff = await prisma.staff.create({ data: req.body });
  res.status(201).json(staff);
});

// Rentals
app.get('/api/rentals', async (req, res) => {
  const { status } = req.query;
  const where: any = { is_deleted: false };
  if (status) where.status = status as string;
  const rentals = await prisma.rental.findMany({
    where,
    include: { customer: true, rental_items: { include: { equipment_type: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(rentals);
});

app.get('/api/rentals/:id', async (req, res) => {
  const rental = await prisma.rental.findFirst({
    where: { rental_id: req.params.id, is_deleted: false },
    include: {
      customer: true,
      rental_items: { include: { equipment_type: true, equipment_unit: true } },
      payments: true,
      service_items: true,
      addendums: true,
      damage_records: true,
    },
  });
  if (!rental) return res.status(404).json({ error: 'Not found' });
  res.json(rental);
});

app.post('/api/rentals', async (req, res) => {
  const rental = await prisma.rental.create({ data: req.body });
  res.status(201).json(rental);
});

app.put('/api/rentals/:id', async (req, res) => {
  const rental = await prisma.rental.update({ where: { rental_id: req.params.id }, data: req.body });
  res.json(rental);
});

// Rental Items
app.post('/api/rental-items', async (req, res) => {
  const item = await prisma.rentalItem.create({ data: req.body });
  res.status(201).json(item);
});

app.put('/api/rental-items/:id', async (req, res) => {
  const item = await prisma.rentalItem.update({ where: { item_id: req.params.id }, data: req.body });
  res.json(item);
});

// Payments
app.get('/api/payments', async (req, res) => {
  const { rental_id, booking_id } = req.query;
  const where: any = { is_deleted: false };
  if (rental_id) where.rental_id = rental_id as string;
  if (booking_id) where.booking_id = booking_id as string;
  const payments = await prisma.payment.findMany({ where, orderBy: { payment_date: 'desc' } });
  res.json(payments);
});

app.post('/api/payments', async (req, res) => {
  const payment = await prisma.payment.create({ data: req.body });
  res.status(201).json(payment);
});

// Storage Locations
app.get('/api/storage-locations', async (_req, res) => {
  const locations = await prisma.storageLocation.findMany({
    where: { is_deleted: false, active: true },
    include: { children: true },
  });
  res.json(locations);
});

app.post('/api/storage-locations', async (req, res) => {
  const location = await prisma.storageLocation.create({ data: req.body });
  res.status(201).json(location);
});

// Venues
app.get('/api/venues', async (_req, res) => {
  const venues = await prisma.venue.findMany({ where: { is_deleted: false, active: true } });
  res.json(venues);
});

app.get('/api/venues/:id', async (req, res) => {
  const venue = await prisma.venue.findFirst({
    where: { venue_id: req.params.id, is_deleted: false },
    include: { venue_bookings: { where: { is_deleted: false } } },
  });
  if (!venue) return res.status(404).json({ error: 'Not found' });
  res.json(venue);
});

app.post('/api/venues', async (req, res) => {
  const venue = await prisma.venue.create({ data: req.body });
  res.status(201).json(venue);
});

// Venue Bookings
app.get('/api/venue-bookings', async (req, res) => {
  const { venue_id, status } = req.query;
  const where: any = { is_deleted: false };
  if (venue_id) where.venue_id = venue_id as string;
  if (status) where.status = status as string;
  const bookings = await prisma.venueBooking.findMany({
    where,
    include: { venue: true, customer: true },
    orderBy: { booking_start: 'desc' },
  });
  res.json(bookings);
});

app.post('/api/venue-bookings', async (req, res) => {
  const booking = await prisma.venueBooking.create({ data: req.body });
  res.status(201).json(booking);
});

app.put('/api/venue-bookings/:id', async (req, res) => {
  const booking = await prisma.venueBooking.update({ where: { booking_id: req.params.id }, data: req.body });
  res.json(booking);
});

// Maintenance Logs
app.get('/api/maintenance-logs', async (req, res) => {
  const { unit_id } = req.query;
  const where: any = { is_deleted: false };
  if (unit_id) where.unit_id = unit_id as string;
  const logs = await prisma.maintenanceLog.findMany({ where, orderBy: { created_at: 'desc' } });
  res.json(logs);
});

app.post('/api/maintenance-logs', async (req, res) => {
  const log = await prisma.maintenanceLog.create({ data: req.body });
  res.status(201).json(log);
});

// Inventory Logs
app.get('/api/inventory-logs', async (req, res) => {
  const { unit_id, rental_id } = req.query;
  const where: any = { is_deleted: false };
  if (unit_id) where.unit_id = unit_id as string;
  if (rental_id) where.rental_id = rental_id as string;
  const logs = await prisma.inventoryLog.findMany({ where, orderBy: { log_date: 'desc' } });
  res.json(logs);
});

app.post('/api/inventory-logs', async (req, res) => {
  const log = await prisma.inventoryLog.create({ data: req.body });
  res.status(201).json(log);
});

// Damage Records
app.get('/api/damage-records', async (req, res) => {
  const { rental_id } = req.query;
  const where: any = { is_deleted: false };
  if (rental_id) where.rental_id = rental_id as string;
  const records = await prisma.damageRecord.findMany({ where, orderBy: { created_at: 'desc' } });
  res.json(records);
});

app.post('/api/damage-records', async (req, res) => {
  const record = await prisma.damageRecord.create({ data: req.body });
  res.status(201).json(record);
});

// Credit Notes
app.get('/api/credit-notes', async (req, res) => {
  const { rental_id } = req.query;
  const where: any = { is_deleted: false };
  if (rental_id) where.rental_id = rental_id as string;
  const notes = await prisma.creditNote.findMany({ where, orderBy: { created_at: 'desc' } });
  res.json(notes);
});

app.post('/api/credit-notes', async (req, res) => {
  const note = await prisma.creditNote.create({ data: req.body });
  res.status(201).json(note);
});

// Discount Rules
app.get('/api/discount-rules', async (_req, res) => {
  const rules = await prisma.discountRule.findMany({ where: { is_deleted: false, active: true } });
  res.json(rules);
});

app.post('/api/discount-rules', async (req, res) => {
  const rule = await prisma.discountRule.create({ data: req.body });
  res.status(201).json(rule);
});

// Overdue Rules
app.get('/api/overdue-rules', async (_req, res) => {
  const rules = await prisma.overdueRule.findMany({ where: { is_deleted: false, active: true } });
  res.json(rules);
});

// Stocktake
app.get('/api/stocktake-plans', async (_req, res) => {
  const plans = await prisma.stocktakePlan.findMany({
    where: { is_deleted: false },
    include: { stocktake_results: true },
    orderBy: { scheduled_date: 'desc' },
  });
  res.json(plans);
});

app.post('/api/stocktake-plans', async (req, res) => {
  const plan = await prisma.stocktakePlan.create({ data: req.body });
  res.status(201).json(plan);
});

// Service Items
app.get('/api/service-items', async (req, res) => {
  const { rental_id, booking_id } = req.query;
  const where: any = { is_deleted: false };
  if (rental_id) where.rental_id = rental_id as string;
  if (booking_id) where.booking_id = booking_id as string;
  const items = await prisma.serviceItem.findMany({ where });
  res.json(items);
});

app.post('/api/service-items', async (req, res) => {
  const item = await prisma.serviceItem.create({ data: req.body });
  res.status(201).json(item);
});

// Print Templates
app.get('/api/print-templates', async (_req, res) => {
  const templates = await prisma.printTemplate.findMany({ where: { is_deleted: false, active: true } });
  res.json(templates);
});

// Dashboard stats
app.get('/api/dashboard/stats', async (_req, res) => {
  const [
    totalEquipment,
    availableEquipment,
    activeRentals,
    overdueRentals,
    totalCustomers,
    activeBookings,
  ] = await Promise.all([
    prisma.equipmentUnit.count({ where: { is_deleted: false, status: { not: 'retired' } } }),
    prisma.equipmentUnit.count({ where: { is_deleted: false, status: 'available' } }),
    prisma.rental.count({ where: { is_deleted: false, status: 'active' } }),
    prisma.rental.count({ where: { is_deleted: false, status: 'overdue' } }),
    prisma.customer.count({ where: { is_deleted: false } }),
    prisma.venueBooking.count({ where: { is_deleted: false, status: 'active' } }),
  ]);
  res.json({ totalEquipment, availableEquipment, activeRentals, overdueRentals, totalCustomers, activeBookings });
});

// ==================== Start Server ====================
app.listen(PORT, () => {
  console.log(`GearBase API running on port ${PORT}`);
});

export { app, prisma };
