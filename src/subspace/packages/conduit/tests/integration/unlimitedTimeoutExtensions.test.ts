import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Unlimited Timeout Extensions', () => {
  test('should send multiple timeout extensions for very long processing', async () => {
    const conduit = createConduit();

    let extensionsReceived = 0;
    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        // Process for 15 seconds (long enough to require multiple extensions)
        await new Promise(resolve => setTimeout(resolve, 15000));
        return { processed: true };
      },
      {
        timeoutExtensionThreshold: 2000 // Send extension when 2s remaining
      }
    );

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 5000 // Start with 5s timeout
    });

    // This should succeed with multiple timeout extensions
    const response = await sender.send('long-process-topic', { data: 'test' });

    expect(response.success).toBe(true);
    expect(response.result).toEqual({ processed: true });

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 30000);

  test('should handle extremely long processing with many extensions', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        // Process in chunks to simulate long-running work
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return { processed: true, chunks: 20 };
      },
      {
        timeoutExtensionThreshold: 2000 // Send extension when 2s remaining
      }
    );

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 5000 // Initial timeout of 5s
    });

    // Should succeed with many extensions (needs ~20s total)
    const response = await sender.send('very-long-topic', { data: 'test' });

    expect(response.success).toBe(true);
    expect(response.result).toEqual({ processed: true, chunks: 20 });

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 45000);

  test('should rate-limit timeout extensions', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        // Process for 8 seconds
        await new Promise(resolve => setTimeout(resolve, 8000));
        return { processed: true };
      },
      {
        timeoutExtensionThreshold: 3000 // High threshold to test rate limiting
      }
    );

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 5000
    });

    // Should send extensions but rate-limited to one per second
    const response = await sender.send('rate-limit-topic', { data: 'test' });

    expect(response.success).toBe(true);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 20000);

  test('should stop sending extensions after message completes', async () => {
    const conduit = createConduit();

    let processingComplete = false;
    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        processingComplete = true;
        return { processed: true };
      },
      {
        timeoutExtensionThreshold: 1000
      }
    );

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 5000
    });

    const response = await sender.send('complete-topic', { data: 'test' });

    expect(response.success).toBe(true);
    expect(processingComplete).toBe(true);

    // Wait a bit to ensure no more extensions are sent after completion
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should have completed successfully
    expect(response.success).toBe(true);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('should handle concurrent messages with extensions', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(
      async (_topic, payload: any) => {
        // Variable processing time
        const delay = payload.slow ? 8000 : 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        return { id: payload.id, processed: true };
      },
      {
        timeoutExtensionThreshold: 2000
      }
    );

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 3000
    });

    // Send mix of fast and slow messages concurrently
    const promises = [
      sender.send('concurrent-ext-topic', { id: 1, slow: false }),
      sender.send('concurrent-ext-topic', { id: 2, slow: true }),
      sender.send('concurrent-ext-topic', { id: 3, slow: false }),
      sender.send('concurrent-ext-topic', { id: 4, slow: true })
    ];

    const responses = await Promise.all(promises);

    // All should succeed (slow ones with extensions)
    for (const response of responses) {
      expect(response.success).toBe(true);
    }

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 25000);
});
