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

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
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
    decrypt.mockResolvedValue({ output: { token: 'bot-token' } });
    invocation.connectTriggerGroupGateway.mockResolvedValue(
      success({ url: 'wss://gateway.example/1', state: { session: null } })
    );
  });

  afterEach(() => {
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
});
