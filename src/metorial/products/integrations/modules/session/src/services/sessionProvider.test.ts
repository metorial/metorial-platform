import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  createSessionProvidersForInput: vi.fn(),
  getOwnershipAccessor: vi.fn(),
  resolveMetorialFacing: vi.fn(),
  fabricFire: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({ Paginator: { create: vi.fn() } }));
vi.mock('@metorial-subspace/db', () => ({ db: {} }));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(),
  normalizeStatusForList: vi.fn(),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderConfigs: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn(),
  resolveSessions: vi.fn(),
  resolveSessionTemplates: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7 })),
  getOwnershipAccessor: mocks.getOwnershipAccessor,
  resolveMetorialFacing: mocks.resolveMetorialFacing,
  toProviderEventBase: vi.fn(() => ({}))
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fabricFire } }));
vi.mock('@metorial-subspace/public-mcp-guard', () => ({ assertNotPublicMcpOwned: vi.fn() }));
vi.mock('../lib/fineGrainedSessionFilter', () => ({ narrowSessionIdFilter: vi.fn() }));

vi.mock('../lib/sessionVisibility', () => ({
  assertSessionVisible: vi.fn(),
  getSessionVisibilityWhere: vi.fn()
}));

vi.mock('./_shared/internalAdapter', () => ({ assertInternalSessionMutable: vi.fn() }));

vi.mock('./sessionProviderInput', () => ({
  sessionProviderInputService: {
    createSessionProvidersForInput: mocks.createSessionProvidersForInput
  }
}));

vi.mock('./sessionProviderNameTemplate', () => ({
  sessionProviderNameTemplateService: {}
}));

import { sessionProviderService } from './sessionProvider';

let tenant = { oid: 10n };
let environment = { oid: 30n };
let instance = { id: 'ins_1' } as any;
let session = { oid: 60n } as any;
let input = { configId: 'pc_1' };

describe('sessionProviderService.createSessionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveMetorialFacing.mockResolvedValue({ tenant, environment });
    mocks.createSessionProvidersForInput.mockResolvedValue([{ id: 'sp_1' }]);
  });

  it("resolves the new provider with the caller's ownership accessor", async () => {
    let organizationActor = { oid: 5n, type: 'member' } as any;
    let memberAccessor = { kind: 'member' };
    mocks.getOwnershipAccessor.mockResolvedValue(memberAccessor);

    await sessionProviderService.createSessionProvider({
      instance,
      organizationActor,
      session,
      input
    });

    expect(mocks.getOwnershipAccessor).toHaveBeenCalledWith({ tenant, organizationActor });
    expect(mocks.createSessionProvidersForInput).toHaveBeenCalledWith({
      tenant,
      environment,
      session,
      providers: [input],
      ownershipAccessor: memberAccessor
    });
  });

  it('keeps callers without an actor on the accessor resolved for no actor', async () => {
    let internalAccessor = { kind: 'internal' };
    mocks.getOwnershipAccessor.mockResolvedValue(internalAccessor);

    let created = await sessionProviderService.createSessionProvider({
      instance,
      session,
      input
    });

    expect(mocks.getOwnershipAccessor).toHaveBeenCalledWith({
      tenant,
      organizationActor: undefined
    });
    expect(mocks.createSessionProvidersForInput.mock.calls[0]![0].ownershipAccessor).toBe(
      internalAccessor
    );
    expect(created).toEqual({ id: 'sp_1' });
  });

  it('adds providers without an accessor through the internal entry point', async () => {
    await sessionProviderService.createSessionProviderInternal({
      tenant: tenant as any,
      environment: environment as any,
      session,
      input
    });

    expect(mocks.getOwnershipAccessor).not.toHaveBeenCalled();
    expect(
      mocks.createSessionProvidersForInput.mock.calls[0]![0].ownershipAccessor
    ).toBeUndefined();
  });
});
