import { describe, expect, it } from 'vitest';
import { retryOnOidCollision } from './retryOnOidCollision';

describe('retryOnOidCollision', () => {
  it('returns the result of the first successful write', async () => {
    let calls = 0;

    let result = await retryOnOidCollision(async () => {
      calls++;
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries when the write fails with a unique constraint error', async () => {
    let calls = 0;

    let result = await retryOnOidCollision(async () => {
      calls++;
      if (calls < 3) throw { code: 'P2002' };
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('rethrows after the maximum number of attempts', async () => {
    let calls = 0;

    await expect(
      retryOnOidCollision(
        async () => {
          calls++;
          throw { code: 'P2002' };
        },
        { maxAttempts: 2 }
      )
    ).rejects.toEqual({ code: 'P2002' });

    expect(calls).toBe(2);
  });

  it('does not retry other errors', async () => {
    let calls = 0;

    await expect(
      retryOnOidCollision(async () => {
        calls++;
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(calls).toBe(1);
  });
});
