import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConduit, createMemoryConduit } from '../../src/index';

let sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

let productionSenderConfig = { defaultTimeout: 10_000, maxRetries: 10 };

describe('Connection loss hardening', () => {
  let conduit: ReturnType<typeof createConduit>;
  let unhandled: unknown[];
  let onUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    conduit = createConduit(createMemoryConduit('connection-loss'));

    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(async () => {
    process.off('unhandledRejection', onUnhandled);
    await conduit.close();
  });

  it('a message queued behind a busy topic is acknowledged and runs exactly once', async () => {
    let runs: string[] = [];
    let closes = 0;

    let createReceiver = () =>
      conduit.createConduitReceiver(
        async ctx => {
          ctx.extendTtl(60_000);

          ctx.onMessage(async (data: any) => {
            runs.push(data.id);
            await sleep(data.ms);
            return { id: data.id };
          });

          ctx.onClose(() => {
            closes++;
          });
        },
        { timeoutExtensionThreshold: 5_000, timeoutExtensionMs: 15_000 }
      );

    let receivers = [createReceiver(), createReceiver()];
    for (let receiver of receivers) await receiver.start();

    let sender = conduit.createSender(productionSenderConfig);

    let retryWarnings: string[] = [];
    let warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      let line = args.map(String).join(' ');
      if (line.includes('retrying in')) retryWarnings.push(line);
    });

    let slow = sender.send('busy-topic', { id: 'slow', ms: 3_000 });
    await sleep(200);
    let queued = sender.send('busy-topic', { id: 'queued', ms: 10 });

    let [slowResponse, queuedResponse] = await Promise.all([slow, queued]);
    await sleep(1_000);
    warn.mockRestore();

    expect(slowResponse.success).toBe(true);
    expect(queuedResponse.success).toBe(true);
    expect(retryWarnings).toEqual([]);
    expect(runs).toEqual(['slow', 'queued']);
    expect(closes).toBe(0);

    for (let receiver of receivers) await receiver.stop();
    await sender.close();
  }, 20_000);

  it('a message arriving while close handlers run starts a fresh topic', async () => {
    let setups = 0;

    let receiver = conduit.createConduitReceiver(async ctx => {
      setups++;
      ctx.extendTtl(60_000);

      await ctx.onClose(() => sleep(1_000));

      await ctx.onMessage(async (data: any) => {
        if (data.close) void ctx.close();
        return { id: data.id };
      });
    });
    await receiver.start();

    let sender = conduit.createSender(productionSenderConfig);

    let first = await sender.send('closing-topic', { id: 'first', close: true });
    await sleep(50);
    let second = await sender.send('closing-topic', { id: 'second' });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.result).toEqual({ id: 'second' });
    expect(setups).toBe(2);

    await receiver.stop();
    await sender.close();
  }, 15_000);

  it("a stale context's close() does not close the replacement topic", async () => {
    let contexts: { close: () => Promise<void> }[] = [];
    let replacementCloses = 0;

    let receiver = conduit.createConduitReceiver(async ctx => {
      let generation = contexts.push(ctx);
      ctx.extendTtl(60_000);

      await ctx.onClose(() => {
        if (generation === 2) replacementCloses++;
      });

      await ctx.onMessage(async (data: any) => {
        if (data.close) await ctx.close();
        return { id: data.id, generation };
      });
    });
    await receiver.start();

    let sender = conduit.createSender(productionSenderConfig);

    await sender.send('replaced-topic', { id: 'first', close: true });
    await sleep(50);
    await sender.send('replaced-topic', { id: 'second' });

    await contexts[0]!.close();

    let third = await sender.send('replaced-topic', { id: 'third' });

    expect(third.result).toEqual({ id: 'third', generation: 2 });
    expect(contexts).toHaveLength(2);
    expect(replacementCloses).toBe(0);
    expect(await conduit.coordination.getTopicOwner('replaced-topic')).toBe(
      receiver.getReceiverId()
    );

    await receiver.stop();
    await sender.close();
  }, 15_000);

  it('a replacement topic started during ownership release keeps its ownership', async () => {
    let coordination = conduit.coordination;
    let originalRelease = coordination.releaseTopicOwnership.bind(coordination);
    let release = vi
      .spyOn(coordination, 'releaseTopicOwnership')
      .mockImplementation(async (topic, receiverId) => {
        await sleep(300);
        await originalRelease(topic, receiverId);
      });

    let receiver = conduit.createConduitReceiver(async ctx => {
      ctx.extendTtl(60_000);

      await ctx.onMessage(async (data: any) => {
        if (data.close) void ctx.close();
        return { id: data.id };
      });
    });
    await receiver.start();

    let sender = conduit.createSender(productionSenderConfig);

    await sender.send('release-race-topic', { id: 'first', close: true });
    await sleep(50);
    let second = await sender.send('release-race-topic', { id: 'second' });
    await sleep(500);
    release.mockRestore();

    expect(second.success).toBe(true);
    expect(await coordination.getTopicOwner('release-race-topic')).toBe(
      receiver.getReceiverId()
    );

    await receiver.stop();
    await sender.close();
  }, 15_000);

  it('a replacement started by a message queued behind the close keeps its ownership', async () => {
    let setups = 0;

    let receiver = conduit.createConduitReceiver(async ctx => {
      let generation = ++setups;
      ctx.extendTtl(60_000);

      await ctx.onMessage(async (data: any) => {
        if (data.close) {
          await sleep(200);
          await ctx.close();
        }
        return { id: data.id, generation };
      });
    });
    await receiver.start();

    let sender = conduit.createSender(productionSenderConfig);

    let closing = sender.send('queued-replacement-topic', { id: 'first', close: true });
    await sleep(50);
    let queued = sender.send('queued-replacement-topic', { id: 'queued' });

    let [, queuedResponse] = await Promise.all([closing, queued]);
    await sleep(100);

    expect(queuedResponse.result).toEqual({ id: 'queued', generation: 2 });
    expect(receiver.getHandledTopics()).toContain('queued-replacement-topic');
    expect(receiver.getOwnedTopics()).toContain('queued-replacement-topic');
    expect(await conduit.coordination.getTopicOwner('queued-replacement-topic')).toBe(
      receiver.getReceiverId()
    );

    await receiver.stop();
    await sender.close();
  }, 15_000);

  it('a topic closed during async setup still cleans up and the message is redelivered', async () => {
    let setups = 0;
    let cleanups = 0;

    let receiver = conduit.createConduitReceiver(async ctx => {
      setups++;

      if (setups === 1) {
        ctx.extendTtl(300);
        await sleep(1_500);
      } else {
        ctx.extendTtl(60_000);
      }

      await ctx.onClose(() => {
        cleanups++;
      });

      await ctx.onMessage(async (data: any) => ({ id: data.id, setups }));
    });
    await receiver.start();

    let sender = conduit.createSender(productionSenderConfig);
    let response = await sender.send('setup-topic', { id: 'x' });
    await sleep(500);

    expect(response.success).toBe(true);
    expect(response.result).toEqual({ id: 'x', setups: 2 });
    expect(cleanups).toBe(1);
    expect(unhandled).toEqual([]);

    await receiver.stop();
    await sender.close();
  }, 15_000);

  it('a pickup timeout does not release a live owner', async () => {
    let calls = 0;

    let createReceiver = () =>
      conduit.createReceiver(
        async () => {
          calls++;
          await sleep(1_500);
          return { calls };
        },
        { timeoutExtensionMs: 0 }
      );

    let receivers = [createReceiver(), createReceiver()];
    for (let receiver of receivers) await receiver.start();

    let release = vi.spyOn(conduit.coordination, 'releaseTopicOwnership');

    let sender = conduit.createSender(productionSenderConfig);
    let response = await sender.send('live-owner-topic', {});

    let owner = await conduit.coordination.getTopicOwner('live-owner-topic');
    let releasedTopics = release.mock.calls.map(([topic]) => topic);
    release.mockRestore();

    expect(response.success).toBe(true);
    expect(calls).toBe(1);
    expect(releasedTopics).not.toContain('live-owner-topic');
    expect(receivers.map(r => r.getReceiverId())).toContain(owner);

    for (let receiver of receivers) await receiver.stop();
    await sender.close();
  }, 15_000);
});
