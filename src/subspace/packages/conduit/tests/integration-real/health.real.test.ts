import { afterEach, describe, expect, it } from 'vitest';
import { isConduitHealthPong } from '../../src/index';
import {
  cleanupAll,
  makeConduitId,
  makeReceiverNode,
  makeSenderNode
} from './setup/realConduit';

describe('health pings (Redis + NATS)', () => {
  afterEach(cleanupAll);

  it('returns a pong from a live receiver over its wildcard subscription', async () => {
    let conduitId = makeConduitId();
    let { receiver } = await makeReceiverNode(conduitId, async () => 'ok');
    let { sender } = makeSenderNode(conduitId);

    let response = await sender.pingReceiver(receiver.getReceiverId(), 2000);

    expect(response.success).toBe(true);
    expect(isConduitHealthPong(response.result)).toBe(true);
    expect((response.result as { receiverId: string }).receiverId).toBe(
      receiver.getReceiverId()
    );
  });

  it('times out when pinging an unknown receiver', async () => {
    let conduitId = makeConduitId();
    await makeReceiverNode(conduitId, async () => 'ok');
    let { sender } = makeSenderNode(conduitId);

    await expect(sender.pingReceiver('receiver-does-not-exist', 500)).rejects.toThrow();
  });

  it('reports healthy under normal load and still pongs while busy on another topic', async () => {
    let conduitId = makeConduitId();
    let { receiver } = await makeReceiverNode(conduitId, async topic => {
      if (topic === 'busy') await new Promise(r => setTimeout(r, 600));
      return { topic };
    });
    let { sender } = makeSenderNode(conduitId);

    // Kick off slow work, then ping: the health topic bypasses the per-topic
    // queue, so the pong must come back without waiting for the busy handler.
    let busyP = sender.send('busy', {});
    let pong = await sender.pingReceiver(receiver.getReceiverId(), 2000);

    expect(pong.success).toBe(true);
    expect(isConduitHealthPong(pong.result)).toBe(true);
    expect(receiver.isHealthy()).toBe(true);

    let busy = await busyP;
    expect(busy.success).toBe(true);
  });
});
