import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Receiver, Sender, TopicResponseBroadcast } from '../../src/index';
import { createConduit } from '../../src/index';

describe('Topic Listener Integration', () => {
  let sender: Sender;
  let receiver: Receiver;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const conduit = createConduit();

    sender = conduit.createSender();
    receiver = conduit.createReceiver(async (topic, payload) => {
      return { processed: true, topic, payload };
    });

    cleanup = conduit.close;
    await receiver.start();
  });

  afterEach(async () => {
    await receiver?.stop();
    await sender?.close();
    await cleanup?.();
  });

  test('should receive broadcasts for subscribed topic', async () => {
    const broadcasts: TopicResponseBroadcast[] = [];

    // Subscribe to topic
    const subscription = await sender.subscribeTopic('test-topic', broadcast => {
      broadcasts.push(broadcast);
    });

    expect(subscription.topic).toBe('test-topic');

    // Send a message
    const response = await sender.send('test-topic', { data: 'hello' });

    // Wait a bit for broadcast to arrive
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have received broadcast
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.topic).toBe('test-topic');
    expect(broadcasts[0]?.response.success).toBe(true);
    expect(broadcasts[0]?.response.messageId).toBe(response.messageId);
    expect(broadcasts[0]?.receiverId).toBeDefined();
    expect(broadcasts[0]?.broadcastAt).toBeGreaterThan(0);

    await subscription.unsubscribe();
  });

  test('should receive broadcasts from multiple messages', async () => {
    const broadcasts: TopicResponseBroadcast[] = [];

    await sender.subscribeTopic('multi-topic', broadcast => {
      broadcasts.push(broadcast);
    });

    // Send multiple messages
    await sender.send('multi-topic', { count: 1 });
    await sender.send('multi-topic', { count: 2 });
    await sender.send('multi-topic', { count: 3 });

    // Wait for broadcasts
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should have received all 3 broadcasts
    expect(broadcasts).toHaveLength(3);
    expect(broadcasts[0]?.topic).toBe('multi-topic');
    expect(broadcasts[1]?.topic).toBe('multi-topic');
    expect(broadcasts[2]?.topic).toBe('multi-topic');
  });

  test('should not receive broadcasts after unsubscribe', async () => {
    const broadcasts: TopicResponseBroadcast[] = [];

    const subscription = await sender.subscribeTopic('unsub-topic', broadcast => {
      broadcasts.push(broadcast);
    });

    // Send first message
    await sender.send('unsub-topic', { data: 'first' });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(broadcasts).toHaveLength(1);

    // Unsubscribe
    await subscription.unsubscribe();

    // Send second message
    await sender.send('unsub-topic', { data: 'second' });
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should still only have 1 broadcast
    expect(broadcasts).toHaveLength(1);
  });

  test('should receive all broadcasts when subscribed', async () => {
    const broadcasts: TopicResponseBroadcast[] = [];

    // Subscribe to topic
    await sender.subscribeTopic('multi-sender-topic', broadcast => {
      broadcasts.push(broadcast);
    });

    // Send multiple messages (simulates different senders)
    await sender.send('multi-sender-topic', { sender: 1 });
    await sender.send('multi-sender-topic', { sender: 2 });
    await sender.send('multi-sender-topic', { sender: 3 });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should receive all broadcasts
    expect(broadcasts).toHaveLength(3);
    expect(broadcasts[0]?.topic).toBe('multi-sender-topic');
    expect(broadcasts[1]?.topic).toBe('multi-sender-topic');
    expect(broadcasts[2]?.topic).toBe('multi-sender-topic');
  });

  test('should handle errors in topic listener gracefully', async () => {
    const broadcasts: TopicResponseBroadcast[] = [];

    await sender.subscribeTopic('error-topic', broadcast => {
      broadcasts.push(broadcast);
      // Throw error in listener
      throw new Error('Listener error');
    });

    // Send message - should not fail even though listener throws
    const response = await sender.send('error-topic', { data: 'test' });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Message should have been processed successfully
    expect(response.success).toBe(true);
    expect(broadcasts).toHaveLength(1);
  });

  test('should not allow duplicate subscriptions', async () => {
    await sender.subscribeTopic('dup-topic', () => {});

    // Try to subscribe again
    await expect(sender.subscribeTopic('dup-topic', () => {})).rejects.toThrow(
      'Already subscribed to topic: dup-topic'
    );
  });

  test('should list subscribed topics', async () => {
    expect(sender.getSubscribedTopics()).toEqual([]);

    await sender.subscribeTopic('topic-a', () => {});
    await sender.subscribeTopic('topic-b', () => {});

    const topics = sender.getSubscribedTopics();
    expect(topics).toHaveLength(2);
    expect(topics).toContain('topic-a');
    expect(topics).toContain('topic-b');
  });

  test('should only receive broadcasts for subscribed topic', async () => {
    const topicABroadcasts: TopicResponseBroadcast[] = [];
    const topicBBroadcasts: TopicResponseBroadcast[] = [];

    await sender.subscribeTopic('topic-a', broadcast => {
      topicABroadcasts.push(broadcast);
    });

    await sender.subscribeTopic('topic-b', broadcast => {
      topicBBroadcasts.push(broadcast);
    });

    // Send to topic-a
    await sender.send('topic-a', { data: 'a' });

    // Send to topic-b
    await sender.send('topic-b', { data: 'b' });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Each subscription should only receive its own topic
    expect(topicABroadcasts).toHaveLength(1);
    expect(topicABroadcasts[0]?.topic).toBe('topic-a');

    expect(topicBBroadcasts).toHaveLength(1);
    expect(topicBBroadcasts[0]?.topic).toBe('topic-b');
  });

  test('should include receiver error in broadcast', async () => {
    // Stop original receiver
    await receiver.stop();

    // Create receiver that throws errors
    const conduit2 = createConduit();
    const errorReceiver = conduit2.createReceiver(async () => {
      throw new Error('Processing failed');
    });
    const errorSender = conduit2.createSender();

    await errorReceiver.start();

    const broadcasts: TopicResponseBroadcast[] = [];
    await errorSender.subscribeTopic('error-topic', broadcast => {
      broadcasts.push(broadcast);
    });

    // Send message
    await errorSender.send('error-topic', { data: 'test' });
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have received broadcast with error
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.response.success).toBe(false);
    expect(broadcasts[0]?.response.error).toBe('Processing failed');

    await errorReceiver.stop();
    await errorSender.close();
    await conduit2.close();

    // Restart original receiver
    await receiver.start();
  });

  test('should cleanup subscriptions on sender close', async () => {
    await sender.subscribeTopic('cleanup-topic', () => {});
    expect(sender.getSubscribedTopics()).toHaveLength(1);

    await sender.close();

    // Create new sender
    const conduit2 = createConduit();
    sender = conduit2.createSender();

    expect(sender.getSubscribedTopics()).toHaveLength(0);

    await sender.close();
    await conduit2.close();
  });
});
