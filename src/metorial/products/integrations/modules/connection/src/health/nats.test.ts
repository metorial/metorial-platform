import { describe, expect, it, vi } from 'vitest';
import { checkNatsHealth, NatsHealthError, type NatsHealthConnection } from './nats';

describe('checkNatsHealth', () => {
  it('flushes the NATS connection', async () => {
    let flush = vi.fn(async () => {});
    let connection = { flush } satisfies NatsHealthConnection;

    await checkNatsHealth({ connection });

    expect(flush).toHaveBeenCalledOnce();
  });

  it('wraps NATS flush failures in NatsHealthError', async () => {
    let connection = {
      flush: async () => {
        throw new Error('nats unavailable');
      }
    } satisfies NatsHealthConnection;

    await expect(checkNatsHealth({ connection })).rejects.toBeInstanceOf(NatsHealthError);
    await expect(checkNatsHealth({ connection })).rejects.toThrow('nats unavailable');
  });
});
