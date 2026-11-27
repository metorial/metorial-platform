import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupAll,
  makeConduitId,
  makeReceiverNode,
  makeSenderNode
} from './setup/realConduit';
import { waitFor } from './setup/poll';

describe('multi-receiver coordination (Redis + NATS)', () => {
  afterEach(cleanupAll);

  it('owns each topic on exactly one node and routes accordingly', async () => {
    let conduitId = makeConduitId();
    let nodeA = await makeReceiverNode(conduitId, async () => 'A');
    let nodeB = await makeReceiverNode(conduitId, async () => 'B');
    let { conduit: senderConduit, sender } = makeSenderNode(conduitId);

    let ids = new Set([nodeA.receiver.getReceiverId(), nodeB.receiver.getReceiverId()]);

    await waitFor(
      async () => {
        let active = await senderConduit.coordination.getActiveReceivers();
        return active.length === 2;
      },
      { message: 'both receivers should register' }
    );

    let topics = Array.from({ length: 20 }, (_, i) => `topic.${i}`);
    let handledBy = await Promise.all(topics.map(t => sender.send(t, {})));

    // Each send was answered by exactly one of the two nodes.
    for (let r of handledBy) {
      expect(r.success).toBe(true);
      expect(['A', 'B']).toContain(r.result);
    }

    // The recorded owner of each topic matches one of our active receivers, and
    // the handler tag is consistent with that owner.
    for (let [i, topic] of topics.entries()) {
      let owner = await senderConduit.coordination.getTopicOwner(topic);
      expect(owner).not.toBeNull();
      expect(ids.has(owner!)).toBe(true);
      let expectedTag = owner === nodeA.receiver.getReceiverId() ? 'A' : 'B';
      expect(handledBy[i]!.result).toBe(expectedTag);
    }

    // With 20 topics across 2 receivers, both should have been used.
    let tags = new Set(handledBy.map(r => r.result));
    expect(tags).toEqual(new Set(['A', 'B']));
  });

  it('keeps a single topic pinned to one owner (NX exclusivity)', async () => {
    let conduitId = makeConduitId();
    await makeReceiverNode(conduitId, async () => 'A');
    await makeReceiverNode(conduitId, async () => 'B');
    let { conduit: senderConduit, sender } = makeSenderNode(conduitId);

    await waitFor(async () => {
      let active = await senderConduit.coordination.getActiveReceivers();
      return active.length === 2;
    });

    let results = await Promise.all(
      Array.from({ length: 10 }, () => sender.send('sticky.topic', {}))
    );

    let tags = new Set(results.map(r => r.result));
    expect(tags.size).toBe(1);
  });

  it('reassigns a topic to a healthy node after the owner leaves', async () => {
    let conduitId = makeConduitId();
    let nodeA = await makeReceiverNode(conduitId, async () => 'A');
    let nodeB = await makeReceiverNode(conduitId, async () => 'B');
    let { conduit: senderConduit, sender } = makeSenderNode(conduitId);

    await waitFor(async () => {
      let active = await senderConduit.coordination.getActiveReceivers();
      return active.length === 2;
    });

    let first = await sender.send('failover.topic', {});
    let firstOwner = await senderConduit.coordination.getTopicOwner('failover.topic');
    expect(firstOwner).not.toBeNull();

    // Stop whichever node currently owns the topic.
    let owningNode = firstOwner === nodeA.receiver.getReceiverId() ? nodeA : nodeB;
    let survivingNode = owningNode === nodeA ? nodeB : nodeA;
    let survivorTag = survivingNode === nodeA ? 'A' : 'B';
    await owningNode.receiver.stop();

    // Wait until the sender no longer sees the stopped receiver as active, so the
    // next send is guaranteed to be (re)assigned to the survivor.
    await waitFor(
      async () => {
        let active = await senderConduit.coordination.getActiveReceivers();
        return !active.includes(owningNode.receiver.getReceiverId()) && active.length === 1;
      },
      { timeout: 8000, message: 'stopped receiver should drop out of active set' }
    );

    let second = await sender.send('failover.topic', {});
    expect(second.success).toBe(true);
    expect(second.result).toBe(survivorTag);

    let newOwner = await senderConduit.coordination.getTopicOwner('failover.topic');
    expect(newOwner).toBe(survivingNode.receiver.getReceiverId());
    expect(first.success).toBe(true);
  });
});
