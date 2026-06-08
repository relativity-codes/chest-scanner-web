export const CHEST_HISTORY_WEEKS = 5;
export const CHEST_HISTORY_DAYS = CHEST_HISTORY_WEEKS * 7;

export function getUTC10DateOnly(date: Date | string): Date {
  const d = new Date(date);
  const utc10Time = d.getTime() + (10 * 60 * 60 * 1000);
  const utc10Date = new Date(utc10Time);
  return new Date(Date.UTC(utc10Date.getUTCFullYear(), utc10Date.getUTCMonth(), utc10Date.getUTCDate()));
}

/** Start of the earliest game day included in the rolling history window (UTC+10). */
export function getChestHistoryCutoffDate(now: Date = new Date()): Date {
  const today = getUTC10DateOnly(now);
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - (CHEST_HISTORY_DAYS - 1));
  return cutoff;
}

export function getChestHistoryTimeFilter(now: Date = new Date()) {
  return { time: { gte: getChestHistoryCutoffDate(now) } };
}
