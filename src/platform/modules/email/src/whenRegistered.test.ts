import { describe, expect, it } from 'vitest';
import { RelayRegistrationTimeoutError, whenRegistered } from './whenRegistered';

describe('whenRegistered', () => {
  it('returns the registered value', async () => {
    await expect(whenRegistered(Promise.resolve({ id: 'sender_1' }))).resolves.toEqual({
      id: 'sender_1'
    });
  });

  it('rejects instead of waiting forever when registration never completes', async () => {
    await expect(whenRegistered(new Promise(() => {}), 20)).rejects.toBeInstanceOf(
      RelayRegistrationTimeoutError
    );
  });

  it('passes through a registration failure', async () => {
    await expect(whenRegistered(Promise.reject(new Error('boom')), 1000)).rejects.toThrow(
      'boom'
    );
  });
});
