import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  addAfterTransactionHook: vi.fn(async (callback: () => Promise<void>) => await callback()),
  generateId: vi.fn(),
  fire: vi.fn(),
  resourceTenant: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn()
  },
  resourceGroup: {
    upsert: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  resourceActor: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn()
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  organization: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  instance: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  project: {
    update: vi.fn()
  },
  consumer: {
    findUnique: vi.fn()
  },
  organizationActor: {
    findUnique: vi.fn()
  },
  transaction: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: mocks.addAfterTransactionHook,
  ID: {
    generateId: mocks.generateId
  },
  db: {
    resourceTenant: mocks.resourceTenant,
    resourceGroup: mocks.resourceGroup,
    resourceActor: mocks.resourceActor,
    user: mocks.user,
    organization: mocks.organization,
    instance: mocks.instance,
    project: mocks.project,
    consumer: mocks.consumer,
    organizationActor: mocks.organizationActor,
    $transaction: mocks.transaction
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: mocks.fire
  }
}));

import {
  resolveResourceScopeForOwner,
  resourceActorService,
  resourceGroupService,
  resourceTenantService
} from '../src';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resource tenant services', () => {
  it('upserts a tenant with a Metorial-generated ID', async () => {
    mocks.generateId.mockResolvedValue('crg_tn_1');
    mocks.resourceTenant.upsert.mockResolvedValue({ oid: 1n, id: 'crg_tn_1' });

    await resourceTenantService.upsertResourceTenant({
      input: {
        identifier: 'tenant-one',
        name: 'Tenant One'
      }
    });

    expect(mocks.resourceTenant.upsert).toHaveBeenCalledWith({
      where: {
        identifier: 'tenant-one'
      },
      update: {
        name: 'Tenant One'
      },
      create: {
        id: 'crg_tn_1',
        identifier: 'tenant-one',
        name: 'Tenant One'
      }
    });
  });

  it('fires the group-created event only for a new group', async () => {
    let resourceTenant = { oid: 1n, id: 'crg_tn_1' };
    let resourceGroup = {
      oid: 2n,
      id: 'crg_en_1',
      identifier: 'default',
      name: 'Default',
      type: 'production' as const,
      resourceTenantOid: 1n,
      resourceTenant
    };

    mocks.resourceGroup.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(resourceGroup);
    mocks.generateId.mockResolvedValue('crg_en_1');
    mocks.resourceGroup.upsert.mockResolvedValue(resourceGroup);
    mocks.resourceGroup.update.mockResolvedValue(resourceGroup);

    let input = {
      resourceTenant,
      input: {
        identifier: 'default',
        name: 'Default',
        type: 'production' as const
      }
    };

    await resourceGroupService.upsertResourceGroup(input);
    await resourceGroupService.upsertResourceGroup(input);

    expect(mocks.fire).toHaveBeenCalledTimes(1);
    expect(mocks.fire).toHaveBeenCalledWith('resource_tenant.resource_group.created:after', {
      resourceTenant,
      resourceGroup
    });
  });

  it('creates and looks up actors within their tenant', async () => {
    mocks.resourceActor.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      oid: 3n,
      id: 'crg_ta_1'
    });
    mocks.generateId.mockResolvedValue('crg_ta_1');
    mocks.resourceActor.create.mockResolvedValue({ oid: 3n, id: 'crg_ta_1' });

    await resourceActorService.upsertActor({
      resourceTenant: { oid: 1n, id: 'crg_tn_1' },
      input: {
        identifier: 'actor-one',
        name: 'Actor One'
      }
    });
    await resourceActorService.getActorById({
      resourceTenant: { oid: 1n, id: 'crg_tn_1' },
      actorId: 'crg_ta_1'
    });

    expect(mocks.resourceActor.create).toHaveBeenCalledWith({
      data: {
        id: 'crg_ta_1',
        resourceTenantOid: 1n,
        identifier: 'actor-one',
        type: 'external',
        name: 'Actor One',
        organizationActorOid: undefined,
        consumerOid: undefined
      }
    });
    expect(mocks.resourceActor.findFirst).toHaveBeenLastCalledWith({
      where: {
        resourceTenantOid: 1n,
        OR: [{ id: 'crg_ta_1' }, { identifier: 'crg_ta_1' }]
      }
    });
  });

  it('reuses an owner scope when both linked records exist', async () => {
    mocks.user.findUnique.mockResolvedValue({
      resourceTenantOid: 1n,
      resourceGroupOid: 2n
    });
    mocks.resourceTenant.findUnique.mockResolvedValue({
      oid: 1n,
      id: 'crg_tn_1'
    });
    mocks.resourceGroup.findFirst.mockResolvedValue({
      oid: 2n,
      id: 'crg_en_1'
    });

    await expect(
      resolveResourceScopeForOwner({
        type: 'user',
        user: { id: 'usr_1' }
      })
    ).resolves.toEqual({
      resourceTenant: {
        oid: 1n,
        id: 'crg_tn_1'
      },
      resourceGroup: {
        oid: 2n,
        id: 'crg_en_1'
      }
    });

    expect(mocks.user.update).not.toHaveBeenCalled();
  });
});
