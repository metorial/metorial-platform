import { beforeEach, describe, expect, it, vi } from 'vitest';

let { connect, duplicate, publish } = vi.hoisted(() => {
  let duplicate = vi.fn();
  let publish = vi.fn();
  let connect = vi.fn(async () => ({ duplicate, publish }));

  return { connect, duplicate, publish };
});

vi.mock('@metorial/redis', () => ({
  createRedisClient: () => ({ eager: connect })
}));

vi.mock('@metorial/db', () => ({
  db: { productAssistantModelRun: { findUnique: async () => ({ status: 'running' }) } }
}));

let createSubscriber = () => {
  let subscriber = {
    isOpen: false,
    on: vi.fn(),
    connect: vi.fn(async () => {
      subscriber.isOpen = true;
    }),
    subscribe: vi.fn<(channel: string, listener: (raw: string) => void) => Promise<void>>(),
    destroy: vi.fn(() => {
      subscriber.isOpen = false;
    })
  };

  return subscriber;
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  duplicate.mockReset();
});

describe('Assistant run Redis connections', () => {
  it('shares a command client between publishers and listeners', async () => {
    let subscriber = createSubscriber();
    duplicate.mockReturnValueOnce(subscriber);
    let { createAssistantRunDeltaPublisher, listenToAssistantRunDeltas } =
      await import('./redisDeltas');

    let [publisher, close] = await Promise.all([
      createAssistantRunDeltaPublisher({ runId: 'run-1' }),
      listenToAssistantRunDeltas({ runId: 'run-1', onMessage: vi.fn() })
    ]);
    await close();
    await close();
    await publisher.markDone({ status: 'completed' });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(subscriber.destroy).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      'product-assistant:run:run-1:done',
      JSON.stringify({ status: 'completed' })
    );
  });

  it('closes the subscriber if setup fails after connecting', async () => {
    let subscriber = createSubscriber();
    let error = new Error('subscription failed');
    subscriber.subscribe.mockRejectedValueOnce(error);
    duplicate.mockReturnValueOnce(subscriber);
    let { listenToAssistantRunDeltas } = await import('./redisDeltas');

    await expect(
      listenToAssistantRunDeltas({ runId: 'run-1', onMessage: vi.fn() })
    ).rejects.toBe(error);
    expect(subscriber.destroy).toHaveBeenCalledTimes(1);
  });

  it('closes the subscriber when the caller aborts during setup', async () => {
    let controller = new AbortController();
    let subscriber = createSubscriber();
    subscriber.subscribe.mockImplementationOnce(async () => {
      controller.abort();
      throw new Error('client closed');
    });
    duplicate.mockReturnValueOnce(subscriber);
    let { listenToAssistantRunDeltas } = await import('./redisDeltas');

    await listenToAssistantRunDeltas({
      runId: 'run-1',
      signal: controller.signal,
      onMessage: vi.fn()
    });

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.destroy).toHaveBeenCalledTimes(1);
  });
});
