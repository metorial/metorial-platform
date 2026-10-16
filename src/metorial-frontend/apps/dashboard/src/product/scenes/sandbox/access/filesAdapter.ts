import type { FileBrowserStatus, FileEntry, FileSystemAdapter } from '@metorial/file-browser';
import {
  createSandboxAccessCache,
  defaultSandboxWebSocketFactory,
  getAccessErrorMessage,
  getSandboxSocketProtocols,
  sleep,
  SOCKET_OPEN,
  type SandboxAccessGrant,
  type SandboxAccessProvider,
  type SandboxWebSocketFactory
} from './common';
import {
  createFilesOperationId,
  decodeFilesChunk,
  encodeFilesCancel,
  encodeFilesChunk,
  encodeFilesRequest,
  encodeFilesWriteEnd,
  FILES_CHUNK_SIZE,
  FILES_LIST_LIMIT,
  normalizeFilesPath,
  parseFilesMessage,
  sha256Hex,
  toFileEntry,
  SandboxFilesError,
  type SandboxFilesOperation,
  type SandboxFilesWireEntry
} from './filesProtocol';

let UPLOAD_HIGH_WATER_MARK = 1024 * 1024;
let UPLOAD_DRAIN_POLL_MS = 15;
let CHECKSUM_MAX_BYTES = 256 * 1024 * 1024;
let READ_PREALLOCATE_MAX_BYTES = 64 * 1024 * 1024;
let SYMLINK_RESOLVE_LIMIT = 32;
let SYMLINK_RESOLVE_CONCURRENCY = 8;

export type SandboxFilesStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'disconnected'
  | 'unavailable';

export interface SandboxFilesSnapshot {
  status: SandboxFilesStatus;
  error: SandboxFilesError | null;
}

export interface SandboxFilesAdapterOptions {
  getAccess: SandboxAccessProvider;
  createWebSocket?: SandboxWebSocketFactory;
  createId?: () => string;
  maxConnectAttempts?: number;
  connectBaseDelayMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface SandboxFilesAdapter extends FileSystemAdapter {
  getSnapshot(): SandboxFilesSnapshot;
  subscribe(listener: () => void): () => void;
  reconnect(): Promise<void>;
  close(): void;
}

export let getFileBrowserStatus = (
  status: SandboxFilesStatus
): 'ready' | 'connecting' | 'disconnected' | 'unavailable' =>
  status == 'idle' ? 'ready' : status;

interface CloseFailure {
  error: SandboxFilesError;
  status: 'disconnected' | 'unavailable';
  invalidatesAccess: boolean;
}

export let describeFilesSocketClose = (code: number, reason: string): CloseFailure => {
  let failure = (
    message: string,
    opts: { fatal?: boolean; retryable?: boolean; invalidatesAccess?: boolean } = {}
  ): CloseFailure => ({
    error: new SandboxFilesError('disconnected', message, {
      serverCode: reason || String(code),
      retryable: opts.retryable ?? !opts.fatal
    }),
    status: opts.fatal ? 'unavailable' : 'disconnected',
    invalidatesAccess: !!opts.invalidatesAccess
  });

  switch (code) {
    case 4404:
      return failure('This machine could not be found.', { fatal: true });

    case 4410:
      return failure('The machine was terminated.', { fatal: true });

    case 4503:
      return reason == 'machine_failed'
        ? failure('The machine has failed.', { fatal: true })
        : failure('The machine is not available right now.');

    case 1012:
      if (reason == 'machine_terminated') {
        return failure('The machine was terminated.', { fatal: true });
      }

      if (reason == 'machine_restarting') return failure('The machine is restarting.');

      return failure('The machine paused.', { retryable: false });

    case 4401:
      return failure('Access to the machine was rejected.', { invalidatesAccess: true });

    case 4429:
      return failure('Too many connections. Try again shortly.');

    case 1000:
    case 1005:
      return failure('The file connection was closed.', { retryable: false });

    default:
      return failure('Lost the connection to the machine.');
  }
};

let createCancelledError = (message = 'The operation was cancelled.') =>
  new SandboxFilesError('cancelled', message);

let throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw createCancelledError();
};

let toFinalError = (error: SandboxFilesError) =>
  error.retryable
    ? new SandboxFilesError(error.code, error.message, {
        serverCode: error.serverCode,
        path: error.path
      })
    : error;

let toFilesError = (error: unknown) =>
  error instanceof SandboxFilesError
    ? error
    : new SandboxFilesError('unknown', error instanceof Error ? error.message : undefined);

let createByteSink = () => {
  let buffer = new Uint8Array(0);
  let length = 0;

  let ensureCapacity = (capacity: number) => {
    if (capacity <= buffer.length) return;

    let next = new Uint8Array(Math.max(capacity, buffer.length * 2));
    next.set(buffer.subarray(0, length));
    buffer = next;
  };

  return {
    reserve: (bytes: number) => ensureCapacity(Math.min(bytes, READ_PREALLOCATE_MAX_BYTES)),

    push: (chunk: Uint8Array) => {
      ensureCapacity(length + chunk.length);
      buffer.set(chunk, length);
      length += chunk.length;

      return length;
    },

    finish: () => (length == buffer.length ? buffer : buffer.slice(0, length))
  };
};

interface UploadSource {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
  checksum(): Promise<string | undefined>;
}

let createUploadSource = (data: Blob | Uint8Array): UploadSource => {
  if (data instanceof Uint8Array) {
    return {
      size: data.byteLength,
      read: async (offset, length) => data.subarray(offset, offset + length),
      checksum: () => sha256Hex(data)
    };
  }

  return {
    size: data.size,
    read: async (offset, length) =>
      new Uint8Array(await data.slice(offset, offset + length).arrayBuffer()),
    checksum: async () =>
      data.size <= CHECKSUM_MAX_BYTES
        ? sha256Hex(new Uint8Array(await data.arrayBuffer()))
        : undefined
  };
};

interface PendingOperation {
  socket: WebSocket;
  onStart?: (start: { size: number; modifiedAt: Date | undefined; offset: number }) => void;
  onEntries?: (entries: SandboxFilesWireEntry[]) => void;
  onData?: (data: Uint8Array) => void;
  resolve: (fields: Record<string, any>) => void;
  reject: (error: SandboxFilesError) => void;
}

interface UploadChannel {
  id: string;
  socket: WebSocket;
  canSend: () => boolean;
}

interface OperationHooks {
  signal?: AbortSignal;
  onStart?: PendingOperation['onStart'];
  onEntries?: PendingOperation['onEntries'];
  onData?: PendingOperation['onData'];
  upload?: (channel: UploadChannel) => Promise<void>;
}

export let createSandboxFilesAdapter = (
  opts: SandboxFilesAdapterOptions
): SandboxFilesAdapter => {
  let access = createSandboxAccessCache(opts.getAccess);
  let createWebSocket = opts.createWebSocket ?? defaultSandboxWebSocketFactory;
  let createId = opts.createId ?? createFilesOperationId;

  let maxConnectAttempts = opts.maxConnectAttempts ?? 3;
  let connectBaseDelayMs = opts.connectBaseDelayMs ?? 500;
  let maxRetries = opts.maxRetries ?? 2;
  let retryDelayMs = opts.retryDelayMs ?? 400;

  let socket: WebSocket | null = null;
  let opening: Promise<WebSocket> | null = null;
  let isDisposed = false;

  let pending = new Map<string, PendingOperation>();
  let listeners = new Set<() => void>();
  let snapshot: SandboxFilesSnapshot = { status: 'idle', error: null };

  let setSnapshot = (status: SandboxFilesStatus, error: SandboxFilesError | null = null) => {
    if (snapshot.status == status && snapshot.error === error) return;

    snapshot = { status, error };
    for (let listener of [...listeners]) listener();
  };

  let rejectPending = (error: SandboxFilesError, target?: WebSocket) => {
    for (let operation of [...pending.values()]) {
      if (!target || operation.socket === target) operation.reject(error);
    }
  };

  let handleMessage = (event: MessageEvent) => {
    if (typeof event.data != 'string') {
      let chunk = decodeFilesChunk(event.data);
      if (chunk) pending.get(chunk.id)?.onData?.(chunk.data);
      return;
    }

    let message = parseFilesMessage(event.data);
    if (!message || message.type == 'connection_notice' || !message.id) return;

    let operation = pending.get(message.id);
    if (!operation) return;

    switch (message.type) {
      case 'start':
        return operation.onStart?.(message);

      case 'entries':
        return operation.onEntries?.(message.entries);

      case 'result':
        return operation.resolve(message.fields);

      case 'error':
        return operation.reject(message.error);
    }
  };

  let handleClose = (ws: WebSocket, event: CloseEvent) => {
    let failure = describeFilesSocketClose(event.code, event.reason);
    if (failure.invalidatesAccess) access.invalidate();

    rejectPending(failure.error, ws);

    if (socket !== ws) return;
    socket = null;

    if (!isDisposed) setSnapshot(failure.status, failure.error);
  };

  let openSocket = async (): Promise<{ socket: WebSocket } | { failure: CloseFailure }> => {
    let grant: SandboxAccessGrant;

    try {
      grant = await access.get();
    } catch (error) {
      return {
        failure: {
          error: new SandboxFilesError('disconnected', getAccessErrorMessage(error), {
            retryable: true
          }),
          status: 'disconnected',
          invalidatesAccess: false
        }
      };
    }

    let ws = createWebSocket(grant.url, getSandboxSocketProtocols(grant.token));
    ws.binaryType = 'arraybuffer';

    return new Promise(resolve => {
      let hasOpened = false;

      ws.addEventListener('open', () => {
        hasOpened = true;
        resolve({ socket: ws });
      });

      ws.addEventListener('message', handleMessage);

      ws.addEventListener('close', event => {
        if (hasOpened) return handleClose(ws, event);

        let failure = describeFilesSocketClose(event.code, event.reason);
        resolve({
          failure: { ...failure, invalidatesAccess: failure.status != 'unavailable' }
        });
      });
    });
  };

  let connect = async () => {
    for (let attempt = 1; ; attempt++) {
      setSnapshot('connecting');

      let result = await openSocket();

      if (isDisposed) {
        if ('socket' in result) result.socket.close(1000, 'closed');
        throw createCancelledError('The file connection was closed.');
      }

      if ('socket' in result) {
        socket = result.socket;
        setSnapshot('ready');
        return result.socket;
      }

      let { failure } = result;
      if (failure.invalidatesAccess) access.invalidate();

      let isFinal =
        failure.status == 'unavailable' ||
        !failure.error.retryable ||
        attempt >= maxConnectAttempts;

      if (isFinal) {
        let error = toFinalError(failure.error);

        setSnapshot(failure.status, error);
        throw error;
      }

      await sleep(connectBaseDelayMs * 2 ** (attempt - 1));
    }
  };

  let ensureOpen = (): Promise<WebSocket> => {
    if (isDisposed) {
      return Promise.reject(createCancelledError('The file connection was closed.'));
    }

    if (socket && socket.readyState == SOCKET_OPEN) return Promise.resolve(socket);

    if (snapshot.status == 'unavailable' && snapshot.error) {
      return Promise.reject(snapshot.error);
    }

    opening ??= connect().finally(() => {
      opening = null;
    });

    return opening;
  };

  let sendCancel = (ws: WebSocket, target: string) => {
    if (ws.readyState != SOCKET_OPEN) return;

    try {
      ws.send(encodeFilesCancel(createId(), target));
    } catch {}
  };

  let runOperation = async (
    op: SandboxFilesOperation,
    fields: Record<string, unknown>,
    hooks: OperationHooks = {}
  ) => {
    throwIfAborted(hooks.signal);

    let ws = await ensureOpen();
    throwIfAborted(hooks.signal);

    let id = createId();

    return new Promise<Record<string, any>>((resolve, reject) => {
      let isFinished = false;

      let finish = (settle: () => void) => {
        if (isFinished) return;

        isFinished = true;
        pending.delete(id);
        hooks.signal?.removeEventListener('abort', handleAbort);
        settle();
      };

      let handleAbort = () => {
        if (isFinished) return;

        sendCancel(ws, id);
        finish(() => reject(createCancelledError()));
      };

      let fail = (error: SandboxFilesError) => finish(() => reject(error));

      pending.set(id, {
        socket: ws,
        onStart: hooks.onStart,
        onEntries: hooks.onEntries,
        onData: hooks.onData,
        resolve: result => finish(() => resolve(result)),
        reject: fail
      });

      hooks.signal?.addEventListener('abort', handleAbort, { once: true });

      try {
        ws.send(encodeFilesRequest(id, op, fields));
      } catch {
        return fail(
          new SandboxFilesError('disconnected', 'The file connection was lost.', {
            retryable: true
          })
        );
      }

      hooks
        .upload?.({
          id,
          socket: ws,
          canSend: () => !isFinished && ws.readyState == SOCKET_OPEN
        })
        .catch(error => {
          sendCancel(ws, id);
          fail(toFilesError(error));
        });
    });
  };

  let withRetries = async <T>(signal: AbortSignal | undefined, run: () => Promise<T>) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await run();
      } catch (error) {
        let canRetry =
          error instanceof SandboxFilesError &&
          error.retryable &&
          attempt < maxRetries &&
          !isDisposed &&
          !signal?.aborted;

        if (!canRetry) throw error;

        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  };

  let statEntry = async (path: string, followSymlinks: boolean, signal?: AbortSignal) => {
    let result = await runOperation('stat', { path, followSymlinks }, { signal });
    return toFileEntry(result.entry);
  };

  let followSymlink = async (link: FileEntry, signal?: AbortSignal) => {
    try {
      return await statEntry(link.path, true, signal);
    } catch (error) {
      let code = toFilesError(error).code;
      if (code == 'cancelled' || code == 'disconnected') throw error;

      return null;
    }
  };

  let resolveSymlinkTypes = async (entries: FileEntry[], signal?: AbortSignal) => {
    let queue = entries
      .filter(entry => entry.type == 'symlink')
      .slice(0, SYMLINK_RESOLVE_LIMIT);

    let work = async () => {
      for (let link = queue.shift(); link; link = queue.shift()) {
        let target = await followSymlink(link, signal);
        if (target) link.targetType = target.type;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(SYMLINK_RESOLVE_CONCURRENCY, queue.length) }, work)
    );
  };

  let waitForDrain = async (channel: UploadChannel) => {
    while (channel.socket.bufferedAmount > UPLOAD_HIGH_WATER_MARK) {
      if (!channel.canSend()) return;
      await sleep(UPLOAD_DRAIN_POLL_MS);
    }
  };

  let streamUpload = async (
    channel: UploadChannel,
    source: UploadSource,
    onProgress?: (sent: number, total: number) => void
  ) => {
    let sent = 0;

    while (sent < source.size) {
      await waitForDrain(channel);
      if (!channel.canSend()) return;

      let chunk = await source.read(sent, FILES_CHUNK_SIZE);
      if (!channel.canSend()) return;

      channel.socket.send(encodeFilesChunk(channel.id, chunk));
      sent += chunk.length;
      onProgress?.(sent, source.size);
    }

    let checksum = await source.checksum();
    if (!channel.canSend()) return;

    channel.socket.send(encodeFilesWriteEnd(channel.id, checksum));
  };

  return {
    list: (path, listOpts) =>
      withRetries(listOpts?.signal, async () => {
        let parent = normalizeFilesPath(path);
        let entries: FileEntry[] = [];

        let result = await runOperation(
          'list',
          { path: parent, limit: FILES_LIST_LIMIT },
          {
            signal: listOpts?.signal,
            onEntries: batch => entries.push(...batch.map(entry => toFileEntry(entry, parent)))
          }
        );

        await resolveSymlinkTypes(entries, listOpts?.signal);

        return { entries, truncated: result.truncated === true };
      }),

    stat: (path, statOpts) =>
      withRetries(statOpts?.signal, async () => {
        let entry = await statEntry(normalizeFilesPath(path), false, statOpts?.signal);
        if (entry.type != 'symlink') return entry;

        // Size and mtime of a link describe what read() returns, so conflict checks compare like with like.
        let target = await followSymlink(entry, statOpts?.signal);
        if (!target) return entry;

        return {
          ...entry,
          targetType: target.type,
          size: target.size,
          modifiedAt: target.modifiedAt
        };
      }),

    read: (path, readOpts = {}) =>
      withRetries(readOpts.signal, async () => {
        let sink = createByteSink();
        let size = 0;
        let expected = 0;
        let modifiedAt: Date | undefined;

        await runOperation(
          'read',
          {
            path: normalizeFilesPath(path),
            offset: readOpts.offset === undefined ? undefined : Math.max(0, readOpts.offset),
            length: readOpts.length === undefined ? undefined : Math.max(0, readOpts.length)
          },
          {
            signal: readOpts.signal,

            onStart: start => {
              size = start.size;
              modifiedAt = start.modifiedAt;
              expected = Math.max(
                0,
                Math.min(readOpts.length ?? Infinity, start.size - start.offset)
              );
              sink.reserve(expected);
            },

            onData: chunk => readOpts.onProgress?.(sink.push(chunk), expected)
          }
        );

        return { data: sink.finish(), size, modifiedAt };
      }),

    write: async (path, data, writeOpts = {}) => {
      let source = createUploadSource(data);

      await runOperation(
        'write',
        {
          path: normalizeFilesPath(path),
          size: source.size,
          overwrite: writeOpts.overwrite ?? false,
          mode: writeOpts.mode === undefined ? undefined : writeOpts.mode & 0o7777
        },
        {
          signal: writeOpts.signal,
          upload: channel => streamUpload(channel, source, writeOpts.onProgress)
        }
      );

      writeOpts.onProgress?.(source.size, source.size);
    },

    mkdir: async path => {
      await runOperation('mkdir', { path: normalizeFilesPath(path), parents: false });
    },

    move: async (from, to) => {
      await runOperation('move', {
        from: normalizeFilesPath(from),
        to: normalizeFilesPath(to),
        overwrite: false
      });
    },

    delete: async (path, deleteOpts) => {
      await runOperation('delete', {
        path: normalizeFilesPath(path),
        recursive: deleteOpts?.recursive ?? false
      });
    },

    getSnapshot: () => snapshot,

    subscribe: listener => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    reconnect: async () => {
      if (isDisposed) return;

      let current = socket;
      socket = null;

      if (current) {
        rejectPending(
          new SandboxFilesError('disconnected', 'The file connection was reset.', {
            retryable: true
          }),
          current
        );

        try {
          current.close(1000, 'reconnect');
        } catch {}
      }

      access.invalidate();
      setSnapshot('idle');

      try {
        await ensureOpen();
      } catch {}
    },

    close: () => {
      if (isDisposed) return;
      isDisposed = true;

      let current = socket;
      socket = null;

      rejectPending(createCancelledError('The file connection was closed.'));

      try {
        current?.close(1000, 'closed');
      } catch {}
    }
  };
};
