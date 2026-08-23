import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  tx,
  createSessionRecord,
  archiveSessionInternal,
  assertInternalAdapterSupportedBySession
} = vi.hoisted(() => {
  let createModel = () => ({
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  });

  return {
    tx: {
      adapterIntegrationInstanceProvider: createModel(),
      adapterIntegrationInstanceProviderSession: createModel(),
      adapterIntegrationInstance: createModel(),
      session: createModel()
    },
    createSessionRecord: vi.fn(),
    archiveSessionInternal: vi.fn(),
    assertInternalAdapterSupportedBySession: vi.fn()
  };
});

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({
    usingLock: async (_key: string, fn: () => Promise<any>) => fn()
  })
}));

vi.mock('@lowerdeck/hash', () => ({
  Hash: {
    sha256: vi.fn(async (value: string) => `hash:${value}`)
  }
}));

vi.mock('@lowerdeck/canonicalize', () => ({
  canonicalize: (value: unknown) => JSON.stringify(value)
}));

vi.mock('@metorial-subspace/db', () => ({
  db: tx,
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 900n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

vi.mock('@metorial-subspace/module-session', () => ({
  sessionService: { archiveSessionInternal }
}));

vi.mock('@metorial-subspace/module-session/src/services/_shared/createSession', () => ({
  createSessionRecord
}));

vi.mock('@metorial-subspace/module-session/src/services/_shared/internalAdapter', () => ({
  assertInternalAdapterSupportedBySession
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  buildIntegrationProviderToolFilterChain: vi.fn(() => ({ type: 'v1.allow_all' }))
}));

import {
  archiveAdapterInstanceProviderSessions,
  archiveAdapterInstanceProviderSessionsForInstance,
  resolveAdapterInstanceProviderSession
} from './session';

let tenant = { oid: 1n, projectOid: 11n } as any;
let environment = { oid: 3n, instanceOid: 33n } as any;

let currentVersion = {
  configOid: 50n,
  authConfigOid: 60n,
  toolFilter: null,
  isOverrideToolFilter: false,
  integrationProviderVersion: {
    deploymentOid: 40n,
    toolFilter: null,
    deployment: { id: 'pde_1', oid: 40n }
  },
  config: { id: 'pcf_1', oid: 50n },
  authConfig: { id: 'pac_1', oid: 60n }
};

let makeSession = (overrides: Record<string, unknown> = {}) => ({
  oid: 1000n,
  id: 'ses_current',
  status: 'active',
  isInternal: true,
  adapterGlobalOid: 9n,
  createdAt: new Date(),
  ...overrides
});

let makeProvider = (overrides: Record<string, unknown> = {}) => ({
  oid: 10n,
  id: 'aiip_1',
  status: 'active',
  currentSessionOid: null,
  currentSession: null,
  providerHash: null,
  willRotateAt: null,
  adapterIntegrationInstanceOid: 30n,
  adapterIntegrationOid: 100n,
  tenantOid: 1n,
  projectOid: 11n,
  environmentOid: 3n,
  instanceOid: 33n,
  solutionOid: 2,
  adapterIntegration: {
    oid: 100n,
    status: 'active',
    adapterGlobalOid: 9n,
    adapterGlobal: { oid: 9n, identifier: 'chat' },
    integration: { oid: 20n }
  },
  adapterIntegrationInstance: {
    integrationInstance: {
      identityActorOid: 7n,
      identityOid: 8n
    }
  },
  integrationInstanceProvider: {
    integration: {
      canAttachCustomToolFilters: true,
      canOverrideToolFilters: true
    },
    integrationInstance: {},
    integrationProvider: {},
    currentVersion
  },
  ...overrides
});

describe('adapter instance provider sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.adapterIntegrationInstanceProvider.findUnique.mockResolvedValue(makeProvider());
    tx.adapterIntegrationInstanceProvider.create.mockResolvedValue({});
    tx.adapterIntegrationInstanceProvider.update.mockResolvedValue({});
    tx.adapterIntegrationInstanceProvider.findMany.mockResolvedValue([]);
    tx.adapterIntegrationInstanceProviderSession.create.mockResolvedValue({});
    tx.adapterIntegrationInstanceProviderSession.updateMany.mockResolvedValue({ count: 0 });
    tx.adapterIntegrationInstanceProviderSession.findMany.mockResolvedValue([]);
    tx.adapterIntegrationInstance.findUnique.mockResolvedValue(null);
    tx.session.findUnique.mockResolvedValue(null);
    createSessionRecord.mockResolvedValue(makeSession({ oid: 2000n, id: 'ses_new' }));
    archiveSessionInternal.mockResolvedValue({});
    assertInternalAdapterSupportedBySession.mockResolvedValue(undefined);
  });

  it('creates an internal adapter session on first resolve', async () => {
    let session = await resolveAdapterInstanceProviderSession({
      tenant,
      environment,
      adapterInstanceProvider: { oid: 10n }
    });

    expect(createSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        isInternal: true,
        isEphemeral: false,
        adapterGlobalOid: 9n,
        identityActorOid: 7n,
        identityOid: 8n,
        input: {
          providers: [
            expect.objectContaining({
              deploymentId: 'pde_1',
              configId: 'pcf_1',
              authConfigId: 'pac_1'
            })
          ]
        }
      })
    );
    expect(tx.adapterIntegrationInstanceProviderSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'active',
          adapterIntegrationInstanceProviderOid: 10n,
          sessionOid: 2000n
        })
      })
    );
    expect(tx.adapterIntegrationInstanceProvider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentSessionOid: 2000n,
          willRotateAt: expect.any(Date)
        })
      })
    );
    expect(session.id).toBe('ses_new');
  });

  it('reuses the current session when it is still valid', async () => {
    let current = makeSession();
    tx.adapterIntegrationInstanceProvider.findUnique.mockResolvedValue(
      makeProvider({
        currentSessionOid: current.oid,
        currentSession: current,
        providerHash:
          'hash:{"deploymentOid":"40","configOid":"50","authConfigOid":"60","toolFilter":{"type":"v1.allow_all"}}',
        willRotateAt: new Date(Date.now() + 86_400_000)
      })
    );

    let session = await resolveAdapterInstanceProviderSession({
      tenant,
      environment,
      adapterInstanceProvider: { oid: 10n }
    });

    expect(createSessionRecord).not.toHaveBeenCalled();
    expect(session.oid).toBe(1000n);
  });

  it('rotates when willRotateAt is in the past and keeps history', async () => {
    let current = makeSession();
    tx.adapterIntegrationInstanceProvider.findUnique.mockResolvedValue(
      makeProvider({
        currentSessionOid: current.oid,
        currentSession: current,
        providerHash:
          'hash:{"deploymentOid":"40","configOid":"50","authConfigOid":"60","toolFilter":{"type":"v1.allow_all"}}',
        willRotateAt: new Date(Date.now() - 1000)
      })
    );

    await resolveAdapterInstanceProviderSession({
      tenant,
      environment,
      adapterInstanceProvider: { oid: 10n }
    });

    expect(createSessionRecord).toHaveBeenCalled();
    expect(tx.adapterIntegrationInstanceProviderSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'rotated' })
      })
    );
    expect(archiveSessionInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        session: current,
        _allowInternalDelete: true
      })
    );
  });

  it('rotates when the provider hash changes', async () => {
    let current = makeSession();
    tx.adapterIntegrationInstanceProvider.findUnique.mockResolvedValue(
      makeProvider({
        currentSessionOid: current.oid,
        currentSession: current,
        providerHash: 'old-hash',
        willRotateAt: new Date(Date.now() + 86_400_000)
      })
    );

    await resolveAdapterInstanceProviderSession({
      tenant,
      environment,
      adapterInstanceProvider: { oid: 10n }
    });

    expect(createSessionRecord).toHaveBeenCalled();
    expect(archiveSessionInternal).toHaveBeenCalled();
  });

  it('archives tracked sessions when the adapter instance provider is archived', async () => {
    let current = makeSession();
    tx.adapterIntegrationInstanceProvider.findUnique.mockResolvedValue({
      oid: 10n,
      currentSessionOid: current.oid
    });
    tx.adapterIntegrationInstanceProviderSession.findMany.mockResolvedValue([
      { sessionOid: current.oid, session: current }
    ]);

    await archiveAdapterInstanceProviderSessions({
      tenant,
      environment,
      adapterInstanceProvider: { oid: 10n }
    });

    expect(tx.adapterIntegrationInstanceProviderSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'archived' })
      })
    );
    expect(tx.adapterIntegrationInstanceProvider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentSessionOid: null,
          willRotateAt: null
        })
      })
    );
    expect(archiveSessionInternal).toHaveBeenCalledWith(
      expect.objectContaining({ session: current })
    );
  });

  it('archives sessions for archived instance providers on an adapter instance', async () => {
    tx.adapterIntegrationInstance.findUnique.mockResolvedValue({
      oid: 30n,
      tenant,
      environment
    });
    tx.adapterIntegrationInstanceProvider.findMany.mockResolvedValue([
      { oid: 10n, status: 'archived' }
    ]);
    tx.adapterIntegrationInstanceProvider.findUnique.mockResolvedValue({
      oid: 10n,
      currentSessionOid: null
    });

    await archiveAdapterInstanceProviderSessionsForInstance({ adapterInstanceOid: 30n });

    expect(tx.adapterIntegrationInstanceProviderSession.updateMany).toHaveBeenCalled();
  });
});
