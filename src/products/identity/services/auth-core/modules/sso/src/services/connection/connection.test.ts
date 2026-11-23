import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    ssoTenant: { update: vi.fn() },
    ssoConnection: { create: vi.fn() }
  },
  createSAMLConnection: vi.fn(),
  createOIDCConnection: vi.fn(),
  getConnections: vi.fn(),
  fetchSsoMetadata: vi.fn(),
  assertSsoUrlReachable: vi.fn(),
  network: { allowsPrivate: false }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@mtsrc/auth-core-db', () => ({
  db: mocks.db,
  getId: vi.fn((type: string) => ({ oid: 100n, id: `${type}_generated` }))
}));

vi.mock('@mtsrc/auth-core-sso-protocol', () => ({
  getSamlConnectionDefaultRedirectUrl: () => 'https://sso.example.test/sso/jxn/saml/callback'
}));

vi.mock('../../queues/disableSsoDirectoryUsers', () => ({
  enqueueDisableSsoDirectoryUsers: vi.fn()
}));

vi.mock('../../lib/jackson', () => ({
  jackson: {
    apiController: {
      createSAMLConnection: mocks.createSAMLConnection,
      createOIDCConnection: mocks.createOIDCConnection,
      getConnections: mocks.getConnections
    },
    redirectUrl: 'https://sso.example.test/*',
    defaultRedirectUrl: {
      saml: 'https://sso.example.test/sso/jxn/saml/callback',
      oidc: 'https://sso.example.test/sso/jxn/oidc/callback'
    }
  }
}));

vi.mock('../../lib/ssoFetch', () => ({
  fetchSsoMetadata: mocks.fetchSsoMetadata,
  assertSsoUrlReachable: mocks.assertSsoUrlReachable,
  get ssoAllowsPrivateNetworks() {
    return mocks.network.allowsPrivate;
  }
}));

import { ssoConnectionService } from './connection';

let tenant = { oid: 6n, id: 'stn_1', status: 'completed', importedDelegationOid: null } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.network.allowsPrivate = false;
  mocks.createSAMLConnection.mockResolvedValue({ clientID: 'cid', clientSecret: 'cs' });
  mocks.createOIDCConnection.mockResolvedValue({ clientID: 'cid', clientSecret: 'cs' });
  mocks.db.ssoConnection.create.mockResolvedValue({ id: 'scn_1' });
  mocks.fetchSsoMetadata.mockResolvedValue('<EntityDescriptor/>');
  mocks.assertSsoUrlReachable.mockResolvedValue(undefined);
});

describe('creating a SAML connection', () => {
  it('fetches a metadata URL itself and hands the document to the SAML library', async () => {
    await ssoConnectionService.createSamlConnection({
      tenant,
      input: {
        name: 'Okta',
        provider: 'okta',
        samlMetadata: { type: 'url', url: 'https://idp.example.test/metadata' }
      }
    });

    expect(mocks.fetchSsoMetadata).toHaveBeenCalledWith('https://idp.example.test/metadata');

    let input = mocks.createSAMLConnection.mock.calls[0]![0];
    expect(input.rawMetadata).toBe('<EntityDescriptor/>');
    expect(input.metadataUrl).toBeUndefined();
  });

  it('passes pasted metadata through without fetching', async () => {
    await ssoConnectionService.createSamlConnection({
      tenant,
      input: {
        name: 'Okta',
        provider: 'okta',
        samlMetadata: { type: 'xml', payload: '<EntityDescriptor entityID="x"/>' }
      }
    });

    expect(mocks.fetchSsoMetadata).not.toHaveBeenCalled();
    expect(mocks.createSAMLConnection.mock.calls[0]![0].rawMetadata).toBe(
      '<EntityDescriptor entityID="x"/>'
    );
  });

  it('does not create anything when the metadata URL cannot be fetched', async () => {
    mocks.fetchSsoMetadata.mockRejectedValueOnce(
      new Error('The identity provider address is not reachable from Metorial.')
    );

    await expect(
      ssoConnectionService.createSamlConnection({
        tenant,
        input: {
          name: 'Internal',
          provider: 'saml',
          samlMetadata: { type: 'url', url: 'https://metadata.internal/latest' }
        }
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Could not create SAML connection: .*not reachable/)
    });

    expect(mocks.createSAMLConnection).not.toHaveBeenCalled();
    expect(mocks.db.ssoConnection.create).not.toHaveBeenCalled();
  });
});

describe('creating an OIDC connection', () => {
  let input = {
    name: 'Entra',
    provider: 'oidc',
    oidcDiscoveryUrl: 'https://login.example.test/.well-known/openid-configuration',
    clientId: 'client',
    clientSecret: 'secret'
  };

  it('checks the discovery URL before storing the connection', async () => {
    await ssoConnectionService.createOidcConnection({ tenant, input });

    expect(mocks.assertSsoUrlReachable).toHaveBeenCalledWith(input.oidcDiscoveryUrl);
    expect(mocks.assertSsoUrlReachable.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.createOIDCConnection.mock.invocationCallOrder[0]!
    );
  });

  it('does not create anything when the discovery URL is refused', async () => {
    mocks.assertSsoUrlReachable.mockRejectedValueOnce(
      new Error('The identity provider address is not reachable from Metorial.')
    );

    await expect(
      ssoConnectionService.createOidcConnection({ tenant, input })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Could not create OIDC connection: .*not reachable/)
    });

    expect(mocks.createOIDCConnection).not.toHaveBeenCalled();
    expect(mocks.db.ssoConnection.create).not.toHaveBeenCalled();
  });
});

describe('checking an identity provider before sign-in', () => {
  let connection = { providerType: 'oidc', internalClientId: 'cid' } as const;

  it('checks the stored discovery URL of an OIDC connection', async () => {
    mocks.getConnections.mockResolvedValue([
      {
        oidcProvider: {
          discoveryUrl: 'https://login.example.test/.well-known/openid-configuration'
        }
      }
    ]);

    await ssoConnectionService.assertIdentityProviderReachable({ connection });

    expect(mocks.getConnections).toHaveBeenCalledWith({ clientID: 'cid' });
    expect(mocks.assertSsoUrlReachable.mock.calls).toEqual([
      ['https://login.example.test/.well-known/openid-configuration']
    ]);
  });

  it('checks the server-side endpoints of stored OIDC metadata', async () => {
    mocks.getConnections.mockResolvedValue([
      {
        oidcProvider: {
          metadata: {
            issuer: 'https://login.example.test',
            authorization_endpoint: 'https://login.example.test/authorize',
            token_endpoint: 'https://login.example.test/token',
            userinfo_endpoint: 'https://login.example.test/userinfo',
            jwks_uri: 'https://login.example.test/jwks'
          }
        }
      }
    ]);

    await ssoConnectionService.assertIdentityProviderReachable({ connection });

    expect(mocks.assertSsoUrlReachable.mock.calls.map(call => call[0])).toEqual([
      'https://login.example.test/token',
      'https://login.example.test/userinfo',
      'https://login.example.test/jwks'
    ]);
  });

  it('fails the sign-in when the stored address is refused', async () => {
    mocks.getConnections.mockResolvedValue([
      { oidcProvider: { discoveryUrl: 'https://rebound.example.test/discovery' } }
    ]);
    mocks.assertSsoUrlReachable.mockRejectedValueOnce(new Error('not reachable'));

    await expect(
      ssoConnectionService.assertIdentityProviderReachable({ connection })
    ).rejects.toThrow('not reachable');
  });

  it('skips SAML connections and installations that allow private networks', async () => {
    await ssoConnectionService.assertIdentityProviderReachable({
      connection: { providerType: 'saml', internalClientId: 'cid' }
    });

    mocks.network.allowsPrivate = true;
    await ssoConnectionService.assertIdentityProviderReachable({ connection });

    expect(mocks.getConnections).not.toHaveBeenCalled();
    expect(mocks.assertSsoUrlReachable).not.toHaveBeenCalled();
  });
});
