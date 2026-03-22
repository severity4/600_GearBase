import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { checkVenueAvailability, getVenueSchedule } from '../services/venueService';

export const venuesRouter = Router();
venuesRouter.use(authenticate);

venuesRouter.get('/', async (req, res, next) => {
  try {
    const { search, active_only } = req.query;
    const where: any = { is_deleted: false };
    if (active_only !== 'false') where.active = true;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { venue_type: { contains: search as string, mode: 'insensitive' } },
        { amenities: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    const venues = await prisma.venue.findMany({ where });
    res.json(venues);
  } catch (e) { next(e); }
});

venuesRouter.get('/available', async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) throw new AppError('start 和 end 參數必填');
    const venues = await prisma.venue.findMany({
      where: { is_deleted: false, active: true },
    });
    const available = [];
    for (const v of venues) {
      const isAvailable = await checkVenueAvailability(v.venue_id, start as string, end as string);
      if (isAvailable) available.push(v);
    }
    res.json(available);
  } catch (e) { next(e); }
});

venuesRouter.get('/:id', async (req, res, next) => {
  try {
    const venue = await prisma.venue.findFirst({
      where: { venue_id: req.params.id, is_deleted: false },
      include: { venue_bookings: { where: { is_deleted: false } } },
    });
    if (!venue) throw new AppError('找不到場地', 404);
    res.json(venue);
  } catch (e) { next(e); }
});

venuesRouter.get('/:id/schedule', async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) throw new AppError('start 和 end 參數必填');
    const schedule = await getVenueSchedule(req.params.id, start as string, end as string);
    res.json(schedule);
  } catch (e) { next(e); }
});

venuesRouter.get('/:id/availability', async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) throw new AppError('start 和 end 參數必填');
    const available = await checkVenueAvailability(req.params.id, start as string, end as string);
    res.json({ available });
  } catch (e) { next(e); }
});

venuesRouter.get('/:id/monthly-schedule', async (req, res, next) => {
  try {
    const { month } = req.query; // YYYY-MM
    if (!month) throw new AppError('month 參數必填 (YYYY-MM)');
    const [year, m] = (month as string).split('-').map(Number);
    const firstDay = new Date(year, m - 1, 1);
    const lastDay = new Date(year, m, 0);

    const venue = await prisma.venue.findFirst({
      where: { venue_id: req.params.id, is_deleted: false },
    });
    if (!venue) throw new AppError('找不到場地', 404);

    const bookings = await prisma.venueBooking.findMany({
      where: {
        venue_id: req.params.id,
        is_deleted: false,
        status: { not: 'cancelled' },
        booking_start: { lte: lastDay },
        booking_end: { gte: firstDay },
      },
    });

    const bookedDates: string[] = [];
    for (const b of bookings) {
      const bStart = new Date(Math.max(new Date(b.booking_start).getTime(), firstDay.getTime()));
      bStart.setHours(0, 0, 0, 0);
      const bEnd = new Date(Math.min(new Date(b.booking_end).getTime(), lastDay.getTime()));
      const cursor = new Date(bStart);
      while (cursor <= bEnd) {
        const dateStr = cursor.toISOString().slice(0, 10);
        if (!bookedDates.includes(dateStr)) bookedDates.push(dateStr);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    res.json({
      venue: {
        venue_id: venue.venue_id,
        name: venue.name,
        available_start_time: venue.available_start_time,
        available_end_time: venue.available_end_time,
      },
      booked_dates: bookedDates.sort(),
    });
  } catch (e) { next(e); }
});

venuesRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.name) throw new AppError('場地名稱必填');
    if (!data.venue_type) throw new AppError('場地類型必填');
    if (!data.hourly_rate || Number(data.hourly_rate) < 0) throw new AppError('時租費必填');
    if (!data.max_capacity || Number(data.max_capacity) <= 0) throw new AppError('最大容納人數必填');

    const venueId = await generateNextId('venue', 'venue_id', 'VN');
    const venue = await prisma.venue.create({
      data: {
        venue_id: venueId,
        name: data.name,
        venue_type: data.venue_type,
        address: data.address || '',
        floor: data.floor || null,
        floor_area_sqm: data.floor_area_sqm || null,
        max_capacity: Number(data.max_capacity),
        hourly_rate: data.hourly_rate,
        half_day_rate: data.half_day_rate || null,
        daily_rate: data.daily_rate || null,
        overtime_hourly_rate: data.overtime_hourly_rate || null,
        deposit_required: data.deposit_required || null,
        min_booking_hours: data.min_booking_hours || 2,
        available_start_time: data.available_start_time || '09:00',
        available_end_time: data.available_end_time || '22:00',
        amenities: data.amenities || null,
        description: data.description || null,
        location_id: data.location_id || null,
        active: true,
        created_by: req.user?.staff_id || '',
      },
    });
    res.status(201).json(venue);
  } catch (e) { next(e); }
});

venuesRouter.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const venue = await prisma.venue.update({
      where: { venue_id: req.params.id },
      data: req.body,
    });
    res.json(venue);
  } catch (e) { next(e); }
});

venuesRouter.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    await prisma.venue.update({
      where: { venue_id: req.params.id },
      data: { is_deleted: true },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});
