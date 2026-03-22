import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { prisma } from './utils/prisma';
import { errorHandler } from './middleware/errorHandler';
import { activityLogger } from './middleware/activityLogger';

// Routes
import { equipmentTypesRouter } from './routes/equipmentTypes';
import { equipmentUnitsRouter } from './routes/equipmentUnits';
import { customersRouter } from './routes/customers';
import { staffRouter } from './routes/staff';
import { rentalsRouter } from './routes/rentals';
import { rentalItemsRouter } from './routes/rentalItems';
import { paymentsRouter } from './routes/payments';
import { storageLocationsRouter } from './routes/storageLocations';
import { venuesRouter } from './routes/venues';
import { venueBookingsRouter } from './routes/venueBookings';
import { maintenanceLogsRouter } from './routes/maintenanceLogs';
import { inventoryLogsRouter } from './routes/inventoryLogs';
import { damageRecordsRouter } from './routes/damageRecords';
import { creditNotesRouter } from './routes/creditNotes';
import { discountRulesRouter } from './routes/discountRules';
import { overdueRulesRouter } from './routes/overdueRules';
import { stocktakeRouter } from './routes/stocktake';
import { serviceItemsRouter } from './routes/serviceItems';
import { rentalAddendumsRouter } from './routes/rentalAddendums';
import { accessoryBindingsRouter } from './routes/accessoryBindings';
import { wearToleranceRouter } from './routes/wearTolerance';
import { printTemplatesRouter } from './routes/printTemplates';
import { dashboardRouter } from './routes/dashboard';
import { searchRouter } from './routes/search';
import { authRouter } from './routes/auth';
import { activityLogsRouter } from './routes/activityLogs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json());

// Activity logging (writes to DB)
app.use(activityLogger);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/equipment-types', equipmentTypesRouter);
app.use('/api/equipment-units', equipmentUnitsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/staff', staffRouter);
app.use('/api/rentals', rentalsRouter);
app.use('/api/rental-items', rentalItemsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/storage-locations', storageLocationsRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/venue-bookings', venueBookingsRouter);
app.use('/api/maintenance-logs', maintenanceLogsRouter);
app.use('/api/inventory-logs', inventoryLogsRouter);
app.use('/api/damage-records', damageRecordsRouter);
app.use('/api/credit-notes', creditNotesRouter);
app.use('/api/discount-rules', discountRulesRouter);
app.use('/api/overdue-rules', overdueRulesRouter);
app.use('/api/stocktake', stocktakeRouter);
app.use('/api/service-items', serviceItemsRouter);
app.use('/api/rental-addendums', rentalAddendumsRouter);
app.use('/api/accessory-bindings', accessoryBindingsRouter);
app.use('/api/wear-tolerance', wearToleranceRouter);
app.use('/api/print-templates', printTemplatesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/search', searchRouter);
app.use('/api/activity-logs', activityLogsRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`GearBase API running on port ${PORT}`);
});

export { app, prisma };
