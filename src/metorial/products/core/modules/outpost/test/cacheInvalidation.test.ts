import { beforeEach, describe, expect, it, vi } from 'vitest';

let listeners = new Map<string, ((event: any) => Promise<void>)[]>();

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: (event: string, handler: any) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    },
    fire: vi.fn()
  }
}));

let clears: { cache: string; tag: string }[] = [];
let cache = (name: string) => ({
  clearByTag: async (tag: string) => {
    clears.push({ cache: name, tag });
  }
});

vi.mock('../src/lib/cache', async () => {
  let actual = await vi.importActual<any>('../src/lib/cache');

  return {
    ...actual,
    cachedCredentialLookup: cache('credentialLookup'),
    cachedInstanceAuthorization: cache('instanceAuthorization'),
    cachedManifest: cache('manifest'),
    cachedVerificationKey: cache('verificationKey')
  };
});
vi.mock('@metorial/cache', () => ({ createCachedFunction: () => vi.fn() }));
vi.mock('@metorial/db', () => ({ db: {} }));
vi.mock('../src/services/outpostInstance', () => ({ outpostInstanceService: {} }));
vi.mock('../src/services/outpostTokenKeyPair', () => ({ outpostTokenKeyPairService: {} }));

const { registerOutpostCacheInvalidation } =
  await import('../src/listeners/cacheInvalidation');

registerOutpostCacheInvalidation();

let fire = async (event: string, payload: any) => {
  for (let handler of listeners.get(event) ?? []) await handler(payload);
};

let tagsClearedIn = (name: string) =>
  clears.filter(clear => clear.cache == name).map(clear => clear.tag);

describe('outpost cache invalidation', () => {
  beforeEach(() => {
    clears = [];
  });

  it('clears every outpost-scoped cache when an outpost changes', async () => {
    await fire('outpost.updated:after', { outpost: { id: 'otp_1' } });

    expect(clears).toEqual([
      { cache: 'credentialLookup', tag: 'outpost:otp_1' },
      { cache: 'instanceAuthorization', tag: 'outpost:otp_1' },
      { cache: 'manifest', tag: 'outpost:otp_1' }
    ]);
  });

  /**
   * The point of tagging instance-authorization entries with the credential id: revoking one
   * credential has to lock out every instance that registered with it, not just its own lookup.
   */
  it.each([
    'outpost_credential.disabled:after',
    'outpost_credential.deleted:after',
    'outpost_credential.expired:after'
  ])('cascades %s to every instance registered with that credential', async event => {
    await fire(event, { credential: { id: 'otc_1' } });

    expect(clears).toEqual([
      { cache: 'credentialLookup', tag: 'outpost_credential:otc_1' },
      { cache: 'instanceAuthorization', tag: 'outpost_credential:otc_1' }
    ]);
  });

  it('clears the manifest when access grants change', async () => {
    await fire('outpost_access.updated:after', { outpost: { id: 'otp_1' } });

    expect(tagsClearedIn('manifest')).toEqual(['outpost_access:otp_1']);
    expect(tagsClearedIn('instanceAuthorization')).toEqual(['outpost:otp_1']);
  });

  it.each([
    'outpost_instance.registered:after',
    'outpost_instance.deactivated:after',
    'outpost_instance.deleted:after'
  ])('clears the instance authorization entry on %s', async event => {
    await fire(event, {
      outpost: { id: 'otp_1' },
      instance: { identifier: 'oti_789' }
    });

    expect(clears).toEqual([
      { cache: 'instanceAuthorization', tag: 'outpost_instance:otp_1:oti_789' }
    ]);
  });

  it.each(['outpost_token_key_pair.replaced:after', 'outpost_token_key_pair.expired:after'])(
    'clears the verification key on %s',
    async event => {
      await fire(event, { keyPair: { id: 'otkp_1' } });

      expect(clears).toEqual([
        { cache: 'verificationKey', tag: 'outpost_token_key_pair:otkp_1' }
      ]);
    }
  );
});
