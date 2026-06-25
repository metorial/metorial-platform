import { serialize } from '@lowerdeck/serialize';
import { afterEach, describe, expect, it } from 'vitest';
import type { ConduitMessage } from '../../src/index';
import {
  cleanupAll,
  makeConduitId,
  makeReceiverNode,
  makeSenderNode
} from './setup/realConduit';
import { sleep, waitFor } from './setup/poll';

describe('head-of-line blocking (Redis + NATS)', () => {
  afterEach(cleanupAll);

  it('does not let a slow topic block a fast topic', async () => {
    let conduitId = makeConduitId();
    await makeReceiverNode(conduitId, async topic => {
      if (topic === 'slow') await sleep(800);
      return { topic };
    });
    let { sender } = makeSenderNode(conduitId);

    let start = Date.now();
    let slowP = sender.send('slow', {});
    let fastP = sender.send('fast', {});

    let fast = await fastP;
    let fastElapsed = Date.now() - start;

    expect(fast.success).toBe(true);
    expect(fastElapsed).toBeLessThan(600);

    let slow = await slowP;
    expect(slow.success).toBe(true);
  });

  it('processes same-topic messages serially', async () => {
    let conduitId = makeConduitId();
    let active = 0;
    let maxActive = 0;
    await makeReceiverNode(conduitId, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await sleep(50);
      active--;
      return { ok: true };
    });
    let { sender } = makeSenderNode(conduitId);

    let responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) => sender.send('same.topic', { i }))
    );

    for (let r of responses) expect(r.success).toBe(true);
    expect(maxActive).toBe(1);
  });

  it('runs different topics concurrently', async () => {
    let conduitId = makeConduitId();
    let active = 0;
    let maxActive = 0;
    await makeReceiverNode(conduitId, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await sleep(150);
      active--;
      return { ok: true };
    });
    let { sender } = makeSenderNode(conduitId);

    let responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => sender.send(`topic.${i}`, { i }))
    );

    for (let r of responses) expect(r.success).toBe(true);
    expect(maxActive).toBeGreaterThan(1);
  });

  it('aborts a hung handler at the maxProcessingMs ceiling and keeps draining', async () => {
    let conduitId = makeConduitId();
    let node = await makeReceiverNode(
      conduitId,
      async topic => {
        if (topic === 'never') await sleep(60000);
        return { topic };
      },
      { maxProcessingMs: 500, timeoutExtensionThreshold: 100 }
    );
    let { sender } = makeSenderNode(conduitId, { defaultTimeout: 10000 });

    let stuck = await sender.send('never', {});
    expect(stuck.success).toBe(false);
    expect(stuck.error).toBe('handler exceeded max processing time');

    // Receiver is not wedged: a different topic still gets handled.
    let ok = await sender.send('fine', {});
    expect(ok.success).toBe(true);
    expect(ok.result).toEqual({ topic: 'fine' });

    expect(node.receiver.getStats().ceilingAborts).toBeGreaterThanOrEqual(1);
  });

  it('runs the handler once for a duplicate in-flight messageId (real NATS)', async () => {
    let conduitId = makeConduitId();
    let calls = 0;
    let node = await makeReceiverNode(conduitId, async () => {
      calls++;
      await sleep(300);
      return { calls };
    });

    // Publish two copies with the SAME messageId straight onto the receiver's
    // wildcard subject so the second arrives while the first is still in-flight.
    // This deterministically exercises in-flight dedup (the sender's own
    // timeout-extension machinery would otherwise keep a single attempt alive).
    let transport = node.conduit.transport;
    let receiverId = node.receiver.getReceiverId();
    let topic = 'dedup.topic';
    let subject = `conduit.${conduitId}.receiver.${receiverId}.${topic}`;

    let encoder = new TextEncoder();
    let decoder = new TextDecoder();

    let makeMessage = (replySubject: string): ConduitMessage => ({
      messageId: 'dup-message-real-1',
      topic,
      payload: { hello: 'world' },
      replySubject,
      timeout: 5000,
      sentAt: Date.now(),
      retryCount: 0
    });

    let replies: Record<string, { success: boolean } | null> = { a: null, b: null };
    let inboxA = `_INBOX.dedup-a-${Math.random().toString(36).slice(2)}`;
    let inboxB = `_INBOX.dedup-b-${Math.random().toString(36).slice(2)}`;

    await transport.subscribe(inboxA, async data => {
      replies.a = serialize.decode(decoder.decode(data));
    });
    await transport.subscribe(inboxB, async data => {
      replies.b = serialize.decode(decoder.decode(data));
    });

    void transport.publish(subject, encoder.encode(serialize.encode(makeMessage(inboxA))));
    void transport.publish(subject, encoder.encode(serialize.encode(makeMessage(inboxB))));

    await waitFor(() => replies.a !== null && replies.b !== null, {
      timeout: 10000,
      message: 'both reply subjects should receive a response'
    });

    expect(calls).toBe(1);
    expect(replies.a?.success).toBe(true);
    expect(replies.b?.success).toBe(true);
    expect(node.receiver.getStats().dedupHits).toBeGreaterThanOrEqual(1);
  }, 20000);
});
