let units = ['B', 'KB', 'MB', 'GB', 'TB'];

export let formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;

  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  let rounded = value >= 100 ? Math.round(value).toString() : value.toFixed(1);
  if (rounded.endsWith('.0')) rounded = rounded.slice(0, -2);

  return `${rounded} ${units[unitIndex]}`;
};
