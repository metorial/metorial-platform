import type {
  TerminalSession,
  TerminalSessionHandlers,
  TerminalSignal,
  TerminalStatusDetail,
  TerminalTransport
} from '@metorial/terminal';
import {
  createSandboxAccessCache,
  defaultSandboxWebSocketFactory,
  describeSandboxConnectionNotice,
  getAccessErrorMessage,
  getSandboxSocketProtocols,
  isSandboxConnectionNotice,
  SOCKET_OPEN,
  type SandboxAccessGrant,
  type SandboxAccessProvider,
  type SandboxConnectionNotice,
  type SandboxWebSocketFactory
} from './common';

let encoder = new TextEncoder();

let clampSize = (value: number) => Math.min(1000, Math.max(1, Math.round(value) || 1));

export let encodeShellOpen = (opts: {
  cols: number;
  rows: number;
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
}) =>
  JSON.stringify({
    type: 'open',
    v: 1,
    tty: true,
    cols: clampSize(opts.cols),
    rows: clampSize(opts.rows),
    ...(opts.command?.length && { command: opts.command }),
    ...(opts.cwd && { cwd: opts.cwd }),
    ...(opts.env && Object.keys(opts.env).length && { env: opts.env })
  });

export let encodeShellAttach = (sessionId: string, offset: number) =>
  JSON.stringify({ type: 'attach', v: 1, sessionId, offset: Math.max(0, Math.floor(offset)) });

export let encodeShellResize = (cols: number, rows: number) =>
  JSON.stringify({ type: 'resize', cols: clampSize(cols), rows: clampSize(rows) });

export let encodeShellSignal = (signal: TerminalSignal) =>
  JSON.stringify({ type: 'signal', signal });

export let encodeShellStdinEof = () => JSON.stringify({ type: 'stdin_eof' });

export let encodeShellInput = (data: Uint8Array | string) =>
  typeof data == 'string' ? encoder.encode(data) : data;

export let decodeShellOutput = (
  data: ArrayBuffer | ArrayBufferView,
  tty: boolean
): { stream: 'stdout' | 'stderr' | null; data: Uint8Array } => {
  let bytes = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);

  if (tty) return { stream: null, data: bytes };

  return {
    stream: bytes[0] == 2 ? 'stderr' : 'stdout',
    data: bytes.subarray(1)
  };
};

export type SandboxShellMessage =
  | {
      type: 'session_init';
      sessionId: string;
      pid?: number;
      tty: boolean;
      resumed: boolean;
      offset: number;
    }
  | { type: 'output_gap'; from: number; to: number }
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'error'; code: string; message: string }
  | SandboxConnectionNotice;

export let parseShellMessage = (text: string): SandboxShellMessage | null => {
  let message: unknown;

  try {
    message = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof message != 'object' || message === null) return null;
  if (isSandboxConnectionNotice(message)) return message;

  let raw = message as Record<string, any>;

  switch (raw.type) {
    case 'session_init':
      if (typeof raw.sessionId != 'string') return null;
      return {
        type: 'session_init',
        sessionId: raw.sessionId,
        pid: typeof raw.pid == 'number' ? raw.pid : undefined,
        tty: raw.tty !== false,
        resumed: !!raw.resumed,
        offset: Number(raw.offset) || 0
      };

    case 'output_gap':
      return { type: 'output_gap', from: Number(raw.from) || 0, to: Number(raw.to) || 0 };

    case 'exit':
      return {
        type: 'exit',
        code: typeof raw.code == 'number' ? raw.code : null,
        signal: typeof raw.signal == 'string' ? raw.signal : null
      };

    case 'error': {
      let error = typeof raw.error == 'object' && raw.error ? raw.error : raw;
      return {
        type: 'error',
        code: String(error.code ?? 'unknown'),
        message: String(error.message ?? 'The shell reported an error.')
      };
    }

    default:
      return null;
  }
};

export interface SandboxShellSessionRecord {
  sessionId: string;
}

export interface SandboxShellSessionStore {
  get(key: string): SandboxShellSessionRecord | undefined;
  set(key: string, record: SandboxShellSessionRecord): void;
  delete(key: string): void;
}

let SESSION_STORAGE_PREFIX = 'metorial:sandbox-shell:';

export let createBrowserShellSessionStore = (): SandboxShellSessionStore => {
  let memory = new Map<string, SandboxShellSessionRecord>();

  let getStorage = () => {
    try {
      return globalThis.sessionStorage ?? null;
    } catch {
      return null;
    }
  };

  return {
    get: key => {
      try {
        let raw = getStorage()?.getItem(SESSION_STORAGE_PREFIX + key);
        let parsed = raw ? JSON.parse(raw) : null;
        if (typeof parsed?.sessionId == 'string') return { sessionId: parsed.sessionId };
      } catch {}

      return memory.get(key);
    },

    set: (key, record) => {
      memory.set(key, record);

      try {
        getStorage()?.setItem(SESSION_STORAGE_PREFIX + key, JSON.stringify(record));
      } catch {}
    },

    delete: key => {
      memory.delete(key);

      try {
        getStorage()?.removeItem(SESSION_STORAGE_PREFIX + key);
      } catch {}
    }
  };
};

let defaultSessionStore: SandboxShellSessionStore | null = null;

let getDefaultSessionStore = () => (defaultSessionStore ??= createBrowserShellSessionStore());

export interface SandboxShellTransportOptions {
  getAccess: SandboxAccessProvider;
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  isSleeping?: () => boolean;
  wakingDelayMs?: number;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  sessionStore?: SandboxShellSessionStore;
  createWebSocket?: SandboxWebSocketFactory;
}

let DETACH_CLOSE_CODE = 4000;

let GAP_NOTICE = encoder.encode(
  '\r\n\x1b[2m[Earlier output is no longer available]\x1b[0m\r\n'
);
let RESTART_NOTICE = encoder.encode(
  '\r\n\x1b[2m[The machine restarted. Starting a new shell.]\x1b[0m\r\n'
);

export let createSandboxShellTransport = (
  opts: SandboxShellTransportOptions
): TerminalTransport => {
  let access = createSandboxAccessCache(opts.getAccess);
  let store = opts.sessionStore ?? getDefaultSessionStore();
  let createWebSocket = opts.createWebSocket ?? defaultSandboxWebSocketFactory;

  let wakingDelayMs = opts.wakingDelayMs ?? 1500;
  let maxReconnectAttempts = opts.maxReconnectAttempts ?? 8;
  let reconnectBaseDelayMs = opts.reconnectBaseDelayMs ?? 500;
  let reconnectMaxDelayMs = opts.reconnectMaxDelayMs ?? 15000;

  return {
    open: (
      { sessionKey, cols, rows, fresh },
      handlers: TerminalSessionHandlers
    ): TerminalSession => {
      if (fresh) store.delete(sessionKey);

      let size = { cols, rows };
      let sessionId: string | null = store.get(sessionKey)?.sessionId ?? null;
      let offset = 0;

      let socket: WebSocket | null = null;
      let isConnected = false;
      let isEnded = false;
      let isDisposed = false;
      let attempt = 0;
      let generation = 0;

      let wakingTimer: ReturnType<typeof setTimeout> | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

      let clearTimers = () => {
        if (wakingTimer) clearTimeout(wakingTimer);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        wakingTimer = null;
        reconnectTimer = null;
      };

      let forgetSession = () => {
        sessionId = null;
        offset = 0;
        store.delete(sessionKey);
      };

      let dropSocket = (code: number, reason: string) => {
        let current = socket;
        socket = null;
        isConnected = false;

        if (current) {
          try {
            current.close(code, reason);
          } catch {}
        }
      };

      let end = (detail?: TerminalStatusDetail) => {
        clearTimers();
        isEnded = true;
        isConnected = false;
        handlers.onStatus('ended', detail);
      };

      let fail = (detail: TerminalStatusDetail) => {
        clearTimers();
        isConnected = false;
        handlers.onStatus('error', detail);
      };

      let scheduleReconnect = (detail: TerminalStatusDetail, delayFactor = 1) => {
        attempt++;
        if (attempt > maxReconnectAttempts) return fail(detail);

        let base = Math.min(reconnectMaxDelayMs, reconnectBaseDelayMs * 2 ** (attempt - 1));
        let delay = base * delayFactor * (0.8 + Math.random() * 0.4);

        handlers.onStatus('reconnecting', detail);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void connect('reconnecting');
        }, delay);
      };

      let handleClose = (
        event: { code: number; reason: string },
        ctx: { opened: boolean; exited: boolean; lastError: { message: string } | null }
      ) => {
        let { code, reason } = event;

        if (ctx.exited || (code == 1000 && reason == 'exited')) {
          forgetSession();
          return end();
        }

        switch (code) {
          case 4404:
            if (reason == 'session_not_found' && sessionId) {
              forgetSession();
              return void connect('reconnecting');
            }
            return fail({ message: 'This machine could not be found.', code });

          case 4410:
            forgetSession();
            if (reason == 'session_ended')
              return end({ message: 'The shell session ended.', code });
            return end({ message: 'The machine was terminated.', code });

          case 4409:
            return fail({
              message:
                'This session is open in another tab. Retry to continue here, or start a new session.',
              code
            });

          case 1012:
            if (reason == 'machine_restarting') {
              forgetSession();
              handlers.onOutput(RESTART_NOTICE);
              return scheduleReconnect({ message: 'The machine is restarting.', code });
            }
            if (reason == 'machine_terminated') {
              forgetSession();
              return end({ message: 'The machine was terminated.', code });
            }
            return fail({ message: 'The machine paused. Reconnect to wake it.', code });

          case 1000:
            if (reason == 'idle_timeout') {
              return fail({
                message: 'Disconnected after being idle. Reconnect to continue.',
                code
              });
            }
            return fail({ message: 'The connection was closed.', code });

          case 4400:
          case 1008:
            return fail({
              message: ctx.lastError?.message ?? 'The machine rejected the shell request.',
              code
            });

          case 4500:
            forgetSession();
            return fail({
              message: ctx.lastError?.message ?? 'The shell could not be started.',
              code
            });

          case 4503:
            return fail({
              message:
                reason == 'machine_failed'
                  ? 'The machine has failed.'
                  : 'The machine is not available right now.',
              code
            });

          case 4401:
            access.invalidate();
            return scheduleReconnect({ message: 'Access to the machine was rejected.', code });

          case 4429:
            return scheduleReconnect(
              { message: 'Too many connections. Retrying shortly.', code },
              4
            );

          default:
            if (!ctx.opened) access.invalidate();
            return scheduleReconnect({ message: 'Lost the connection to the machine.', code });
        }
      };

      let connect = async (status: 'connecting' | 'reconnecting') => {
        clearTimers();
        dropSocket(DETACH_CLOSE_CODE, 'reconnect');

        let currentGeneration = ++generation;
        let isCurrent = () => currentGeneration == generation && !isDisposed && !isEnded;

        handlers.onStatus(opts.isSleeping?.() ? 'waking' : status);

        let grant: SandboxAccessGrant;
        try {
          grant = await access.get();
        } catch (error) {
          if (!isCurrent()) return;

          let detail = { message: getAccessErrorMessage(error) };
          if (status == 'connecting') fail(detail);
          else scheduleReconnect(detail);
          return;
        }

        if (!isCurrent()) return;

        let ws = createWebSocket(grant.url, getSandboxSocketProtocols(grant.token));
        ws.binaryType = 'arraybuffer';
        socket = ws;

        let ctx = {
          opened: false,
          exited: false,
          lastError: null as { message: string } | null
        };

        ws.addEventListener('open', () => {
          if (socket !== ws) return;
          ctx.opened = true;

          ws.send(
            sessionId
              ? encodeShellAttach(sessionId, offset)
              : encodeShellOpen({
                  cols: size.cols,
                  rows: size.rows,
                  command: opts.command,
                  cwd: opts.cwd,
                  env: opts.env
                })
          );

          wakingTimer = setTimeout(() => {
            wakingTimer = null;
            if (socket === ws && !isConnected) handlers.onStatus('waking');
          }, wakingDelayMs);
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          if (socket !== ws) return;

          if (typeof event.data != 'string') {
            let output = decodeShellOutput(event.data, true);
            offset += output.data.length;
            handlers.onOutput(output.data);
            return;
          }

          let message = parseShellMessage(event.data);
          if (!message) return;

          switch (message.type) {
            case 'session_init':
              if (wakingTimer) clearTimeout(wakingTimer);
              wakingTimer = null;

              sessionId = message.sessionId;
              offset = message.offset;
              store.set(sessionKey, { sessionId: message.sessionId });

              attempt = 0;
              isConnected = true;
              handlers.onStatus('connected');

              if (message.resumed) ws.send(encodeShellResize(size.cols, size.rows));
              return;

            case 'output_gap':
              offset = Math.max(offset, message.to);
              handlers.onOutput(GAP_NOTICE);
              return;

            case 'exit':
              ctx.exited = true;
              handlers.onExit({ code: message.code, signal: message.signal });
              return;

            case 'error':
              ctx.lastError = message;
              return;

            case 'connection_notice': {
              if (message.notice == 'active') return handlers.onNoticeClear?.();

              let notice = describeSandboxConnectionNotice(message);
              if (notice) handlers.onNotice(notice);
              return;
            }
          }
        });

        ws.addEventListener('close', (event: CloseEvent) => {
          if (socket !== ws) return;

          socket = null;
          isConnected = false;
          if (wakingTimer) clearTimeout(wakingTimer);
          wakingTimer = null;

          if (isDisposed || isEnded) return;
          handleClose({ code: event.code, reason: event.reason }, ctx);
        });
      };

      void connect('connecting');

      let send = (data: string | Uint8Array) => {
        if (!socket || !isConnected || socket.readyState != SOCKET_OPEN) return;
        socket.send(data);
      };

      return {
        write: data => send(encodeShellInput(data)),

        resize: (cols, rows) => {
          size = { cols, rows };
          send(encodeShellResize(cols, rows));
        },

        signal: signal => send(encodeShellSignal(signal)),

        reconnect: () => {
          if (isDisposed || isEnded) return;
          attempt = 0;
          void connect('reconnecting');
        },

        detach: () => {
          if (isDisposed) return;
          isDisposed = true;
          clearTimers();
          dropSocket(DETACH_CLOSE_CODE, 'detach');
        },

        close: () => {
          if (isDisposed) return;
          isDisposed = true;
          clearTimers();
          send(encodeShellStdinEof());
          forgetSession();
          dropSocket(1000, 'closed');
        }
      };
    }
  };
};
