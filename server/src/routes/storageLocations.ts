import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const storageLocationsRouter = Router();
storageLocationsRouter.use(authenticate);

storageLocationsRouter.get('/', async (_req, res, next) => {
  try {
    const locations = await prisma.storageLocation.findMany({
      where: { is_deleted: false, active: true },
      include: { children: true },
    });
    res.json(locations);
  } catch (e) { next(e); }
});

storageLocationsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const locId = await generateNextId('storageLocation', 'location_id', 'LOC');
    const location = await prisma.storageLocation.create({
      data: { location_id: locId, ...req.body },
    });
    res.status(201).json(location);
  } catch (e) { next(e); }
});
