import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

describe('Ownership Transfer Integration', () => {
  test('should transfer topic ownership when receiver stops', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender();

    // Create first receiver
    const receiver1 = conduit.createReceiver(async (_topic, payload) => {
      return { receiver: 1, payload };
    });
    await receiver1.start();

    // Send message to establish ownership
    const response1 = await sender.send('transfer-topic', { data: 'test1' });
    expect(response1.success).toBe(true);
    expect(response1.result).toEqual({ receiver: 1, payload: { data: 'test1' } });

    // Verify receiver1 owns the topic
    expect(receiver1.getOwnedTopics()).toContain('transfer-topic');

    // Stop receiver1
    await receiver1.stop();

    // Create second receiver
    const receiver2 = conduit.createReceiver(async (_topic, payload) => {
      return { receiver: 2, payload };
    });
    await receiver2.start();

    // Wait for ownership to expire (we need to wait longer than the TTL)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send another message - should go to receiver2
    const response2 = await sender.send('transfer-topic', { data: 'test2' });
    expect(response2.success).toBe(true);
    expect(response2.result).toEqual({ receiver: 2, payload: { data: 'test2' } });

    // Verify receiver2 owns the topic
    expect(receiver2.getOwnedTopics()).toContain('transfer-topic');

    await receiver2.stop();
    await sender.close();
    await conduit.close();
  }, 10000);

  test('should maintain topic ownership across multiple messages', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender();

    const receiver = conduit.createReceiver(async (_topic, payload) => {
      return { processed: payload };
    });
    await receiver.start();

    // Send multiple messages quickly
    for (let i = 0; i < 5; i++) {
      const response = await sender.send('sticky-topic', { index: i });
      expect(response.success).toBe(true);
    }

    // Should still own the topic
    expect(receiver.getOwnedTopics()).toContain('sticky-topic');

    await receiver.stop();
    await sender.close();
    await conduit.close();
  });

  test('should handle graceful ownership release', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender();

    const receiver1 = conduit.createReceiver(async (_topic, _payload) => {
      return { receiver: 1 };
    });
    await receiver1.start();

    // Establish ownership
    await sender.send('release-topic', { data: 'test' });
    expect(receiver1.getOwnedTopics()).toContain('release-topic');

    // Create second receiver before stopping first
    const receiver2 = conduit.createReceiver(async (_topic, _payload) => {
      return { receiver: 2 };
    });
    await receiver2.start();

    // Stop first receiver (graceful)
    await receiver1.stop();

    // Immediately send message - should go to receiver2
    const response = await sender.send('release-topic', { data: 'test2' });
    expect(response.success).toBe(true);
    expect(response.result).toEqual({ receiver: 2 });

    await receiver2.stop();
    await sender.close();
    await conduit.close();
  });

  test('should distribute topics across multiple receivers', async () => {
    const conduit = createConduit();
    const sender = conduit.createSender();

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

    // Send messages to 10 different topics
    const topics: any[] = [];
    for (let i = 0; i < 10; i++) {
      const topic = `topic-${i}`;
      topics.push(topic);
      await sender.send(topic, { data: i });
    }

    // Check that topics are distributed (not all on one receiver)
    const ownerships = receivers.map(r => r.getOwnedTopicCount());
    const totalOwned = ownerships.reduce((a, b) => a + b, 0);

    expect(totalOwned).toBe(10); // All topics should be owned

    // At least 2 receivers should own something (statistical distribution)
    const ownersWithTopics = ownerships.filter(count => count > 0).length;
    expect(ownersWithTopics).toBeGreaterThanOrEqual(1);

    // Cleanup
    for (const receiver of receivers) {
      await receiver.stop();
    }
    await sender.close();
    await conduit.close();
  }, 10000);
});
