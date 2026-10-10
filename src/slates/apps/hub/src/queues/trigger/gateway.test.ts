import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let gatewayTable = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(async () => ({ triggerRegistrationInstanceOid: 7n })),
  updateMany: vi.fn(async () => ({ count: 1 }))
};
let db = { triggerRegistrationGateway: gatewayTable };
let invocation = {
  createInvocationWithState: vi.fn(async () => ({})),
  connectTriggerGroupGateway: vi.fn(),
  receiveTriggerGroupGatewayFrames: vi.fn()
};
let createRawEvents = vi.fn(async () => ({ created: [] }));
let decrypt = vi.fn();
let instanceError = vi.fn();
let dnsLookup = vi.fn();

vi.mock('@lowerdeck/delay', () => ({
  delay: vi.fn(() => new Promise(resolve => setTimeout(resolve, 0)))
}));
vi.mock('@lowerdeck/sentry', () => ({ getSentry: () => ({ captureException: vi.fn() }) }));
vi.mock('../../db', () => ({ db }));
vi.mock('../../lib/slateVersion', () => ({
  getActiveSlateVersion: vi.fn(async () => ({ id: 'version' }))
}));
vi.mock('../../services/secret', () => ({
  secretService: { DANGEROUSLY_decryptSecret: decrypt }
}));
vi.mock('../../services/slateInvocation', () => ({ slateInvocationService: invocation }));
vi.mock('./_rawEvent', () => ({ createTriggerRawEvents: createRawEvents }));
vi.mock('./_instanceError', () => ({ createTriggerRegistrationInstanceError: instanceError }));
vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closedWith: { code: number; reason: string } | null = null;
  listeners = new Map<string, ((event: any) => void)[]>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.emit('open', {});
    });
  }

  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, event: any) {
    for (let listener of this.listeners.get(type) ?? []) listener(event);
  }

  send(frame: string) {
    this.sent.push(frame);
  }

  close(code = 1000, reason = '') {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.closedWith = { code, reason };
    // Real sockets emit close asynchronously.
    setTimeout(() => this.emit('close', { code, reason }), 5);
  }
}

let record = {
  oid: 1n,
  id: 'gateway-1',
  isDisabled: false,
  state: null,
  triggerRegistrationInstanceOid: 7n,
  triggerRegistrationInstance: {
    id: 'instance-1',
    triggerGroup: { key: 'gateway' },
    triggerRegistration: {
      status: 'active',
      tenant: { oid: 1n },
      slate: {},
      instance: {},
      instanceConfig: { value: {} },
      authConfig: { secretOid: 3n, authMethod: { key: 'bot_token' } }
    }
  }
};

let success = (data: any) => ({ status: 'success', invocation: {}, data });

let { GatewayConnection } = await import('./gateway');

let started: InstanceType<typeof GatewayConnection>[] = [];
let startConnection = () => {
  let connection = new GatewayConnection(1n, 'gateway-1', 7n, () => {});
  started.push(connection);
  connection.start();
  return connection;
};

describe('trigger gateway connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    (globalThis as any).WebSocket = FakeWebSocket;
    gatewayTable.findUnique.mockResolvedValue(record);
    dnsLookup.mockResolvedValue([{ address: '162.159.135.232', family: 4 }]);
    decrypt.mockResolvedValue({ output: { token: 'bot-token' } });
    invocation.connectTriggerGroupGateway.mockResolvedValue(
      success({ url: 'wss://gateway.example/1', state: { session: null } })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (let connection of started) connection.stop();
    started = [];
  });

  it('relays frames, writes replies, records events and persists state', async () => {
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValue(
      success({
        state: { session: 's1', seq: 2 },
        send: ['{"op":2}'],
        events: [
          { payload: { t: 'MESSAGE_CREATE' }, idempotencyKey: 's1:2', triggerIds: ['m'] }
        ],
        heartbeat: null,
        close: null
      })
    );

    startConnection();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    let socket = FakeWebSocket.instances[0]!;
    expect(socket.url).toBe('wss://gateway.example/1');
    expect(invocation.connectTriggerGroupGateway).toHaveBeenCalledWith(
      expect.objectContaining({ triggerGroupId: 'gateway', state: null })
    );

    await vi.waitFor(() => expect(socket.readyState).toBe(FakeWebSocket.OPEN));
    socket.emit('message', { data: '{"op":10}' });
    socket.emit('message', { data: '{"op":0,"s":2}' });

    await vi.waitFor(() => expect(createRawEvents).toHaveBeenCalled());
    expect(invocation.receiveTriggerGroupGatewayFrames).toHaveBeenCalledTimes(1);
    expect(invocation.receiveTriggerGroupGatewayFrames).toHaveBeenCalledWith(
      expect.objectContaining({
        frames: ['{"op":10}', '{"op":0,"s":2}'],
        closed: null,
        state: { session: null }
      })
    );
    expect(socket.sent).toEqual(['{"op":2}']);
    expect(createRawEvents).toHaveBeenCalledWith({
      source: 'gateway',
      events: [
        {
          triggerRegistrationInstanceOids: [7n],
          payload: { t: 'MESSAGE_CREATE' },
          idempotencyKey: 's1:2',
          triggerIds: ['m']
        }
      ]
    });
  });

  it('restores credential placeholders only when writing frames to the socket', async () => {
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValue(
      success({
        send: ['{"op":2,"d":{"token":"$$MT$secret$authConfig$token$$"}}'],
        events: [],
        close: null
      })
    );

    startConnection();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    let socket = FakeWebSocket.instances[0]!;
    await vi.waitFor(() => expect(socket.readyState).toBe(FakeWebSocket.OPEN));
    socket.emit('message', { data: '{"op":10}' });

    await vi.waitFor(() =>
      expect(socket.sent).toEqual(['{"op":2,"d":{"token":"bot-token"}}'])
    );
  });

  it('keeps the previous state when storing events fails so a resume replays them', async () => {
    createRawEvents.mockRejectedValueOnce(new Error('db down'));
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValue(
      success({
        state: { session: 's1', seq: 9 },
        send: [],
        events: [
          { payload: { t: 'MESSAGE_CREATE' }, idempotencyKey: 's1:9', triggerIds: ['m'] }
        ],
        close: null
      })
    );

    startConnection();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    let socket = FakeWebSocket.instances[0]!;
    await vi.waitFor(() => expect(socket.readyState).toBe(FakeWebSocket.OPEN));
    socket.emit('message', { data: '{"op":0,"s":9}' });

    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    expect(invocation.connectTriggerGroupGateway).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: { session: null } })
    );
  });

  it('keeps processing frames after a requested close with nothing pending', async () => {
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValueOnce(
      success({ send: [], events: [], close: { reconnect: true, reason: 'resume rejected' } })
    );
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValue(
      success({ send: ['{"op":2}'], events: [], close: null })
    );

    startConnection();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    let first = FakeWebSocket.instances[0]!;
    await vi.waitFor(() => expect(first.readyState).toBe(FakeWebSocket.OPEN));
    first.emit('message', { data: '{"op":9}' });

    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    let second = FakeWebSocket.instances[1]!;
    await vi.waitFor(() => expect(second.readyState).toBe(FakeWebSocket.OPEN));
    second.emit('message', { data: '{"op":10}' });

    await vi.waitFor(() => expect(second.sent).toEqual(['{"op":2}']));
    expect(invocation.receiveTriggerGroupGatewayFrames).toHaveBeenCalledTimes(2);
  });

  it('reports an unexpected close and reconnects with the saved state', async () => {
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValue(
      success({ state: { session: 's1', seq: 5 }, send: [], events: [], close: null })
    );

    startConnection();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    let socket = FakeWebSocket.instances[0]!;
    await vi.waitFor(() => expect(socket.readyState).toBe(FakeWebSocket.OPEN));

    socket.close(1006, 'abnormal');

    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    expect(invocation.receiveTriggerGroupGatewayFrames).toHaveBeenCalledWith(
      expect.objectContaining({ frames: [], closed: { code: 1006, reason: 'abnormal' } })
    );
    expect(invocation.connectTriggerGroupGateway).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: { session: 's1', seq: 5 } })
    );
  });

  it('disables the gateway when the slate closes without reconnecting', async () => {
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValue(
      success({
        send: [],
        events: [],
        close: { reconnect: false, reason: 'Authentication failed' }
      })
    );

    startConnection();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    let socket = FakeWebSocket.instances[0]!;
    await vi.waitFor(() => expect(socket.readyState).toBe(FakeWebSocket.OPEN));
    socket.emit('message', { data: '{"op":9}' });

    await vi.waitFor(() => expect(instanceError).toHaveBeenCalled());
    expect(gatewayTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDisabled: true, lastErrorCode: 'gateway_closed' })
      })
    );
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({ triggerRegistrationInstanceOid: 7n, code: 'gateway_closed' })
    );
    await vi.waitFor(() => expect(socket.readyState).toBe(3));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('reconnects when frame processing fails so the provider can replay', async () => {
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValueOnce({
      status: 'error',
      invocation: {},
      error: { code: 'internal', message: 'boom' }
    });
    invocation.receiveTriggerGroupGatewayFrames.mockResolvedValue(
      success({ send: [], events: [], close: null })
    );

    startConnection();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    let socket = FakeWebSocket.instances[0]!;
    await vi.waitFor(() => expect(socket.readyState).toBe(FakeWebSocket.OPEN));
    socket.emit('message', { data: '{"op":0}' });

    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    expect(gatewayTable.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastErrorCode: 'internal' }) })
    );
  });

  it('reports repeated thrown connect failures once per streak', async () => {
    decrypt.mockRejectedValue(new Error('secret unavailable'));

    startConnection();
    await vi.waitFor(() => expect(decrypt.mock.calls.length).toBeGreaterThan(6));

    expect(invocation.connectTriggerGroupGateway).not.toHaveBeenCalled();
    expect(gatewayTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastErrorCode: 'gateway_connection_failed' })
      })
    );
    expect(instanceError).toHaveBeenCalledTimes(1);
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerRegistrationInstanceOid: 7n,
        code: 'gateway_connect_failed'
      })
    );
  });

  it('waits for auth processing before reading the secret and connecting', async () => {
    let processing: any = structuredClone(record);
    processing.triggerRegistrationInstance.triggerRegistration.authConfig.isProcessing = true;
    gatewayTable.findUnique.mockResolvedValueOnce(processing);

    startConnection();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    expect(gatewayTable.findUnique).toHaveBeenCalledTimes(2);
    expect(decrypt).toHaveBeenCalledTimes(1);
    expect(invocation.connectTriggerGroupGateway).toHaveBeenCalledTimes(1);
    expect(instanceError).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-wss URL', 'ws://gateway.example/1'],
    ['a private literal IP', 'wss://10.0.0.8/gateway'],
    ['the cloud metadata address', 'wss://169.254.169.254/latest'],
    ['a host resolving to a private IP', 'wss://internal.example/gateway']
  ])('rejects %s as a connect failure without opening a socket', async (_, url) => {
    dnsLookup.mockResolvedValue([{ address: '192.168.10.4', family: 4 }]);
    invocation.connectTriggerGroupGateway.mockResolvedValue(
      success({ url, state: { session: null } })
    );

    startConnection();
    await vi.waitFor(() => expect(instanceError).toHaveBeenCalled());

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(gatewayTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastErrorCode: 'gateway_url_not_allowed' })
      })
    );
    expect(instanceError).toHaveBeenCalledTimes(1);
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerRegistrationInstanceOid: 7n,
        code: 'gateway_connect_failed'
      })
    );
    expect(invocation.connectTriggerGroupGateway.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  describe('liveness', () => {
    let HELLO = '{"op":10}';
    let ACK = '{"op":11}';
    let BEAT = '{"op":1}';
    let INTERVAL = 1000;

    let advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

    let openSocket = async () => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
      });
      vi.spyOn(Math, 'random').mockReturnValue(0);
      startConnection();
      for (let i = 0; i < 50 && !FakeWebSocket.instances[0]; i++) await advance(0);
      let socket = FakeWebSocket.instances[0]!;
      await advance(0);
      expect(socket.readyState).toBe(FakeWebSocket.OPEN);
      return socket;
    };

    let heartbeatReplies = (heartbeat: Record<string, unknown> | null) =>
      invocation.receiveTriggerGroupGatewayFrames.mockImplementation(
        async ({ frames }: { frames: string[] }) =>
          success({
            send: [],
            events: [],
            heartbeat,
            heartbeatAcked: frames.includes(ACK),
            close: null
          })
      );

    it('reconnects an idle connection even without a declared heartbeat', async () => {
      heartbeatReplies(null);
      let socket = await openSocket();
      socket.emit('message', { data: '{"op":0}' });
      await advance(60_000);
      expect(socket.readyState).toBe(FakeWebSocket.OPEN);

      await advance(2 * 60_000);
      expect(socket.closedWith).toEqual({ code: 4000, reason: 'connection idle' });
      await advance(100);
      expect(FakeWebSocket.instances).toHaveLength(2);
      expect(invocation.receiveTriggerGroupGatewayFrames).not.toHaveBeenCalledWith(
        expect.objectContaining({ closed: expect.anything() })
      );
    });

    it('reconnects when a heartbeat that expects an ack is not acknowledged', async () => {
      heartbeatReplies({ intervalMs: INTERVAL, frame: BEAT, expectsAck: true });
      let socket = await openSocket();
      socket.emit('message', { data: HELLO });
      await advance(150);
      expect(socket.sent).toEqual([BEAT]);

      socket.emit('message', { data: '{"op":0}' });
      await advance(INTERVAL);

      expect(socket.sent).toEqual([BEAT]);
      expect(socket.closedWith).toEqual({ code: 4000, reason: 'heartbeat not acknowledged' });
      await advance(100);
      expect(FakeWebSocket.instances).toHaveLength(2);
    });

    it('keeps an acknowledged connection open', async () => {
      heartbeatReplies({ intervalMs: INTERVAL, frame: BEAT, expectsAck: true });
      let socket = await openSocket();
      socket.emit('message', { data: HELLO });
      await advance(150);

      for (let beat = 1; beat <= 4; beat++) {
        expect(socket.sent).toHaveLength(beat);
        socket.emit('message', { data: ACK });
        await advance(INTERVAL);
      }

      expect(socket.readyState).toBe(FakeWebSocket.OPEN);
      expect(socket.closedWith).toBeNull();
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('waits for an ack still queued behind a slow receive call', async () => {
      heartbeatReplies({ intervalMs: INTERVAL, frame: BEAT, expectsAck: true });
      let socket = await openSocket();
      socket.emit('message', { data: HELLO });
      await advance(150);
      expect(socket.sent).toEqual([BEAT]);

      invocation.receiveTriggerGroupGatewayFrames.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return success({ send: [], events: [], heartbeatAcked: true, close: null });
      });
      socket.emit('message', { data: ACK });
      await advance(INTERVAL);
      expect(socket.closedWith).toBeNull();

      await advance(1000);
      expect(socket.closedWith).toBeNull();
      expect(socket.sent).toEqual([BEAT, BEAT]);
    });

    it('keeps the legacy any-frame rule when the heartbeat expects no ack', async () => {
      heartbeatReplies({ intervalMs: INTERVAL, frame: BEAT });
      let socket = await openSocket();
      socket.emit('message', { data: HELLO });
      await advance(150);

      for (let beat = 1; beat <= 3; beat++) {
        socket.emit('message', { data: '{"op":0}' });
        await advance(INTERVAL);
      }
      expect(socket.sent).toEqual([BEAT, BEAT, BEAT, BEAT]);
      expect(socket.closedWith).toBeNull();

      await advance(INTERVAL * 3);
      expect(socket.closedWith).toEqual({ code: 4000, reason: 'no frames received' });
    });
  });
});
