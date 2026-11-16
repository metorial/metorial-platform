export type Log = (message: string) => void;

export let formatDuration = (ms: number) => {
  let seconds = Math.max(0, Math.round(ms / 1000));
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor((seconds % 3600) / 60);
  let rest = seconds % 60;

  if (hours)
    return `${hours}h${String(minutes).padStart(2, '0')}m${String(rest).padStart(2, '0')}s`;
  if (minutes) return `${minutes}m${String(rest).padStart(2, '0')}s`;
  return `${rest}s`;
};

export let formatTokens = (count: number) =>
  count >= 10_000
    ? `${(count / 1000).toFixed(0)}k`
    : count >= 1000
      ? `${(count / 1000).toFixed(1)}k`
      : String(count);

export let formatCost = (dollars: number) =>
  `$${dollars < 1 ? dollars.toFixed(3) : dollars.toFixed(2)}`;

export let shorten = (value: string, limit: number) => {
  let flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
};

// Every line carries the time since the run started, so a slow stretch in the Actions log can be
// read off directly.
export let createLogger = (
  startedAt = Date.now(),
  write: (line: string) => void = line => console.log(line)
): Log => {
  return message => {
    let clock = formatDuration(Date.now() - startedAt).padStart(7);
    let [first, ...rest] = message.split('\n');

    write(`[${clock}] ${first}`);
    for (let line of rest) write(`${' '.repeat(clock.length + 3)}${line}`);
  };
};
