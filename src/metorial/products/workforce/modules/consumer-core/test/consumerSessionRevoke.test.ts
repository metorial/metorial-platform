import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  oauthAuthorizationFindUniqueOrThrow: vi.fn(),
  consumerSessionUpdate: vi.fn(),
  revokeConsumerOAuthAuthorization: vi.fn(),
  fire: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    oAuthAuthorization: { findUniqueOrThrow: mocks.oauthAuthorizationFindUniqueOrThrow },
    consumerSession: { update: mocks.consumerSessionUpdate }
  },
  ID: { generateId: vi.fn() }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial/consumer-auth', () => ({
  authenticateWithConsumerSessionToken: vi.fn(),
  consumerSessionInclude: {},
  getConsumerAccessContextForSession: vi.fn(),
  getConsumerSessionToken: vi.fn(),
  getConsumerToken: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fire } }));

vi.mock('@metorial/module-machine-access', () => ({
  oauthAuthorizationService: {
    revokeConsumerOAuthAuthorization: mocks.revokeConsumerOAuthAuthorization
  }
}));

vi.mock('../src/services/consumerProfile', () => ({
  consumerProfileService: {}
}));

import { consumerAuthService } from '../src/services/consumerAuth';

let context = { ip: '127.0.0.1', ua: 'test' };
let auditScope = {
  organizationOid: 1n,
  actor: { type: 'consumer_profile', id: 'cop_1' },
  context
};
let consumerProfile = { oid: 88n, id: 'cop_1' };

let createAuthorization = (overrides: Record<string, unknown> = {}) => ({
  oid: 501n,
  id: 'oau_1',
  status: 'active',
  consumerProfile,
  oauthApplication: { type: 'cli_auth' },
  ...overrides
});

describe('consumerAuthService.revokeConsumerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumerSessionUpdate.mockResolvedValue({ id: 'csn_1', loggedOutAt: new Date() });
  });

  it('revokes the linked OAuth authorization of an OAuth-backed session', async () => {
    mocks.oauthAuthorizationFindUniqueOrThrow.mockResolvedValue(createAuthorization());

    await consumerAuthService.revokeConsumerSession({
      session: { oid: 77n, loggedOutAt: null, oauthAuthorizationOid: 501n } as any,
      auditScope: auditScope as any
    });

    expect(mocks.revokeConsumerOAuthAuthorization).toHaveBeenCalledWith({
      consumerProfile,
      oauthAuthorizationId: 'oau_1',
      context
    });
    expect(mocks.consumerSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 77n },
        data: { loggedOutAt: expect.any(Date) }
      })
    );
    expect(mocks.fire).toHaveBeenCalledWith(
      'consumer.session.revoked:after',
      expect.anything()
    );
  });

  it('only logs out service account sessions without revoking the authorization', async () => {
    mocks.oauthAuthorizationFindUniqueOrThrow.mockResolvedValue(
      createAuthorization({ oauthApplication: { type: 'server_side' } })
    );

    await consumerAuthService.revokeConsumerSession({
      session: { oid: 77n, loggedOutAt: null, oauthAuthorizationOid: 501n } as any,
      auditScope: auditScope as any
    });

    expect(mocks.revokeConsumerOAuthAuthorization).not.toHaveBeenCalled();
    expect(mocks.consumerSessionUpdate).toHaveBeenCalled();
  });

  it('leaves regular portal sessions to the plain logout', async () => {
    await consumerAuthService.revokeConsumerSession({
      session: { oid: 77n, loggedOutAt: null, oauthAuthorizationOid: null } as any,
      auditScope: auditScope as any
    });

    expect(mocks.oauthAuthorizationFindUniqueOrThrow).not.toHaveBeenCalled();
    expect(mocks.revokeConsumerOAuthAuthorization).not.toHaveBeenCalled();
    expect(mocks.consumerSessionUpdate).toHaveBeenCalled();
  });
});
