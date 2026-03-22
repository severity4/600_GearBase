import { prisma } from '../utils/prisma';

/**
 * Find the applicable overdue rule for a category
 */
export async function findOverdueRule(category: string) {
  const rules = await prisma.overdueRule.findMany({
    where: { is_deleted: false, active: true },
  });

  // Category-specific first
  const categoryRule = rules.find(
    (r) => r.applies_to === 'category' && r.target_category === category
  );
  if (categoryRule) return categoryRule;

  // Then global
  return rules.find((r) => r.applies_to === 'all') || null;
}

/**
 * Calculate overdue days considering grace period
 */
export function calculateOverdueDays(
  expectedReturn: Date,
  actualReturn: Date,
  graceHours: number
): number {
  const expected = new Date(expectedReturn);
  const actual = new Date(actualReturn);
  if (actual <= expected) return 0;

  const diffMs = actual.getTime() - expected.getTime();
  const graceMs = (graceHours || 0) * 60 * 60 * 1000;
  if (diffMs <= graceMs) return 0;

  return Math.ceil((diffMs - graceMs) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate overdue fee for a single item
 */
export function calculateItemOverdueFee(
  dailyRate: number,
  overdueDays: number,
  replacementValue: number,
  rule: any
): { fee: number; forcedPurchase: boolean } {
  if (!rule || overdueDays <= 0) return { fee: 0, forcedPurchase: false };

  const multiplier = Number(rule.multiplier) || 1.5;
  let fee = Math.round(dailyRate * multiplier * overdueDays);

  // Max penalty cap
  if (rule.max_penalty_rate) {
    const maxFee = Math.round(replacementValue * Number(rule.max_penalty_rate));
    fee = Math.min(fee, maxFee);
  }

  // Forced purchase
  const forcedDays = rule.forced_purchase_days ? Number(rule.forced_purchase_days) : null;
  if (forcedDays && overdueDays >= forcedDays) {
    return { fee: replacementValue, forcedPurchase: true };
  }

  return { fee, forcedPurchase: false };
}
