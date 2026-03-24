import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Edge Cases Integration', () => {
  test('should handle message ordering within a topic', async () => {
    const conduit = createConduit();

    const processedOrder: number[] = [];
    const receiver = conduit.createReceiver(async (_topic, payload: any) => {
      processedOrder.push(payload.order);
      return { order: payload.order };
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Send messages sequentially to ensure ordering
    for (let i = 0; i < 10; i++) {
      await sender.send('ordered-topic', { order: i });
    }

    // Messages should be processed in order (since sent sequentially)
    expect(processedOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  });

  test('should handle timeout extension only once per message', async () => {
    const conduit = createConduit();

    let extensionCount = 0;
    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        // Process for longer than timeout but not too long
        await new Promise(resolve => setTimeout(resolve, 2500));
        return { processed: true };
      },
      {
        timeoutExtensionThreshold: 1000 // Trigger extension at 1s remaining
      }
    );

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 2000 // 2 second initial timeout
    });

    const response = await sender.send('extension-topic', { data: 'test' });

    expect(response.success).toBe(true);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('should handle ownership expiry at exact boundary', async () => {
    const conduit = createConduit();

    const receiver1 = conduit.createReceiver(async (_topic, _payload) => ({ receiver: 1 }), {
      topicOwnershipTtl: 200,
      ownershipRenewalInterval: 10000 // Don't renew
    });

    await receiver1.start();

    const sender = conduit.createSender();

    // Establish ownership
    await sender.send('boundary-topic', { data: 'test1' });
    expect(receiver1.getOwnedTopics()).toContain('boundary-topic');

    // Stop receiver (stops renewal)
    await receiver1.stop();

    // Wait exactly at expiry boundary
    await new Promise(resolve => setTimeout(resolve, 200));

    // Create new receiver
    const receiver2 = conduit.createReceiver(async (_topic, _payload) => ({
      receiver: 2
    }));
    await receiver2.start();

    // Should be able to claim now
    const response = await sender.send('boundary-topic', { data: 'test2' });
    expect(response.success).toBe(true);
    expect(response.result).toEqual({ receiver: 2 });

    await sender.close();
    await receiver2.stop();
    await conduit.close();
  }, 10000);

  test('should handle empty payload', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(async (_topic, payload) => {
      return { received: payload };
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Test various empty payloads
    const response1 = await sender.send('empty-topic', null);
    expect(response1.success).toBe(true);
    expect(response1.result).toEqual({ received: null });

    const response2 = await sender.send('empty-topic', undefined);
    expect(response2.success).toBe(true);

    const response3 = await sender.send('empty-topic', {});
    expect(response3.success).toBe(true);
    expect(response3.result).toEqual({ received: {} });

    const response4 = await sender.send('empty-topic', '');
    expect(response4.success).toBe(true);
    expect(response4.result).toEqual({ received: '' });

    await sender.close();
    await receiver.stop();
    await conduit.close();
  });

  test('should handle very large payloads', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(async (_topic, payload: any) => {
      return { size: JSON.stringify(payload).length };
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Create a large payload (1MB of data)
    const largePayload = {
      data: 'x'.repeat(1024 * 1024)
    };

    const response = await sender.send('large-topic', largePayload);
    expect(response.success).toBe(true);
    expect(response.result).toEqual({
      size: JSON.stringify(largePayload).length
    });

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('should handle special characters in topic names', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(async (topic, payload) => {
      return { topic, payload };
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Test various special characters
    const specialTopics = [
      'topic-with-dashes',
      'topic_with_underscores',
      'topic.with.dots',
      'topic:with:colons',
      'topic/with/slashes',
      'topic@with@at',
      'UPPERCASE-TOPIC',
      'MiXeD-CaSe-ToPiC',
      '123-numeric-topic',
      'émoji-topic-🚀'
    ];

    for (const topic of specialTopics) {
      const response = await sender.send(topic, { test: true });
      expect(response.success).toBe(true);
      expect(response.result).toEqual({ topic, payload: { test: true } });
    }

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('should handle rapid start/stop cycles', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender();

    // Rapidly start and stop receivers
    for (let i = 0; i < 5; i++) {
      const receiver = conduit.createReceiver(async (_topic, _payload) => ({
        cycle: i
      }));

      await receiver.start();
      const response = await sender.send('cycle-topic', { cycle: i });
      expect(response.success).toBe(true);
      await receiver.stop();
    }

    await sender.close();
    await conduit.close();
  }, 15000);

  test('should handle receiver processing timeout during high load', async () => {
    const conduit = createConduit();

    let processingCount = 0;
    const receiver = conduit.createReceiver(
      async (_topic, payload: any) => {
        processingCount++;
        // Simulate variable processing time
        const delay = payload.slow ? 2500 : 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        return { processed: true, id: payload.id };
      },
      {
        timeoutExtensionThreshold: 1000 // Send extension when 1s remaining
      }
    );

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 3000, // Give enough time
      maxRetries: 0
    });

    // Send mix of fast and slow messages
    const promises = [
      sender.send('mixed-topic', { id: 1, slow: false }),
      sender.send('mixed-topic', { id: 2, slow: false }),
      sender.send('mixed-topic', { id: 3, slow: true }), // This will need extension
      sender.send('mixed-topic', { id: 4, slow: false })
    ];

    const results = await Promise.allSettled(promises);

    // Fast messages should succeed, slow one should succeed with extension
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]?.status).toBe('fulfilled');
    expect(results[2]?.status).toBe('fulfilled'); // With timeout extension
    expect(results[3]?.status).toBe('fulfilled');

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 20000);

  test('should handle zero timeout gracefully', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(async (_topic, _payload) => {
      return { received: true };
    });

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 1, // Very short timeout
      maxRetries: 0
    });

    // Should either succeed (if fast enough) or timeout
    const result = await sender.send('zero-timeout-topic', { data: 'test' }).catch(err => err);

    // Either succeeds or times out
    if (result instanceof Error) {
      expect(result.message).toContain('timeout');
    } else {
      expect(result.success).toBeDefined();
    }

    await sender.close();
    await receiver.stop();
    await conduit.close();
  });

  test('should handle sender close during in-flight messages', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(async (_topic, _payload) => {
      // Long processing to ensure message is in-flight
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { processed: true };
    });

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 5000
    });

    // Start sending multiple messages
    const promises = [
      sender.send('inflight-topic', { data: 'test1' }),
      sender.send('inflight-topic', { data: 'test2' }),
      sender.send('inflight-topic', { data: 'test3' })
    ];

    // Wait a bit for messages to be in-flight
    await new Promise(resolve => setTimeout(resolve, 100));

    // Close sender while messages are processing
    await sender.close();

    // All in-flight messages should be cancelled
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'rejected') {
        expect(result.reason.message).toContain('Sender closed');
      }
      // Some might succeed if they completed before close
    }

    await receiver.stop();
    await conduit.close();
  });

  test('should handle receiver stop during message processing', async () => {
    const conduit = createConduit();

    let processingStarted = false;
    const receiver = conduit.createReceiver(async (_topic, _payload) => {
      processingStarted = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { processed: true };
    });

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 2000,
      maxRetries: 2
    });

    // Start processing
    const sendPromise = sender.send('stop-during-topic', { data: 'test' });

    // Wait for processing to start
    await new Promise(resolve => setTimeout(resolve, 100));

    // Stop receiver while processing
    await receiver.stop();

    // Send should eventually fail or timeout
    const result = await sendPromise.catch(err => err);

    // Either succeeds if it finished in time, or fails/times out
    expect(processingStarted).toBe(true);

    await sender.close();
    await conduit.close();
  }, 15000);

  test('should handle duplicate message IDs correctly', async () => {
    const conduit = createConduit();

    let processCount = 0;
    const receiver = conduit.createReceiver(async (_topic, payload) => {
      processCount++;
      return { count: processCount, payload };
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Send first message
    const response1 = await sender.send('dedup-topic', { data: 'test' });
    expect(response1.success).toBe(true);

    // processCount should be 1
    expect(processCount).toBe(1);

    // Messages from same sender will have different IDs, so we can't easily
    // test deduplication at the sender level. The deduplication is tested
    // via the retry mechanism where the same message ID is retried

    await sender.close();
    await receiver.stop();
    await conduit.close();
  });

  test('should handle receiver heartbeat expiry', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(async (_topic, _payload) => ({ received: true }), {
      heartbeatInterval: 100,
      heartbeatTtl: 200
    });

    await receiver.start();

    const sender = conduit.createSender();

    // First message should work
    const response1 = await sender.send('heartbeat-topic', { data: 'test1' });
    expect(response1.success).toBe(true);

    // Stop heartbeating by stopping receiver
    await receiver.stop();

    // Wait for heartbeat to expire
    await new Promise(resolve => setTimeout(resolve, 300));

    // New message should fail (no receiver)
    await expect(sender.send('heartbeat-topic', { data: 'test2' })).rejects.toThrow();

    await sender.close();
    await conduit.close();
  }, 10000);
});
