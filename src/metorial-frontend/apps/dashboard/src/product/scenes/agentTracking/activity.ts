let minuteMs = 60 * 1000;

let hourMs = 60 * minuteMs;

let dayMs = 24 * hourMs;

let activeNowMs = 5 * minuteMs;

type SessionActivity =
  { kind: 'active' } | { kind: 'idle'; quietMs: number } | { kind: 'ended' };

export let sessionActivity = (
  session: { state: 'active' | 'idle' | 'ended'; lastActivityAt: Date },
  now: Date
): SessionActivity => {
  if (session.state == 'ended') return { kind: 'ended' };

  let quietMs = Math.max(0, now.getTime() - new Date(session.lastActivityAt).getTime());
  if (quietMs < activeNowMs) return { kind: 'active' };

  return { kind: 'idle', quietMs };
};

export let formatSpan = (ms: number) => {
  let minutes = Math.floor(Math.max(0, ms) / minuteMs);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;

  let hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;

  let days = Math.floor(hours / 24);
  let restHours = hours % 24;

  return restHours ? `${days}d ${restHours}h` : `${days}d`;
};

export let activityLabel = (activity: SessionActivity) => {
  if (activity.kind == 'active') return 'Active Now';
  if (activity.kind == 'ended') return 'Ended';

  return `Idle · ${formatSpan(activity.quietMs)}`;
};

export let sessionLength = (session: { startedAt: Date; lastActivityAt: Date }) =>
  new Date(session.lastActivityAt).getTime() - new Date(session.startedAt).getTime();

let calendarDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export let formatDayLabel = (value: Date, now: Date) => {
  let date = new Date(value);
  let days = Math.round((calendarDay(now) - calendarDay(date)) / dayMs);

  if (days == 0) return 'Today';
  if (days == 1) return 'Yesterday';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() == now.getFullYear() ? {} : { year: 'numeric' })
  }).format(date);
};

export let formatTime = (value: Date) =>
  new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(value))
    .replace(/ /g, ' ');

export let formatDateTime = (value: Date, now: Date) =>
  `${formatDayLabel(value, now)}, ${formatTime(value)}`;

export let formatTimeSpan = (from: Date, to: Date, now: Date) =>
  calendarDay(new Date(from)) == calendarDay(new Date(to))
    ? `${formatDateTime(from, now)} to ${formatTime(to)}`
    : `${formatDateTime(from, now)} to ${formatDateTime(to, now)}`;
