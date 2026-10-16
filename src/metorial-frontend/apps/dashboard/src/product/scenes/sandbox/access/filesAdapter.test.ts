import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSandboxFilesAdapter,
  describeFilesSocketClose,
  getFileBrowserStatus,
  type SandboxFilesAdapter
} from './filesAdapter';
import { encodeFilesChunk, SandboxFilesError } from './filesProtocol';
import { createFakeWebSocket, FakeWebSocket, flushPromises } from './fakeWebSocket.testUtil';

let encoder = new TextEncoder();
let decoder = new TextDecoder();

let settle = () => flushPromises(40);

let waitForSent = (ws: FakeWebSocket, predicate: (ws: FakeWebSocket) => boolean) =>
  vi.waitFor(() => expect(predicate(ws)).toBe(true));

let createSequentialIds = () => {
  let counter = 0;
  return () => `op${++counter}`;
};

describe('createSandboxFilesAdapter', () => {
  let getAccess: ReturnType<typeof vi.fn>;
  let adapter: SandboxFilesAdapter;

  let createAdapter = (extra: Record<string, unknown> = {}) => {
    adapter = createSandboxFilesAdapter({
      getAccess: getAccess as any,
      createWebSocket: createFakeWebSocket,
      createId: createSequentialIds(),
      connectBaseDelayMs: 10,
      retryDelayMs: 10,
      ...extra
    });

    return adapter;
  };

  let connect = async () => {
    await settle();

    let ws = FakeWebSocket.last();
    ws.serverOpen();
    await settle();

    return ws;
  };

  let expectCode = async (promise: Promise<unknown>, code: string) => {
    let error = await promise.then(
      () => null,
      (rejection: unknown) => rejection
    );

    expect(error).toBeInstanceOf(SandboxFilesError);
    expect((error as SandboxFilesError).code).toBe(code);

    return error as SandboxFilesError;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.reset();

    getAccess = vi.fn(async () => ({
      url: 'wss://proxy.test/files',
      token: 'tok_1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }));

    createAdapter();
  });

  afterEach(() => {
    adapter.close();
    vi.useRealTimers();
  });

  it('connects lazily with the sandbox subprotocols and shares one socket', async () => {
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(adapter.getSnapshot().status).toBe('idle');

    let first = adapter.stat('/a');
    let ws = await connect();

    expect(ws.url).toBe('wss://proxy.test/files');
    expect(ws.protocols).toEqual(['metorial-sandbox-v1', 'metorial-sandbox-token.tok_1']);
    expect(ws.binaryType).toBe('arraybuffer');
    expect(adapter.getSnapshot().status).toBe('ready');

    expect(ws.sentJson()[0]).toEqual({
      id: 'op1',
      op: 'stat',
      path: '/a',
      followSymlinks: false
    });

    ws.serverSend({
      id: 'op1',
      type: 'result',
      entry: { path: '/a', type: 'file', size: 3, mode: 0o644, mtime: 1700000000000 }
    });

    expect(await first).toEqual({
      name: 'a',
      path: '/a',
      type: 'file',
      size: 3,
      mode: 0o644,
      modifiedAt: new Date(1700000000000)
    });

    let second = adapter.stat('/b/../c');
    await settle();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(ws.sentJson()[1]).toMatchObject({ id: 'op2', path: '/c' });

    ws.serverSend({
      id: 'op2',
      type: 'result',
      entry: { path: '/c', type: 'directory', size: 0 }
    });
    expect((await second).type).toBe('directory');
  });

  it('lists entries across batches and resolves what symlinks point to', async () => {
    let listing = adapter.list('/');
    let ws = await connect();

    expect(ws.sentJson()[0]).toEqual({ id: 'op1', op: 'list', path: '/', limit: 10000 });

    ws.serverSend({
      id: 'op1',
      type: 'entries',
      entries: [
        { name: 'app', type: 'directory', size: 4096, mode: 0o755, mtime: 1 },
        { name: 'bin', type: 'symlink', size: 7, mode: 0o777, mtime: 1, target: 'usr/bin' }
      ]
    });
    ws.serverSend({
      id: 'op1',
      type: 'entries',
      entries: [{ name: 'notes.txt', type: 'file', size: 12, mode: 0o644, mtime: 1 }]
    });
    ws.serverSend({ id: 'op1', type: 'result', count: 3, truncated: true });
    await settle();

    expect(ws.sentJson()[1]).toEqual({
      id: 'op2',
      op: 'stat',
      path: '/bin',
      followSymlinks: true
    });

    ws.serverSend({
      id: 'op2',
      type: 'result',
      entry: { path: '/bin', type: 'directory', size: 0 }
    });

    let { entries, truncated } = await listing;

    expect(truncated).toBe(true);
    expect(entries.map(entry => entry.path)).toEqual(['/app', '/bin', '/notes.txt']);
    expect(entries[1]).toMatchObject({
      type: 'symlink',
      target: 'usr/bin',
      targetType: 'directory'
    });
  });

  it('leaves dangling symlinks unresolved', async () => {
    let listing = adapter.list('/tmp');
    let ws = await connect();

    ws.serverSend({
      id: 'op1',
      type: 'entries',
      entries: [{ name: 'gone', type: 'symlink', size: 3, target: 'nowhere' }]
    });
    ws.serverSend({ id: 'op1', type: 'result', count: 1, truncated: false });
    await settle();

    ws.serverSend({
      id: 'op2',
      type: 'error',
      error: { code: 'not_found', message: 'No such file or directory' }
    });

    let { entries } = await listing;

    expect(entries[0]!.targetType).toBeUndefined();
  });

  it('describes a symlink by its target when statting it', async () => {
    let stat = adapter.stat('/current');
    let ws = await connect();

    ws.serverSend({
      id: 'op1',
      type: 'result',
      entry: { path: '/current', type: 'symlink', size: 6, mtime: 100, target: 'v2.txt' }
    });
    await settle();

    expect(ws.sentJson()[1]).toMatchObject({
      op: 'stat',
      path: '/current',
      followSymlinks: true
    });

    ws.serverSend({
      id: 'op2',
      type: 'result',
      entry: { path: '/current', type: 'file', size: 99, mtime: 5000 }
    });

    expect(await stat).toMatchObject({
      type: 'symlink',
      target: 'v2.txt',
      targetType: 'file',
      size: 99,
      modifiedAt: new Date(5000)
    });
  });

  it('reads a byte range and reports progress', async () => {
    let onProgress = vi.fn();
    let reading = adapter.read('/data/log.txt', { offset: 10, length: 6, onProgress });
    let ws = await connect();

    expect(ws.sentJson()[0]).toEqual({
      id: 'op1',
      op: 'read',
      path: '/data/log.txt',
      offset: 10,
      length: 6
    });

    ws.serverSend({ id: 'op1', type: 'start', size: 100, mtime: 5000, offset: 10 });
    ws.serverSend(encodeFilesChunk('op1', encoder.encode('abc')));
    ws.serverSend(encodeFilesChunk('op1', encoder.encode('def')));
    ws.serverSend({ id: 'op1', type: 'result', bytes: 6 });

    let result = await reading;

    expect(decoder.decode(result.data)).toBe('abcdef');
    expect(result.size).toBe(100);
    expect(result.modifiedAt).toEqual(new Date(5000));
    expect(onProgress.mock.calls).toEqual([
      [3, 6],
      [6, 6]
    ]);
  });

  it('reads an empty file', async () => {
    let reading = adapter.read('/empty');
    let ws = await connect();

    ws.serverSend({ id: 'op1', type: 'start', size: 0, mtime: 0, offset: 0 });
    ws.serverSend({ id: 'op1', type: 'result', bytes: 0 });

    let result = await reading;

    expect(result.data.length).toBe(0);
    expect(result.modifiedAt).toBeUndefined();
  });

  it('writes in 64 KiB chunks and finishes with the sha256', async () => {
    let data = new Uint8Array(150 * 1024).map((_, index) => index % 251);
    let onProgress = vi.fn();

    let writing = adapter.write('/app/out.bin', data, {
      overwrite: true,
      mode: 0o600,
      onProgress
    });
    let ws = await connect();

    expect(ws.sentJson()[0]).toEqual({
      id: 'op1',
      op: 'write',
      path: '/app/out.bin',
      size: data.length,
      overwrite: true,
      mode: 0o600
    });

    await waitForSent(ws, socket => socket.sentJson().length == 2);

    let frames = ws.sentBinary();

    expect(frames.map(frame => frame.length - 1 - 3)).toEqual([65536, 65536, 22528]);
    expect(decoder.decode(frames[0]!.subarray(1, 4))).toBe('op1');
    expect(frames[0]![0]).toBe(3);

    let sha256 = createHash('sha256').update(data).digest('hex');
    expect(ws.sentJson().at(-1)).toEqual({ id: 'op1', type: 'end', sha256 });

    ws.serverSend({ id: 'op1', type: 'result', bytes: data.length, sha256 });
    await writing;

    expect(onProgress.mock.calls.at(-1)).toEqual([data.length, data.length]);
  });

  it('refuses to overwrite by default', async () => {
    let writing = adapter.write('/a.txt', new Uint8Array([1]));
    let ws = await connect();

    expect(ws.sentJson()[0]).toMatchObject({ overwrite: false });
    expect(ws.sentJson()[0]).not.toHaveProperty('mode');

    ws.serverSend({
      id: 'op1',
      type: 'error',
      error: { code: 'already_exists', message: 'exists', path: '/a.txt' }
    });

    let error = await expectCode(writing, 'already_exists');
    expect(error.path).toBe('/a.txt');
  });

  it('streams blobs and sends an end frame for empty files', async () => {
    let blobWriting = adapter.write('/blob.txt', new Blob(['hello blob']));
    let ws = await connect();

    await waitForSent(ws, socket => socket.sentJson().length == 2);

    expect(ws.sentJson()[0]).toMatchObject({ op: 'write', size: 10 });
    expect(decoder.decode(ws.sentBinary()[0]!.subarray(4))).toBe('hello blob');
    expect(ws.sentJson().at(-1)).toMatchObject({
      type: 'end',
      sha256: createHash('sha256').update('hello blob').digest('hex')
    });

    ws.serverSend({ id: 'op1', type: 'result', bytes: 10 });
    await blobWriting;

    let emptyWriting = adapter.write('/empty.txt', new Uint8Array(0));
    await waitForSent(ws, socket => socket.sentJson().length == 4);

    expect(ws.sentJson().slice(-2)[0]).toMatchObject({ id: 'op2', op: 'write', size: 0 });
    expect(ws.sentJson().at(-1)).toMatchObject({ id: 'op2', type: 'end' });

    ws.serverSend({ id: 'op2', type: 'result', bytes: 0 });
    await emptyWriting;
  });

  it('waits for the socket buffer to drain before sending more chunks', async () => {
    let data = new Uint8Array(200 * 1024);
    let writing = adapter.write('/big.bin', data);

    await settle();

    let ws = FakeWebSocket.last();
    ws.bufferedAmount = 4 * 1024 * 1024;
    ws.serverOpen();
    await settle();
    await vi.advanceTimersByTimeAsync(200);

    expect(ws.sentBinary()).toHaveLength(0);

    ws.bufferedAmount = 0;
    await waitForSent(ws, socket => socket.sentJson().length == 2);

    expect(ws.sentBinary()).toHaveLength(4);

    ws.serverSend({ id: 'op1', type: 'result', bytes: data.length });
    await writing;
  });

  it('cancels a running operation when its signal aborts', async () => {
    let controller = new AbortController();
    let reading = adapter.read('/big.log', { signal: controller.signal });
    let ws = await connect();

    controller.abort();

    await expectCode(reading, 'cancelled');
    expect(ws.sentJson()[1]).toEqual({ id: 'op2', op: 'cancel', target: 'op1' });
  });

  it('stops uploading once the signal aborts', async () => {
    let controller = new AbortController();
    let writing = adapter.write('/big.bin', new Uint8Array(300 * 1024), {
      signal: controller.signal
    });

    await settle();

    let ws = FakeWebSocket.last();
    ws.bufferedAmount = 4 * 1024 * 1024;
    ws.serverOpen();
    await settle();

    let rejection = expectCode(writing, 'cancelled');

    controller.abort();
    ws.bufferedAmount = 0;
    await vi.advanceTimersByTimeAsync(100);

    await rejection;
    expect(ws.sentBinary()).toHaveLength(0);
    expect(ws.sentJson().at(-1)).toEqual({ id: 'op2', op: 'cancel', target: 'op1' });
  });

  it('does not touch the socket for an already aborted signal', async () => {
    let controller = new AbortController();
    controller.abort();

    await expectCode(adapter.list('/', { signal: controller.signal }), 'cancelled');
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('maps nested server errors to typed errors', async () => {
    let statting = adapter.stat('/nope');
    let ws = await connect();

    ws.serverSend({
      id: 'op1',
      type: 'error',
      error: {
        code: 'not_found',
        message: 'No such file or directory (os error 2)',
        path: '/nope'
      }
    });

    let error = await expectCode(statting, 'not_found');

    expect(error.serverCode).toBe('not_found');
    expect(error.path).toBe('/nope');
  });

  it('sends mkdir, move and delete requests with explicit semantics', async () => {
    let mkdir = adapter.mkdir('/app/new');
    let ws = await connect();

    ws.serverSend({ id: 'op1', type: 'result', created: true });
    await mkdir;

    let move = adapter.move('/app/a.txt', '/app/b.txt');
    await settle();
    ws.serverSend({ id: 'op2', type: 'result' });
    await move;

    let remove = adapter.delete('/app/old', { recursive: true });
    await settle();
    ws.serverSend({ id: 'op3', type: 'result', deleted: true });
    await remove;

    expect(ws.sentJson()).toEqual([
      { id: 'op1', op: 'mkdir', path: '/app/new', parents: false },
      { id: 'op2', op: 'move', from: '/app/a.txt', to: '/app/b.txt', overwrite: false },
      { id: 'op3', op: 'delete', path: '/app/old', recursive: true }
    ]);
  });

  it('retries reads on a new connection after the socket drops', async () => {
    let listing = adapter.list('/app');
    let first = await connect();

    first.serverClose(1006);
    await vi.advanceTimersByTimeAsync(50);

    expect(FakeWebSocket.instances).toHaveLength(2);

    let second = await connect();

    expect(second.sentJson()[0]).toEqual({
      id: 'op2',
      op: 'list',
      path: '/app',
      limit: 10000
    });

    second.serverSend({
      id: 'op2',
      type: 'entries',
      entries: [{ name: 'a', type: 'file', size: 1 }]
    });
    second.serverSend({ id: 'op2', type: 'result', count: 1, truncated: false });

    expect((await listing).entries).toHaveLength(1);
  });

  it('retries reads the server flags as retryable', async () => {
    let statting = adapter.stat('/a');
    let ws = await connect();

    ws.serverSend({
      id: 'op1',
      type: 'error',
      error: {
        code: 'connection_interrupted',
        message: 'The connection to the machine was interrupted.',
        retryable: true
      }
    });
    await vi.advanceTimersByTimeAsync(50);

    expect(ws.sentJson()[1]).toMatchObject({ id: 'op2', op: 'stat' });

    ws.serverSend({ id: 'op2', type: 'result', entry: { path: '/a', type: 'file', size: 1 } });

    expect((await statting).size).toBe(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('does not retry changes after the socket drops', async () => {
    let removing = adapter.delete('/app/file');
    let ws = await connect();

    ws.serverClose(1006);

    await expectCode(removing, 'disconnected');
    await vi.advanceTimersByTimeAsync(1000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(adapter.getSnapshot().status).toBe('disconnected');
  });

  it('reconnects on the next operation after a disconnect', async () => {
    let first = adapter.stat('/a');
    let ws = await connect();

    ws.serverSend({ id: 'op1', type: 'result', entry: { path: '/a', type: 'file', size: 1 } });
    await first;

    ws.serverClose(1012, 'machine_paused');
    expect(adapter.getSnapshot().status).toBe('disconnected');

    let next = adapter.stat('/a');
    let second = await connect();

    expect(FakeWebSocket.instances).toHaveLength(2);

    second.serverSend({
      id: 'op2',
      type: 'result',
      entry: { path: '/a', type: 'file', size: 2 }
    });
    expect((await next).size).toBe(2);
    expect(adapter.getSnapshot().status).toBe('ready');
  });

  it('does not retry reads once the machine paused', async () => {
    let listing = adapter.list('/app');
    let ws = await connect();

    ws.serverClose(1012, 'machine_paused');

    await expectCode(listing, 'disconnected');
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('becomes unavailable when the machine has ended until reconnect is called', async () => {
    let listener = vi.fn();
    adapter.subscribe(listener);

    let listing = adapter.list('/');
    let ws = await connect();

    ws.serverClose(4410, 'machine_ended');

    let error = await expectCode(listing, 'disconnected');

    expect(error.message).toBe('The machine was terminated.');
    expect(adapter.getSnapshot()).toMatchObject({ status: 'unavailable', error });
    expect(listener).toHaveBeenCalled();

    await expectCode(adapter.stat('/'), 'disconnected');
    expect(FakeWebSocket.instances).toHaveLength(1);

    let reconnecting = adapter.reconnect();
    let next = await connect();
    await reconnecting;

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(next.protocols[1]).toBe('metorial-sandbox-token.tok_1');
    expect(adapter.getSnapshot().status).toBe('ready');
  });

  it('stops notifying after unsubscribe', async () => {
    let listener = vi.fn();
    let unsubscribe = adapter.subscribe(listener);
    unsubscribe();

    adapter.stat('/a').catch(() => {});
    await connect();

    expect(listener).not.toHaveBeenCalled();
  });

  it('fetches a new token when access is rejected', async () => {
    getAccess
      .mockResolvedValueOnce({
        url: 'wss://proxy.test/files',
        token: 'tok_old',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      })
      .mockResolvedValueOnce({
        url: 'wss://proxy.test/files',
        token: 'tok_new',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      });

    let statting = adapter.stat('/a');
    let first = await connect();

    first.serverClose(4401, 'token_expired');
    await vi.advanceTimersByTimeAsync(50);

    let second = await connect();

    expect(getAccess).toHaveBeenCalledTimes(2);
    expect(second.protocols[1]).toBe('metorial-sandbox-token.tok_new');

    second.serverSend({
      id: 'op2',
      type: 'result',
      entry: { path: '/a', type: 'file', size: 1 }
    });
    await statting;
  });

  it('fetches a new token when the previous one is about to expire', async () => {
    getAccess.mockImplementation(async () => ({
      url: 'wss://proxy.test/files',
      token: 'tok_short',
      expiresAt: new Date(Date.now() + 10 * 1000)
    }));

    let first = adapter.stat('/a');
    let ws = await connect();
    ws.serverSend({ id: 'op1', type: 'result', entry: { path: '/a', type: 'file', size: 1 } });
    await first;

    ws.serverClose(1006);

    let second = adapter.stat('/a');
    await connect();

    expect(getAccess).toHaveBeenCalledTimes(2);

    FakeWebSocket.last().serverSend({
      id: 'op2',
      type: 'result',
      entry: { path: '/a', type: 'file', size: 1 }
    });
    await second;
  });

  it('retries the connection before giving up', async () => {
    let statting = adapter.stat('/a').catch((error: SandboxFilesError) => error);

    for (let attempt = 0; attempt < 3; attempt++) {
      await settle();
      FakeWebSocket.last().serverClose(1006);
      await vi.advanceTimersByTimeAsync(100);
    }

    let error = await statting;

    expect(error).toBeInstanceOf(SandboxFilesError);
    expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(3);
    expect(adapter.getSnapshot().status).toBe('disconnected');
  });

  it('reports failures to fetch access as disconnects', async () => {
    getAccess.mockRejectedValue(new Error('Machine not found'));
    createAdapter({ maxConnectAttempts: 1 });

    let error = await expectCode(adapter.list('/'), 'disconnected');

    expect(error.message).toBe('Could not get access to the machine: Machine not found');
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('rejects pending operations and closes the socket on close', async () => {
    let listing = adapter.list('/');
    let ws = await connect();

    adapter.close();

    await expectCode(listing, 'cancelled');
    expect(ws.closedWith).toEqual({ code: 1000, reason: 'closed' });

    await expectCode(adapter.stat('/'), 'cancelled');
  });
});

describe('describeFilesSocketClose', () => {
  it('treats ended and missing machines as unavailable', () => {
    expect(describeFilesSocketClose(4404, 'not_found').status).toBe('unavailable');
    expect(describeFilesSocketClose(4410, 'machine_ended').status).toBe('unavailable');
    expect(describeFilesSocketClose(4503, 'machine_failed').status).toBe('unavailable');
    expect(describeFilesSocketClose(1012, 'machine_terminated').status).toBe('unavailable');
  });

  it('keeps transient failures retryable', () => {
    for (let [code, reason] of [
      [1006, ''],
      [4502, 'upstream_unavailable'],
      [4504, 'upstream_timeout'],
      [4429, 'rate_limited'],
      [4503, 'unavailable'],
      [1012, 'machine_restarting']
    ] as const) {
      let failure = describeFilesSocketClose(code, reason);

      expect(failure.status).toBe('disconnected');
      expect(failure.error.retryable).toBe(true);
    }
  });

  it('does not retry a machine that paused and asks for a fresh token on rejection', () => {
    expect(describeFilesSocketClose(1012, 'machine_paused').error.retryable).toBe(false);
    expect(describeFilesSocketClose(4401, 'upstream_auth').invalidatesAccess).toBe(true);
  });
});

describe('getFileBrowserStatus', () => {
  it('lets the browser issue the first operation while idle', () => {
    expect(getFileBrowserStatus('idle')).toBe('ready');
    expect(getFileBrowserStatus('connecting')).toBe('connecting');
    expect(getFileBrowserStatus('disconnected')).toBe('disconnected');
    expect(getFileBrowserStatus('unavailable')).toBe('unavailable');
  });
});
