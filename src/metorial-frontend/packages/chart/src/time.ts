export type ChartTime = Date | string | number;

let DAY = 86_400_000;

let clockFormat = new Intl.DateTimeFormat('en', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

let dayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

let monthFormat = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });

let tooltipFormats = {
  minutes: new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }),

  seconds: new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }),

  minutesWithYear: new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
};

export let toTimestamp = (value: ChartTime) =>
  value instanceof Date ? value.getTime() : new Date(value).getTime();

export let formatTimeTick = (value: ChartTime, spanMs: number) => {
  let date = new Date(toTimestamp(value));

  if (spanMs > 180 * DAY) return monthFormat.format(date);
  if (spanMs > 3 * DAY) return dayFormat.format(date);

  let isMidnight = date.getHours() == 0 && date.getMinutes() == 0;
  if (isMidnight) return dayFormat.format(date);

  return clockFormat.format(date);
};

export let formatTooltipTime = (
  value: ChartTime,
  opts: { seconds?: boolean; now?: Date } = {}
) => {
  let date = new Date(toTimestamp(value));
  let now = opts.now ?? new Date();

  if (date.getFullYear() != now.getFullYear()) {
    return tooltipFormats.minutesWithYear.format(date);
  }

  return (opts.seconds ? tooltipFormats.seconds : tooltipFormats.minutes).format(date);
};

let isCurrentYear = (date: Date, now: Date) => date.getFullYear() == now.getFullYear();

let dayWithYearFormat = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

let clockWithSecondsFormat = new Intl.DateTimeFormat('en', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

export let formatBucketTime = (start: ChartTime, stepMs: number) => {
  let date = new Date(toTimestamp(start));
  if (stepMs >= DAY) return dayFormat.format(date);
  return (stepMs < 60_000 ? clockWithSecondsFormat : clockFormat).format(date);
};

export let formatBucketRange = (
  start: ChartTime,
  stepMs: number,
  opts: { now?: Date } = {}
) => {
  let from = new Date(toTimestamp(start));
  let now = opts.now ?? new Date();
  let day = (isCurrentYear(from, now) ? dayFormat : dayWithYearFormat).format(from);

  if (stepMs >= DAY) {
    if (stepMs == DAY) return day;
    let to = new Date(from.getTime() + stepMs - DAY);
    return `${day} – ${(isCurrentYear(to, now) ? dayFormat : dayWithYearFormat).format(to)}`;
  }

  let to = new Date(from.getTime() + stepMs);
  return `${day} · ${formatBucketTime(from, stepMs)} – ${formatBucketTime(to, stepMs)}`;
};
