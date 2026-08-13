import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerListingGroupCreate: vi.fn(),
  getMetorialSolution: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerListingGroup: {
      create: mocks.providerListingGroupCreate,
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    providerListing: {
      update: vi.fn()
    }
  },
  getId: vi.fn(() => ({ oid: 10n, id: 'pgr_1' }))
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  resolveProviders: vi.fn(),
  resolveProviderListings: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: mocks.getMetorialSolution,
  resolveMetorialFacing: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

import { providerListingGroupService } from './providerGroup';

let makeTenant = (projectOid: bigint | null) => ({ oid: 1n, projectOid }) as any;
let makeEnvironment = (instanceOid: bigint | null) => ({ oid: 2n, instanceOid }) as any;

let createdData = () => mocks.providerListingGroupCreate.mock.calls[0]![0].data;

describe('Provider listing group double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMetorialSolution.mockResolvedValue({ oid: 3 });
    mocks.providerListingGroupCreate.mockResolvedValue({ id: 'pgr_1' });
  });

  it('mirrors the project and instance references onto a created group', async () => {
    await providerListingGroupService.createProviderListingGroupInternal({
      tenant: makeTenant(20n),
      environment: makeEnvironment(30n),
      input: { name: 'My Group' }
    });

    expect(mocks.providerListingGroupCreate).toHaveBeenCalledTimes(1);
    expect(createdData()).toMatchObject({
      tenantOid: 1n,
      projectOid: 20n,
      environmentOid: 2n,
      instanceOid: 30n
    });
  });

  it('keeps the mirrored references null while the tenant is not linked yet', async () => {
    await providerListingGroupService.createProviderListingGroupInternal({
      tenant: makeTenant(null),
      environment: makeEnvironment(null),
      input: { name: 'My Group' }
    });

    let data = createdData();
    expect(data.tenantOid).toBe(1n);
    expect(data.projectOid).toBeNull();
    expect(data.environmentOid).toBe(2n);
    expect(data.instanceOid).toBeNull();
  });
});
