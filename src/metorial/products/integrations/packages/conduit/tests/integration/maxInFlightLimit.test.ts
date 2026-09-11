import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Max In-Flight Limit Integration', () => {
  test('should reject messages when max in-flight limit reached', async () => {
    const conduit = createConduit();

    // Create a receiver that takes time to respond
    const receiver = conduit.createReceiver(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { processed: true };
    });
    await receiver.start();

    // Create sender with very low max in-flight limit and short timeout
    const sender = conduit.createSender({
      defaultTimeout: 1000,
      maxInFlightMessages: 3,
      maxRetries: 0 // Don't retry
    });

    // Send 3 messages - should all be accepted (don't await)
    sender.send('test-topic', { data: 1 }).catch(() => {});
    sender.send('test-topic', { data: 2 }).catch(() => {});
    sender.send('test-topic', { data: 3 }).catch(() => {});

    // Wait a bit to ensure messages are in-flight
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify 3 messages are in-flight
    expect(sender.getInFlightCount()).toBe(3);

    // Try to send 4th message - should be rejected immediately
    await expect(sender.send('test-topic', { data: 4 })).rejects.toThrow(
      'Max in-flight messages limit reached (3)'
    );

    // Verify still 3 messages in-flight (4th was rejected before being added)
    expect(sender.getInFlightCount()).toBe(3);

    // Wait for messages to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now should be able to send again
    const response = await sender.send('test-topic', { data: 5 });
    expect(response.success).toBe(true);

    await receiver.stop();
    await sender.close();
    await conduit.close();
  }, 5000);
});
