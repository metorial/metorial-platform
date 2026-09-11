import { describe, expect, test } from 'vitest';
import { createConduit } from '../../src/index';

let tick = () => new Promise<void>(resolve => setImmediate(resolve));

describe('Ceiling-orphaned handlers', () => {
  test('orphaned handlers are tracked, recycle the receiver, then drain on settle', async () => {
    let conduit = createConduit();

    // Handlers block until the test releases them, so a ceiling abort leaves a
    // still-running ("orphaned") handler we can observe.
    let release: Array<() => void> = [];
    let receiver = conduit.createReceiver(
      async () => {
        await new Promise<void>(resolve => release.push(resolve));
        return { done: true };
      },
      { maxProcessingMs: 100, maxOrphanedHandlers: 2, timeoutExtensionThreshold: 50 }
    );
    await receiver.start();

    let sender = conduit.createSender({ defaultTimeout: 5000 });

    // Distinct topics so the handlers run concurrently (different topic chains).
    let first = await sender.send('topic-a', {});
    expect(first.success).toBe(false);
    expect(first.error).toBe('handler exceeded max processing time');
    expect(receiver.getStats().orphaned).toBe(1);
    expect(receiver.getStats().orphanedTotal).toBe(1);
    // One orphan is below the recycle threshold (2).
    expect(receiver.isHealthy()).toBe(true);

    let second = await sender.send('topic-b', {});
    expect(second.success).toBe(false);
    expect(receiver.getStats().orphaned).toBe(2);

    // At the threshold the receiver reports unhealthy so it gets recycled (which
    // would terminate the orphaned provider work with the process).
    expect(receiver.isHealthy()).toBe(false);

    // Once the orphaned handlers finally settle, they stop counting and health
    // recovers.
    for (let resolve of release) resolve();
    await tick();
    await tick();

    expect(receiver.getStats().orphaned).toBe(0);
    expect(receiver.getStats().orphanedTotal).toBe(2);
    expect(receiver.isHealthy()).toBe(true);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);
});
