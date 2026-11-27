import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupAll,
  makeConduitId,
  makeReceiverNode,
  makeSenderNode
} from './setup/realConduit';
import { composeRestart, composeStart, composeStop } from './setup/dockerControl';
import { sleep, waitFor } from './setup/poll';

let trySend = async (
  sender: { send: (topic: string, payload: unknown) => Promise<{ success: boolean }> },
  topic: string
) => {
  try {
    let r = await sender.send(topic, {});
    return r.success;
  } catch {
    return false;
  }
};

describe('NATS chaos (restart / outage)', () => {
  afterEach(cleanupAll);

  it('keeps draining new messages after the NATS server is restarted', async () => {
    let conduitId = makeConduitId();
    let node = await makeReceiverNode(conduitId, async topic => ({ topic }));
    let { sender } = makeSenderNode(conduitId, { defaultTimeout: 3000, maxRetries: 1 });

    // Baseline: messages flow.
    expect((await sender.send('before.restart', {})).success).toBe(true);

    // Bounce NATS. The client auto-reconnects; the receiver's read loop must
    // resume draining (either via the client's transparent resubscribe or our
    // resubscribe-on-iterator-death fallback).
    composeRestart('nats');

    await waitFor(() => trySend(sender, 'after.restart'), {
      timeout: 40000,
      interval: 500,
      message: 'sends should succeed again after NATS recovers'
    });

    expect(node.receiver.isHealthy()).toBe(true);

    let transport = node.conduit.transport as { getResubscribeCount?: () => number };
    console.log(
      `[natsChaos] resubscribeCount=${transport.getResubscribeCount?.() ?? 'n/a'} (informational; may be 0 if the client resubscribed transparently)`
    );
  }, 60000);

  it('eventually delivers a send issued during a brief NATS outage', async () => {
    let conduitId = makeConduitId();
    await makeReceiverNode(conduitId, async () => 'ok');
    // Generous timeout + retries so the request survives the outage window.
    let { sender } = makeSenderNode(conduitId, {
      defaultTimeout: 10000,
      maxRetries: 5,
      retryBackoffMs: 500
    });

    expect((await sender.send('warmup', {})).success).toBe(true);

    composeStop('nats');
    // Issue the send while NATS is down, then bring it back shortly after.
    let inflight = sender.send('during.outage', {});
    await sleep(1500);
    composeStart('nats');

    let result = await inflight;
    expect(result.success).toBe(true);
  }, 60000);
});
