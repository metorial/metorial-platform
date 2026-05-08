import { beforeEach, describe, expect, it, vi } from 'vitest';

let subscribers: Record<string, (message: string) => void> = {};
let redis: any;
let subscriber: any;

vi.mock('@metorial/db', () => ({
  db: {
    assistantMessage: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/redis', () => ({
  createRedisClient: () => ({
    eager: async () => redis
  })
}));

describe('assistant run redis deltas', () => {
  beforeEach(() => {
    subscribers = {};

    subscriber = {
      connect: vi.fn(async () => {}),
      subscribe: vi.fn(async (channel: string, listener: (message: string) => void) => {
        subscribers[channel] = listener;
      }),
      unsubscribe: vi.fn(async () => {}),
      quit: vi.fn(async () => {})
    };

    redis = {
      publish: vi.fn(async () => {}),
      set: vi.fn(async () => {}),
      lPush: vi.fn(async () => {}),
      lTrim: vi.fn(async () => {}),
      lRange: vi.fn(async () => []),
      expire: vi.fn(async () => {}),
      get: vi.fn(async () => null),
      duplicate: vi.fn(() => subscriber),
      quit: vi.fn(async () => {})
    };
  });

  it('publishes deltas and stores snapshot notifications with stable keys', async () => {
    let { assistantRunDeltaKeys, createAssistantRunDeltaPublisher } = await import(
      '../src/lib/run/redisDeltas'
    );
    let keys = assistantRunDeltaKeys('run_1');
    let publisher = await createAssistantRunDeltaPublisher({
      runId: 'run_1',
      ttlSeconds: 30
    });

    await publisher.delta.emit?.send(['d', 1, [0, ['items'], { id: 'x' }]]);
    await publisher.delta.onSnapshot?.(['s', 2, { items: [] }]);

    expect(redis.publish).toHaveBeenCalledWith(
      keys.deltaChannel,
      JSON.stringify(['d', 1, [0, ['items'], { id: 'x' }]])
    );
    expect(redis.lPush).toHaveBeenCalledWith(
      keys.deltaReplay,
      JSON.stringify(['d', 1, [0, ['items'], { id: 'x' }]])
    );
    expect(redis.lTrim).toHaveBeenCalledWith(keys.deltaReplay, 0, 14);
    expect(redis.expire).toHaveBeenCalledWith(keys.deltaReplay, 30);
    expect(redis.set).toHaveBeenCalledWith(keys.snapshot, JSON.stringify(['s', 2, { items: [] }]), {
      EX: 30
    });
    expect(redis.publish).toHaveBeenCalledWith(
      keys.snapshotWrittenChannel,
      JSON.stringify({ runId: 'run_1', index: 2 })
    );
  });

  it('waits for a fresh snapshot before replaying buffered deltas', async () => {
    let { assistantRunDeltaKeys, listenToAssistantRunDeltas } = await import(
      '../src/lib/run/redisDeltas'
    );
    let keys = assistantRunDeltaKeys('run_2');
    let messages: unknown[] = [];
    redis.get.mockResolvedValue(JSON.stringify(['s', 2, { items: ['snapshot'] }]));

    let close = await listenToAssistantRunDeltas({
      runId: 'run_2',
      snapshotWaitTimeoutMs: 60_000,
      onMessage: message => {
        messages.push(message);
      }
    });

    subscribers[keys.deltaChannel](JSON.stringify(['d', 1, [0, ['items'], 'old']]));
    subscribers[keys.deltaChannel](JSON.stringify(['d', 3, [0, ['items'], 'new']]));
    subscribers[keys.snapshotWrittenChannel](JSON.stringify({ runId: 'run_2', index: 2 }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(messages).toEqual([
      ['s', 2, { items: ['snapshot'] }],
      ['d', 3, [0, ['items'], 'new']]
    ]);

    await close();
  });

  it('replays cached deltas newer than the snapshot before live streaming continues', async () => {
    let { assistantRunDeltaKeys, listenToAssistantRunDeltas } = await import(
      '../src/lib/run/redisDeltas'
    );
    let keys = assistantRunDeltaKeys('run_3');
    let messages: unknown[] = [];

    redis.get.mockResolvedValue(JSON.stringify(['s', 2, { items: ['snapshot'] }]));
    redis.lRange.mockResolvedValue([
      JSON.stringify(['d', 4, [0, ['items'], 'delta-4']]),
      JSON.stringify(['d', 3, [0, ['items'], 'delta-3']]),
      JSON.stringify(['d', 2, [0, ['items'], 'delta-2']])
    ]);

    let close = await listenToAssistantRunDeltas({
      runId: 'run_3',
      snapshotWaitTimeoutMs: 60_000,
      onMessage: message => {
        messages.push(message);
      }
    });

    subscribers[keys.snapshotWrittenChannel](JSON.stringify({ runId: 'run_3', index: 2 }));
    await new Promise(resolve => setTimeout(resolve, 0));
    subscribers[keys.deltaChannel](JSON.stringify(['d', 5, [0, ['items'], 'delta-5']]));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(messages).toEqual([
      ['s', 2, { items: ['snapshot'] }],
      ['d', 3, [0, ['items'], 'delta-3']],
      ['d', 4, [0, ['items'], 'delta-4']],
      ['d', 5, [0, ['items'], 'delta-5']]
    ]);

    await close();
  });

  it('does not lose deltas that arrive while replaying cached deltas', async () => {
    let { assistantRunDeltaKeys, listenToAssistantRunDeltas } = await import(
      '../src/lib/run/redisDeltas'
    );
    let keys = assistantRunDeltaKeys('run_4');
    let messages: unknown[] = [];
    let injected = false;

    redis.get.mockResolvedValue(JSON.stringify(['s', 2, { items: ['snapshot'] }]));
    redis.lRange.mockImplementation(async () => [
      JSON.stringify(['d', 3, [0, ['items'], 'delta-3']])
    ]);

    let close = await listenToAssistantRunDeltas({
      runId: 'run_4',
      snapshotWaitTimeoutMs: 60_000,
      onMessage: async message => {
        messages.push(message);

        if (!injected && JSON.stringify(message) == JSON.stringify(['d', 3, [0, ['items'], 'delta-3']])) {
          injected = true;
          subscribers[keys.deltaChannel](JSON.stringify(['d', 4, [0, ['items'], 'delta-4']]));
        }
      }
    });

    subscribers[keys.snapshotWrittenChannel](JSON.stringify({ runId: 'run_4', index: 2 }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(messages).toEqual([
      ['s', 2, { items: ['snapshot'] }],
      ['d', 3, [0, ['items'], 'delta-3']],
      ['d', 4, [0, ['items'], 'delta-4']]
    ]);

    await close();
  });
});
