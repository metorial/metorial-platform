import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Receiver Crash Integration', () => {
  test('should handle receiver crash and retry to new receiver', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender({
      defaultTimeout: 500,
      maxRetries: 3,
      retryBackoffMs: 100
    });

    // Create first receiver
    const receiver1 = conduit.createReceiver(async (_topic, payload) => {
      return { receiver: 1, payload };
    });
    await receiver1.start();

    // Send message to establish ownership
    const response1 = await sender.send('crash-topic', { data: 'test1' });
    expect(response1.success).toBe(true);
    expect(response1.result).toEqual({
      receiver: 1,
      payload: { data: 'test1' }
    });

    // Simulate crash by stopping receiver abruptly (no graceful shutdown)
    // In a real crash, the receiver would just disappear
    await receiver1.stop();

    // Create second receiver
    const receiver2 = conduit.createReceiver(async (_topic, payload) => {
      return { receiver: 2, payload };
    });

    // Start receiver2 slightly delayed
    setTimeout(() => {
      receiver2.start();
    }, 200);

    // Try to send - should timeout first attempt, then succeed with receiver2
    const response2 = await sender.send('crash-topic', { data: 'test2' });
    expect(response2.success).toBe(true);
    expect(response2.result).toEqual({
      receiver: 2,
      payload: { data: 'test2' }
    });

    await receiver2.stop();
    await sender.close();
    await conduit.close();
  }, 10000);

  test('should fail gracefully when no receivers available after crash', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender({
      defaultTimeout: 200,
      maxRetries: 2,
      retryBackoffMs: 50
    });

    // Create and then stop receiver
    const receiver = conduit.createReceiver(async (_topic, _payload) => {
      return { data: 'test' };
    });
    await receiver.start();

    // Establish ownership
    await sender.send('crash-topic', { data: 'test' });

    // Stop receiver (crash simulation)
    await receiver.stop();

    // Try to send with no receivers available
    try {
      await sender.send('crash-topic', { data: 'test2' });
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeDefined();
      // Should fail after retries
      expect((err as Error).message).toContain('failed after');
    }

    await sender.close();
    await conduit.close();
  }, 10000);

  test('should handle multiple receivers crashing', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender({
      defaultTimeout: 500,
      maxRetries: 5,
      retryBackoffMs: 100
    });

    // Create 3 receivers
    const receivers = await Promise.all([
      (async () => {
        const r = conduit.createReceiver(async (_topic, _payload) => ({ r: 1 }));
        await r.start();
        return r;
      })(),
      (async () => {
        const r = conduit.createReceiver(async (_topic, _payload) => ({ r: 2 }));
        await r.start();
        return r;
      })(),
      (async () => {
        const r = conduit.createReceiver(async (_topic, _payload) => ({ r: 3 }));
        await r.start();
        return r;
      })()
    ]);

    // Send messages to establish ownership
    await sender.send('topic-1', { data: 'test' });
    await sender.send('topic-2', { data: 'test' });

    // Stop first two receivers (crash)
    await receivers[0]!.stop();
    await receivers[1]!.stop();

    // The third receiver should handle subsequent messages
    const response = await sender.send('topic-3', { data: 'test' });
    expect(response.success).toBe(true);
    expect(response.result).toEqual({ r: 3 });

    await receivers[2]!.stop();
    await sender.close();
    await conduit.close();
  }, 10000);

  test('should recover when receiver comes back online', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender({
      defaultTimeout: 300,
      maxRetries: 10,
      retryBackoffMs: 100
    });

    // Start receiver
    let receiver = conduit.createReceiver(async (_topic, payload) => {
      return { version: 1, payload };
    });
    await receiver.start();

    // Send initial message
    const response1 = await sender.send('recover-topic', { data: 'test1' });
    expect(response1.success).toBe(true);

    // Crash receiver
    await receiver.stop();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 200));

    // Start new receiver
    receiver = conduit.createReceiver(async (_topic, payload) => {
      return { version: 2, payload };
    });
    await receiver.start();

    // Send message - should work with new receiver
    const response2 = await sender.send('recover-topic', { data: 'test2' });
    expect(response2.success).toBe(true);
    expect(response2.result).toEqual({
      version: 2,
      payload: { data: 'test2' }
    });

    await receiver.stop();
    await sender.close();
    await conduit.close();
  }, 15000);
});
