import { badRequestError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { getSlateInstanceAuth, decrypt, captureException } = vi.hoisted(() => ({
  getSlateInstanceAuth: vi.fn(),
  decrypt: vi.fn(),
  captureException: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({ getSentry: () => ({ captureException }) }));
vi.mock('../../services/slateInstanceAuthHandler', () => ({
  slateAuthHandlerService: { getSlateInstanceAuth }
}));
vi.mock('../../services/secret', () => ({
  secretService: { DANGEROUSLY_decryptSecret: decrypt }
}));

import { resolveTriggerAuth } from './_triggerAuth';

let tenant = { oid: 1n, id: 'tenant' } as any;
let slateInstance = { oid: 2n, id: 'instance' } as any;
let authConfig = { id: 'auth', secretOid: 3n, authMethod: { key: 'oauth' } } as any;

beforeEach(() => vi.resetAllMocks());

describe('resolveTriggerAuth', () => {
  it('uses the refreshing auth handler with an expiry buffer', async () => {
    getSlateInstanceAuth.mockResolvedValue({
      authMethod: { key: 'oauth' },
      output: { token: 'fresh' }
    });

    await expect(
      resolveTriggerAuth({ tenant, slateInstance, authConfig, note: 'poll' })
    ).resolves.toEqual({ authenticationMethodId: 'oauth', data: { token: 'fresh' } });
    expect(getSlateInstanceAuth).toHaveBeenCalledWith({
      tenant,
      slateInstance,
      authConfigId: 'auth',
      minExpirationBuffer: 5 * 60 * 1000
    });
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('passes a caller-specific refresh buffer', async () => {
    getSlateInstanceAuth.mockResolvedValue({ authMethod: { key: 'oauth' }, output: {} });

    await resolveTriggerAuth({
      tenant,
      slateInstance,
      authConfig,
      note: 'gateway',
      minExpirationBuffer: 10 * 60 * 1000
    });
    expect(getSlateInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({ minExpirationBuffer: 10 * 60 * 1000 })
    );
  });

  it('returns null without an auth config', async () => {
    await expect(
      resolveTriggerAuth({ tenant, slateInstance, authConfig: null, note: 'poll' })
    ).resolves.toBeNull();
    expect(getSlateInstanceAuth).not.toHaveBeenCalled();
  });

  it('falls back to the stored credentials when the refresh is refused', async () => {
    let warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getSlateInstanceAuth.mockRejectedValue(
      new ServiceError(
        badRequestError({ code: 'authentication_expired', message: 'Expired.' })
      )
    );
    decrypt.mockResolvedValue({ output: { token: 'stored' } });

    await expect(
      resolveTriggerAuth({ tenant, slateInstance, authConfig, note: 'poll' })
    ).resolves.toEqual({ authenticationMethodId: 'oauth', data: { token: 'stored' } });
    expect(decrypt).toHaveBeenCalledWith(
      expect.objectContaining({ secretOid: 3n, note: 'poll' })
    );
    expect(warned).toHaveBeenCalledWith(expect.stringContaining('authentication_expired'));
    expect(captureException).not.toHaveBeenCalled();

    warned.mockRestore();
  });

  it('reports an unexpected refresh failure before falling back', async () => {
    let logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fault = new Error('connection terminated');
    getSlateInstanceAuth.mockRejectedValue(fault);
    decrypt.mockResolvedValue({ output: { token: 'stored' } });

    await expect(
      resolveTriggerAuth({ tenant, slateInstance, authConfig, note: 'poll' })
    ).resolves.toEqual({ authenticationMethodId: 'oauth', data: { token: 'stored' } });
    expect(captureException).toHaveBeenCalledWith(fault, {
      extra: { authConfigId: 'auth', note: 'poll' }
    });

    logged.mockRestore();
  });
});
