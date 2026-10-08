/**
 * An artist's board week starts on their chosen day (profiles.week_start_day,
 * 0 = Sunday ... 6 = Saturday) in UK time, not on Monday.
 */

const TZ = "Europe/London";
const DAY_MS = 86400000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Today's date in UK time as YYYY-MM-DD, and its weekday. */
function londonToday(now: Date): { iso: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Midnight UK time on an ISO date, as a UTC timestamp. */
function londonMidnightIso(iso: string): string {
  // UK is UTC+0 or UTC+1; find the offset at noon that day and apply it.
  const noonUtc = new Date(`${iso}T12:00:00Z`);
  const londonNoon = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).format(noonUtc);
  const offsetHours = Number(londonNoon) - 12;
  return new Date(Date.parse(`${iso}T00:00:00Z`) - offsetHours * 3600000).toISOString();
}

export type BoardWeek = {
  /** First day of the week, YYYY-MM-DD (UK date). */
  start: string;
  /** Last day of the week, YYYY-MM-DD. */
  end: string;
  /** Week start as a UTC timestamp, for "since" queries. */
  startsAt: string;
  /** e.g. "Fri 9 – Thu 15 Oct" */
  label: string;
};

export function boardWeek(weekStartDay: number | null | undefined, now: Date = new Date()): BoardWeek {
  const startDay = Number.isInteger(weekStartDay) ? Number(weekStartDay) : 1;
  const today = londonToday(now);
  const back = (today.weekday - startDay + 7) % 7;
  const start = addDays(today.iso, -back);
  const end = addDays(start, 6);

  const fmt = (iso: string, withMonth: boolean) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      ...(withMonth ? { month: "short" } : {}),
    });
  const sameMonth = start.slice(5, 7) === end.slice(5, 7);

  return {
    start,
    end,
    startsAt: londonMidnightIso(start),
    label: `${fmt(start, !sameMonth)} – ${fmt(end, true)}`,
  };
}
