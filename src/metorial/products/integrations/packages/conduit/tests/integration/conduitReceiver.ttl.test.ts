import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TopicContext } from '../../src/core/conduitReceiver';
import { createConduit, createMemoryConduit } from '../../src/index';

describe('ConduitReceiver TTL Tests', () => {
  let conduit: ReturnType<typeof createConduit>;

  beforeEach(() => {
    conduit = createConduit(createMemoryConduit('test-conduit'));
  });

  afterEach(async () => {
    await conduit.close();
  });

  it('should voluntarily close topic when TTL expires', async () => {
    const closeCalls: string[] = [];
    const messageCount: Record<string, number> = {};

    const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
      messageCount[ctx.topic] = 0;

      // Set a very short TTL (200ms)
      ctx.extendTtl(200);

      ctx.onMessage(async (_data: any) => {
        messageCount[ctx.topic]!++;
        return { processed: true };
      });

      ctx.onClose(async () => {
        console.log(`[Test] onClose called for ${ctx.topic}`);
        closeCalls.push(ctx.topic);
        console.log(`[Test] closeCalls now:`, closeCalls);
      });
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Send first message
    await sender.send('test-topic', { value: 1 });
    expect(messageCount['test-topic']).toBe(1);
    expect(receiver.getOwnedTopicCount()).toBe(1);

    // Wait for TTL to expire (200ms + 1000ms check interval + async close buffer)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Topic should be closed
    expect(closeCalls).toContain('test-topic');
    expect(receiver.getOwnedTopicCount()).toBe(0);

    // New message should create new topic instance
    await sender.send('test-topic', { value: 2 });
    expect(messageCount['test-topic']).toBe(1); // Reset to 1 (new instance)

    await receiver.stop();
    await sender.close();
  });

  it('should extend TTL on each message', async () => {
    const closeCalls: string[] = [];
    const messageCount: Record<string, number> = {};

    const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
      messageCount[ctx.topic] = 0;

      // Initial TTL: 200ms
      ctx.extendTtl(200);

      ctx.onMessage(async (_data: any) => {
        messageCount[ctx.topic]!++;
        // Extend TTL by another 200ms on each message
        ctx.extendTtl(200);
        return { processed: true };
      });

      ctx.onClose(async () => {
        console.log(`[Test] onClose called for ${ctx.topic}`);
        closeCalls.push(ctx.topic);
        console.log(`[Test] closeCalls now:`, closeCalls);
      });
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Send messages every 150ms (before TTL expires)
    await sender.send('test-topic', { value: 1 });
    await new Promise(resolve => setTimeout(resolve, 150));

    await sender.send('test-topic', { value: 2 });
    await new Promise(resolve => setTimeout(resolve, 150));

    await sender.send('test-topic', { value: 3 });

    // Should have processed all 3 messages without closing
    expect(messageCount['test-topic']).toBe(3);
    expect(closeCalls).toHaveLength(0);
    expect(receiver.getOwnedTopicCount()).toBe(1);

    // Wait for TTL to expire (200ms + 1000ms check interval + async close buffer)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Now it should be closed
    expect(closeCalls).toContain('test-topic');
    expect(receiver.getOwnedTopicCount()).toBe(0);

    await receiver.stop();
    await sender.close();
  });

  it('should handle multiple topics with different TTLs', async () => {
    const closeCalls: string[] = [];

    const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
      if (ctx.topic === 'short-ttl') {
        ctx.extendTtl(200); // 200ms
      } else if (ctx.topic === 'long-ttl') {
        ctx.extendTtl(2000); // 2 seconds
      }

      ctx.onMessage(async (_data: any) => {
        return { processed: true };
      });

      ctx.onClose(async () => {
        console.log(`[Test] onClose called for ${ctx.topic}`);
        closeCalls.push(ctx.topic);
        console.log(`[Test] closeCalls now:`, closeCalls);
      });
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Send to both topics
    await sender.send('short-ttl', { value: 1 });
    await sender.send('long-ttl', { value: 1 });

    expect(receiver.getOwnedTopicCount()).toBe(2);

    // Wait for short TTL to expire (200ms + 1000ms check interval + async close buffer)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Short TTL should be closed, long TTL should still be open
    expect(closeCalls).toContain('short-ttl');
    expect(closeCalls).not.toContain('long-ttl');
    expect(receiver.getOwnedTopicCount()).toBe(1);

    // Wait for long TTL to expire (2000ms - 1500ms already waited + 1000ms check interval)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Both should be closed now
    expect(closeCalls).toContain('long-ttl');
    expect(receiver.getOwnedTopicCount()).toBe(0);

    await receiver.stop();
    await sender.close();
  });

  it('should not interfere with Redis ownership TTL', async () => {
    // This test verifies that the logical TTL doesn't affect Redis ownership
    const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
      // Set a very long logical TTL (10 seconds)
      ctx.extendTtl(10000);

      ctx.onMessage(async (_data: any) => {
        return { processed: true };
      });
    });

    await receiver.start();

    const sender = conduit.createSender();

    // Send a message
    await sender.send('test-topic', { value: 1 });

    // The ownership manager should still be renewing at its configured interval
    // (not affected by the 10 second logical TTL)
    // We can't directly test this without mocking, but we can verify the topic stays alive

    expect(receiver.getOwnedTopicCount()).toBe(1);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should still be owned (logical TTL hasn't expired)
    expect(receiver.getOwnedTopicCount()).toBe(1);

    await receiver.stop();
    await sender.close();
  });
});
