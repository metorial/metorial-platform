export type LogStream = 'stdout' | 'stderr' | 'system';

export type LogStatus = 'open' | 'sealed';

export type LogDirection = 'forward' | 'backward';

export interface LogLine {
  index: number;
  text: string;
  stream?: LogStream;
  timestamp?: Date | string;
}

export interface LogPage {
  lines: LogLine[];
  hasMore: boolean;
  status: LogStatus;
  truncated?: boolean;
  lineCount?: number;
}

export interface LogFetchOptions {
  direction: LogDirection;
  cursor?: number;
  limit: number;
  signal?: AbortSignal;
}

export interface LogSource {
  fetch(opts: LogFetchOptions): Promise<LogPage>;
}
