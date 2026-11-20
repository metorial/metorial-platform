export type ValueFormatter = (value: number) => string;

// A tooltip value with the series it belongs to: one id for a series row, every contributing id
// for a stacked total.
export type SeriesValueFormatter = (value: number, seriesIds: string[]) => string;

export type TooltipValueFormatter = (value: number, seriesIds?: string[]) => string;

let binaryByteUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
let decimalByteUnits = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

let durationUnits = [
  { suffix: 'd', ms: 86_400_000 },
  { suffix: 'h', ms: 3_600_000 },
  { suffix: 'm', ms: 60_000 },
  { suffix: 's', ms: 1_000 }
];

let invalidValue = '—';

let currencySymbols: Record<string, string> = { usd: '$' };

let decimalPattern = /^([+-])?(\d*)(?:\.(\d*))?$/;

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

let toDecimalString = (value: string | number) => {
  if (typeof value == 'string') return value.trim();
  if (!Number.isFinite(value) || Math.abs(value) >= 1e21) return undefined;

  return value.toFixed(12);
};

let zero = BigInt(0);

let one = BigInt(1);

let groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// Decimal strings are rounded on their digits, so amounts with up to nine decimals are never
// pushed through a float on the way to the screen.
export let formatCurrency = (
  value: string | number,
  opts: { currency?: string; precision?: number; compact?: boolean } = {}
) => {
  let currency = (opts.currency ?? 'usd').toLowerCase();
  let symbol = currencySymbols[currency];
  let decorate = (sign: string, amount: string) =>
    symbol ? `${sign}${symbol}${amount}` : `${sign}${amount} ${currency.toUpperCase()}`;

  let number = Number(value);

  // Below a thousand, compact notation only drops cents ("$0.5"), so amounts keep them.
  if (opts.compact && Math.abs(number) >= 1000) {
    if (!Number.isFinite(number)) return invalidValue;

    let formatted = new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(Math.abs(number));

    return decorate(number < 0 ? '-' : '', formatted);
  }

  let decimal = toDecimalString(value);
  let match = decimal ? decimalPattern.exec(decimal) : null;
  if (!match || (!match[2] && !match[3])) return invalidValue;

  let precision = Math.max(0, Math.floor(opts.precision ?? 2));
  let negative = match[1] == '-';
  let whole = match[2] || '0';
  let fraction = match[3] ?? '';

  let scaled = BigInt(whole + fraction.padEnd(precision, '0').slice(0, precision));
  if ((fraction[precision] ?? '0') >= '5') scaled += one;

  let isNonZero = /[1-9]/.test(whole + fraction);

  if (scaled == zero && isNonZero) {
    let smallest = precision > 0 ? `0.${'0'.repeat(precision - 1)}1` : '1';
    return negative ? `>${decorate('-', smallest)}` : `<${decorate('', smallest)}`;
  }

  let digits = scaled.toString().padStart(precision + 1, '0');
  let integerPart = precision > 0 ? digits.slice(0, -precision) : digits;
  let fractionPart = precision > 0 ? `.${digits.slice(-precision)}` : '';

  return decorate(
    negative && scaled != zero ? '-' : '',
    groupThousands(integerPart) + fractionPart
  );
};
