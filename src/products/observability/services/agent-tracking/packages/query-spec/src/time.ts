import { durationPattern } from './parse';
import type { Range, RangePreset } from './types';

let minuteMs = 60_000;
let hourMs = 60 * minuteMs;
let dayMs = 24 * hourMs;

export let timeUnits = ['hour', 'day', 'week', 'month', 'quarter', 'year'] as const;

export type TimeUnit = (typeof timeUnits)[number];

export type WallTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

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

export let isValidTimeZone = (timeZone: string) => {
  try {
    formatterOf(timeZone);
    return true;
  } catch {
    return false;
  }
};

export let wallTimeOf = (date: Date, timeZone: string): WallTime => {
  let parts: Record<string, number> = {};
  for (let part of formatterOf(timeZone).formatToParts(date)) {
    if (part.type != 'literal') parts[part.type] = Number(part.value);
  }

  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour! % 24,
    minute: parts.minute!,
    second: parts.second!,
    millisecond: date.getUTCMilliseconds()
  };
};

export let offsetMinutesAt = (date: Date, timeZone: string) => {
  let wall = wallTimeOf(date, timeZone);
  let asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.millisecond
  );

  return Math.round((asUtc - date.getTime()) / minuteMs);
};

// Wall times inside a DST gap resolve forward and ambiguous ones to the earlier instant, like
// `$dateTrunc` does.
export let instantOf = (wall: Partial<WallTime> & { year: number }, timeZone: string) => {
  let asUtc = Date.UTC(
    wall.year,
    (wall.month ?? 1) - 1,
    wall.day ?? 1,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
    wall.millisecond ?? 0
  );

  let guess = asUtc - offsetMinutesAt(new Date(asUtc), timeZone) * minuteMs;
  let second = asUtc - offsetMinutesAt(new Date(guess), timeZone) * minuteMs;
  if (second == guess) return new Date(guess);

  return new Date(Math.min(guess, second));
};

export let truncate = (date: Date, unit: TimeUnit, timeZone: string) => {
  let wall = wallTimeOf(date, timeZone);

  switch (unit) {
    case 'hour':
      return instantOf({ ...wall, minute: 0, second: 0, millisecond: 0 }, timeZone);
    case 'day':
      return instantOf({ year: wall.year, month: wall.month, day: wall.day }, timeZone);
    case 'week': {
      let weekday = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
      let back = (weekday + 6) % 7;
      let monday = new Date(Date.UTC(wall.year, wall.month - 1, wall.day - back));
      return instantOf(
        {
          year: monday.getUTCFullYear(),
          month: monday.getUTCMonth() + 1,
          day: monday.getUTCDate()
        },
        timeZone
      );
    }
    case 'month':
      return instantOf({ year: wall.year, month: wall.month }, timeZone);
    case 'quarter':
      return instantOf(
        { year: wall.year, month: Math.floor((wall.month - 1) / 3) * 3 + 1 },
        timeZone
      );
    case 'year':
      return instantOf({ year: wall.year }, timeZone);
  }
};

export let addUnits = (date: Date, unit: TimeUnit, count: number, timeZone: string) => {
  let wall = wallTimeOf(date, timeZone);

  switch (unit) {
    case 'hour':
      return new Date(date.getTime() + count * hourMs);
    case 'day':
      return instantOf({ ...wall, day: wall.day + count }, timeZone);
    case 'week':
      return instantOf({ ...wall, day: wall.day + count * 7 }, timeZone);
    case 'month':
      return instantOf({ ...wall, month: wall.month + count }, timeZone);
    case 'quarter':
      return instantOf({ ...wall, month: wall.month + count * 3 }, timeZone);
    case 'year':
      return instantOf({ ...wall, year: wall.year + count }, timeZone);
  }
};

export let bucketsBetween = (
  range: { from: Date; to: Date },
  unit: TimeUnit,
  timeZone: string,
  max: number
) => {
  let buckets: Date[] = [];
  let current = truncate(range.from, unit, timeZone);

  while (current < range.to && buckets.length <= max) {
    buckets.push(current);
    current = addUnits(current, unit, 1, timeZone);
  }

  return buckets;
};

let pad = (value: number, length = 2) => String(Math.abs(value)).padStart(length, '0');

export let formatInZone = (date: Date, timeZone: string) => {
  let wall = wallTimeOf(date, timeZone);
  let offset = offsetMinutesAt(date, timeZone);
  let sign = offset < 0 ? '-' : '+';
  let millis = wall.millisecond ? `.${pad(wall.millisecond, 3)}` : '';

  return (
    `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}` +
    `T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}${millis}` +
    `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
};

let explicitZone = /(Z|[+-]\d{2}:?\d{2})$/;

export let parseInstant = (value: string, timeZone: string) => {
  if (explicitZone.test(value)) return new Date(value);

  let [datePart, timePart = '00:00:00'] = value.split('T');
  let [year, month, day] = datePart!.split('-').map(Number);
  let [hour, minute, secondText = '0'] = timePart.split(':');
  let second = Number.parseFloat(secondText);

  return instantOf(
    {
      year: year!,
      month: month!,
      day: day!,
      hour: Number(hour),
      minute: Number(minute),
      second: Math.floor(second),
      millisecond: Math.round((second % 1) * 1000)
    },
    timeZone
  );
};

let presetRange = (preset: RangePreset, now: Date, timeZone: string) => {
  let unitOf: Record<RangePreset, { unit: TimeUnit; offset: number }> = {
    today: { unit: 'day', offset: 0 },
    yesterday: { unit: 'day', offset: -1 },
    this_week: { unit: 'week', offset: 0 },
    last_week: { unit: 'week', offset: -1 },
    this_month: { unit: 'month', offset: 0 },
    last_month: { unit: 'month', offset: -1 },
    this_quarter: { unit: 'quarter', offset: 0 },
    last_quarter: { unit: 'quarter', offset: -1 },
    this_year: { unit: 'year', offset: 0 }
  };

  let { unit, offset } = unitOf[preset];
  let from = addUnits(truncate(now, unit, timeZone), unit, offset, timeZone);
  let to = addUnits(from, unit, 1, timeZone);

  return { from, to };
};

export let durationRange = (last: string, now: Date, timeZone: string) => {
  let match = durationPattern.exec(last)!;
  let count = Number(match[1]);
  let unit = match[2]!;

  let fixed: Record<string, number> = { m: minuteMs, h: hourMs, d: dayMs, w: 7 * dayMs };
  if (fixed[unit]) return { from: new Date(now.getTime() - count * fixed[unit]!), to: now };

  let wall = wallTimeOf(now, timeZone);
  let from =
    unit == 'mo'
      ? instantOf({ ...wall, month: wall.month - count }, timeZone)
      : instantOf({ ...wall, year: wall.year - count }, timeZone);

  return { from, to: now };
};

export let resolveRange = (range: Range, d: { now: Date; timeZone: string }) => {
  if ('preset' in range) return presetRange(range.preset, d.now, d.timeZone);
  if ('last' in range) return durationRange(range.last, d.now, d.timeZone);

  return {
    from: parseInstant(range.from, d.timeZone),
    to: parseInstant(range.to, d.timeZone)
  };
};

export let shiftRange = (
  range: { from: Date; to: Date },
  by: 'period' | 'year',
  timeZone: string
) => {
  if (by == 'year') {
    return {
      from: addUnits(range.from, 'year', -1, timeZone),
      to: addUnits(range.to, 'year', -1, timeZone)
    };
  }

  let span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime()) };
};

export let rangeDays = (range: { from: Date; to: Date }) =>
  (range.to.getTime() - range.from.getTime()) / dayMs;
