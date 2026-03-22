/**
 * Calculate rental days between two dates
 */
export function calculateRentalDays(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Add working days (skip weekends)
 */
export function addWorkingDays(startDate: Date, days: number): Date {
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return date;
}

/**
 * Round to integer (for TWD currency)
 */
export function roundMoney(amount: number): number {
  return Math.round(amount);
}
