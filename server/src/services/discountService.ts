import { prisma } from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface DiscountRuleRecord {
  rule_id: string;
  rule_name: string;
  applies_to: string;
  target_id: string | null;
  min_days: number;
  max_days: number | null;
  discount_type: string;
  discount_value: Decimal;
  active: boolean;
  is_deleted: boolean;
}

/**
 * Find the best applicable discount rule for an equipment item
 */
export async function findBestDiscount(
  typeId: string,
  category: string,
  rentalDays: number
): Promise<DiscountRuleRecord | null> {
  const rules = await prisma.discountRule.findMany({
    where: { is_deleted: false, active: true },
  });

  const applicable = rules.filter((rule) => {
    if (rentalDays < rule.min_days) return false;
    if (rule.max_days && rentalDays > rule.max_days) return false;
    if (rule.applies_to === 'all') return true;
    if (rule.applies_to === 'equipment' && rule.target_id === typeId) return true;
    if (rule.applies_to === 'category' && rule.target_id === category) return true;
    return false;
  });

  if (applicable.length === 0) return null;

  // Priority: equipment > category > all, then highest discount_value
  const priority: Record<string, number> = { equipment: 3, category: 2, all: 1 };
  applicable.sort((a, b) => {
    const pDiff = (priority[b.applies_to] || 0) - (priority[a.applies_to] || 0);
    if (pDiff !== 0) return pDiff;
    return Number(b.discount_value) - Number(a.discount_value);
  });

  return applicable[0] as DiscountRuleRecord;
}

/**
 * Calculate discount amount for a line item
 */
export function calculateDiscountAmount(
  lineTotal: number,
  _dailyRate: number,
  days: number,
  rule: DiscountRuleRecord | null
): number {
  if (!rule) return 0;
  const value = Number(rule.discount_value);
  if (rule.discount_type === 'percentage') {
    return Math.round(lineTotal * value / 100);
  }
  if (rule.discount_type === 'fixed_per_day') {
    return Math.round(value * days);
  }
  return 0;
}
