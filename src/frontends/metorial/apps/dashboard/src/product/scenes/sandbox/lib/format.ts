import { formatBytes } from '../../../lib/formatBytes';
import { toDate } from '../../../lib/formatDate';

export { formatBytes } from '../../../lib/formatBytes';

let trimNumber = (value: number, maxFractionDigits: number) =>
  Number(value.toFixed(maxFractionDigits)).toString();

export let formatGib = (gib: number | null | undefined) => {
  if (gib == null || !Number.isFinite(gib)) return '—';
  return formatBytes(gib * 1024 ** 3);
};

export let formatMib = (mib: number | null | undefined) => {
  if (mib == null || !Number.isFinite(mib)) return '—';
  return formatBytes(mib * 1024 ** 2);
};

export let formatCpus = (cpus: number | null | undefined) => {
  if (cpus == null || !Number.isFinite(cpus)) return '—';
  return `${trimNumber(cpus, 2)} vCPU`;
};

export let formatSpec = (
  spec:
    | { cpus: number | null | undefined; memory_gib: number | null | undefined }
    | null
    | undefined
) => {
  if (!spec) return '—';
  return `${formatCpus(spec.cpus)} · ${formatGib(spec.memory_gib)}`;
};

export let formatPercent = (ratio: number | null | undefined, maxFractionDigits = 0) => {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return `${trimNumber(ratio * 100, maxFractionDigits)}%`;
};

export let formatDuration = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(ms)) return '—';

  let totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds == 0) return ms > 0 ? '<1s' : '0s';

  let units: [number, string][] = [
    [Math.floor(totalSeconds / 86400), 'd'],
    [Math.floor((totalSeconds % 86400) / 3600), 'h'],
    [Math.floor((totalSeconds % 3600) / 60), 'm'],
    [totalSeconds % 60, 's']
  ];

  let leading = units.findIndex(([value]) => value > 0);

  return units
    .slice(leading, leading + 2)
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value}${unit}`)
    .join(' ');
};

export let formatDurationBetween = (
  start: Date | string | number | null | undefined,
  end?: Date | string | number | null
) => {
  let startDate = toDate(start);
  if (!startDate) return '—';

  let endDate = toDate(end) ?? new Date();
  return formatDuration(endDate.getTime() - startDate.getTime());
};

export let formatAbsoluteTime = (date: Date | string | number | null | undefined) => {
  let parsed = toDate(date);
  if (!parsed) return '—';

  return parsed.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export let formatEnumLabel = (value: string | null | undefined) => {
  if (!value) return '—';

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
