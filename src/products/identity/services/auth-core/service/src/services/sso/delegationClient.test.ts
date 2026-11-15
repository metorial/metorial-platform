import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertDelegationSnapshot,
  DelegationRemoteError,
  ssoDelegationClient
} from './delegationClient';

vi.mock('@lowerdeck/delay', () => ({ delay: vi.fn() }));

let identitySnapshot = {
  active: true,
  type: 'identity',
  delegation: { id: 'sed_1', clientId: 'client_1' },
  instance: {
    id: 'ari_1',
    authorizationUrl: 'https://regional.example/authorize',
    tokenUrl: 'https://regional.example/token'
  },
  tenant: {
    id: 'stn_1',
    name: 'Tenant',
    status: 'completed',
    externalId: null,
    metadata: null,
    hideInUI: false
  },
  connections: [],
  connection: {
    id: 'scn_1',
    status: 'active',
    providerType: 'oidc',
    providerName: null,
    name: 'Connection',
    metadata: null
  },
  userProfile: {
    email: 'user@example.com',
    uid: 'user',
    uidHash: 'hash',
    sub: null,
    firstName: 'User',
    lastName: 'Example',
    roles: [],
    groups: [],
    raw: {}
  }
};

describe('delegation client snapshot validation', () => {
  it('requires an identity connection ID', () => {
    let snapshot = structuredClone(identitySnapshot);
    delete (snapshot.connection as { id?: string }).id;

    expect(() => assertDelegationSnapshot(snapshot)).toThrow(
      'Delegation returned an invalid identity'
    );
  });
});

let descriptor = {
  id: 'sed_1',
  tenantId: 'stn_1',
  clientId: 'client_1',
  clientSecret: 'secret_1',
  instance: {
    id: 'ari_1',
    authorizationUrl: 'https://regional.example/authorize',
    tokenUrl: 'https://regional.example/token'
  }
};

let imported = {
  clientId: descriptor.clientId,
  clientSecret: descriptor.clientSecret,
  remoteInstance: {
    tokenUrl: descriptor.instance.tokenUrl
  },
  localExportedDelegation: null
} as any;

let jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

describe('delegation client retries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('retries transient metadata and introspection failures', async () => {
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token_1' }))
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(jsonResponse(identitySnapshot));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      ssoDelegationClient.getMetadataFromDescriptor(descriptor, {
        isSelfDelegation: false
      })
    ).resolves.toEqual(identitySnapshot);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry permanent client errors', async () => {
    let fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_client' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      ssoDelegationClient.getMetadataFromDescriptor(descriptor, {
        isSelfDelegation: false
      })
    ).rejects.toBeInstanceOf(DelegationRemoteError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not retry one-time authorization code exchanges', async () => {
    let fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'unavailable' }, 503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      ssoDelegationClient.exchangeCode({
        imported,
        code: 'code_1',
        redirectUri: 'https://id.metorial.com/callback'
      })
    ).rejects.toBeInstanceOf(DelegationRemoteError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
