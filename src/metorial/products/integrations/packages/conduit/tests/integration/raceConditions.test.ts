import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Race Conditions Integration', () => {
  test('should handle concurrent ownership claims on same topic', async () => {
    const conduit = createConduit();

    // Create multiple senders that will race to claim the same topic
    const senders = Array.from({ length: 5 }, () => conduit.createSender());

    // Create a receiver that tracks which messages it processes
    const processedMessages: string[] = [];
    const receiver = conduit.createReceiver(async (_topic, payload: any) => {
      processedMessages.push(payload.senderId);
      return { received: payload.senderId };
    });

    await receiver.start();

    // All senders try to send to the same topic concurrently
    const promises = senders.map((sender, i) =>
      sender.send('race-topic', { senderId: `sender-${i}` })
    );

    const responses = await Promise.all(promises);

    // All should succeed
    expect(responses).toHaveLength(5);
    for (const response of responses) {
      expect(response.success).toBe(true);
    }

    // Receiver should own the topic (only one owner)
    expect(receiver.getOwnedTopicCount()).toBe(1);
    expect(receiver.getOwnedTopics()).toContain('race-topic');

    // All messages should have been processed
    expect(processedMessages).toHaveLength(5);

    // Cleanup
    for (const sender of senders) {
      await sender.close();
    }
    await receiver.stop();
    await conduit.close();
  }, 10000);

  test('should handle concurrent claims from multiple senders to unowned topic', async () => {
    const conduit = createConduit();

    // Create two receivers
    const receiver1 = conduit.createReceiver(async (_topic, payload) => {
      return { receiver: 1, payload };
    });
    const receiver2 = conduit.createReceiver(async (_topic, payload) => {
      return { receiver: 2, payload };
    });

    await receiver1.start();
    await receiver2.start();

    // Create multiple senders
    const senders = Array.from({ length: 10 }, () => conduit.createSender());

    // All senders send to new topics at the same time
    const promises = senders.map((sender, i) => sender.send('new-topic', { index: i }));

    const responses = await Promise.all(promises);

    // All should succeed
    for (const response of responses) {
      expect(response.success).toBe(true);
    }

    // Topic should be owned by exactly one receiver
    const r1Owns = receiver1.getOwnedTopics().includes('new-topic');
    const r2Owns = receiver2.getOwnedTopics().includes('new-topic');

    // Exactly one should own it (XOR)
    expect(r1Owns !== r2Owns).toBe(true);

    // Cleanup
    for (const sender of senders) {
      await sender.close();
    }
    await receiver1.stop();
    await receiver2.stop();
    await conduit.close();
  }, 10000);

  test('should handle ownership claim race during expiry', async () => {
    const conduit = createConduit();

    // Create first receiver with very short TTL
    const receiver1 = conduit.createReceiver(
      async (_topic, _payload) => {
        return { receiver: 1 };
      },
      {
        topicOwnershipTtl: 100, // Very short TTL
        ownershipRenewalInterval: 1000 // Don't renew
      }
    );

    await receiver1.start();

    const sender1 = conduit.createSender();

    // Establish ownership
    await sender1.send('expiry-topic', { data: 'test1' });

    // Stop renewal to let ownership expire
    await receiver1.stop();

    // Create two new receivers
    const receiver2 = conduit.createReceiver(async (_topic, _payload) => {
      return { receiver: 2 };
    });
    const receiver3 = conduit.createReceiver(async (_topic, _payload) => {
      return { receiver: 3 };
    });

    await receiver2.start();
    await receiver3.start();

    // Wait for ownership to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Create multiple senders that race to send after expiry
    const senders = Array.from({ length: 5 }, () => conduit.createSender());
    const promises = senders.map(sender => sender.send('expiry-topic', { data: 'test2' }));

    const responses = await Promise.all(promises);

    // All should succeed
    for (const response of responses) {
      expect(response.success).toBe(true);
    }

    // Topic should be owned by exactly one of the new receivers
    const r2Owns = receiver2.getOwnedTopics().includes('expiry-topic');
    const r3Owns = receiver3.getOwnedTopics().includes('expiry-topic');

    // Exactly one should own it
    expect(r2Owns !== r3Owns).toBe(true);

    // Cleanup
    await sender1.close();
    for (const sender of senders) {
      await sender.close();
    }
    await receiver2.stop();
    await receiver3.stop();
    await conduit.close();
  }, 10000);

  test('should handle concurrent sends to multiple topics', async () => {
    const conduit = createConduit();

    // Create multiple receivers
    const receivers = await Promise.all(
      Array.from({ length: 3 }, async (_, i) => {
        const r = conduit.createReceiver(async (_topic, _payload) => ({
          receiver: i
        }));
        await r.start();
        return r;
      })
    );

    // Create multiple senders
    const senders = Array.from({ length: 10 }, () => conduit.createSender());

    // Each sender sends to multiple topics concurrently
    const allPromises = senders.flatMap((sender, i) =>
      Array.from({ length: 5 }, (_, j) => sender.send(`topic-${j}`, { sender: i, topic: j }))
    );

    const responses = await Promise.all(allPromises);

    // All 50 messages should succeed
    expect(responses).toHaveLength(50);
    for (const response of responses) {
      expect(response.success).toBe(true);
    }

    // Each of the 5 topics should be owned by exactly one receiver
    const topicOwnership = new Map<string, number>();
    for (let i = 0; i < 5; i++) {
      const topic = `topic-${i}`;
      let ownerCount = 0;
      for (const receiver of receivers) {
        if (receiver.getOwnedTopics().includes(topic)) {
          ownerCount++;
        }
      }
      expect(ownerCount).toBe(1);
      topicOwnership.set(topic, ownerCount);
    }

    // Cleanup
    for (const sender of senders) {
      await sender.close();
    }
    for (const receiver of receivers) {
      await receiver.stop();
    }
    await conduit.close();
  }, 15000);

  test('should handle receiver starting during active claims', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender();

    // Create first receiver
    const receiver1 = conduit.createReceiver(async () => ({ r: 1 }));
    await receiver1.start();

    // Start sending messages
    const sendPromises = Array.from({ length: 20 }, (_, i) =>
      sender.send(`dynamic-topic-${i % 5}`, { index: i })
    );

    // Start second receiver mid-flight
    setTimeout(async () => {
      const receiver2 = conduit.createReceiver(async () => ({ r: 2 }));
      await receiver2.start();
    }, 50);

    const responses = await Promise.all(sendPromises);

    // All should succeed
    for (const response of responses) {
      expect(response.success).toBe(true);
    }

    // Cleanup
    await sender.close();
    await receiver1.stop();
    await conduit.close();
  }, 10000);

  test('should maintain ownership under high concurrent load', async () => {
    const conduit = createConduit();

    const receiver = conduit.createReceiver(async (_topic, _payload) => {
      // Small delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 5));
      return { processed: true };
    });

    await receiver.start();

    // Create many senders sending many messages to same topic
    const senders = Array.from({ length: 10 }, () => conduit.createSender());

    const allPromises = senders.flatMap(sender =>
      Array.from({ length: 10 }, (_, i) => sender.send('high-load-topic', { index: i }))
    );

    const responses = await Promise.all(allPromises);

    // All 100 messages should succeed
    expect(responses).toHaveLength(100);
    for (const response of responses) {
      expect(response.success).toBe(true);
    }

    // Topic should be owned consistently
    expect(receiver.getOwnedTopicCount()).toBe(1);

    // Cleanup
    for (const sender of senders) {
      await sender.close();
    }
    await receiver.stop();
    await conduit.close();
  }, 30000);
});
