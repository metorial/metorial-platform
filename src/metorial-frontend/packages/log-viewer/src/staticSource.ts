import type { LogFetchOptions, LogLine, LogSource, LogStatus } from './types';

let lowerBound = (lines: LogLine[], index: number) => {
  let low = 0;
  let high = lines.length;

  while (low < high) {
    let mid = (low + high) >> 1;
    if (lines[mid].index < index) low = mid + 1;
    else high = mid;
  }

  return low;
};

export let paginateLogLines = (
  lines: LogLine[],
  opts: Pick<LogFetchOptions, 'direction' | 'cursor' | 'limit'>
) => {
  let limit = Math.max(0, opts.limit);

  if (opts.direction == 'backward') {
    let endPosition =
      opts.cursor === undefined ? lines.length : lowerBound(lines, opts.cursor);
    let startPosition = Math.max(0, endPosition - limit);

    return {
      lines: lines.slice(startPosition, endPosition),
      hasMore: startPosition > 0
    };
  }

  let startPosition = opts.cursor === undefined ? 0 : lowerBound(lines, opts.cursor);
  let endPosition = Math.min(lines.length, startPosition + limit);

  return {
    lines: lines.slice(startPosition, endPosition),
    hasMore: endPosition < lines.length
  };
};

export let createStaticLogSource = (
  lines: (string | LogLine)[],
  opts: { status?: LogStatus; truncated?: boolean } = {}
): LogSource => {
  let normalized = lines
    .map((line, position) =>
      typeof line == 'string' ? { index: position, text: line } : line
    )
    .sort((a, b) => a.index - b.index);

  return {
    fetch: async request => ({
      ...paginateLogLines(normalized, request),
      status: opts.status ?? 'sealed',
      truncated: opts.truncated ?? false,
      lineCount: normalized.length
    })
  };
};
