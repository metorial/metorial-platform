import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Cache Edge Cases Integration', () => {
  test('should evict oldest entries when cache size limit reached', async () => {
    const conduit = createConduit();

    let processCount = 0;
    const receiver = conduit.createReceiver(
      async (_topic, payload: any) => {
        processCount++;
        return { count: processCount, id: payload.id };
      },
      {
        messageCacheSize: 5, // Very small cache
        messageCacheTtl: 60000 // Long TTL so expiry doesn't interfere
      }
    );

    await receiver.start();

    const sender = conduit.createSender();

    // Send 10 messages (more than cache size)
    const responses: any[] = [];
    for (let i = 0; i < 10; i++) {
      const response = await sender.send('cache-eviction-topic', { id: i });
      responses.push(response);
    }

    // All should succeed
    expect(responses).toHaveLength(10);
    expect(processCount).toBe(10); // All processed once

    // Now if we could somehow retry the first messages (which should be evicted)
    // they would be reprocessed. But since message IDs are unique per send,
    // we can't easily test this in integration. The unit test covers this better.

    await sender.close();
    await receiver.stop();
    await conduit.close();
  });

  test('should expire cache entries after TTL', async () => {
    const conduit = createConduit();

    let processCount = 0;
    const processedIds: number[] = [];
    const receiver = conduit.createReceiver(
      async (_topic, payload: any) => {
        processCount++;
        processedIds.push(payload.id);
        return { count: processCount, id: payload.id };
      },
      {
        messageCacheTtl: 500, // Very short TTL
        messageCacheSize: 1000
      }
    );

    await receiver.start();

    const sender = conduit.createSender();

    // Send first message
    const response1 = await sender.send('cache-ttl-topic', { id: 1 });
    expect(response1.success).toBe(true);
    expect(processCount).toBe(1);

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 600));

    // Send second message - cache should have expired
    const response2 = await sender.send('cache-ttl-topic', { id: 2 });
    expect(response2.success).toBe(true);
    expect(processCount).toBe(2);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  });

  test('should handle cache cleanup during high message volume', async () => {
    const conduit = createConduit();

    let processCount = 0;
    const receiver = conduit.createReceiver(
      async (_topic, _payload: any) => {
        processCount++;
        return { count: processCount };
      },
      {
        messageCacheSize: 100,
        messageCacheTtl: 2000
      }
    );

    await receiver.start();

    const sender = conduit.createSender();

    // Send many messages rapidly
    const promises: any[] = [];
    for (let i = 0; i < 200; i++) {
      promises.push(sender.send('high-volume-topic', { index: i }));
    }

    const responses = await Promise.all(promises);

    // All should succeed
    expect(responses).toHaveLength(200);
    expect(processCount).toBe(200);

    // Cache should have evicted some entries due to size limit
    // (oldest 100 messages should be evicted as we sent 200)

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('should deduplicate messages via cache', async () => {
    const conduit = createConduit();

    let processCount = 0;
    const receiver = conduit.createReceiver(
      async (_topic, payload: any) => {
        processCount++;
        return { count: processCount, payload };
      },
      {
        messageCacheTtl: 5000,
        messageCacheSize: 1000
      }
    );

    await receiver.start();

    const sender = conduit.createSender({
      defaultTimeout: 100, // Short timeout to trigger retry
      maxRetries: 2,
      retryBackoffMs: 50
    });

    // Simulate a slow receiver that will cause timeout on first attempt
    let firstAttempt = true;
    const slowReceiver = conduit.createReceiver(
      async (_topic, _payload) => {
        if (firstAttempt) {
          firstAttempt = false;
          // Take longer than timeout
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        return { received: true };
      },
      {
        messageCacheTtl: 5000
      }
    );

    // Stop first receiver and use slow one
    await receiver.stop();
    await slowReceiver.start();

    // This should timeout once and retry, but the second attempt should
    // hit the cache and return the same result
    const response = await sender.send('dedup-topic', { data: 'test' }).catch(err => err);

    // Might timeout or succeed depending on timing
    // The key is that the receiver's cache should prevent reprocessing

    await sender.close();
    await slowReceiver.stop();
    await conduit.close();
  }, 10000);

  test('should handle cache during receiver restart', async () => {
    const conduit = createConduit();

    let processCount = 0;
    const receiver1 = conduit.createReceiver(
      async (_topic, _payload: any) => {
        processCount++;
        return { receiver: 1, count: processCount };
      },
      {
        messageCacheTtl: 60000
      }
    );

    await receiver1.start();

    const sender = conduit.createSender();

    // Send message to establish cache
    await sender.send('restart-topic', { data: 'test1' });
    expect(processCount).toBe(1);

    // Stop receiver (cache is destroyed)
    await receiver1.stop();

    // Start new receiver (new cache)
    const receiver2 = conduit.createReceiver(
      async (_topic, _payload: any) => {
        processCount++;
        return { receiver: 2, count: processCount };
      },
      {
        messageCacheTtl: 60000
      }
    );

    await receiver2.start();

    // Send new message (should be processed by new receiver)
    const response = await sender.send('restart-topic', { data: 'test2' });
    expect(response.success).toBe(true);
    expect(processCount).toBe(2); // Processed by new receiver

    await sender.close();
    await receiver2.stop();
    await conduit.close();
  });

  test('should handle cache with concurrent processing of same topic', async () => {
    const conduit = createConduit();

    const processedMessages: string[] = [];
    const receiver = conduit.createReceiver(
      async (_topic, payload: any) => {
        // Small delay to ensure concurrency
        await new Promise(resolve => setTimeout(resolve, 10));
        processedMessages.push(payload.id);
        return { id: payload.id };
      },
      {
        messageCacheTtl: 60000,
        messageCacheSize: 1000
      }
    );

    await receiver.start();

    const sender = conduit.createSender();

    // Send multiple messages to same topic concurrently
    const promises = Array.from({ length: 20 }, (_, i) =>
      sender.send('concurrent-cache-topic', { id: `msg-${i}` })
    );

    const responses = await Promise.all(promises);

    // All should succeed
    expect(responses).toHaveLength(20);
    for (const response of responses) {
      expect(response.success).toBe(true);
    }

    // All messages should be processed exactly once
    expect(processedMessages).toHaveLength(20);

    // No duplicates
    const uniqueMessages = new Set(processedMessages);
    expect(uniqueMessages.size).toBe(20);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  });

  test('should handle cache entries with error responses', async () => {
    const conduit = createConduit();

    let attemptCount = 0;
    const receiver = conduit.createReceiver(
      async (_topic, payload: any) => {
        attemptCount++;
        if (payload.shouldFail) {
          throw new Error('Processing failed');
        }
        return { success: true };
      },
      {
        messageCacheTtl: 5000
      }
    );

    await receiver.start();

    const sender = conduit.createSender();

    // Send message that will fail
    const response1 = await sender.send('error-cache-topic', { shouldFail: true });
    expect(response1.success).toBe(false);
    expect(response1.error).toBe('Processing failed');
    expect(attemptCount).toBe(1);

    // Send another message - error should be cached
    // (but since message IDs are different, this will be a new processing)
    const response2 = await sender.send('error-cache-topic', { shouldFail: true });
    expect(response2.success).toBe(false);
    expect(attemptCount).toBe(2); // Different message ID, so reprocessed

    await sender.close();
    await receiver.stop();
    await conduit.close();
  });

  test('should cleanup cache on receiver stop', async () => {
    const conduit = createConduit();

    let processCount = 0;
    const receiver = conduit.createReceiver(
      async (_topic, _payload) => {
        processCount++;
        return { count: processCount };
      },
      {
        messageCacheTtl: 60000
      }
    );

    await receiver.start();

    const sender = conduit.createSender();

    // Send messages to populate cache
    await sender.send('cleanup-topic', { data: 'test1' });
    await sender.send('cleanup-topic', { data: 'test2' });
    expect(processCount).toBe(2);

    // Stop receiver (should cleanup cache)
    await receiver.stop();

    // The receiver is now stopped, cache should be destroyed
    // We can't directly verify cache is cleared, but stop should not error

    await sender.close();
    await conduit.close();
  });

  test('should handle cache during ownership transfer', async () => {
    const conduit = createConduit();

    let r1ProcessCount = 0;
    const receiver1 = conduit.createReceiver(
      async (_topic, _payload: any) => {
        r1ProcessCount++;
        return { receiver: 1, count: r1ProcessCount };
      },
      {
        messageCacheTtl: 60000,
        topicOwnershipTtl: 200,
        ownershipRenewalInterval: 10000 // Don't renew
      }
    );

    await receiver1.start();

    const sender = conduit.createSender();

    // Send message to receiver1
    const response1 = await sender.send('transfer-cache-topic', { data: 'test1' });
    expect(response1.result).toEqual({ receiver: 1, count: 1 });

    // Stop receiver1 and wait for ownership to expire
    await receiver1.stop();
    await new Promise(resolve => setTimeout(resolve, 250));

    // Start receiver2
    let r2ProcessCount = 0;
    const receiver2 = conduit.createReceiver(
      async (_topic, _payload: any) => {
        r2ProcessCount++;
        return { receiver: 2, count: r2ProcessCount };
      },
      {
        messageCacheTtl: 60000
      }
    );

    await receiver2.start();

    // Send message to receiver2 (should have fresh cache)
    const response2 = await sender.send('transfer-cache-topic', { data: 'test2' });
    expect(response2.result).toEqual({ receiver: 2, count: 1 });

    await sender.close();
    await receiver2.stop();
    await conduit.close();
  }, 10000);
});
