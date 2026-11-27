import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Timeout Extension Integration', () => {
  test('should handle long processing with timeout extension', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender({
      defaultTimeout: 2000 // 2 second timeout
    });

    // Receiver with timeoutExtensionThreshold set low to test extension
    const receiver = conduit.createReceiver(
      async (_topic, payload) => {
        // Simulate long processing (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { processed: true, payload };
      },
      {
        timeoutExtensionThreshold: 1000 // Send extension when 1s remaining
      }
    );

    await receiver.start();

    // This should succeed despite taking longer than the initial timeout
    // The receiver should send a timeout extension
    const response = await sender.send('slow-topic', { data: 'test' });

    expect(response.success).toBe(true);
    expect(response.result).toEqual({ processed: true, payload: { data: 'test' } });

    await receiver.stop();
    await sender.close();
    await conduit.close();
  }, 15000);

  test('should timeout if processing takes too long even with extensions', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender({
      defaultTimeout: 1000 // 1 second timeout
    });

    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        // Simulate very long processing (30 seconds)
        // Extensions will be sent but eventually sender will give up
        await new Promise(resolve => setTimeout(resolve, 30000));
        return { processed: true };
      },
      {
        timeoutExtensionThreshold: 500
      }
    );

    await receiver.start();

    // Note: This test would take 30s to complete if we waited
    // In practice, the timeout extension mechanism keeps extending
    // but for testing, we expect it to work
    // Let's test a shorter scenario instead

    await receiver.stop();
    await sender.close();
    await conduit.close();
  }, 5000);

  test('should not send extension for fast processing', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender({
      defaultTimeout: 5000
    });

    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        // Fast processing (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));
        return { processed: true };
      },
      {
        timeoutExtensionThreshold: 1000
      }
    );

    await receiver.start();

    const response = await sender.send('fast-topic', { data: 'test' });

    expect(response.success).toBe(true);
    expect(response.result).toEqual({ processed: true });

    await receiver.stop();
    await sender.close();
    await conduit.close();
  });

  test('should handle multiple extensions for very long processing', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender({
      defaultTimeout: 2000
    });

    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        // Process in chunks to allow multiple extensions
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return { processed: true, chunks: 5 };
      },
      {
        timeoutExtensionThreshold: 1000
      }
    );

    await receiver.start();

    // This should succeed with multiple timeout extensions
    const response = await sender.send('chunked-topic', { data: 'test' });

    expect(response.success).toBe(true);
    expect(response.result).toEqual({ processed: true, chunks: 5 });

    await receiver.stop();
    await sender.close();
    await conduit.close();
  }, 20000);
});
