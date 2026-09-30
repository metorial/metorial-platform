import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerAuthCredentialsCreate: vi.fn(),
  providerAuthCredentialsFindMany: vi.fn(),
  providerAuthCredentialsUpdate: vi.fn(),
  providerAuthCredentialsUpdateMany: vi.fn(),
  addAfterTransactionHook: vi.fn(),
  queueAdd: vi.fn(),
  backendCreateProviderAuthCredentials: vi.fn(),
  backendGetScopes: vi.fn(),
  resolveAuthMethodsGlobal: vi.fn(),
  resolveProviders: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: vi.fn(() => ({ usingLock: (_keys: unknown, fn: () => unknown) => fn() }))
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(factory => ({
      run: (_query?: object) => factory({ prisma: (fn: (opts: object) => unknown) => fn({}) })
    })),
    validate: vi.fn()
  }
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    providerAuthCredentials: {
      create: mocks.providerAuthCredentialsCreate,
      update: mocks.providerAuthCredentialsUpdate,
      updateMany: mocks.providerAuthCredentialsUpdateMany,
      findFirst: vi.fn(),
      findMany: mocks.providerAuthCredentialsFindMany,
      findUniqueOrThrow: vi.fn()
    },
    managedProviderAuthCredentials: { findFirstOrThrow: vi.fn(), findFirst: vi.fn() },
    managedProviderAuthCredentialsBacking: { findFirstOrThrow: vi.fn(), findFirst: vi.fn() },
    integrationProvider: { findFirst: vi.fn() }
  };

  return {
    db,
    withTransaction: (fn: (tx: typeof db) => unknown) => fn(db),
    addAfterTransactionHook: mocks.addAfterTransactionHook,
    getId: (prefix: string) => ({ oid: 1n, id: `${prefix}_test` })
  };
});

vi.mock('@metorial-subspace/list-utils', () => ({
  assertNoActiveIntegrationInstanceProviderAuthCredentialsLink: vi.fn(),
  checkDeletedEdit: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} })),
  resolveAuthMethodsGlobal: mocks.resolveAuthMethodsGlobal,
  resolveProviders: mocks.resolveProviders
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { providerAuthCredentials: { id: 'idx' } },
  voyagerSource: Promise.resolve({ id: 'src' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' })),
  resolveMetorialFacing: vi.fn(),
  resolveMetorialFacingWithOptionalActor: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn(async () => ({
    backend: { oid: 60n },
    auth: {
      createProviderAuthCredentials: mocks.backendCreateProviderAuthCredentials,
      getProviderAuthCredentialsScopes: mocks.backendGetScopes
    }
  }))
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../lib/managedProviderAuthCredentialsBacking', () => ({
  ensureManagedProviderAuthCredentialsBacking: vi.fn()
}));

vi.mock('../queues/lifecycle/providerAuthCredentials', () => ({
  providerAuthCredentialsArchivedQueue: { add: mocks.queueAdd },
  providerAuthCredentialsCreatedQueue: { add: mocks.queueAdd },
  providerAuthCredentialsUpdatedQueue: { add: mocks.queueAdd }
}));

import { db } from '@metorial-subspace/db';
import { ensureManagedProviderAuthCredentialsBacking } from '../lib/managedProviderAuthCredentialsBacking';
import { providerAuthCredentialsService } from './providerAuthCredentials';

let makeParams = ({
  projectOid = 20n as bigint | null,
  instanceOid = 40n as bigint | null
} = {}) => ({
  tenant: { oid: 10n, projectOid } as any,
  environment: { oid: 30n, instanceOid } as any,
  provider: {
    oid: 50n,
    defaultVariant: { oid: 51n, backendOid: 60n },
    type: {
      attributes: { auth: { oauth: { oauthAutoRegistration: { status: 'supported' } } } }
    }
  } as any,
  input: {
    config: {
      type: 'oauth' as const,
      clientId: 'client',
      clientSecret: 'secret',
      scopes: ['read']
    }
  }
});

describe('createProviderAuthCredentialsInternal double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backendCreateProviderAuthCredentials.mockResolvedValue({
      type: 'oauth',
      isAutoRegistration: false,
      slateOAuthCredentials: undefined,
      shuttleOAuthCredentials: undefined
    });
    mocks.backendGetScopes.mockResolvedValue({ scopes: ['read'] });
    mocks.providerAuthCredentialsCreate.mockResolvedValue({
      oid: 100n,
      id: 'pacr_1',
      backendOid: 60n,
      isDefault: false
    });
    mocks.providerAuthCredentialsUpdate.mockResolvedValue({ oid: 100n, id: 'pacr_1' });
  });

  it('mirrors the tenant project and environment instance onto the credentials', async () => {
    await providerAuthCredentialsService.createProviderAuthCredentialsInternal(
      makeParams() as any
    );

    expect(mocks.providerAuthCredentialsCreate).toHaveBeenCalledTimes(1);
    expect(mocks.providerAuthCredentialsCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('keeps the mirrored oids null while the tenant is not linked yet', async () => {
    await providerAuthCredentialsService.createProviderAuthCredentialsInternal(
      makeParams({ projectOid: null, instanceOid: null }) as any
    );

    expect(mocks.providerAuthCredentialsCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: null,
      environmentOid: 30n,
      instanceOid: null
    });
  });

  it('does not add project or instance filters to the default-credentials cleanup', async () => {
    mocks.providerAuthCredentialsCreate.mockResolvedValue({
      oid: 100n,
      id: 'pacr_1',
      backendOid: 60n,
      isDefault: true
    });

    await providerAuthCredentialsService.createProviderAuthCredentialsInternal(
      makeParams() as any
    );

    expect(mocks.providerAuthCredentialsUpdateMany).toHaveBeenCalledTimes(1);
    let where = mocks.providerAuthCredentialsUpdateMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ tenantOid: 10n, environmentOid: 30n });
    expect(where).not.toHaveProperty('projectOid');
    expect(where).not.toHaveProperty('instanceOid');
  });

  it('requests default credential reuse only for default auto-registration', async () => {
    let params = makeParams() as any;
    params.isDefault = true;
    params.input.config = { type: 'auto_registration' };

    await providerAuthCredentialsService.createProviderAuthCredentialsInternal(params);

    expect(mocks.backendCreateProviderAuthCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ reuseDefaultCredentials: true })
    );
  });

  it('does not request default credential reuse for explicit credentials', async () => {
    let params = makeParams() as any;
    params.isDefault = true;

    await providerAuthCredentialsService.createProviderAuthCredentialsInternal(params);

    expect(mocks.backendCreateProviderAuthCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ reuseDefaultCredentials: false })
    );
  });
});

describe('listProviderAuthCredentialsInternal auth method filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveProviders.mockResolvedValue(undefined);
    mocks.resolveAuthMethodsGlobal.mockResolvedValue({
      oids: [70n],
      in: { in: [70n] },
      oidIn: { oid: { in: [70n] } }
    });
    mocks.providerAuthCredentialsFindMany.mockResolvedValue([]);
  });

  it('matches managed credentials through their global family, including legacy rows', async () => {
    let paginator = await providerAuthCredentialsService.listProviderAuthCredentialsInternal({
      tenant: { oid: 10n, id: 'ten_1' } as any,
      environment: { oid: 30n } as any,
      providerAuthMethodIds: ['pam_1']
    });

    await paginator.run({});

    let where = mocks.providerAuthCredentialsFindMany.mock.calls[0]![0].where;
    let managedBackingFilter = where.AND.at(-1).OR[1];

    expect(managedBackingFilter.managedCredentialsBacking.is.managedCredentials.OR).toEqual([
      {
        providerAuthMethodGlobalOid: {
          in: [70n]
        }
      },
      {
        providerAuthMethodGlobalOid: null,
        initialProviderAuthMethod: {
          globalOid: {
            in: [70n]
          }
        }
      }
    ]);
  });
});

describe('listProviderAuthCredentialsInternal auth method filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveProviders.mockResolvedValue(undefined);
    mocks.resolveAuthMethodsGlobal.mockResolvedValue({
      oids: [70n],
      in: { in: [70n] },
      oidIn: { oid: { in: [70n] } }
    });
    mocks.providerAuthCredentialsFindMany.mockResolvedValue([]);
  });

  it('matches managed credentials through their global family, including legacy rows', async () => {
    let paginator = await providerAuthCredentialsService.listProviderAuthCredentialsInternal({
      tenant: { oid: 10n, id: 'ten_1' } as any,
      environment: { oid: 30n } as any,
      providerAuthMethodIds: ['pam_1']
    });

    await paginator.run({});

    let where = mocks.providerAuthCredentialsFindMany.mock.calls[0]![0].where;
    let managedBackingFilter = where.AND.at(-1).OR[1];

    expect(managedBackingFilter.managedCredentialsBacking.is.managedCredentials.OR).toEqual([
      {
        providerAuthMethodGlobalOid: {
          in: [70n]
        }
      },
      {
        providerAuthMethodGlobalOid: null,
        initialProviderAuthMethod: {
          globalOid: {
            in: [70n]
          }
        }
      }
    ]);
  });
});

describe('resolveReplacementProviderAuthCredentialsInternal', () => {
  let tenant = { oid: 10n, projectOid: 20n } as any;
  let environment = { oid: 30n, instanceOid: 40n } as any;
  let makeProvider = (d: { autoRegistration: boolean }) =>
    ({
      oid: 50n,
      defaultVariant: { oid: 51n, backendOid: 60n },
      type: {
        supportsOAuthAutoRegistration: d.autoRegistration,
        attributes: {
          auth: {
            oauth: d.autoRegistration ? { oauthAutoRegistration: { status: 'supported' } } : {}
          }
        }
      }
    }) as any;
  let staleCredentials = {
    oid: 70n,
    id: 'pac_old',
    status: 'archived',
    isAutoRegistration: false
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('re-registers default credentials when the stale ones were auto-registered', async () => {
    let defaults = { oid: 71n, id: 'pac_default' } as any;
    let ensureDefault = vi
      .spyOn(providerAuthCredentialsService, 'ensureDefaultProviderAuthCredentialsInternal')
      .mockResolvedValue(defaults);

    let result =
      await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal({
        tenant,
        environment,
        provider: makeProvider({ autoRegistration: true }),
        providerAuthCredentials: { ...staleCredentials, isAutoRegistration: true }
      });

    expect(result).toEqual({ type: 'replace', providerAuthCredentials: defaults });
    expect(ensureDefault).toHaveBeenCalled();
    expect(mocks.providerAuthCredentialsFindMany).not.toHaveBeenCalled();
  });

  it('uses the only other active credentials for the provider', async () => {
    let candidate = { oid: 72n, id: 'pac_other' };
    mocks.providerAuthCredentialsFindMany.mockResolvedValue([candidate]);

    let result =
      await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal({
        tenant,
        environment,
        provider: makeProvider({ autoRegistration: false }),
        providerAuthCredentials: staleCredentials
      });

    expect(result).toEqual({ type: 'replace', providerAuthCredentials: candidate });
    expect(mocks.providerAuthCredentialsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerOid: 50n,
          status: 'active',
          oid: { not: staleCredentials.oid }
        })
      })
    );
  });

  it('refuses to guess between multiple candidate credentials', async () => {
    mocks.providerAuthCredentialsFindMany.mockResolvedValue([
      { oid: 72n, id: 'pac_a' },
      { oid: 73n, id: 'pac_b' }
    ]);

    let result =
      await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal({
        tenant,
        environment,
        provider: makeProvider({ autoRegistration: true }),
        providerAuthCredentials: staleCredentials
      });

    expect(result).toBeNull();
  });

  it('clears the credentials when none remain and the provider can auto-register', async () => {
    mocks.providerAuthCredentialsFindMany.mockResolvedValue([]);

    let result =
      await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal({
        tenant,
        environment,
        provider: makeProvider({ autoRegistration: true }),
        providerAuthCredentials: staleCredentials
      });

    expect(result).toEqual({ type: 'clear' });
  });

  it('returns null when none remain and the provider needs explicit credentials', async () => {
    mocks.providerAuthCredentialsFindMany.mockResolvedValue([]);

    let result =
      await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal({
        tenant,
        environment,
        provider: makeProvider({ autoRegistration: false }),
        providerAuthCredentials: staleCredentials
      });

    expect(result).toBeNull();
  });

  describe('managed credentials', () => {
    let staleManagedCredentials = {
      oid: 80n,
      providerAuthMethodGlobalOid: null,
      initialProviderAuthMethod: { globalOid: 90n }
    };
    let rotatedManagedCredentials = { oid: 81n, id: 'mpac_new', status: 'active' };
    let materializedBacking = { oid: 74n, id: 'pac_managed_new', origin: 'managed_backing' };

    beforeEach(() => {
      vi.mocked(db.managedProviderAuthCredentialsBacking.findFirst).mockResolvedValue({
        managedCredentials: staleManagedCredentials
      } as any);
      vi.mocked(ensureManagedProviderAuthCredentialsBacking).mockResolvedValue(
        materializedBacking as any
      );
      vi.mocked(db.providerAuthCredentials.findFirst).mockResolvedValue(
        materializedBacking as any
      );
    });

    it('materializes the active managed credentials that replaced an archived backing', async () => {
      vi.mocked(db.managedProviderAuthCredentials.findFirst).mockResolvedValue(
        rotatedManagedCredentials as any
      );

      let result =
        await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal(
          {
            tenant,
            environment,
            provider: makeProvider({ autoRegistration: false }),
            providerAuthCredentials: { ...staleCredentials, origin: 'managed_backing' }
          }
        );

      expect(result).toEqual({
        type: 'replace',
        providerAuthCredentials: materializedBacking
      });
      expect(db.managedProviderAuthCredentials.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
            OR: [
              { providerAuthMethodGlobalOid: 90n },
              {
                providerAuthMethodGlobalOid: null,
                initialProviderAuthMethod: { globalOid: 90n }
              }
            ]
          }),
          orderBy: { createdAt: 'desc' }
        })
      );
      expect(ensureManagedProviderAuthCredentialsBacking).toHaveBeenCalledWith({
        tenant,
        managedCredentials: rotatedManagedCredentials,
        providerAuthMethod: { globalOid: 90n }
      });
      expect(mocks.providerAuthCredentialsFindMany).not.toHaveBeenCalled();
    });

    it('resolves legacy managed_public rows through their managed credentials', async () => {
      vi.mocked(db.managedProviderAuthCredentials.findFirst)
        .mockResolvedValueOnce(staleManagedCredentials as any)
        .mockResolvedValueOnce(rotatedManagedCredentials as any);

      let result =
        await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal(
          {
            tenant,
            environment,
            provider: makeProvider({ autoRegistration: false }),
            providerAuthCredentials: {
              ...staleCredentials,
              origin: 'managed_public',
              managedCredentialsOid: 80n
            }
          }
        );

      expect(result).toEqual({
        type: 'replace',
        providerAuthCredentials: materializedBacking
      });
      expect(db.managedProviderAuthCredentialsBacking.findFirst).not.toHaveBeenCalled();
    });

    it('matches managed credentials on the global auth method of the integration', async () => {
      vi.mocked(db.managedProviderAuthCredentials.findFirst).mockResolvedValue(
        rotatedManagedCredentials as any
      );

      await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal({
        tenant,
        environment,
        provider: makeProvider({ autoRegistration: false }),
        providerAuthCredentials: { ...staleCredentials, origin: 'managed_backing' },
        providerAuthMethod: { globalOid: 91n }
      });

      expect(db.managedProviderAuthCredentialsBacking.findFirst).not.toHaveBeenCalled();
      expect(db.managedProviderAuthCredentials.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { providerAuthMethodGlobalOid: 91n },
              {
                providerAuthMethodGlobalOid: null,
                initialProviderAuthMethod: { globalOid: 91n }
              }
            ]
          })
        })
      );
      expect(ensureManagedProviderAuthCredentialsBacking).toHaveBeenCalledWith(
        expect.objectContaining({ providerAuthMethod: { globalOid: 91n } })
      );
    });

    it('does not use a materialized backing that was archived concurrently', async () => {
      vi.mocked(db.managedProviderAuthCredentials.findFirst).mockResolvedValue(
        rotatedManagedCredentials as any
      );
      vi.mocked(db.providerAuthCredentials.findFirst).mockResolvedValue(null);
      mocks.providerAuthCredentialsFindMany.mockResolvedValue([]);

      let result =
        await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal(
          {
            tenant,
            environment,
            provider: makeProvider({ autoRegistration: false }),
            providerAuthCredentials: { ...staleCredentials, origin: 'managed_backing' }
          }
        );

      expect(db.providerAuthCredentials.findFirst).toHaveBeenCalledWith({
        where: { oid: materializedBacking.oid, status: 'active' }
      });
      expect(result).toBeNull();
    });

    it('falls back to tenant candidates when no managed credentials are active', async () => {
      vi.mocked(db.managedProviderAuthCredentials.findFirst).mockResolvedValue(null);
      mocks.providerAuthCredentialsFindMany.mockResolvedValue([{ oid: 72n, id: 'pac_other' }]);

      let result =
        await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal(
          {
            tenant,
            environment,
            provider: makeProvider({ autoRegistration: false }),
            providerAuthCredentials: { ...staleCredentials, origin: 'managed_backing' }
          }
        );

      expect(result).toEqual({
        type: 'replace',
        providerAuthCredentials: { oid: 72n, id: 'pac_other' }
      });
      expect(ensureManagedProviderAuthCredentialsBacking).not.toHaveBeenCalled();
    });

    it('does not look up managed credentials for tenant-created rows', async () => {
      mocks.providerAuthCredentialsFindMany.mockResolvedValue([]);

      await providerAuthCredentialsService.resolveReplacementProviderAuthCredentialsInternal({
        tenant,
        environment,
        provider: makeProvider({ autoRegistration: false }),
        providerAuthCredentials: { ...staleCredentials, origin: 'tenant_created' }
      });

      expect(db.managedProviderAuthCredentials.findFirst).not.toHaveBeenCalled();
      expect(db.managedProviderAuthCredentialsBacking.findFirst).not.toHaveBeenCalled();
    });
  });
});
