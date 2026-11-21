import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { AgentTrackingRange, RangePreset } from './types';

export let maxRangeDays = 400;

export let defaultRangePreset = 'last_30_days' as const;

export let rangePresets = [
  'today',
  'last_7_days',
  'last_30_days',
  'month_to_date',
  'last_month'
] as const satisfies readonly RangePreset[];

let dayMs = 24 * 60 * 60 * 1000;

export type RangeInput = {
  preset?: RangePreset;
  from?: Date;
  to?: Date;
  timeZone?: string;
};

export type ResolvedRange = AgentTrackingRange;

type CalendarDate = { year: number; month: number; day: number };

let invalid = (message: string) => new ServiceError(badRequestError({ message }));

let formatters = new Map<string, Intl.DateTimeFormat>();

let formatterOf = (timeZone: string) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    formatters.set(timeZone, formatter);
  }

  return formatter;
};

let isValidTimeZone = (timeZone: string) => {
  try {
    formatterOf(timeZone);
    return true;
  } catch {
    return false;
  }
};

let wallClockOf = (at: Date, timeZone: string) => {
  let parts: Record<string, number> = {};
  for (let part of formatterOf(timeZone).formatToParts(at)) {
    if (part.type != 'literal') parts[part.type] = Number(part.value);
  }

  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
};

let offsetMsAt = (at: Date, timeZone: string) => {
  let wall = wallClockOf(at, timeZone);
  let asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second
  );

  return asUtc - (at.getTime() - at.getUTCMilliseconds());
};

// The offset is read twice because the first guess can sit on the other side of a DST change.
export let startOfDayIn = (date: CalendarDate, timeZone: string) => {
  let wall = Date.UTC(date.year, date.month - 1, date.day);
  let guess = wall - offsetMsAt(new Date(wall), timeZone);

  return new Date(wall - offsetMsAt(new Date(guess), timeZone));
};

export let calendarDateIn = (at: Date, timeZone: string): CalendarDate => {
  let wall = wallClockOf(at, timeZone);

  return { year: wall.year, month: wall.month, day: wall.day };
};

let shiftDays = (date: CalendarDate, days: number): CalendarDate => {
  let shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
};

let firstOfMonth = (date: CalendarDate, monthOffset: number): CalendarDate => {
  let shifted = new Date(Date.UTC(date.year, date.month - 1 + monthOffset, 1));

  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: 1 };
};

let presetRange = (preset: RangePreset, now: Date, timeZone: string) => {
  let today = calendarDateIn(now, timeZone);
  let start = (date: CalendarDate) => startOfDayIn(date, timeZone);

  switch (preset) {
    case 'today':
      return { from: start(today), to: now };
    case 'last_7_days':
      return { from: start(shiftDays(today, -6)), to: now };
    case 'last_30_days':
      return { from: start(shiftDays(today, -29)), to: now };
    case 'month_to_date':
      return { from: start(firstOfMonth(today, 0)), to: now };
    case 'last_month':
      return { from: start(firstOfMonth(today, -1)), to: start(firstOfMonth(today, 0)) };
  }
};

let daysInMonth = (date: CalendarDate) =>
  new Date(Date.UTC(date.year, date.month, 0)).getUTCDate();

let earlier = (a: Date, b: Date) => (a < b ? a : b);

export let previousRange = (range: ResolvedRange): { from: Date; to: Date } => {
  let timeZone = range.timeZone;
  let start = (date: CalendarDate) => startOfDayIn(date, timeZone);
  let length = range.to.getTime() - range.from.getTime();

  if (range.preset == 'today') {
    let from = start(shiftDays(calendarDateIn(range.from, timeZone), -1));

    return { from, to: earlier(new Date(from.getTime() + length), range.from) };
  }

  if (range.preset == 'month_to_date') {
    let today = calendarDateIn(range.to, timeZone);
    let month = firstOfMonth(today, -1);
    let elapsedToday = range.to.getTime() - start(today).getTime();
    let to =
      today.day > daysInMonth(month)
        ? range.from
        : earlier(
            new Date(start({ ...month, day: today.day }).getTime() + elapsedToday),
            range.from
          );

    return { from: start(month), to };
  }

  if (range.preset == 'last_month') {
    return {
      from: start(firstOfMonth(calendarDateIn(range.from, timeZone), -1)),
      to: range.from
    };
  }

  return { from: new Date(range.from.getTime() - length), to: range.from };
};

export let hasRange = (range: RangeInput | undefined): range is RangeInput =>
  !!range &&
  (range.preset !== undefined || range.from !== undefined || range.to !== undefined);

export let normalizeRange = (input: RangeInput) => {
  let timeZone = input.timeZone ?? 'UTC';
  if (!isValidTimeZone(timeZone)) throw invalid(`Unknown time zone "${timeZone}".`);

  let explicit = input.from !== undefined || input.to !== undefined;
  if (explicit && input.preset) throw invalid('Pass either range or from and to, not both.');
  if (explicit && (!input.from || !input.to)) throw invalid('Pass both from and to.');

  if (input.from && input.to) {
    if (input.to <= input.from) throw invalid('to must be after from.');
    if (input.to.getTime() - input.from.getTime() > maxRangeDays * dayMs) {
      throw invalid(`Ranges are limited to ${maxRangeDays} days.`);
    }

    return { preset: null, from: input.from, to: input.to, timeZone };
  }

  return { preset: input.preset ?? defaultRangePreset, from: null, to: null, timeZone };
};

export type NormalizedRange = ReturnType<typeof normalizeRange>;

export let resolveRange = (range: NormalizedRange, now: Date = new Date()): ResolvedRange => {
  if (range.preset)
    return {
      preset: range.preset,
      ...presetRange(range.preset, now, range.timeZone),
      timeZone: range.timeZone
    };

  return { preset: null, from: range.from!, to: range.to!, timeZone: range.timeZone };
};

export let rangeCacheKey = (range: NormalizedRange, now: Date = new Date()) =>
  range.preset
    ? {
        preset: range.preset,
        timeZone: range.timeZone,
        today: calendarDateKey(calendarDateIn(now, range.timeZone))
      }
    : {
        from: range.from!.toISOString(),
        to: range.to!.toISOString(),
        timeZone: range.timeZone
      };

export let queryRange = (range: { from: Date; to: Date }) => ({
  from: range.from.toISOString(),
  to: range.to.toISOString()
});

let pad = (value: number, length = 2) => String(value).padStart(length, '0');

export let calendarDateKey = (date: CalendarDate) =>
  `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`;

export let calendarDateOfKey = (key: string) => key.slice(0, 10);
