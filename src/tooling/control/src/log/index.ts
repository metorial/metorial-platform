export type LogOptions = {
  verbose?: boolean;
};

let useColor = () => process.stderr.isTTY && process.env.CI !== 'true';

let wrap = (code: string, text: string) => (useColor() ? `\x1b[${code}m${text}\x1b[0m` : text);

export let bold = (text: string) => wrap('1', text);
export let dim = (text: string) => wrap('2', text);
export let red = (text: string) => wrap('31', text);
export let green = (text: string) => wrap('32', text);
export let yellow = (text: string) => wrap('33', text);
export let cyan = (text: string) => wrap('36', text);

export let isVerbose = (opts?: LogOptions) =>
  !!opts?.verbose || process.env.CONTROL_VERBOSE === '1';

export let createLogger = (opts?: LogOptions) => {
  let verbose = isVerbose(opts);

  return {
    info: (msg: string) => console.log(msg),
    success: (msg: string) => console.log(green(msg)),
    warn: (msg: string) => console.warn(yellow(msg)),
    error: (msg: string) => console.error(red(msg)),
    debug: (msg: string) => {
      if (verbose) console.log(dim(msg));
    },
    section: (title: string) => console.log(bold(title)),
    detail: (label: string, value: string) => console.log(`  ${label.padEnd(14)}${value}`),
    list: (items: string[], indent = 2) => {
      let pad = ' '.repeat(indent);
      for (let item of items) console.log(`${pad}${item}`);
    },
    blank: () => console.log('')
  };
};

export let log = createLogger();

export let formatDuration = (ms: number): string => {
  let totalSec = Math.round(ms / 1000);
  let min = Math.floor(totalSec / 60);
  let sec = totalSec % 60;
  return `${min}m ${String(sec).padStart(2, '0')}s`;
};

export let formatDurationShort = (ms: number): string => {
  let totalSec = Math.round(ms / 1000);
  let min = Math.floor(totalSec / 60);
  let sec = totalSec % 60;
  if (min > 0) return `${min}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
};
