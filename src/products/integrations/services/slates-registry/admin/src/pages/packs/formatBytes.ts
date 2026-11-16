export let formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;

  let units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
};
