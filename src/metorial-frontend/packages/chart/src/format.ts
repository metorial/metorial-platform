export type ValueFormatter = (value: number) => string;

let binaryByteUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
let decimalByteUnits = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

let durationUnits = [
  { suffix: 'd', ms: 86_400_000 },
  { suffix: 'h', ms: 3_600_000 },
  { suffix: 'm', ms: 60_000 },
  { suffix: 's', ms: 1_000 }
];

let invalidValue = '—';

let roundTo = (value: number, precision: number) => {
  let factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

let formatFraction = (value: number, precision: number) =>
  new Intl.NumberFormat('en', {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0
  }).format(value);

export let formatNumber = (
  value: number,
  opts: { precision?: number; compact?: boolean; unit?: string } = {}
) => {
  if (!Number.isFinite(value)) return invalidValue;

  let formatted = new Intl.NumberFormat('en', {
    maximumFractionDigits: opts.precision ?? 2,
    notation: opts.compact ? 'compact' : 'standard'
  }).format(value);

  return opts.unit ? `${formatted} ${opts.unit}` : formatted;
};

export let formatBytes = (
  bytes: number,
  opts: { base?: 1000 | 1024; precision?: number } = {}
) => {
  if (!Number.isFinite(bytes)) return invalidValue;

  let base = opts.base ?? 1024;
  let precision = opts.precision ?? 1;
  let units = base == 1024 ? binaryByteUnits : decimalByteUnits;

  let sign = bytes < 0 ? '-' : '';
  let absolute = Math.abs(bytes);

  let exponent =
    absolute < base
      ? 0
      : Math.min(Math.floor(Math.log(absolute) / Math.log(base)), units.length - 1);
  let scaled = roundTo(absolute / base ** exponent, exponent == 0 ? 0 : precision);

  if (scaled >= base && exponent < units.length - 1) {
    exponent += 1;
    scaled = roundTo(absolute / base ** exponent, precision);
  }

  return `${sign}${formatFraction(scaled, exponent == 0 ? 0 : precision)} ${units[exponent]}`;
};

export let formatPercent = (
  value: number,
  opts: { precision?: number; scale?: 'ratio' | 'percent' } = {}
) => {
  if (!Number.isFinite(value)) return invalidValue;

  let ratio = opts.scale == 'percent' ? value / 100 : value;

  return new Intl.NumberFormat('en', {
    style: 'percent',
    maximumFractionDigits: opts.precision ?? 1
  }).format(ratio);
};

export let formatDuration = (
  milliseconds: number,
  opts: { units?: number; unit?: 'ms' | 's' } = {}
) => {
  if (!Number.isFinite(milliseconds)) return invalidValue;

  let ms = opts.unit == 's' ? milliseconds * 1000 : milliseconds;
  let sign = ms < 0 ? '-' : '';
  let remaining = Math.abs(ms);

  if (remaining < 1000) return `${sign}${Math.round(remaining)}ms`;

  let maxParts = opts.units ?? 2;
  let parts: string[] = [];

  for (let unit of durationUnits) {
    if (parts.length >= maxParts) break;

    let count = Math.floor(remaining / unit.ms);
    remaining -= count * unit.ms;

    if (count > 0) parts.push(`${count}${unit.suffix}`);
    else if (parts.length) break;
  }

  return `${sign}${parts.join(' ')}`;
};
