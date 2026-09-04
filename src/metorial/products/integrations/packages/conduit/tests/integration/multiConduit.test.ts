import { afterEach, describe, expect, it } from 'vitest';
import { createConduit, createMemoryConduit } from '../../src/index';

describe('Multi-Conduit Integration', () => {
  const conduits: ReturnType<typeof createConduit>[] = [];

  afterEach(async () => {
    // Close all conduits
    for (const conduit of conduits) {
      await conduit.close();
    }
    conduits.length = 0;
  });

  it('should isolate messages between different conduit instances', async () => {
    // Create two separate Conduit instances with different IDs
    const conduit1 = createConduit(createMemoryConduit('conduit1'));
    const conduit2 = createConduit(createMemoryConduit('conduit2'));
    conduits.push(conduit1, conduit2);

    // Track which receivers process which messages
    const conduit1Messages: string[] = [];
    const conduit2Messages: string[] = [];

    // Create receivers on both conduits for the same topic
    const receiver1 = conduit1.createReceiver(async (_topic, payload) => {
      conduit1Messages.push(payload as string);
      return { conduit: 'conduit1', payload };
    });

    const receiver2 = conduit2.createReceiver(async (_topic, payload) => {
      conduit2Messages.push(payload as string);
      return { conduit: 'conduit2', payload };
    });

    await receiver1.start();
    await receiver2.start();

    // Create senders on both conduits
    const sender1 = conduit1.createSender();
    const sender2 = conduit2.createSender();

    // Send messages to the same topic on different conduits
    const response1 = await sender1.send('shared-topic', 'message-for-conduit1');
    const response2 = await sender2.send('shared-topic', 'message-for-conduit2');

    // Verify responses came from correct conduit
    expect(response1.success).toBe(true);
    expect(response1.result).toEqual({ conduit: 'conduit1', payload: 'message-for-conduit1' });

    expect(response2.success).toBe(true);
    expect(response2.result).toEqual({ conduit: 'conduit2', payload: 'message-for-conduit2' });

    // Verify each receiver only processed its own conduit's message
    expect(conduit1Messages).toEqual(['message-for-conduit1']);
    expect(conduit2Messages).toEqual(['message-for-conduit2']);

    await receiver1.stop();
    await receiver2.stop();
    await sender1.close();
    await sender2.close();
  });

  it('should not allow cross-conduit topic subscriptions', async () => {
    // Create two separate Conduit instances
    const conduit1 = createConduit(createMemoryConduit('conduit1'));
    const conduit2 = createConduit(createMemoryConduit('conduit2'));
    conduits.push(conduit1, conduit2);

    // Track broadcasts
    const conduit1Broadcasts: any[] = [];
    const conduit2Broadcasts: any[] = [];

    // Create receivers and senders
    const receiver1 = conduit1.createReceiver(async (_topic, payload) => {
      return { conduit: 'conduit1', payload };
    });

    const receiver2 = conduit2.createReceiver(async (_topic, payload) => {
      return { conduit: 'conduit2', payload };
    });

    await receiver1.start();
    await receiver2.start();

    const sender1 = conduit1.createSender();
    const sender2 = conduit2.createSender();

    // Subscribe sender1 to conduit1's topic
    await sender1.subscribeTopic('test-topic', broadcast => {
      conduit1Broadcasts.push(broadcast);
    });

    // Subscribe sender2 to conduit2's topic
    await sender2.subscribeTopic('test-topic', broadcast => {
      conduit2Broadcasts.push(broadcast);
    });

    // Send messages on both conduits
    await sender1.send('test-topic', 'data1');
    await sender2.send('test-topic', 'data2');

    // Wait for broadcasts to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Each sender should only receive broadcasts from its own conduit
    expect(conduit1Broadcasts.length).toBe(1);
    expect(conduit1Broadcasts[0].response.result.conduit).toBe('conduit1');

    expect(conduit2Broadcasts.length).toBe(1);
    expect(conduit2Broadcasts[0].response.result.conduit).toBe('conduit2');

    await receiver1.stop();
    await receiver2.stop();
    await sender1.close();
    await sender2.close();
  });

  it('should handle multiple conduits with the same topic names', async () => {
    // Create three Conduit instances
    const conduitA = createConduit(createMemoryConduit('conduitA'));
    const conduitB = createConduit(createMemoryConduit('conduitB'));
    const conduitC = createConduit(createMemoryConduit('conduitC'));
    conduits.push(conduitA, conduitB, conduitC);

    // Create receivers on all conduits
    const receiverA = conduitA.createReceiver(async (topic, payload) => {
      return { conduit: 'A', topic, payload };
    });

    const receiverB = conduitB.createReceiver(async (topic, payload) => {
      return { conduit: 'B', topic, payload };
    });

    const receiverC = conduitC.createReceiver(async (topic, payload) => {
      return { conduit: 'C', topic, payload };
    });

    await receiverA.start();
    await receiverB.start();
    await receiverC.start();

    // Create senders
    const senderA = conduitA.createSender();
    const senderB = conduitB.createSender();
    const senderC = conduitC.createSender();

    // Send to same topic names on all conduits
    const responseA = await senderA.send('orders', 'order-A');
    const responseB = await senderB.send('orders', 'order-B');
    const responseC = await senderC.send('orders', 'order-C');

    // Verify each conduit processed only its own message
    expect(responseA.result).toEqual({ conduit: 'A', topic: 'orders', payload: 'order-A' });
    expect(responseB.result).toEqual({ conduit: 'B', topic: 'orders', payload: 'order-B' });
    expect(responseC.result).toEqual({ conduit: 'C', topic: 'orders', payload: 'order-C' });

    // Cleanup
    await receiverA.stop();
    await receiverB.stop();
    await receiverC.stop();
    await senderA.close();
    await senderB.close();
    await senderC.close();
  });

  it('should maintain separate topic ownership per conduit', async () => {
    // Create two conduits
    const conduit1 = createConduit(createMemoryConduit('conduit1'));
    const conduit2 = createConduit(createMemoryConduit('conduit2'));
    conduits.push(conduit1, conduit2);

    // Create multiple receivers on each conduit
    const receiver1a = conduit1.createReceiver(async (_topic, payload) => {
      return { conduit: 'conduit1', receiver: 'a', payload };
    });

    const receiver1b = conduit1.createReceiver(async (_topic, payload) => {
      return { conduit: 'conduit1', receiver: 'b', payload };
    });

    const receiver2a = conduit2.createReceiver(async (_topic, payload) => {
      return { conduit: 'conduit2', receiver: 'a', payload };
    });

    const receiver2b = conduit2.createReceiver(async (_topic, payload) => {
      return { conduit: 'conduit2', receiver: 'b', payload };
    });

    await receiver1a.start();
    await receiver1b.start();
    await receiver2a.start();
    await receiver2b.start();

    const sender1 = conduit1.createSender();
    const sender2 = conduit2.createSender();

    // Send multiple messages to same topic on each conduit
    const response1_1 = await sender1.send('data-topic', 'msg1');
    const response1_2 = await sender1.send('data-topic', 'msg2');
    const response2_1 = await sender2.send('data-topic', 'msg3');
    const response2_2 = await sender2.send('data-topic', 'msg4');

    // All messages should succeed
    expect(response1_1.success).toBe(true);
    expect(response1_2.success).toBe(true);
    expect(response2_1.success).toBe(true);
    expect(response2_2.success).toBe(true);

    // conduit1 messages should be processed by conduit1 receivers
    expect((response1_1.result as any).conduit).toBe('conduit1');
    expect((response1_2.result as any).conduit).toBe('conduit1');

    // conduit2 messages should be processed by conduit2 receivers
    expect((response2_1.result as any).conduit).toBe('conduit2');
    expect((response2_2.result as any).conduit).toBe('conduit2');

    // Messages on same conduit should be handled by same receiver (topic ownership)
    expect((response1_1.result as any).receiver).toBe((response1_2.result as any).receiver);
    expect((response2_1.result as any).receiver).toBe((response2_2.result as any).receiver);

    // Cleanup
    await receiver1a.stop();
    await receiver1b.stop();
    await receiver2a.stop();
    await receiver2b.stop();
    await sender1.close();
    await sender2.close();
  });

  it('should allow default conduitId to work alongside custom conduitIds', async () => {
    // Create one conduit with default ID and one with custom ID
    const defaultConduit = createConduit(); // Uses 'default'
    const customConduit = createConduit(createMemoryConduit('custom'));
    conduits.push(defaultConduit, customConduit);

    // Create receivers
    const defaultReceiver = defaultConduit.createReceiver(async (_topic, payload) => {
      return { conduit: 'default', payload };
    });

    const customReceiver = customConduit.createReceiver(async (_topic, payload) => {
      return { conduit: 'custom', payload };
    });

    await defaultReceiver.start();
    await customReceiver.start();

    const defaultSender = defaultConduit.createSender();
    const customSender = customConduit.createSender();

    // Send messages
    const defaultResponse = await defaultSender.send('topic', 'default-msg');
    const customResponse = await customSender.send('topic', 'custom-msg');

    // Verify isolation
    expect(defaultResponse.result).toEqual({ conduit: 'default', payload: 'default-msg' });
    expect(customResponse.result).toEqual({ conduit: 'custom', payload: 'custom-msg' });

    // Cleanup
    await defaultReceiver.stop();
    await customReceiver.stop();
    await defaultSender.close();
    await customSender.close();
  });
});
