import { beforeEach, describe, expect, it, vi } from 'vitest';

let { duplicate, lazy, publish } = vi.hoisted(() => {
  let duplicate = vi.fn();
  let publish = vi.fn();
  let lazy = vi.fn(() => async () => ({ duplicate, publish }));

  return { duplicate, lazy, publish };
});

vi.mock('@lowerdeck/redis', () => ({
  createRedisClient: () => ({ lazy })
}));
vi.mock('@mtsrc/slates-hub-env/env', () => ({
  env: { service: { REDIS_URL: 'redis://unused' } }
}));

let createSubscriber = () => {
  let subscriber = {
    isOpen: false,
    on: vi.fn(),
    connect: vi.fn(async () => {
      subscriber.isOpen = true;
    }),
    subscribe: vi.fn<(channel: string, listener: () => void) => Promise<void>>(),
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

describe('Slates webhook event bus', () => {
  it('reuses the Redis client across publishes and subscriptions', async () => {
    let subscriber = createSubscriber();
    duplicate.mockReturnValueOnce(subscriber);
    let { publishWebhookEventResolved, subscribeToWebhookEvent } =
      await import('./webhookEventBus');

    let [subscription] = await Promise.all([
      subscribeToWebhookEvent('event-1'),
      publishWebhookEventResolved('event-1'),
      publishWebhookEventResolved('event-2')
    ]);

    expect(lazy).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls).toEqual([
      ['shub:whk:evt:event-1', '1'],
      ['shub:whk:evt:event-2', '1']
    ]);
    expect(subscriber.subscribe).toHaveBeenCalledExactlyOnceWith(
      'shub:whk:evt:event-1',
      expect.any(Function)
    );

    subscriber.subscribe.mock.calls[0]![1]();
    await expect(subscription.waitForSignal()).resolves.toBeUndefined();

    await subscription.close();
    await subscription.close();
    expect(subscriber.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(['connect', 'subscribe'] as const)(
    'closes the subscriber when %s fails',
    async setup => {
      let subscriber = createSubscriber();
      let error = new Error('Redis setup failed');
      subscriber[setup].mockImplementationOnce(async () => {
        subscriber.isOpen = true;
        throw error;
      });
      duplicate.mockReturnValueOnce(subscriber);
      let { subscribeToWebhookEvent } = await import('./webhookEventBus');

      await expect(subscribeToWebhookEvent('event-1')).rejects.toBe(error);
      expect(subscriber.destroy).toHaveBeenCalledTimes(1);
    }
  );
});
