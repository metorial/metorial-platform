import { describe, expect, test } from 'vitest';
import { createConduit, isConduitHealthPong } from '../../src/index';

describe('Direct per-receiver health ping', () => {
  test('a running receiver answers a health ping with a pong', async () => {
    let conduit = createConduit();

    let receiver = conduit.createReceiver(async (_topic, payload) => ({ echo: payload }));
    await receiver.start();

    let sender = conduit.createSender();

    let response = await sender.pingReceiver(receiver.getReceiverId(), 2000);

    expect(response.success).toBe(true);
    expect(isConduitHealthPong(response.result)).toBe(true);
    if (isConduitHealthPong(response.result)) {
      expect(response.result.receiverId).toBe(receiver.getReceiverId());
    }

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('the health ping bypasses the user handler', async () => {
    let conduit = createConduit();

    let handlerCalls = 0;
    let receiver = conduit.createReceiver(async () => {
      handlerCalls++;
      return {};
    });
    await receiver.start();

    let sender = conduit.createSender();
    await sender.pingReceiver(receiver.getReceiverId(), 2000);

    expect(handlerCalls).toBe(0);

    await sender.close();
    await receiver.stop();
    await conduit.close();
  }, 15000);

  test('pinging an unknown receiver times out', async () => {
    let conduit = createConduit();

    let sender = conduit.createSender();

    await expect(sender.pingReceiver('receiver-does-not-exist', 300)).rejects.toThrow();

    await sender.close();
    await conduit.close();
  }, 15000);
});
