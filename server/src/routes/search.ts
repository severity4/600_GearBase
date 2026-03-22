import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const searchRouter = Router();
searchRouter.use(authenticate);

/**
 * GET /api/search/equipment?q=keyword
 */
searchRouter.get('/equipment', async (req, res, next) => {
  try {
    const q = req.query.q as string;
    if (!q) throw new AppError('搜尋關鍵字 q 必填');

    const [types, units] = await Promise.all([
      prisma.equipmentType.findMany({
        where: {
          is_deleted: false,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
          ],
        },
      }),
      prisma.equipmentUnit.findMany({
        where: {
          is_deleted: false,
          OR: [
            { internal_code: { contains: q, mode: 'insensitive' } },
            { serial_number: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { equipment_type: true },
      }),
    ]);
    res.json({ types, units });
  } catch (e) { next(e); }
});

/**
 * GET /api/search/available-equipment?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
searchRouter.get('/available-equipment', async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) throw new AppError('start 和 end 參數必填');

    const requestStart = new Date(start as string);
    const requestEnd = new Date(end as string);

    // Find all unit IDs that are booked during the requested period
    const bookedItems = await prisma.rentalItem.findMany({
      where: {
        is_deleted: false,
        unit_id: { not: null },
        rental: {
          is_deleted: false,
          status: { notIn: ['cancelled', 'returned'] },
          rental_start: { lte: requestEnd },
          rental_end: { gte: requestStart },
        },
      },
      select: { unit_id: true },
    });
    const bookedUnitIds = new Set(bookedItems.map(i => i.unit_id).filter(Boolean));

    const availableUnits = await prisma.equipmentUnit.findMany({
      where: {
        is_deleted: false,
        status: 'available',
        unit_id: { notIn: [...bookedUnitIds] as string[] },
      },
      include: { equipment_type: true, storage_location: true },
    });
    res.json(availableUnits);
  } catch (e) { next(e); }
});

/**
 * GET /api/search/catalog - Equipment catalog for customer-facing
 */
searchRouter.get('/catalog', async (_req, res, next) => {
  try {
    const types = await prisma.equipmentType.findMany({
      where: { is_deleted: false, active: true },
      include: {
        units: { where: { is_deleted: false }, select: { unit_id: true, status: true } },
        accessory_as_parent: {
          where: { is_deleted: false },
          include: { accessory_type: { select: { type_id: true, name: true } } },
        },
      },
    });

    const catalog = types.map(type => ({
      type_id: type.type_id,
      name: type.name,
      category: type.category,
      sub_category: type.sub_category,
      brand: type.brand,
      model: type.model,
      daily_rate: Number(type.daily_rate),
      replacement_value: Number(type.replacement_value),
      deposit_required: type.deposit_required ? Number(type.deposit_required) : 0,
      is_consumable: type.is_consumable,
      description: type.description,
      total_units: type.units.length,
      available_units: type.units.filter(u => u.status === 'available').length,
      accessories: type.accessory_as_parent.map(b => ({
        type_id: b.accessory_type_id,
        type_name: b.accessory_type?.name || '',
        binding_type: b.binding_type,
        notes: b.notes,
      })),
    }));
    res.json(catalog);
  } catch (e) { next(e); }
});

/**
 * GET /api/search/qr/:unitId - QR code data for equipment
 */
searchRouter.get('/qr/:unitId', async (req, res, next) => {
  try {
    const unit = await prisma.equipmentUnit.findFirst({
      where: { unit_id: req.params.unitId, is_deleted: false },
      include: { equipment_type: true, storage_location: true },
    });
    if (!unit) throw new AppError('找不到器材', 404);

    const qrPayload = JSON.stringify({
      id: unit.unit_id,
      code: unit.internal_code,
      type: unit.equipment_type?.name || unit.type_id,
      sn: unit.serial_number || '',
    });

    res.json({
      unit_id: unit.unit_id,
      internal_code: unit.internal_code,
      type_name: unit.equipment_type?.name || '',
      category: unit.equipment_type?.category || '',
      serial_number: unit.serial_number || '',
      status: unit.status,
      location_name: unit.storage_location?.name || '',
      daily_rate: unit.equipment_type ? Number(unit.equipment_type.daily_rate) : 0,
      replacement_value: unit.equipment_type ? Number(unit.equipment_type.replacement_value) : 0,
      qr_data: qrPayload,
    });
  } catch (e) { next(e); }
});

/**
 * GET /api/search/qr-batch - Batch QR data
 */
searchRouter.get('/qr-batch', async (req, res, next) => {
  try {
    const unitIds = req.query.ids ? (req.query.ids as string).split(',') : undefined;
    const where: any = { is_deleted: false };
    if (unitIds) where.unit_id = { in: unitIds };

    const units = await prisma.equipmentUnit.findMany({
      where,
      include: { equipment_type: true, storage_location: true },
    });

    const batch = units.map(unit => ({
      unit_id: unit.unit_id,
      internal_code: unit.internal_code,
      type_name: unit.equipment_type?.name || '',
      category: unit.equipment_type?.category || '',
      serial_number: unit.serial_number || '',
      daily_rate: unit.equipment_type ? Number(unit.equipment_type.daily_rate) : 0,
      location_name: unit.storage_location?.name || '',
      qr_data: JSON.stringify({
        id: unit.unit_id,
        code: unit.internal_code,
        type: unit.equipment_type?.name || unit.type_id,
        sn: unit.serial_number || '',
      }),
    }));
    res.json(batch);
  } catch (e) { next(e); }
});

/**
 * GET /api/search/revenue?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
searchRouter.get('/revenue', async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const rentalWhere: any = { is_deleted: false, status: 'returned' };
    const bookingWhere: any = { is_deleted: false, status: 'completed' };

    if (start) {
      rentalWhere.actual_return_date = { ...(rentalWhere.actual_return_date || {}), gte: new Date(start as string) };
      bookingWhere.actual_end = { ...(bookingWhere.actual_end || {}), gte: new Date(start as string) };
    }
    if (end) {
      rentalWhere.actual_return_date = { ...(rentalWhere.actual_return_date || {}), lte: new Date(end as string) };
      bookingWhere.actual_end = { ...(bookingWhere.actual_end || {}), lte: new Date(end as string) };
    }

    const [rentals, bookings] = await Promise.all([
      prisma.rental.findMany({ where: rentalWhere, select: { total_amount: true } }),
      prisma.venueBooking.findMany({ where: bookingWhere, select: { total_amount: true } }),
    ]);

    const rentalRevenue = rentals.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const venueRevenue = bookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

    res.json({ rental_revenue: rentalRevenue, venue_revenue: venueRevenue, total: rentalRevenue + venueRevenue });
  } catch (e) { next(e); }
});
