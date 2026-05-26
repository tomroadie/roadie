/**
 * Monday start of week in local timezone, as YYYY-MM-DD.
 * @example getMondayDateString() → this week's Monday
 * @example getMondayDateString(new Date("2026-05-21")) → "2026-05-19"
 */
export function getMondayDateString(d = new Date()): string {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dayNum = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}
