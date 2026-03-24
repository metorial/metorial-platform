import { encode } from '@toon-format/toon';

export type SlateLogType = 'info' | 'warn' | 'error' | 'progress';

export type SlateLogMessageInput =
  | string
  | Error
  | boolean
  | number
  | null
  | undefined
  | object
  | SlateLogMessageInput[];

let formatMessage = (message: SlateLogMessageInput): string => {
  if (typeof message === 'object') {
    if (message === null) return 'null';
    if (message instanceof Error) {
      return `[ERROR]: ${message.name}: ${message.message}\n${message.stack}`;
    }
    return encode(message);
  }

  return String(message);
};

export interface SlateLogEntry {
  type: SlateLogType;
  message: string;
  timestamp: Date;
}

export type SlateLogListener = (entries: SlateLogEntry[]) => void;

export class SlateLogger {
  #logs: SlateLogEntry[] = [];
  #listeners: SlateLogListener[] = [];
  #timer: NodeJS.Timeout | null = null;

  constructor(listeners: SlateLogListener[] = []) {
    this.#listeners.push(...listeners);
  }

  private flush() {
    if (this.#timer) clearTimeout(this.#timer);
    if (this.#logs.length === 0) return;

    for (let listener of this.#listeners) {
      listener(this.#logs);
    }
  }

  private scheduleFlush() {
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.flush();
      this.#timer = null;
    }, 10);
  }

  log(type: SlateLogType, message: SlateLogMessageInput) {
    this.#logs.push({
      type,
      timestamp: new Date(),
      message: formatMessage(message)
    });
    this.scheduleFlush();
  }

  info(...message: SlateLogMessageInput[]) {
    this.log('info', message.flat());
  }

  warn(...message: SlateLogMessageInput[]) {
    this.log('warn', message.flat());
  }

  error(...message: SlateLogMessageInput[]) {
    this.log('error', message.flat());
  }

  progress(...message: SlateLogMessageInput[]) {
    this.log('progress', message.flat());
  }
}
