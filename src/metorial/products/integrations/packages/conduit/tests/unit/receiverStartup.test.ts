import { describe, expect, test, vi } from 'vitest';
import { MemoryCoordination, MemoryTransport, Receiver } from '../../src';
import { DEFAULT_CONFIG } from '../../src/types/config';

describe('Receiver startup', () => {
  test('rolls back a failed subscription so startup can be retried', async () => {
    let coordination = new MemoryCoordination();
    let transport = new MemoryTransport();
    let originalSubscribe = transport.subscribe.bind(transport);
    let subscribe = vi.spyOn(transport, 'subscribe');

    subscribe.mockRejectedValueOnce(new Error('temporary subscription failure'));
    subscribe.mockImplementation((...args) => originalSubscribe(...args));

    let receiver = new Receiver(
      coordination,
      transport,
      DEFAULT_CONFIG.receiver,
      async () => ({ ok: true })
    );

    await expect(receiver.start()).rejects.toThrow('temporary subscription failure');
    expect(receiver.isRunning()).toBe(false);
    expect(receiver.isReady()).toBe(false);

    await expect(receiver.start()).resolves.toBeUndefined();
    expect(receiver.isRunning()).toBe(true);
    expect(receiver.isReady()).toBe(true);

    await receiver.stop();
    await coordination.close();
    await transport.close();
  });

  test('rolls back a failed registration so startup can be retried', async () => {
    let coordination = new MemoryCoordination();
    let transport = new MemoryTransport();
    let originalRegister = coordination.registerReceiver.bind(coordination);
    let register = vi.spyOn(coordination, 'registerReceiver');

    register.mockRejectedValueOnce(new Error('temporary registration failure'));
    register.mockImplementation((...args) => originalRegister(...args));

    let receiver = new Receiver(
      coordination,
      transport,
      DEFAULT_CONFIG.receiver,
      async () => ({ ok: true })
    );

    await expect(receiver.start()).rejects.toThrow('temporary registration failure');
    expect(receiver.isRunning()).toBe(false);
    expect(receiver.isReady()).toBe(false);

    await expect(receiver.start()).resolves.toBeUndefined();
    expect(receiver.isRunning()).toBe(true);
    expect(receiver.isReady()).toBe(true);

    await receiver.stop();
    await coordination.close();
    await transport.close();
  });
});
