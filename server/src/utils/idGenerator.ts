import { prisma } from './prisma';

const CATEGORY_CODES: Record<string, string> = {
  camera: 'CAM', lens: 'LEN', audio: 'AUD', lighting: 'LGT',
  monitor: 'MON', transmission: 'TRX', tripod: 'TRI', motion: 'MOT',
  teleprompter: 'TLP', accessory: 'ACC',
  prop_furniture: 'PROP-F', prop_wardrobe: 'PROP-W', prop_set: 'PROP-S',
  prop_fx: 'PROP-X', prop_vehicle: 'PROP-V', prop_other: 'PROP-O',
};

function extractNumber(id: string): number {
  const match = String(id).match(/(\d+)$/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Generate a sequential ID with prefix: PREFIX-NNN
 */
export async function generateNextId(
  model: string,
  idField: string,
  prefix: string,
  padLength = 3
): Promise<string> {
  const records = await (prisma as any)[model].findMany({
    select: { [idField]: true },
  });
  const maxNum = records.reduce((max: number, r: any) => {
    const n = extractNumber(r[idField]);
    return n > max ? n : max;
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(padLength, '0')}`;
}

/**
 * Generate a year-based sequential ID: PREFIX-YYYY-NNN
 */
export async function generateYearBasedId(
  model: string,
  idField: string,
  prefix: string,
  padLength = 3
): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;
  const records = await (prisma as any)[model].findMany({
    select: { [idField]: true },
    where: { [idField]: { startsWith: yearPrefix } },
  });
  const maxNum = records.reduce((max: number, r: any) => {
    const n = extractNumber(r[idField]);
    return n > max ? n : max;
  }, 0);
  return `${yearPrefix}${String(maxNum + 1).padStart(padLength, '0')}`;
}

/**
 * Generate internal equipment code: CAT-YYYY-NNN
 */
export async function generateInternalCode(categoryKey: string): Promise<string> {
  const prefix = CATEGORY_CODES[categoryKey] || 'GEN';
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;
  const units = await prisma.equipmentUnit.findMany({
    select: { internal_code: true },
    where: { internal_code: { startsWith: yearPrefix } },
  });
  const maxNum = units.reduce((max, u) => {
    const n = extractNumber(u.internal_code);
    return n > max ? n : max;
  }, 0);
  return `${yearPrefix}${String(maxNum + 1).padStart(3, '0')}`;
}
