import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  dbMock,
  remoteAuthorizationMock,
  delegatedAuthorizationMock,
  recordEventMock,
  lockState
} = vi.hoisted(() => ({
  dbMock: {
    $transaction: vi.fn(),
    serverOAuthSetup: {
      findFirst: vi.fn(),
      update: vi.fn()
    }
  },
  remoteAuthorizationMock: {
    startAuthorization: vi.fn(),
    resumeAuthorization: vi.fn()
  },
  delegatedAuthorizationMock: {
    startAuthorization: vi.fn(),
    resumeAuthorization: vi.fn()
  },
  recordEventMock: vi.fn(),
  lockState: {
    tail: Promise.resolve() as Promise<void>
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({
    usingLock: async (_keys: string[], fn: () => Promise<unknown>) => {
      let previous = lockState.tail;
      let release!: () => void;
      lockState.tail = new Promise<void>(resolve => {
        release = resolve;
      });

      await previous;
      try {
        return await fn();
      } finally {
        release();
      }
    }
  })
}));

vi.mock('../../db', () => ({ db: dbMock }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('./remote', () => ({ remoteOauthAuthorizationService: remoteAuthorizationMock }));
vi.mock('./delegated', () => ({
  delegatedOauthAuthorizationService: delegatedAuthorizationMock
}));
vi.mock('./serverEvent', () => ({
  serverEventService: { recordServerOAuthSetupEvent: recordEventMock }
}));
vi.mock('./serverOAuthCredentials', () => ({ serverOAuthCredentialsService: {} }));

import { serverOAuthSetupService } from './serverOAuthSetup';

let createRemoteSetup = () => ({
  oid: 1n,
  id: 'csos_test',
  status: 'pending',
  type: 'remote',
  redirectUri: 'https://subspace.example.com/oauth-setup/callback',
  callbackUrlOverride: null,
  remoteOAuthConnectionSetupOid: null as bigint | null,
  remoteOAuthConnectionSetup: null as any,
  delegatedOAuthConnectionSetup: null,
  serverInstanceConfiguration: null,
  credentials: {
    remoteConnection: {
      oid: 2n,
      status: 'active',
      discoveryStatus: 'succeeded',
      config: { config: {}, scopes: [] }
    },
    delegatedConnection: null
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  lockState.tail = Promise.resolve();
  dbMock.$transaction.mockImplementation(async callback => await callback(dbMock));
});

describe('serverOAuthSetupService.consumeServerOAuthSetup', () => {
  it('rejects an unknown setup', async () => {
    dbMock.serverOAuthSetup.findFirst.mockResolvedValue(null);

    await expect(
      serverOAuthSetupService.consumeServerOAuthSetup({
        serverOAuthSetupId: 'csos_missing'
      })
    ).rejects.toThrow();
  });

  it('rejects a setup without an OAuth connection', async () => {
    let setup = createRemoteSetup();
    setup.credentials.remoteConnection = null as any;
    dbMock.serverOAuthSetup.findFirst.mockResolvedValue(setup);

    await expect(
      serverOAuthSetupService.consumeServerOAuthSetup({
        serverOAuthSetupId: setup.id
      })
    ).rejects.toThrow('OAuth setup not configured');
  });

  it('resumes a pending remote authorization without creating another attempt', async () => {
    let setup = createRemoteSetup();
    let innerSetup = {
      oid: 3n,
      status: 'pending',
      stateIdentifier: 'oauth-state',
      codeVerifier: 'pkce-verifier',
      tenant: { oid: 4n }
    };

    dbMock.serverOAuthSetup.findFirst.mockImplementation(async () => setup);
    dbMock.serverOAuthSetup.update.mockImplementation(async () => {
      setup.remoteOAuthConnectionSetupOid = innerSetup.oid;
      setup.remoteOAuthConnectionSetup = innerSetup;
      return setup;
    });
    remoteAuthorizationMock.startAuthorization.mockResolvedValue({
      setup: innerSetup,
      redirectUrl: 'https://provider.example.com/authorize'
    });
    remoteAuthorizationMock.resumeAuthorization.mockResolvedValue({
      setup: innerSetup,
      redirectUrl: 'https://provider.example.com/authorize'
    });

    let first = await serverOAuthSetupService.consumeServerOAuthSetup({
      serverOAuthSetupId: setup.id
    });
    let second = await serverOAuthSetupService.consumeServerOAuthSetup({
      serverOAuthSetupId: setup.id
    });

    expect(first).toEqual({
      url: 'https://provider.example.com/authorize',
      state: 'oauth-state'
    });
    expect(second).toEqual(first);
    expect(remoteAuthorizationMock.startAuthorization).toHaveBeenCalledTimes(1);
    expect(remoteAuthorizationMock.resumeAuthorization).toHaveBeenCalledTimes(1);
    expect(recordEventMock).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent starts so only one authorization attempt is created', async () => {
    let setup = createRemoteSetup();
    let innerSetup = {
      oid: 3n,
      status: 'pending',
      stateIdentifier: 'oauth-state',
      codeVerifier: null,
      tenant: { oid: 4n }
    };

    dbMock.serverOAuthSetup.findFirst.mockImplementation(async () => setup);
    dbMock.serverOAuthSetup.update.mockImplementation(async () => {
      setup.remoteOAuthConnectionSetupOid = innerSetup.oid;
      setup.remoteOAuthConnectionSetup = innerSetup;
      return setup;
    });
    remoteAuthorizationMock.startAuthorization.mockResolvedValue({
      setup: innerSetup,
      redirectUrl: 'https://provider.example.com/authorize'
    });
    remoteAuthorizationMock.resumeAuthorization.mockResolvedValue({
      setup: innerSetup,
      redirectUrl: 'https://provider.example.com/authorize'
    });

    await Promise.all([
      serverOAuthSetupService.consumeServerOAuthSetup({ serverOAuthSetupId: setup.id }),
      serverOAuthSetupService.consumeServerOAuthSetup({ serverOAuthSetupId: setup.id })
    ]);

    expect(remoteAuthorizationMock.startAuthorization).toHaveBeenCalledTimes(1);
    expect(remoteAuthorizationMock.resumeAuthorization).toHaveBeenCalledTimes(1);
    expect(recordEventMock).toHaveBeenCalledTimes(1);
  });

  it.each(['completed', 'failed'] as const)(
    'redirects a %s setup through its upstream callback',
    async status => {
      let setup = { ...createRemoteSetup(), status };
      dbMock.serverOAuthSetup.findFirst.mockResolvedValue(setup);

      await expect(
        serverOAuthSetupService.consumeServerOAuthSetup({
          serverOAuthSetupId: setup.id
        })
      ).resolves.toEqual({
        url: setup.redirectUri,
        state: null
      });

      expect(remoteAuthorizationMock.startAuthorization).not.toHaveBeenCalled();
      expect(remoteAuthorizationMock.resumeAuthorization).not.toHaveBeenCalled();
    }
  );
});
