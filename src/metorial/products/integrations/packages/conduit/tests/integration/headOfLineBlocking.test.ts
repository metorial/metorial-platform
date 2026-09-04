import { serialize } from '@lowerdeck/serialize';
import { describe, expect, test } from 'vitest';
import type { ConduitMessage } from '../../src/index';
import { createConduit } from '../../src/index';

let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Head-of-line blocking', () => {
  test('a slow message on topic A does not delay topic B', async () => {
    let conduit = createConduit();

    let receiver = conduit.createReceiver(async (topic, _payload) => {
      if (topic === 'slow') await sleep(800);
      return { topic, at: Date.now() };
    });
    await receiver.start();

    let sender = conduit.createSender({ defaultTimeout: 5000 });

    let start = Date.now();
    // Fire the slow message first, then the fast one. The fast one must not be
    // stuck behind the slow one (different topics run concurrently).
    let slowP = sender.send('slow', {});
    let fastP = sender.send('fast', {});

    let fast = await fastP;
    let fastElapsed = Date.now() - start;

    expect(fast.success).toBe(true);
    // Fast should come back well before the slow handler's 800ms.
    expect(fastElapsed).toBeLessThan(500);

    let slow = await slowP;
    expect(slow.success).toBe(true);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('messages on the same topic are processed serially', async () => {
    let conduit = createConduit();

    let active = 0;
    let maxActive = 0;
    let receiver = conduit.createReceiver(async (_topic, _payload) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await sleep(50);
      active--;
      return { ok: true };
    });
    await receiver.start();

    let sender = conduit.createSender({ defaultTimeout: 5000 });

    let responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) => sender.send('same-topic', { i }))
    );

    for (let r of responses) expect(r.success).toBe(true);
    // Same topic must never run two handlers concurrently.
    expect(maxActive).toBe(1);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('different topics run concurrently', async () => {
    let conduit = createConduit();

    let active = 0;
    let maxActive = 0;
    let receiver = conduit.createReceiver(async (_topic, _payload) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await sleep(100);
      active--;
      return { ok: true };
    });
    await receiver.start();

    let sender = conduit.createSender({ defaultTimeout: 5000 });

    let start = Date.now();
    let responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => sender.send(`topic-${i}`, { i }))
    );
    let elapsed = Date.now() - start;

    for (let r of responses) expect(r.success).toBe(true);
    // Concurrent across topics: should be far less than 5 * 100ms.
    expect(maxActive).toBeGreaterThan(1);
    expect(elapsed).toBeLessThan(400);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('handler ceiling fails one message and frees the loop', async () => {
    let conduit = createConduit();

    let receiver = conduit.createReceiver(
      async (topic, _payload) => {
        if (topic === 'never') {
          // Never returns within the ceiling.
          await sleep(60000);
        }
        return { topic };
      },
      { maxProcessingMs: 500, timeoutExtensionThreshold: 100 }
    );
    await receiver.start();

    let sender = conduit.createSender({ defaultTimeout: 10000 });

    let stuck = await sender.send('never', {});
    expect(stuck.success).toBe(false);
    expect(stuck.error).toBe('handler exceeded max processing time');

    // The receiver is not wedged: another topic still processes.
    let ok = await sender.send('fine', {});
    expect(ok.success).toBe(true);
    expect(ok.result).toEqual({ topic: 'fine' });

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('in-flight dedup: a retry of an in-flight messageId runs the handler once', async () => {
    let conduit = createConduit();

    let calls = 0;
    let receiver = conduit.createReceiver(async (_topic, _payload) => {
      calls++;
      await sleep(300);
      return { calls };
    });
    await receiver.start();

    let transport = conduit.transport; // MemoryTransport
    let receiverId = receiver.getReceiverId();
    let topic = 'dedup-topic';
    let subject = `conduit.default.receiver.${receiverId}.${topic}`;

    let encoder = new TextEncoder();
    let decoder = new TextDecoder();

    let makeMessage = (replySubject: string): ConduitMessage => ({
      messageId: 'dup-message-1',
      topic,
      payload: { hello: 'world' },
      replySubject,
      timeout: 5000,
      sentAt: Date.now(),
      retryCount: 0
    });

    let reply1: any = null;
    let reply2: any = null;
    let r1 = new Promise<void>(resolve => {
      transport.subscribe('_INBOX.dup-1', async data => {
        reply1 = serialize.decode(decoder.decode(data));
        resolve();
      });
    });
    let r2 = new Promise<void>(resolve => {
      transport.subscribe('_INBOX.dup-2', async data => {
        reply2 = serialize.decode(decoder.decode(data));
        resolve();
      });
    });

    // Publish two copies with the SAME messageId in the same tick: the second
    // arrives while the first is still in-flight.
    void transport.publish(subject, encoder.encode(serialize.encode(makeMessage('_INBOX.dup-1'))));
    void transport.publish(subject, encoder.encode(serialize.encode(makeMessage('_INBOX.dup-2'))));

    await Promise.all([r1, r2]);

    expect(calls).toBe(1);
    expect(reply1.success).toBe(true);
    expect(reply2.success).toBe(true);

    await receiver.stop();
    await conduit.close();
  }, 15000);
});
