let binaryUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

let trimNumber = (value: number, maxFractionDigits: number) =>
  Number(value.toFixed(maxFractionDigits)).toString();

export let formatBytes = (
  bytes: number | null | undefined,
  opts?: { maxFractionDigits?: number }
) => {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  if (bytes == 0) return '0 B';

  let sign = bytes < 0 ? '-' : '';
  let value = Math.abs(bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < binaryUnits.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  let digits = unitIndex == 0 ? 0 : (opts?.maxFractionDigits ?? 1);
  let rounded = trimNumber(value, digits);

  if (Number(rounded) >= 1024 && unitIndex < binaryUnits.length - 1) {
    rounded = '1';
    unitIndex++;
  }

  return `${sign}${rounded} ${binaryUnits[unitIndex]}`;
};
