import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TopicContext } from '../../src/core/conduitReceiver';
import { createConduit, createMemoryConduit } from '../../src/index';

describe('ConduitReceiver Basic Tests', () => {
  let conduit: ReturnType<typeof createConduit>;

  beforeEach(() => {
    conduit = createConduit(createMemoryConduit('test-conduit'));
  });

  afterEach(async () => {
    await conduit.close();
  });

  it('should process messages with simple handler', async () => {
    const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
      ctx.onMessage(async (data: any) => {
        return { success: true, data };
      });
    });

    await receiver.start();

    const sender = conduit.createSender();
    const response = await sender.send('test', { value: 123 });

    expect(response.success).toBe(true);
    expect(response.result).toMatchObject({ success: true, data: { value: 123 } });

    await receiver.stop();
    await sender.close();
  });

  it('should handle async setup', async () => {
    let setupComplete = false;

    const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      setupComplete = true;

      ctx.onMessage(async (data: any) => {
        return { setupComplete, data };
      });
    });

    await receiver.start();

    const sender = conduit.createSender();
    const response = await sender.send('test', { value: 456 });

    expect(response.success).toBe(true);
    expect((response.result as any).setupComplete).toBe(true);

    await receiver.stop();
    await sender.close();
  });

  it('should call onClose handlers', async () => {
    let closeCalled = false;

    const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
      ctx.onMessage(async (_data: any) => {
        return { processed: true };
      });

      ctx.onClose(async () => {
        closeCalled = true;
      });
    });

    await receiver.start();

    const sender = conduit.createSender();
    await sender.send('test', { value: 1 });

    await receiver.stop();

    expect(closeCalled).toBe(true);

    await sender.close();
  });

  it('should extend TTL', async () => {
    const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
      ctx.extendTtl(60000);

      ctx.onMessage(async (_data: any) => {
        ctx.extendTtl(30000);
        return { processed: true };
      });
    });

    await receiver.start();

    const sender = conduit.createSender();
    await sender.send('test', { value: 1 });

    expect(receiver.getOwnedTopicCount()).toBe(1);

    await receiver.stop();
    await sender.close();
  });
});
