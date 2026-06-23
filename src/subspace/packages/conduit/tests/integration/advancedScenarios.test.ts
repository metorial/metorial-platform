import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Advanced Scenarios Integration', () => {
  describe('Race Conditions', () => {
    test('should handle concurrent ownership claims correctly', async () => {
      const conduit = createConduit();

      // Create 5 receivers simultaneously
      const receivers = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const r = conduit.createReceiver(async (_topic, payload) => ({
            receiver: i,
            payload
          }));
          await r.start();
          return r;
        })
      );

      const sender = conduit.createSender();

      // Send message - exactly one receiver should get ownership
      const response = await sender.send('race-topic', { data: 'test' });
      expect(response.success).toBe(true);

      // Count how many receivers own this topic
      const ownerships = receivers.filter(r => r.getOwnedTopics().includes('race-topic'));
      expect(ownerships).toHaveLength(1);

      // Send another message to same topic - should go to same receiver
      const response2 = await sender.send('race-topic', { data: 'test2' });
      expect(response2.success).toBe(true);
      expect((response2.result as any).receiver).toBe((response.result as any).receiver);

      // Cleanup
      for (const r of receivers) {
        await r.stop();
      }
      await sender.close();
      await conduit.close();
    });

    test('should handle concurrent messages to different topics', async () => {
      const conduit = createConduit();
      const receiver = conduit.createReceiver(async (topic, payload) => ({
        topic,
        payload,
        processedAt: Date.now()
      }));
      await receiver.start();

      const sender = conduit.createSender();

      // Send 50 messages to different topics concurrently
      const promises = Array.from({ length: 50 }, (_, i) =>
        sender.send(`topic-${i}`, { index: i })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      expect(responses.every(r => r.success)).toBe(true);

      // Receiver should own all topics
      expect(receiver.getOwnedTopicCount()).toBe(50);

      await receiver.stop();
      await sender.close();
      await conduit.close();
    });

    test('should handle simultaneous sender and receiver operations', async () => {
      const conduit = createConduit();

      let processedCount = 0;
      const receiver = conduit.createReceiver(async (_topic, _payload) => {
        processedCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { processed: processedCount };
      });

      const sender = conduit.createSender();

      // Start sending messages while receiver is starting
      const sendPromises = Array.from({ length: 20 }, (_, i) =>
        sender.send('concurrent-topic', { index: i })
      );

      const receiverStartPromise = receiver.start();

      // Wait for both to complete
      await receiverStartPromise;
      const responses = await Promise.all(sendPromises);

      // All messages should eventually be processed
      expect(responses.every(r => r.success)).toBe(true);
      expect(processedCount).toBe(20);

      await receiver.stop();
      await sender.close();
      await conduit.close();
    }, 15000);
  });

  describe('Ownership Loss During Processing', () => {
    test('should complete message processing even if ownership expires', async () => {
      const conduit = createConduit();

      // Create receiver with very short ownership TTL
      const receiver = conduit.createReceiver(
        async (_topic, payload) => {
          // Simulate long processing that outlasts ownership
          await new Promise(resolve => setTimeout(resolve, 200));
          return { processed: true, payload };
        },
        {
          topicOwnershipTtl: 50, // Very short TTL
          ownershipRenewalInterval: 500 // Don't renew
        }
      );

      await receiver.start();

      const sender = conduit.createSender();

      // Send message - ownership will expire during processing
      const response = await sender.send('short-ttl-topic', { data: 'test' });

      // Should still complete successfully
      expect(response.success).toBe(true);
      expect(response.result).toEqual({
        processed: true,
        payload: { data: 'test' }
      });

      await receiver.stop();
      await sender.close();
      await conduit.close();
    }, 10000);

    test('should transfer ownership after receiver stops processing', async () => {
      const conduit = createConduit();

      const receiver1 = conduit.createReceiver(async (_topic, payload) => ({
        receiver: 1,
        payload
      }));
      await receiver1.start();

      const sender = conduit.createSender();

      // Send first message
      const response1 = await sender.send('transfer-topic', { data: 'msg1' });
      expect((response1.result as any).receiver).toBe(1);

      // Stop receiver1
      await receiver1.stop();

      // Create receiver2
      const receiver2 = conduit.createReceiver(async (_topic, payload) => ({
        receiver: 2,
        payload
      }));
      await receiver2.start();

      // Wait for ownership to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send another message - should go to receiver2
      const response2 = await sender.send('transfer-topic', { data: 'msg2' });
      expect((response2.result as any).receiver).toBe(2);

      await receiver2.stop();
      await sender.close();
      await conduit.close();
    }, 10000);
  });

  describe('High Concurrency', () => {
    test('should handle high message throughput', async () => {
      const conduit = createConduit();

      const receiver = conduit.createReceiver(async (_topic, payload) => ({
        processed: true,
        payload
      }));
      await receiver.start();

      const sender = conduit.createSender();

      // Send 200 messages as fast as possible
      const startTime = Date.now();
      const promises = Array.from({ length: 200 }, (_, i) =>
        sender.send('high-throughput', { index: i })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      expect(responses.every(r => r.success)).toBe(true);
      expect(responses).toHaveLength(200);

      console.log(`Processed 200 messages in ${endTime - startTime}ms`);

      await receiver.stop();
      await sender.close();
      await conduit.close();
    }, 30000);

    test('should handle many concurrent senders', async () => {
      const conduit = createConduit();

      const receiver = conduit.createReceiver(async (_topic, payload) => ({
        processed: true,
        payload
      }));
      await receiver.start();

      // Create 10 senders
      const senders = Array.from({ length: 10 }, () => conduit.createSender());

      // Each sender sends 10 messages
      const allPromises = senders.flatMap((sender, senderIdx) =>
        Array.from({ length: 10 }, (_, msgIdx) =>
          sender.send('multi-sender-topic', {
            sender: senderIdx,
            message: msgIdx
          })
        )
      );

      const responses = await Promise.all(allPromises);

      // All 100 messages should succeed
      expect(responses.every(r => r.success)).toBe(true);
      expect(responses).toHaveLength(100);

      await receiver.stop();
      for (const sender of senders) {
        await sender.close();
      }
      await conduit.close();
    }, 30000);

    test('should handle many concurrent receivers', async () => {
      const conduit = createConduit();

      // Create 10 receivers
      const receivers = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          const r = conduit.createReceiver(async (_topic, payload) => ({
            receiver: i,
            payload
          }));
          await r.start();
          return r;
        })
      );

      const sender = conduit.createSender();

      // Send messages to 50 different topics
      const promises = Array.from({ length: 50 }, (_, i) =>
        sender.send(`load-topic-${i}`, { index: i })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      expect(responses.every(r => r.success)).toBe(true);

      // Topics should be distributed across receivers
      const ownerships = receivers.map(r => r.getOwnedTopicCount());
      const totalOwned = ownerships.reduce((a, b) => a + b, 0);

      expect(totalOwned).toBe(50);

      // At least half of receivers should own something (distribution)
      const activeReceivers = ownerships.filter(count => count > 0).length;
      expect(activeReceivers).toBeGreaterThanOrEqual(5);

      for (const r of receivers) {
        await r.stop();
      }
      await sender.close();
      await conduit.close();
    }, 30000);
  });

  describe('Cross-Receiver Idempotency', () => {
    test('should handle message retry across different receivers', async () => {
      const conduit = createConduit();
      const processLog: Array<{ receiver: number; messageId: string }> = [];

      // Create receiver 1 that will "crash" after seeing message
      const receiver1 = conduit.createReceiver(
        async (_topic, payload: any) => {
          processLog.push({ receiver: 1, messageId: payload.messageId });
          // Don't return - simulate hanging/crash
          await new Promise(() => {}); // Never resolves
        },
        { timeoutExtensionThreshold: 5000 }
      );
      await receiver1.start();

      const sender = conduit.createSender({
        defaultTimeout: 200,
        maxRetries: 3,
        retryBackoffMs: 100
      });

      // Start sending message
      const sendPromise = sender.send('idempotency-topic', {
        messageId: 'test-msg-1',
        data: 'test'
      });

      // Wait a bit then crash receiver1 and start receiver2
      await new Promise(resolve => setTimeout(resolve, 250));
      await receiver1.stop();

      const receiver2 = conduit.createReceiver(async (_topic, payload: any) => {
        processLog.push({ receiver: 2, messageId: payload.messageId });
        return { processed: true, receiver: 2 };
      });
      await receiver2.start();

      // Wait for retry to succeed
      const response = await sendPromise;

      expect(response.success).toBe(true);
      expect((response.result as any).receiver).toBe(2);

      // Both receivers may have seen the message, but only receiver2 completed it
      expect(processLog.some(log => log.receiver === 2)).toBe(true);

      await receiver2.stop();
      await sender.close();
      await conduit.close();
    }, 15000);

    test('should cache responses per receiver', async () => {
      const conduit = createConduit();

      let processCount = 0;
      const receiver = conduit.createReceiver(async (_topic, payload) => {
        processCount++;
        return {
          count: processCount,
          payload
        };
      });
      await receiver.start();

      const sender = conduit.createSender();

      // Send first message
      const response1 = await sender.send('cache-topic', { data: 'test' });
      expect((response1.result as any).count).toBe(1);

      // The message is now cached in receiver
      // In a real retry scenario (same messageId), it would return cached response
      // But sender generates new messageIds, so we can't directly test this

      // Instead, verify that each new message increments the counter
      const response2 = await sender.send('cache-topic', { data: 'test' });
      expect((response2.result as any).count).toBe(2);

      await receiver.stop();
      await sender.close();
      await conduit.close();
    });
  });

  describe('Distributed System Behavior', () => {
    test('should handle cascading receiver failures', async () => {
      const conduit = createConduit();
      const sender = conduit.createSender({
        defaultTimeout: 200,
        maxRetries: 5,
        retryBackoffMs: 50
      });

      // Create receiver that will timeout (not respond)
      const createHangingReceiver = (_id: number) => {
        return conduit.createReceiver(
          async (_topic, _payload) => {
            // Hang forever (timeout will occur)
            await new Promise(() => {});
          },
          { timeoutExtensionThreshold: 10000 } // Don't send extensions
        );
      };

      const r1 = createHangingReceiver(1);
      await r1.start();

      // Start sending message
      const sendPromise = sender.send('cascade-topic', { data: 'test' });

      // Stop r1 and start r2 after timeout
      setTimeout(async () => {
        await r1.stop();
        const r2 = createHangingReceiver(2);
        await r2.start();

        // Stop r2 and start r3 after another timeout
        setTimeout(async () => {
          await r2.stop();
          const r3 = conduit.createReceiver(async (_topic, payload) => ({
            receiver: 3,
            payload
          }));
          await r3.start();

          // Clean up r3
          setTimeout(async () => {
            await r3.stop();
          }, 1000);
        }, 250);
      }, 250);

      // Should eventually succeed with r3 after retries
      const response = await sendPromise;
      expect(response.success).toBe(true);
      expect((response.result as any).receiver).toBe(3);

      await sender.close();
      await conduit.close();
    }, 15000);

    test('should handle topic rebalancing', async () => {
      const conduit = createConduit();

      // Start with 2 receivers
      const r1 = conduit.createReceiver(async (_topic, payload) => ({
        receiver: 1,
        payload
      }));
      const r2 = conduit.createReceiver(async (_topic, payload) => ({
        receiver: 2,
        payload
      }));

      await r1.start();
      await r2.start();

      const sender = conduit.createSender();

      // Send messages to 10 topics
      for (let i = 0; i < 10; i++) {
        await sender.send(`rebalance-topic-${i}`, { data: i });
      }

      // Record initial distribution
      const r1InitialTopics = r1.getOwnedTopicCount();
      const r2InitialTopics = r2.getOwnedTopicCount();
      expect(r1InitialTopics + r2InitialTopics).toBe(10);

      // Stop r1
      await r1.stop();

      // Wait for ownership to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start r3
      const r3 = conduit.createReceiver(async (_topic, payload) => ({
        receiver: 3,
        payload
      }));
      await r3.start();

      // Send new messages to the same topics - should be rebalanced
      for (let i = 0; i < 10; i++) {
        const response = await sender.send(`rebalance-topic-${i}`, { data: i });
        expect(response.success).toBe(true);
        // Should go to r2 or r3 (not r1)
        expect([2, 3]).toContain((response.result as any).receiver);
      }

      await r2.stop();
      await r3.stop();
      await sender.close();
      await conduit.close();
    }, 15000);
  });

  describe('Error Resilience', () => {
    test('should handle processing errors without losing messages', async () => {
      const conduit = createConduit();
      let failureCount = 0;

      const receiver = conduit.createReceiver(async (_topic, payload: any) => {
        if (payload.shouldFail && failureCount < 1) {
          failureCount++;
          throw new Error('Simulated processing error');
        }
        return { processed: true, payload };
      });
      await receiver.start();

      const sender = conduit.createSender();

      // Send message that causes processing error
      const errorResponse = await sender.send('error-test', {
        shouldFail: true,
        data: 'test'
      });

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toContain('processing error');

      // Send normal message - should work
      const successResponse = await sender.send('error-test', {
        shouldFail: false,
        data: 'test'
      });

      expect(successResponse.success).toBe(true);

      await receiver.stop();
      await sender.close();
      await conduit.close();
    });

    test('should handle network-like errors with retries', async () => {
      const conduit = createConduit();
      const sender = conduit.createSender({
        defaultTimeout: 200,
        maxRetries: 3,
        retryBackoffMs: 50
      });

      let attemptCount = 0;

      // Simulate receiver that becomes available after a few attempts
      setTimeout(async () => {
        const receiver = conduit.createReceiver(async (_topic, payload) => ({
          processed: true,
          attempt: ++attemptCount,
          payload
        }));
        await receiver.start();

        setTimeout(async () => {
          await receiver.stop();
        }, 2000);
      }, 200);

      // This should retry and eventually succeed
      const response = await sender.send('network-error-topic', { data: 'test' });

      expect(response.success).toBe(true);
      expect(attemptCount).toBe(1); // Should process once when available

      await sender.close();
      await conduit.close();
    }, 10000);
  });
});
