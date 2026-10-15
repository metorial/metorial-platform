export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface ResizeScheduler {
  schedule(size: TerminalSize): void;
  flush(): void;
  cancel(): void;
}

let isValidSize = (size: TerminalSize) =>
  Number.isFinite(size.cols) && Number.isFinite(size.rows) && size.cols > 0 && size.rows > 0;

let isSameSize = (a: TerminalSize | null, b: TerminalSize) =>
  !!a && a.cols == b.cols && a.rows == b.rows;

export let createResizeScheduler = (opts: {
  delayMs: number;
  initial?: TerminalSize;
  onResize: (size: TerminalSize) => void;
}): ResizeScheduler => {
  let sent: TerminalSize | null = opts.initial ?? null;
  let pending: TerminalSize | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  let clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  let flush = () => {
    clearTimer();

    let next = pending;
    pending = null;

    if (!next || isSameSize(sent, next)) return;

    sent = next;
    opts.onResize(next);
  };

  return {
    schedule: size => {
      if (!isValidSize(size)) return;

      pending = { cols: size.cols, rows: size.rows };

      clearTimer();
      timer = setTimeout(flush, opts.delayMs);
    },

    flush,

    cancel: () => {
      clearTimer();
      pending = null;
    }
  };
};
