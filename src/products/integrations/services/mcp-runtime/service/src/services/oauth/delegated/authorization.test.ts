import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  dbMock,
  callFunctionMock,
  ensureInvocationMock,
  credentialsMock,
  recordEventMock
} = vi.hoisted(() => ({
  dbMock: {
    delegatedOAuthConnectionSetup: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    serverOAuthSetup: {
      update: vi.fn()
    }
  },
  callFunctionMock: vi.fn(),
  ensureInvocationMock: vi.fn(),
  credentialsMock: vi.fn(),
  recordEventMock: vi.fn()
}));

vi.mock('../../../config', () => ({
  oauthCallbackUrl: 'https://shuttle.example.com/shuttle-oauth/callback'
}));
vi.mock('../../../db', () => ({ db: dbMock }));
vi.mock('../../../lib/function/call', () => ({ callFunction: callFunctionMock }));
vi.mock('../../../lib/oauth/normalizeAuthorizationUrl', () => ({
  normalizeAuthorizationUrl: (url: string) => url
}));
vi.mock('../../functionServerInvocation', () => ({
  functionServerInvocationService: {
    ensureFunctionServerInvocation: ensureInvocationMock
  }
}));
vi.mock('../../secret', () => ({ secretService: {} }));
vi.mock('../serverEvent', () => ({
  serverEventService: { recordServerOAuthSetupEvent: recordEventMock }
}));
vi.mock('./connection', () => ({
  delegatedOAuthConnectionService: {
    DANGEROUSLY_getCredentials: credentialsMock
  }
}));

import { delegatedOauthAuthorizationService } from './authorization';

beforeEach(() => {
  vi.clearAllMocks();
  credentialsMock.mockResolvedValue({
    clientId: 'client-id',
    clientSecret: 'client-secret'
  });
  ensureInvocationMock.mockResolvedValue({
    functionBayInvocationId: 'invocation-id'
  });
});

describe('delegatedOauthAuthorizationService.resumeAuthorization', () => {
  it('requests a new URL with the existing state and persists refreshed auth state', async () => {
    let getOauthAuthorizationUrl = vi.fn().mockResolvedValue(undefined);
    callFunctionMock.mockImplementation(async (_server, _options, callback) => {
      await callback({ getOauthAuthorizationUrl });
      return {
        status: 'success',
        functionCallId: 'function-call-id',
        result: {
          authorizationUrl: 'https://provider.example.com/authorize',
          authState: { nonce: 'refreshed' }
        }
      };
    });

    let setup = {
      oid: 1n,
      id: 'delegated_setup',
      status: 'pending',
      stateIdentifier: 'existing-state',
      authConfigValue: { workspace: 'example' },
      authStateValue: { nonce: 'old' },
      tenant: { oid: 2n },
      connection: {
        oid: 3n,
        status: 'active',
        functionServer: { oid: 4n }
      },
      serverOAuthSetup: {
        oid: 5n,
        callbackUrlOverride: 'https://subspace.example.com/oauth-callback/provider'
      }
    };

    let result = await delegatedOauthAuthorizationService.resumeAuthorization({
      setup: setup as any,
      serverInstanceConfiguration: null
    });

    expect(result.redirectUrl).toBe('https://provider.example.com/authorize');
    expect(getOauthAuthorizationUrl).toHaveBeenCalledWith({
      authConfig: { workspace: 'example' },
      clientId: 'client-id',
      clientSecret: 'client-secret',
      state: 'existing-state',
      redirectUri: 'https://subspace.example.com/oauth-callback/provider'
    });
    expect(dbMock.delegatedOAuthConnectionSetup.updateMany).toHaveBeenCalledWith({
      where: { oid: setup.oid },
      data: { authStateValue: { nonce: 'refreshed' } }
    });
    expect(dbMock.delegatedOAuthConnectionSetup.create).not.toHaveBeenCalled();
  });

  it('rejects an attempt whose callback state was already cleared', async () => {
    await expect(
      delegatedOauthAuthorizationService.resumeAuthorization({
        setup: {
          status: 'pending',
          stateIdentifier: null
        } as any,
        serverInstanceConfiguration: null
      })
    ).rejects.toThrow('OAuth authorization attempt is no longer active');
  });
});
