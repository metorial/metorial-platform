import { afterEach, describe, expect, it } from 'vitest';
import { cleanupAll, makeConduit, makeConduitId } from './setup/realConduit';
import { sleep, waitFor } from './setup/poll';

describe('Redis coordination adapter (real Redis)', () => {
  afterEach(cleanupAll);

  it('drops a receiver from the active set once its registration TTL expires', async () => {
    let conduit = makeConduit();
    let coord = conduit.coordination;

    await coord.registerReceiver('rx-temp', 1500);
    expect(await coord.getActiveReceivers()).toContain('rx-temp');

    await waitFor(
      async () => {
        let active = await coord.getActiveReceivers();
        return !active.includes('rx-temp');
      },
      { timeout: 5000, message: 'receiver should expire from active set' }
    );
  });

  it('enforces mutually-exclusive topic ownership across nodes (NX)', async () => {
    let conduitId = makeConduitId();
    let nodeA = makeConduit(conduitId);
    let nodeB = makeConduit(conduitId);

    let claimedA = await nodeA.coordination.claimTopicOwnership('excl.topic', 'r-a', 5000);
    let claimedB = await nodeB.coordination.claimTopicOwnership('excl.topic', 'r-b', 5000);

    expect(claimedA).toBe(true);
    expect(claimedB).toBe(false);
    expect(await nodeB.coordination.getTopicOwner('excl.topic')).toBe('r-a');
  });

  it('extends ownership via renew so it outlives the original TTL', async () => {
    let conduit = makeConduit();
    let coord = conduit.coordination;

    expect(await coord.claimTopicOwnership('renew.topic', 'r-1', 1000)).toBe(true);

    // Renew well before the 1s lease lapses, extending it to 5s.
    await sleep(400);
    expect(await coord.renewTopicOwnership('renew.topic', 'r-1', 5000)).toBe(true);

    // Past the original 1s TTL, the renewed lease keeps us as owner.
    await sleep(1200);
    expect(await coord.getTopicOwner('renew.topic')).toBe('r-1');
  });

  it('frees ownership on release so another node can claim', async () => {
    let conduitId = makeConduitId();
    let nodeA = makeConduit(conduitId);
    let nodeB = makeConduit(conduitId);

    expect(await nodeA.coordination.claimTopicOwnership('rel.topic', 'r-a', 5000)).toBe(true);

    // A non-owner cannot release it.
    await nodeB.coordination.releaseTopicOwnership('rel.topic', 'r-b');
    expect(await nodeA.coordination.getTopicOwner('rel.topic')).toBe('r-a');

    // The owner releasing it frees the lease for someone else.
    await nodeA.coordination.releaseTopicOwnership('rel.topic', 'r-a');
    expect(await nodeA.coordination.getTopicOwner('rel.topic')).toBeNull();
    expect(await nodeB.coordination.claimTopicOwnership('rel.topic', 'r-b', 5000)).toBe(true);
  });

  it('lets a receiver renew its registration to stay active', async () => {
    let conduit = makeConduit();
    let coord = conduit.coordination;

    await coord.registerReceiver('rx-keep', 1500);
    await sleep(700);
    await coord.registerReceiver('rx-keep', 1500);
    await sleep(900);

    // Total elapsed > original 1.5s TTL, but the renewal kept it alive.
    expect(await coord.getActiveReceivers()).toContain('rx-keep');
  });
});
