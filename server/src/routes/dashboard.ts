import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/stats', async (_req, res, next) => {
  try {
    const [
      totalEquipmentTypes,
      totalEquipmentUnits,
      availableUnits,
      rentedUnits,
      maintenanceUnits,
      totalCustomers,
      activeRentals,
      overdueRentals,
      completedRentals,
      totalVenues,
      activeBookings,
      completedBookings,
    ] = await Promise.all([
      prisma.equipmentType.count({ where: { is_deleted: false, active: true } }),
      prisma.equipmentUnit.count({ where: { is_deleted: false, status: { not: 'retired' } } }),
      prisma.equipmentUnit.count({ where: { is_deleted: false, status: 'available' } }),
      prisma.equipmentUnit.count({ where: { is_deleted: false, status: 'rented' } }),
      prisma.equipmentUnit.count({ where: { is_deleted: false, status: 'maintenance' } }),
      prisma.customer.count({ where: { is_deleted: false } }),
      prisma.rental.count({ where: { is_deleted: false, status: { in: ['draft', 'reserved', 'active', 'overdue'] } } }),
      prisma.rental.count({ where: { is_deleted: false, status: 'overdue' } }),
      prisma.rental.count({ where: { is_deleted: false, status: 'returned' } }),
      prisma.venue.count({ where: { is_deleted: false, active: true } }),
      prisma.venueBooking.count({ where: { is_deleted: false, status: { in: ['draft', 'reserved', 'confirmed', 'active'] } } }),
      prisma.venueBooking.count({ where: { is_deleted: false, status: 'completed' } }),
    ]);

    res.json({
      total_equipment_types: totalEquipmentTypes,
      total_equipment_units: totalEquipmentUnits,
      available_units: availableUnits,
      rented_units: rentedUnits,
      maintenance_units: maintenanceUnits,
      total_customers: totalCustomers,
      active_rentals: activeRentals,
      overdue_rentals: overdueRentals,
      completed_rentals: completedRentals,
      total_venues: totalVenues,
      active_bookings: activeBookings,
      completed_bookings: completedBookings,
    });
  } catch (e) { next(e); }
});

dashboardRouter.get('/schedule', async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'start 和 end 參數必填' });
    }
    const startDate = new Date(start as string);
    const endDate = new Date(end as string);
    endDate.setHours(23, 59, 59);

    const [rentals, bookings] = await Promise.all([
      prisma.rental.findMany({
        where: {
          is_deleted: false,
          status: { not: 'cancelled' },
          rental_start: { lte: endDate },
          rental_end: { gte: startDate },
        },
        include: {
          customer: { select: { name: true } },
          rental_items: { include: { equipment_type: true, equipment_unit: true } },
        },
        orderBy: { rental_start: 'asc' },
      }),
      prisma.venueBooking.findMany({
        where: {
          is_deleted: false,
          status: { not: 'cancelled' },
          booking_start: { lte: endDate },
          booking_end: { gte: startDate },
        },
        include: {
          venue: { select: { name: true } },
          customer: { select: { name: true } },
        },
        orderBy: { booking_start: 'asc' },
      }),
    ]);

    res.json({
      rentals: rentals.map(r => ({
        rental_id: r.rental_id,
        customer_name: r.customer?.name || '',
        start: r.rental_start,
        end: r.rental_end,
        status: r.status,
        item_count: r.rental_items.length,
        items: r.rental_items.map(i => ({
          unit_id: i.unit_id,
          type_name: i.equipment_type?.name || i.type_id,
          internal_code: i.equipment_unit?.internal_code || i.unit_id || '',
        })),
      })),
      bookings: bookings.map(b => ({
        booking_id: b.booking_id,
        venue_name: b.venue?.name || '',
        customer_name: b.customer?.name || '',
        start: b.booking_start,
        end: b.booking_end,
        status: b.status,
        rate_type: b.rate_type,
      })),
    });
  } catch (e) { next(e); }
});

dashboardRouter.get('/overdue-rentals', async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = await prisma.rental.findMany({
      where: {
        is_deleted: false,
        status: { in: ['active', 'overdue'] },
        rental_end: { lt: today },
      },
      include: { customer: true },
      orderBy: { rental_end: 'asc' },
    });
    res.json(overdue);
  } catch (e) { next(e); }
});
