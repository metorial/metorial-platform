export type TerminalStatus =
  | 'connecting'
  | 'waking'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'error';

export type TerminalSignal = 'INT' | 'TERM' | 'KILL' | 'HUP' | 'QUIT';

export interface TerminalStatusDetail {
  message?: string;
  code?: number;
}

export interface TerminalExit {
  code: number | null;
  signal: string | null;
}

export type TerminalNoticeKind = 'idle_warning' | 'idle' | 'closing' | 'info';

export interface TerminalNotice {
  kind: TerminalNoticeKind;
  message: string;
}

export interface TerminalSessionHandlers {
  onOutput(data: Uint8Array): void;
  onStatus(status: TerminalStatus, detail?: TerminalStatusDetail): void;
  onExit(exit: TerminalExit): void;
  onNotice(notice: TerminalNotice): void;
  onNoticeClear?(): void;
}

export interface TerminalSession {
  write(data: Uint8Array | string): void;
  resize(cols: number, rows: number): void;
  signal(signal: TerminalSignal): void;
  reconnect(): void;
  detach(): void;
  close(): void;
}

export interface TerminalOpenOptions {
  sessionKey: string;
  cols: number;
  rows: number;

  // Set when the user explicitly asks for a new session: the transport must not resume
  // whatever server session it remembers for this sessionKey.
  fresh?: boolean;
}

export interface TerminalTransport {
  open(opts: TerminalOpenOptions, handlers: TerminalSessionHandlers): TerminalSession;
}
