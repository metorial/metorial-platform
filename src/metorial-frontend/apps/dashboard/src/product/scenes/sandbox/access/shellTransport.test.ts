import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeWebSocket, FakeWebSocket, flushPromises } from './fakeWebSocket.testUtil';
import {
  createSandboxShellTransport,
  decodeShellOutput,
  encodeShellAttach,
  encodeShellInput,
  encodeShellOpen,
  encodeShellResize,
  encodeShellSignal,
  encodeShellStdinEof,
  createBrowserShellSessionStore,
  parseShellMessage,
  type SandboxShellSessionRecord
} from './shellTransport';

let decoder = new TextDecoder();

describe('shell protocol helpers', () => {
  it('encodes control frames', () => {
    expect(JSON.parse(encodeShellOpen({ cols: 120, rows: 40 }))).toEqual({
      type: 'open',
      v: 1,
      tty: true,
      cols: 120,
      rows: 40
    });

    expect(
      JSON.parse(encodeShellOpen({ cols: 0, rows: 5000, command: ['/bin/bash'], cwd: '/app' }))
    ).toEqual({
      type: 'open',
      v: 1,
      tty: true,
      cols: 1,
      rows: 1000,
      command: ['/bin/bash'],
      cwd: '/app'
    });

    expect(JSON.parse(encodeShellAttach('sess_1', 42.7))).toEqual({
      type: 'attach',
      v: 1,
      sessionId: 'sess_1',
      offset: 42
    });

    expect(JSON.parse(encodeShellResize(80.4, 24))).toEqual({
      type: 'resize',
      cols: 80,
      rows: 24
    });
    expect(JSON.parse(encodeShellSignal('INT'))).toEqual({ type: 'signal', signal: 'INT' });
    expect(JSON.parse(encodeShellStdinEof())).toEqual({ type: 'stdin_eof' });
    expect(decoder.decode(encodeShellInput('ls\r'))).toBe('ls\r');
  });

  it('decodes output frames', () => {
    let tty = decodeShellOutput(new Uint8Array([104, 105]).buffer, true);
    expect(tty.stream).toBeNull();
    expect(decoder.decode(tty.data)).toBe('hi');

    let stderr = decodeShellOutput(new Uint8Array([2, 111, 104]), false);
    expect(stderr.stream).toBe('stderr');
    expect(decoder.decode(stderr.data)).toBe('oh');

    expect(decodeShellOutput(new Uint8Array([1, 120]), false).stream).toBe('stdout');
  });

  it('parses server messages', () => {
    expect(
      parseShellMessage(
        '{"type":"session_init","sessionId":"s1","pid":7,"tty":true,"resumed":true,"offset":12}'
      )
    ).toEqual({
      type: 'session_init',
      sessionId: 's1',
      pid: 7,
      tty: true,
      resumed: true,
      offset: 12
    });

    expect(
      parseShellMessage('{"type":"error","code":"spawn_failed","message":"nope"}')
    ).toEqual({
      type: 'error',
      code: 'spawn_failed',
      message: 'nope'
    });

    expect(
      parseShellMessage('{"type":"error","error":{"code":"invalid_request","message":"bad"}}')
    ).toEqual({ type: 'error', code: 'invalid_request', message: 'bad' });

    expect(parseShellMessage('{"type":"exit","code":null,"signal":"KILL"}')).toEqual({
      type: 'exit',
      code: null,
      signal: 'KILL'
    });

    expect(parseShellMessage('{"type":"connection_notice","notice":"idle"}')).toMatchObject({
      notice: 'idle'
    });

    expect(parseShellMessage('not json')).toBeNull();
    expect(parseShellMessage('{"type":"mystery"}')).toBeNull();
  });
});

let createHandlers = () => ({
  onOutput: vi.fn<(data: Uint8Array) => void>(),
  onStatus: vi.fn(),
  onExit: vi.fn(),
  onNotice: vi.fn(),
  onNoticeClear: vi.fn()
});

let statuses = (handlers: ReturnType<typeof createHandlers>) =>
  handlers.onStatus.mock.calls.map(call => call[0]);

describe('createSandboxShellTransport', () => {
  let store: Map<string, SandboxShellSessionRecord>;
  let getAccess: ReturnType<typeof vi.fn>;

  let createTransport = (extra: Record<string, unknown> = {}) =>
    createSandboxShellTransport({
      getAccess: getAccess as any,
      sessionStore: store,
      createWebSocket: createFakeWebSocket,
      ...extra
    });

  let connect = async (ws: FakeWebSocket, init: Record<string, unknown> = {}) => {
    ws.serverOpen();
    ws.serverSend({
      type: 'session_init',
      sessionId: 'sess_1',
      pid: 1,
      tty: true,
      resumed: false,
      offset: 0,
      ...init
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.reset();
    store = new Map();
    getAccess = vi.fn(async () => ({
      url: 'wss://proxy.test/shell',
      token: 'tok_1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a session with the sandbox subprotocols', async () => {
    let handlers = createHandlers();
    let session = createTransport().open(
      { sessionKey: 'm1:1', cols: 100, rows: 30 },
      handlers
    );
    await flushPromises();

    let ws = FakeWebSocket.last();
    expect(ws.url).toBe('wss://proxy.test/shell');
    expect(ws.protocols).toEqual(['metorial-sandbox-v1', 'metorial-sandbox-token.tok_1']);
    expect(ws.binaryType).toBe('arraybuffer');

    await connect(ws);

    expect(ws.sentJson()[0]).toEqual({ type: 'open', v: 1, tty: true, cols: 100, rows: 30 });
    expect(statuses(handlers)).toEqual(['connecting', 'connected']);
    expect(store.get('m1:1')).toEqual({ sessionId: 'sess_1' });

    ws.serverSend(new TextEncoder().encode('hello'));
    expect(decoder.decode(handlers.onOutput.mock.calls[0]![0])).toBe('hello');

    session.write('ls\r');
    session.resize(120, 40);
    session.signal('INT');

    expect(decoder.decode(ws.sentBinary()[0])).toBe('ls\r');
    expect(ws.sentJson().slice(1)).toEqual([
      { type: 'resize', cols: 120, rows: 40 },
      { type: 'signal', signal: 'INT' }
    ]);
  });

  it('detaches with a resumable close code and replays the buffer on the next open', async () => {
    let transport = createTransport();
    let session = transport.open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, createHandlers());
    await flushPromises();
    await connect(FakeWebSocket.last());

    FakeWebSocket.last().serverSend(new TextEncoder().encode('abc'));
    session.detach();

    expect(FakeWebSocket.last().closedWith).toEqual({ code: 4000, reason: 'detach' });

    transport.open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, createHandlers());
    await flushPromises();
    FakeWebSocket.last().serverOpen();

    expect(FakeWebSocket.last().sentJson()[0]).toEqual({
      type: 'attach',
      v: 1,
      sessionId: 'sess_1',
      offset: 0
    });
  });

  it('reconnects after a dropped connection and resumes at the received offset', async () => {
    let handlers = createHandlers();
    createTransport().open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, handlers);
    await flushPromises();

    let first = FakeWebSocket.last();
    await connect(first);
    first.serverSend(new TextEncoder().encode('12345'));
    first.serverClose(1006);

    expect(statuses(handlers).at(-1)).toBe('reconnecting');

    await vi.advanceTimersByTimeAsync(2000);

    let second = FakeWebSocket.last();
    expect(second).not.toBe(first);

    second.serverOpen();
    expect(second.sentJson()[0]).toEqual({
      type: 'attach',
      v: 1,
      sessionId: 'sess_1',
      offset: 5
    });

    second.serverSend({
      type: 'session_init',
      sessionId: 'sess_1',
      tty: true,
      resumed: true,
      offset: 5
    });

    expect(statuses(handlers).at(-1)).toBe('connected');
    expect(second.sentJson()[1]).toEqual({ type: 'resize', cols: 80, rows: 24 });
  });

  it('falls back to a new session when the remembered one is gone', async () => {
    store.set('m1:1', { sessionId: 'old' });

    createTransport().open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, createHandlers());
    await flushPromises();

    let first = FakeWebSocket.last();
    first.serverOpen();
    expect(first.sentJson()[0]).toMatchObject({ type: 'attach', sessionId: 'old' });

    first.serverSend({ type: 'error', code: 'session_not_found', message: 'gone' });
    first.serverClose(4404, 'session_not_found');
    await flushPromises();

    let second = FakeWebSocket.last();
    expect(second).not.toBe(first);
    second.serverOpen();
    expect(second.sentJson()[0]).toMatchObject({ type: 'open' });
    expect(store.has('m1:1')).toBe(false);
  });

  it('ignores the remembered session for fresh opens', async () => {
    store.set('m1:1', { sessionId: 'old' });

    createTransport().open(
      { sessionKey: 'm1:1', cols: 80, rows: 24, fresh: true },
      createHandlers()
    );
    await flushPromises();

    FakeWebSocket.last().serverOpen();
    expect(FakeWebSocket.last().sentJson()[0]).toMatchObject({ type: 'open' });
  });

  it('reports exits and forgets the session', async () => {
    let handlers = createHandlers();
    createTransport().open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, handlers);
    await flushPromises();

    let ws = FakeWebSocket.last();
    await connect(ws);
    ws.serverSend({ type: 'exit', code: 0, signal: null });
    ws.serverClose(1000, 'exited');

    expect(handlers.onExit).toHaveBeenCalledWith({ code: 0, signal: null });
    expect(statuses(handlers).at(-1)).toBe('ended');
    expect(store.has('m1:1')).toBe(false);
  });

  it('sends stdin_eof and kills the session on close', async () => {
    let session = createTransport().open(
      { sessionKey: 'm1:1', cols: 80, rows: 24 },
      createHandlers()
    );
    await flushPromises();
    await connect(FakeWebSocket.last());

    session.close();

    expect(FakeWebSocket.last().sentJson().at(-1)).toEqual({ type: 'stdin_eof' });
    expect(FakeWebSocket.last().closedWith).toEqual({ code: 1000, reason: 'closed' });
    expect(store.has('m1:1')).toBe(false);
  });

  it('reports waking when the session takes a while to start', async () => {
    let handlers = createHandlers();
    createTransport().open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, handlers);
    await flushPromises();

    FakeWebSocket.last().serverOpen();
    await vi.advanceTimersByTimeAsync(1600);

    expect(statuses(handlers)).toEqual(['connecting', 'waking']);
  });

  it('starts in waking when the machine is known to be asleep', async () => {
    let handlers = createHandlers();
    createTransport({ isSleeping: () => true }).open(
      { sessionKey: 'm1:1', cols: 80, rows: 24 },
      handlers
    );

    expect(statuses(handlers)[0]).toBe('waking');
  });

  it('stops when attached elsewhere', async () => {
    let handlers = createHandlers();
    createTransport().open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, handlers);
    await flushPromises();

    let ws = FakeWebSocket.last();
    await connect(ws);
    ws.serverClose(4409, 'attached_elsewhere');
    await vi.advanceTimersByTimeAsync(30000);

    expect(statuses(handlers).at(-1)).toBe('error');
    expect(handlers.onStatus.mock.calls.at(-1)![1]).toMatchObject({ code: 4409 });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('fetches a new token when the socket fails before opening', async () => {
    createTransport().open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, createHandlers());
    await flushPromises();

    expect(getAccess).toHaveBeenCalledTimes(1);
    FakeWebSocket.last().serverClose(1006);
    await vi.advanceTimersByTimeAsync(2000);

    expect(getAccess).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('reuses the token until it nears expiry', async () => {
    let transport = createTransport();

    transport.open({ sessionKey: 'a', cols: 80, rows: 24 }, createHandlers());
    await flushPromises();
    transport.open({ sessionKey: 'b', cols: 80, rows: 24 }, createHandlers());
    await flushPromises();

    expect(getAccess).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 60 * 60 * 1000);
    transport.open({ sessionKey: 'c', cols: 80, rows: 24 }, createHandlers());
    await flushPromises();

    expect(getAccess).toHaveBeenCalledTimes(2);
  });

  it('maps connection notices', async () => {
    let handlers = createHandlers();
    createTransport().open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, handlers);
    await flushPromises();

    let ws = FakeWebSocket.last();
    await connect(ws);

    ws.serverSend({ type: 'connection_notice', notice: 'idle_warning', idleInSeconds: 290 });
    ws.serverSend({ type: 'connection_notice', notice: 'active' });
    ws.serverSend({ type: 'connection_notice', notice: 'closing', reason: 'machine_paused' });

    expect(handlers.onNotice.mock.calls.map(call => call[0].kind)).toEqual([
      'idle_warning',
      'closing'
    ]);
    expect(handlers.onNotice.mock.calls[0]![0].message).toContain('5 min');
    expect(handlers.onNoticeClear).toHaveBeenCalledTimes(1);

    ws.serverClose(1012, 'machine_paused');
    await vi.advanceTimersByTimeAsync(30000);

    expect(statuses(handlers).at(-1)).toBe('error');
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('starts a new shell after the machine restarts', async () => {
    let handlers = createHandlers();
    createTransport().open({ sessionKey: 'm1:1', cols: 80, rows: 24 }, handlers);
    await flushPromises();

    let first = FakeWebSocket.last();
    await connect(first);
    first.serverClose(1012, 'machine_restarting');
    await vi.advanceTimersByTimeAsync(2000);

    let second = FakeWebSocket.last();
    expect(second).not.toBe(first);
    second.serverOpen();
    expect(second.sentJson()[0]).toMatchObject({ type: 'open' });
  });

  it('gives up after too many failed attempts', async () => {
    let handlers = createHandlers();
    createTransport({ maxReconnectAttempts: 2 }).open(
      { sessionKey: 'm1:1', cols: 80, rows: 24 },
      handlers
    );

    for (let i = 0; i < 3; i++) {
      await flushPromises();
      FakeWebSocket.last().serverOpen();
      FakeWebSocket.last().serverClose(4502, 'upstream_unavailable');
      await vi.advanceTimersByTimeAsync(5000);
    }

    expect(statuses(handlers).at(-1)).toBe('error');
    expect(FakeWebSocket.instances).toHaveLength(3);
  });
});

describe('createBrowserShellSessionStore', () => {
  let createStorage = () => {
    let values = new Map<string, string>();

    return {
      values,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key)
    };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps session ids in sessionStorage so they survive a reload', () => {
    let storage = createStorage();
    vi.stubGlobal('sessionStorage', storage);

    createBrowserShellSessionStore().set('m1:1', { sessionId: 'sess_1' });

    expect(createBrowserShellSessionStore().get('m1:1')).toEqual({ sessionId: 'sess_1' });

    createBrowserShellSessionStore().delete('m1:1');

    expect(storage.values.size).toBe(0);
    expect(createBrowserShellSessionStore().get('m1:1')).toBeUndefined();
  });

  it('falls back to memory when storage is unavailable', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      }
    });

    let store = createBrowserShellSessionStore();
    store.set('m1:1', { sessionId: 'sess_2' });

    expect(store.get('m1:1')).toEqual({ sessionId: 'sess_2' });
  });
});
