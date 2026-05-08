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
});
