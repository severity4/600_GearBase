import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { addWorkingDays } from '../utils/helpers';
import { advanceRentalStatus } from './rentalService';
import { AppError } from '../middleware/errorHandler';

interface CheckInData {
  unit_id: string;
  rental_id?: string;
  performed_by: string;
  to_location_id?: string;
  condition_after?: string;
  accessories_complete?: boolean;
  missing_accessories?: string;
  needs_maintenance?: boolean;
  needs_cleaning?: boolean;
  damage_found?: boolean;
  damage_description?: string;
  photo_urls?: string;
  notes?: string;
}

/**
 * Process equipment check-in (return)
 */
export async function processEquipmentCheckIn(data: CheckInData) {
  const unit = await prisma.equipmentUnit.findFirst({
    where: { unit_id: data.unit_id, is_deleted: false },
  });
  if (!unit) throw new AppError('找不到器材: ' + data.unit_id, 404);

  // Create inventory log
  const logId = await generateNextId('inventoryLog', 'log_id', 'IL');
  await prisma.inventoryLog.create({
    data: {
      log_id: logId,
      unit_id: data.unit_id,
      rental_id: data.rental_id || null,
      log_type: 'check_in',
      log_date: new Date(),
      performed_by: data.performed_by,
      to_location_id: data.to_location_id || unit.location_id || null,
      condition_before: unit.current_condition,
      condition_after: data.condition_after || 'good',
      checklist_completed: true,
      accessories_complete: data.accessories_complete !== false,
      missing_accessories: data.missing_accessories || null,
      needs_maintenance: data.needs_maintenance || false,
      needs_cleaning: data.needs_cleaning || false,
      damage_found: data.damage_found || false,
      photo_urls: data.photo_urls || null,
      notes: data.notes || null,
      inspection_deadline: addWorkingDays(new Date(), 3),
      inspection_overdue: false,
    },
  });

  // Update unit status
  const newStatus = data.needs_maintenance || data.damage_found ? 'maintenance' : 'available';
  await prisma.equipmentUnit.update({
    where: { unit_id: data.unit_id },
    data: {
      current_condition: data.condition_after || unit.current_condition,
      location_id: data.to_location_id || unit.location_id,
      status: newStatus,
    },
  });

  // Create damage record if damage found
  let damageRecord = null;
  if (data.damage_found && data.damage_description) {
    const damageId = await generateNextId('damageRecord', 'damage_id', 'DM');
    damageRecord = await prisma.damageRecord.create({
      data: {
        damage_id: damageId,
        rental_id: data.rental_id || '',
        unit_id: data.unit_id,
        damage_description: data.damage_description,
        damage_severity: 'moderate',
        within_tolerance: false,
        assessed_by: data.performed_by,
        status: 'pending',
      },
    });
  }

  // Update rental item return status
  if (data.rental_id) {
    const rentalItems = await prisma.rentalItem.findMany({
      where: {
        rental_id: data.rental_id,
        unit_id: data.unit_id,
        is_deleted: false,
      },
    });
    for (const item of rentalItems) {
      await prisma.rentalItem.update({
        where: { item_id: item.item_id },
        data: {
          return_status: 'returned',
          return_date: new Date(),
          condition_in: data.condition_after || '',
          checked_in_by: data.performed_by,
        },
      });
    }

    // Check if all items returned → auto-advance rental status
    const allItems = await prisma.rentalItem.findMany({
      where: { rental_id: data.rental_id, is_deleted: false },
    });
    const allReturned = allItems.every((i) => i.return_status === 'returned');
    if (allReturned) {
      const rental = await prisma.rental.findFirst({
        where: { rental_id: data.rental_id, is_deleted: false },
      });
      if (rental && ['active', 'overdue'].includes(rental.status)) {
        await advanceRentalStatus(data.rental_id, 'returned', {
          return_date: new Date(),
        });
      }
    }
  }

  return {
    success: true,
    log_id: logId,
    new_status: newStatus,
    damage_record: damageRecord,
  };
}
