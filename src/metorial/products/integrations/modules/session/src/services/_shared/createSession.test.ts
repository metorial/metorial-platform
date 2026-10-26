import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  sessionCreate: vi.fn(),
  resolveProviderSessionInput: vi.fn(),
  createSessionProvidersForInput: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<unknown>) => {
    await hook();
  }),
  getId: vi.fn((prefix: string) => ({ oid: 1n, id: `${prefix}_1` })),
  withTransaction: vi.fn(async (run: (db: unknown) => Promise<unknown>) =>
    run({
      session: { create: mocks.sessionCreate }
    })
  )
}));

vi.mock('@metorial/module-usage', () => ({
  recordSessionCreatedUsage: vi.fn(async () => {})
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ oid: 7 })),
  mergeResourceOwners: vi.fn(() => null),
  ownerActorSelect: {}
}));

vi.mock('../sessionProvider', () => ({
  sessionProviderInclude: {}
}));

vi.mock('../sessionProviderInput', () => ({
  hasOwnerLockedProvider: (providers: { config?: { isOwnerLocked?: boolean } }[]) =>
    providers.some(provider => !!provider.config?.isOwnerLocked),
  hasOwnerOnlyVisibleProvider: (providers: { config?: { isOwnerOnlyVisible?: boolean } }[]) =>
    providers.some(provider => !!provider.config?.isOwnerOnlyVisible),
  sessionProviderInputService: {
    resolveProviderSessionInput: mocks.resolveProviderSessionInput,
    createSessionProvidersForInput: mocks.createSessionProvidersForInput
  }
}));

import { createSessionRecord } from './createSession';

let linkedTenant = { oid: 10n, projectOid: 20n };
let linkedEnvironment = { oid: 30n, instanceOid: 40n };

let run = (d: {
  tenant: { oid: bigint; projectOid: bigint | null };
  environment: { oid: bigint; instanceOid: bigint | null };
}) =>
  createSessionRecord({
    tenant: d.tenant as any,
    environment: d.environment as any,
    isEphemeral: false,
    input: {
      providers: [{ deploymentId: 'pd_1' }]
    }
  });

let createdData = () => mocks.sessionCreate.mock.calls[0]![0].data;

describe('createSessionRecord double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionCreate.mockResolvedValue({ oid: 1n, id: 'session_1', providers: [] });
    mocks.createSessionProvidersForInput.mockResolvedValue([]);
    mocks.resolveProviderSessionInput.mockResolvedValue({
      templates: new Map(),
      providers: []
    });
  });

  it.each([true, false])(
    'stores explorer provenance independently of ownership flags (%s)',
    async enabled => {
      await createSessionRecord({
        tenant: linkedTenant as any,
        environment: linkedEnvironment as any,
        isEphemeral: false,
        owner: { ownerActorOid: 5n, isOwnerLocked: false },
        input: {
          providers: [],
          source: 'explorer',
          isOwnerLocked: enabled,
          isOwnerOnlyVisible: enabled
        },
        resolvedProviders: { template: null, providers: [] } as any
      });

      expect(createdData()).toMatchObject({
        source: 'explorer',
        ownerActorOid: 5n,
        isOwnerLocked: enabled,
        isOwnerOnlyVisible: enabled
      });
    }
  );

  it('mirrors the tenant and environment references onto the session', async () => {
    await run({ tenant: linkedTenant, environment: linkedEnvironment });

    expect(createdData()).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('mirrors the references onto the nested session event', async () => {
    await run({ tenant: linkedTenant, environment: linkedEnvironment });

    expect(createdData().sessionEvents.create).toMatchObject({
      type: 'session_created',
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('writes null for an unlinked tenant and environment', async () => {
    await run({
      tenant: { oid: 10n, projectOid: null },
      environment: { oid: 30n, instanceOid: null }
    });

    let data = createdData();

    expect(data.projectOid).toBeNull();
    expect(data.instanceOid).toBeNull();
    expect(data.sessionEvents.create.projectOid).toBeNull();
    expect(data.sessionEvents.create.instanceOid).toBeNull();
  });

  it('stores an explicit internal adapter binding without consulting the template', async () => {
    mocks.resolveProviderSessionInput.mockResolvedValue({
      templates: new Map([['st_1', { id: 'st_1', identityActorOid: 91n, identityOid: 92n }]]),
      providers: []
    });

    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: true,
      isInternal: true,
      adapterGlobalOid: 55n,
      identityActorOid: null,
      identityOid: null,
      input: { providers: [{ sessionTemplateId: 'st_1' }] }
    });

    expect(createdData()).toMatchObject({
      isEphemeral: true,
      isInternal: true,
      adapterGlobalOid: 55n,
      identityActorOid: null,
      identityOid: null
    });
  });

  it('takes the identity from the template already loaded for provider resolution', async () => {
    mocks.resolveProviderSessionInput.mockResolvedValue({
      templates: new Map([['st_1', { id: 'st_1', identityActorOid: 91n, identityOid: 92n }]]),
      providers: []
    });

    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      input: { providers: [{ sessionTemplateId: 'st_1' }] }
    });

    expect(mocks.resolveProviderSessionInput).toHaveBeenCalledTimes(1);
    expect(createdData()).toMatchObject({ identityActorOid: 91n, identityOid: 92n });
  });

  it('reuses pre-resolved providers and creates them as a new session', async () => {
    let resolvedProviders = { template: null, providers: [{ provider: { oid: 1n } }] };

    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      input: { providers: [{ deploymentId: 'pd_1' }] },
      resolvedProviders: resolvedProviders as any
    });

    expect(mocks.resolveProviderSessionInput).not.toHaveBeenCalled();
    expect(mocks.createSessionProvidersForInput).toHaveBeenCalledWith(
      expect.objectContaining({
        resolvedProviders: resolvedProviders.providers,
        isNewSession: true
      })
    );
  });

  it('does not create a session-created event for internal sessions', async () => {
    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: true,
      isInternal: true,
      input: { providers: [{ deploymentId: 'pd_1' }] }
    });

    expect(createdData().sessionEvents).toBeUndefined();
  });
});

describe('createSessionRecord ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionCreate.mockResolvedValue({ oid: 1n, id: 'session_1', providers: [] });
    mocks.createSessionProvidersForInput.mockResolvedValue([]);
    mocks.resolveProviderSessionInput.mockResolvedValue({
      templates: new Map(),
      providers: []
    });
  });

  it('is ownerless and unlocked by default', async () => {
    await run({ tenant: linkedTenant, environment: linkedEnvironment });

    expect(createdData()).toMatchObject({ ownerActorOid: null, isOwnerLocked: false });
  });

  it('inherits the owner and lock from the template', async () => {
    mocks.resolveProviderSessionInput.mockResolvedValue({
      templates: new Map([['st_1', { id: 'st_1', ownerActorOid: 91n, isOwnerLocked: true }]]),
      providers: []
    });

    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      input: { providers: [{ sessionTemplateId: 'st_1' }] }
    });

    expect(createdData()).toMatchObject({ ownerActorOid: 91n, isOwnerLocked: true });
  });

  it('inherits a lock from any provider resource', async () => {
    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      input: { providers: [{ deploymentId: 'pd_1' }] },
      resolvedProviders: {
        template: null,
        providers: [{ provider: { oid: 1n }, config: { isOwnerLocked: true } }]
      } as any
    });

    expect(createdData()).toMatchObject({ ownerActorOid: null, isOwnerLocked: true });
  });

  it('prefers an explicit owner over the template', async () => {
    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      owner: { ownerActorOid: 5n, isOwnerLocked: false },
      input: { providers: [{ deploymentId: 'pd_1' }] }
    } as any);

    expect(createdData()).toMatchObject({ ownerActorOid: 5n, isOwnerLocked: false });
  });

  it('inherits owner-only visibility from the template when owned', async () => {
    mocks.resolveProviderSessionInput.mockResolvedValue({
      templates: new Map([
        [
          'st_1',
          { id: 'st_1', ownerActorOid: 91n, isOwnerLocked: true, isOwnerOnlyVisible: true }
        ]
      ]),
      providers: []
    });

    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      input: { providers: [{ sessionTemplateId: 'st_1' }] }
    });

    expect(createdData()).toMatchObject({ ownerActorOid: 91n, isOwnerOnlyVisible: true });
  });

  it('never marks an unowned session owner-only visible', async () => {
    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      input: { providers: [{ deploymentId: 'pd_1' }] },
      resolvedProviders: {
        template: null,
        providers: [{ provider: { oid: 1n }, config: { isOwnerOnlyVisible: true } }]
      } as any
    });

    expect(createdData()).toMatchObject({ ownerActorOid: null, isOwnerOnlyVisible: false });
  });

  it('writes the system-owned flag', async () => {
    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      isSystemOwned: true,
      input: { providers: [{ deploymentId: 'pd_1' }] }
    } as any);

    expect(createdData()).toMatchObject({ isSystemOwned: true });
  });
});
