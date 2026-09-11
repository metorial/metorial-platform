import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupAll,
  makeConduitId,
  makeReceiverNode,
  makeSenderNode
} from './setup/realConduit';
import { waitFor } from './setup/poll';

describe('real flow (Redis + NATS)', () => {
  afterEach(cleanupAll);

  it('round-trips a request/response over real infrastructure', async () => {
    let conduitId = makeConduitId();
    let { receiver } = await makeReceiverNode(conduitId, async (topic, payload) => {
      return { echoedTopic: topic, doubled: (payload as { n: number }).n * 2 };
    });
    let { sender } = makeSenderNode(conduitId);

    let response = await sender.send('math.double', { n: 21 });

    expect(response.success).toBe(true);
    expect(response.result).toEqual({ echoedTopic: 'math.double', doubled: 42 });
    expect(receiver.getReceiverId()).toBeTruthy();
  });

  it('records topic ownership in Redis after the first send', async () => {
    let conduitId = makeConduitId();
    let { conduit, receiver } = await makeReceiverNode(conduitId, async () => 'ok');
    let { sender } = makeSenderNode(conduitId);

    await sender.send('topic.alpha', {});

    let owner = await waitFor(() => conduit.coordination.getTopicOwner('topic.alpha'), {
      message: 'topic owner should be recorded in Redis'
    });
    expect(owner).toBe(receiver.getReceiverId());
  });

  it('routes multiple distinct topics to the same single receiver', async () => {
    let conduitId = makeConduitId();
    let seen: string[] = [];
    await makeReceiverNode(conduitId, async topic => {
      seen.push(topic);
      return topic;
    });
    let { sender } = makeSenderNode(conduitId);

    let topics = ['t.one', 't.two', 't.three'];
    let results = await Promise.all(topics.map(t => sender.send(t, {})));

    expect(results.map(r => r.success)).toEqual([true, true, true]);
    expect(results.map(r => r.result)).toEqual(topics);
    expect(new Set(seen)).toEqual(new Set(topics));
  });
});
