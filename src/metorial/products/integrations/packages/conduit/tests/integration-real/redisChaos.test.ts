import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupAll,
  makeConduitId,
  makeReceiverNode,
  makeSenderNode
} from './setup/realConduit';
import { composeRestart } from './setup/dockerControl';
import { waitFor } from './setup/poll';

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

describe('Redis chaos (restart)', () => {
  afterEach(cleanupAll);

  it('recovers coordination after Redis is restarted (re-registers + resumes routing)', async () => {
    let conduitId = makeConduitId();
    let node = await makeReceiverNode(conduitId, async topic => ({ topic }), {
      // Re-register quickly after the wipe so failover/recovery is fast.
      heartbeatInterval: 500,
      heartbeatTtl: 2000
    });
    let { conduit: senderConduit, sender } = makeSenderNode(conduitId);

    expect((await sender.send('before.redis.restart', {})).success).toBe(true);

    // Restart Redis. Persistence is disabled, so registration + ownership are
    // wiped; ioredis reconnects and the receiver's heartbeat re-registers it.
    composeRestart('redis');

    // Receiver should re-appear in the active set after reconnect + heartbeat.
    await waitFor(
      async () => {
        let active = await senderConduit.coordination.getActiveReceivers();
        return active.includes(node.receiver.getReceiverId());
      },
      { timeout: 30000, interval: 500, message: 'receiver should re-register after Redis restart' }
    );

    // And routing/sends resume (ownership re-claimed against fresh Redis state).
    await waitFor(() => trySend(sender, 'after.redis.restart'), {
      timeout: 30000,
      interval: 500,
      message: 'sends should resume after Redis recovers'
    });
  }, 60000);
});
