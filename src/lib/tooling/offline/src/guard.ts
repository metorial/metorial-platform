import net from 'node:net';
import tls from 'node:tls';

export interface BlockedConnection {
  kind: 'net' | 'tls' | 'bun' | 'fetch' | 'websocket' | 'redis';
  target: string;
  stack: string;
}

let BLOCKED_ERROR_CODE = 'ECONNREFUSED';
let blockedErrorMarker = Symbol.for('lowerdeck.offline.blocked');

let stateKey = Symbol.for('lowerdeck.offline.state');

let getState = (): {
  installed: boolean;
  blocked: BlockedConnection[];
  backgroundErrors: unknown[];
} => ((globalThis as any)[stateKey] ??= { installed: false, blocked: [], backgroundErrors: [] });

let BLOCKED_ERROR_MESSAGE = 'Offline mode: blocked outbound connection';

let createBlockedError = (target: string) =>
  Object.assign(new Error(`${BLOCKED_ERROR_MESSAGE} to ${target}`), {
    code: BLOCKED_ERROR_CODE,
    [blockedErrorMarker]: true
  });

// Clients like Prisma rethrow their own error types, so only the message survives.
export let isBlockedConnectionError = (error: unknown, depth = 0): boolean => {
  if (!error || typeof error != 'object' || depth > 5) return false;
  if ((error as any)[blockedErrorMarker] === true) return true;
  if (String((error as any).message ?? '').includes(BLOCKED_ERROR_MESSAGE)) return true;
  return isBlockedConnectionError((error as any).cause, depth + 1);
};

let record = (kind: BlockedConnection['kind'], target: string) => {
  let stack = (new Error().stack ?? '').split('\n').slice(3).join('\n');
  getState().blocked.push({ kind, target, stack });

  if (process.env.OFFLINE_DEBUG == '1') {
    console.warn(`[offline] blocked ${kind} connection to ${target}\n${stack}`);
  }
};

let describeSocketTarget = (args: any[]) => {
  let first = Array.isArray(args[0]) ? args[0][0] : args[0];

  if (first && typeof first == 'object') {
    if (first.path) return String(first.path);
    return `${first.host ?? first.hostname ?? 'localhost'}:${first.port ?? '?'}`;
  }

  if (typeof first == 'number' || (typeof first == 'string' && /^\d+$/.test(first))) {
    return `${typeof args[1] == 'string' ? args[1] : 'localhost'}:${first}`;
  }

  return String(first);
};

let describeUrl = (input: unknown) => {
  if (typeof input == 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input && typeof input == 'object' && 'url' in input) return String((input as any).url);
  return String(input);
};

let refuseSocket = <S extends net.Socket>(
  socket: S,
  kind: BlockedConnection['kind'],
  target: string
) => {
  record(kind, target);
  process.nextTick(() => socket.destroy(createBlockedError(target)));
  return socket;
};

class OfflineWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = OfflineWebSocket.CLOSED;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;

  constructor(readonly url: string | URL) {
    super();
    record('websocket', describeUrl(url));

    setTimeout(() => {
      let errorEvent = new Event('error');
      this.dispatchEvent(errorEvent);
      this.onerror?.(errorEvent);

      let closeEvent = new Event('close');
      this.dispatchEvent(closeEvent);
      this.onclose?.(closeEvent);
    }, 0);
  }

  send() {}
  close() {}
}

class OfflineRedisClient {
  constructor(url?: string) {
    record('redis', url ?? 'redis://localhost:6379');
  }

  get connected() {
    return false;
  }

  async connect() {
    throw createBlockedError('redis');
  }

  close() {}
}

let overrideProperty = (target: any, key: string, value: unknown) => {
  try {
    Object.defineProperty(target, key, { value, writable: true, configurable: true });
  } catch {
    try {
      target[key] = value;
    } catch {}
  }
};

export let installNetworkGuard = () => {
  let state = getState();
  if (state.installed) return;
  state.installed = true;

  net.Socket.prototype.connect = function (this: net.Socket, ...args: any[]) {
    return refuseSocket(this, 'net', describeSocketTarget(args));
  } as any;

  let createBlockedNetConnection = (...args: any[]) =>
    refuseSocket(new net.Socket(), 'net', describeSocketTarget(args));
  overrideProperty(net, 'connect', createBlockedNetConnection);
  overrideProperty(net, 'createConnection', createBlockedNetConnection);

  overrideProperty(tls, 'connect', (...args: any[]) =>
    refuseSocket(new net.Socket(), 'tls', describeSocketTarget(args))
  );
  if (tls.TLSSocket?.prototype) {
    tls.TLSSocket.prototype.connect = function (this: tls.TLSSocket, ...args: any[]) {
      return refuseSocket(this, 'tls', describeSocketTarget(args));
    } as any;
  }

  overrideProperty(globalThis, 'fetch', async (input: unknown) => {
    let target = describeUrl(input);
    record('fetch', target);
    throw createBlockedError(target);
  });

  overrideProperty(globalThis, 'WebSocket', OfflineWebSocket);

  if (typeof Bun != 'undefined') {
    overrideProperty(Bun, 'connect', async (opts: any) => {
      let target = opts?.unix ?? `${opts?.hostname ?? 'localhost'}:${opts?.port ?? '?'}`;
      record('bun', target);
      throw createBlockedError(target);
    });
    overrideProperty(Bun, 'RedisClient', OfflineRedisClient);
  }

  let originalSetInterval = globalThis.setInterval;
  overrideProperty(globalThis, 'setInterval', (...args: Parameters<typeof setInterval>) => {
    let timer: any = originalSetInterval(...args);
    timer?.unref?.();
    return timer;
  });

  // Background work kicked off at import (seeding, bucket setup, ...) runs against stubs and
  // may fail; that can't affect anything an offline task produces, so it's collected instead
  // of crashing the process. Failures on the awaited import path still reject the task.
  let recordBackgroundError = (error: unknown) => {
    if (isBlockedConnectionError(error)) return;
    getState().backgroundErrors.push(error);
    if (process.env.OFFLINE_DEBUG == '1') console.warn('[offline] background error', error);
  };

  process.on('uncaughtException', recordBackgroundError);
  process.on('unhandledRejection', recordBackgroundError);
};

export let getBlockedConnections = () => [...getState().blocked];

export let getBackgroundErrors = () => [...getState().backgroundErrors];

export let formatBlockedConnections = (blocked = getBlockedConnections()) => {
  let grouped = new Map<string, { connection: BlockedConnection; count: number }>();

  for (let connection of blocked) {
    let key = `${connection.kind}|${connection.target}|${connection.stack}`;
    let existing = grouped.get(key);
    if (existing) existing.count++;
    else grouped.set(key, { connection, count: 1 });
  }

  return Array.from(grouped.values())
    .map(
      ({ connection: { kind, target, stack }, count }) =>
        `- [${kind}] ${target}${count > 1 ? ` (x${count})` : ''}\n${stack
          .split('\n')
          .slice(0, 12)
          .map(line => `    ${line.trim()}`)
          .join('\n')}`
    )
    .join('\n');
};
