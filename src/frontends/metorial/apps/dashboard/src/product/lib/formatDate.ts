export let toDate = (date: Date | string | number | null | undefined) => {
  if (date == null) return null;
  let parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

let formatShortDate = (date: Date | string | number | null | undefined) => {
  let parsed = toDate(date);
  if (!parsed) return '—';

  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export let formatRelativeTime = (
  date: Date | string | number | null | undefined,
  now: Date | number = Date.now()
) => {
  let parsed = toDate(date);
  if (!parsed) return '—';

  let nowMs = now instanceof Date ? now.getTime() : now;
  let diffSeconds = Math.round((nowMs - parsed.getTime()) / 1000);
  let isFuture = diffSeconds < 0;
  let seconds = Math.abs(diffSeconds);

  if (seconds < 45) return isFuture ? 'in a few seconds' : 'just now';

  let phrase: string;
  let minutes = Math.round(seconds / 60);
  let hours = Math.round(seconds / 3600);
  let days = Math.round(seconds / 86400);

  if (minutes < 60) phrase = `${minutes} min`;
  else if (hours < 24) phrase = `${hours} hr`;
  else if (days < 30) phrase = `${days} ${days == 1 ? 'day' : 'days'}`;
  else return formatShortDate(parsed);

  return isFuture ? `in ${phrase}` : `${phrase} ago`;
};
