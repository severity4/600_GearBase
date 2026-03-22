import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateYearBasedId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const creditNotesRouter = Router();
creditNotesRouter.use(authenticate);

creditNotesRouter.get('/', async (req, res, next) => {
  try {
    const { rental_id, customer_id } = req.query;
    const where: any = { is_deleted: false };
    if (rental_id) where.rental_id = rental_id as string;
    if (customer_id) where.customer_id = customer_id as string;
    const notes = await prisma.creditNote.findMany({ where, orderBy: { created_at: 'desc' } });
    res.json(notes);
  } catch (e) { next(e); }
});

creditNotesRouter.post('/', requirePermission('approve_credit_note'), async (req, res, next) => {
  try {
    const noteId = await generateYearBasedId('creditNote', 'credit_note_id', 'CN');
    const note = await prisma.creditNote.create({
      data: { credit_note_id: noteId, ...req.body },
    });
    res.status(201).json(note);
  } catch (e) { next(e); }
});
