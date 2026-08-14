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
    upsert: vi.fn(),
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

  it('returns the existing tenant after a concurrent unique conflict', async () => {
    let resourceTenant = { oid: 1n, id: 'crg_tn_1', identifier: 'tenant-one' };
    mocks.resourceTenant.upsert.mockRejectedValue({ code: 'P2002' });
    mocks.resourceTenant.findFirst.mockResolvedValue(resourceTenant);

    await expect(
      resourceTenantService.upsertResourceTenant({
        input: {
          identifier: 'tenant-one',
          name: 'Tenant One'
        }
      })
    ).resolves.toBe(resourceTenant);

    expect(mocks.resourceTenant.findFirst).toHaveBeenCalledWith({
      where: { identifier: 'tenant-one' }
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

  it('returns the existing group after a concurrent unique conflict', async () => {
    let resourceTenant = { oid: 1n, id: 'crg_tn_1' };
    let resourceGroup = { oid: 2n, id: 'crg_en_1', resourceTenant };
    mocks.resourceGroup.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(resourceGroup);
    mocks.resourceGroup.upsert.mockRejectedValue({ code: 'P2002' });

    await expect(
      resourceGroupService.upsertResourceGroup({
        resourceTenant,
        input: {
          identifier: 'default',
          name: 'Default',
          type: 'production'
        }
      })
    ).resolves.toBe(resourceGroup);

    expect(mocks.resourceGroup.findFirst).toHaveBeenLastCalledWith({
      where: {
        resourceTenantOid: 1n,
        identifier: 'default'
      },
      include: { resourceTenant: true }
    });
    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('atomically upserts and looks up actors within their tenant', async () => {
    mocks.resourceActor.findFirst.mockResolvedValueOnce({
      oid: 3n,
      id: 'crg_ta_1'
    });
    mocks.generateId.mockResolvedValue('crg_ta_1');
    mocks.resourceActor.upsert.mockResolvedValue({ oid: 3n, id: 'crg_ta_1' });

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

    expect(mocks.resourceActor.upsert).toHaveBeenCalledWith({
      where: {
        resourceTenantOid_identifier: {
          resourceTenantOid: 1n,
          identifier: 'actor-one'
        }
      },
      update: {
        type: undefined,
        name: 'Actor One',
        organizationActorOid: undefined,
        consumerOid: undefined
      },
      create: {
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

  it('returns the existing actor after a concurrent unique conflict', async () => {
    let resourceActor = { oid: 3n, id: 'crg_ta_1', identifier: 'actor-one' };
    mocks.resourceActor.upsert.mockRejectedValue({ code: 'P2002' });
    mocks.resourceActor.findFirst.mockResolvedValue(resourceActor);

    await expect(
      resourceActorService.upsertActor({
        resourceTenant: { oid: 1n, id: 'crg_tn_1' },
        input: {
          identifier: 'actor-one',
          name: 'Actor One'
        }
      })
    ).resolves.toBe(resourceActor);

    expect(mocks.resourceActor.findFirst).toHaveBeenCalledWith({
      where: {
        resourceTenantOid: 1n,
        identifier: 'actor-one'
      }
    });
  });

  it('preserves explicit actor ID compatibility', async () => {
    mocks.resourceActor.findFirst.mockResolvedValue({
      oid: 3n,
      id: 'crg_ta_1',
      type: 'system'
    });
    mocks.resourceActor.update.mockResolvedValue({ oid: 3n, id: 'crg_ta_1' });

    await resourceActorService.upsertActor({
      resourceTenant: { oid: 1n, id: 'crg_tn_1' },
      input: {
        id: 'crg_ta_1',
        identifier: 'actor-one',
        name: 'Actor One'
      }
    });

    expect(mocks.resourceActor.findFirst).toHaveBeenCalledWith({
      where: {
        resourceTenantOid: 1n,
        OR: [{ id: 'crg_ta_1' }, { identifier: 'actor-one' }]
      }
    });
    expect(mocks.resourceActor.update).toHaveBeenCalledWith({
      where: {
        id: 'crg_ta_1'
      },
      data: {
        identifier: 'actor-one',
        type: 'system',
        name: 'Actor One',
        organizationActorOid: undefined,
        consumerOid: undefined
      }
    });
  });

  it('reuses an owner scope when both linked records exist', async () => {
    mocks.user.findUnique.mockResolvedValue({
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceTenant: {
        oid: 1n,
        id: 'crg_tn_1'
      },
      resourceGroup: {
        oid: 2n,
        id: 'crg_en_1'
      }
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

  it('provisions and links a missing instance scope', async () => {
    let resourceTenant = { oid: 1n, id: 'crg_tn_1' };
    let resourceGroup = {
      oid: 2n,
      id: 'crg_en_1',
      resourceTenant
    };

    mocks.instance.findUnique
      .mockResolvedValueOnce({
        resourceTenantOid: null,
        resourceGroupOid: null
      })
      .mockResolvedValueOnce({
        oid: 3n,
        id: 'ins_1',
        name: 'Production',
        type: 'production',
        projectOid: 4n,
        project: {
          oid: 4n,
          name: 'Project One'
        }
      });
    mocks.resourceTenant.upsert.mockResolvedValue(resourceTenant);
    mocks.resourceGroup.findFirst.mockResolvedValue(null);
    mocks.resourceGroup.upsert.mockResolvedValue(resourceGroup);
    mocks.generateId.mockResolvedValueOnce('crg_tn_1').mockResolvedValueOnce('crg_en_1');

    await expect(
      resolveResourceScopeForOwner({
        type: 'instance',
        instance: { id: 'ins_1' }
      })
    ).resolves.toEqual({
      resourceTenant,
      resourceGroup
    });

    expect(mocks.resourceTenant.upsert).toHaveBeenCalledWith({
      where: {
        identifier: 'mte-pro-4'
      },
      update: {
        name: 'Project One'
      },
      create: {
        id: 'crg_tn_1',
        identifier: 'mte-pro-4',
        name: 'Project One'
      }
    });
    expect(mocks.resourceGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          resourceTenantOid_identifier: {
            resourceTenantOid: 1n,
            identifier: 'mte-ins-3'
          }
        }
      })
    );
    expect(mocks.project.update).toHaveBeenCalledWith({
      where: { oid: 4n },
      data: { resourceTenantOid: 1n }
    });
    expect(mocks.instance.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: {
        resourceTenantOid: 1n,
        resourceGroupOid: 2n
      }
    });
  });

  it('repairs a dangling instance scope link', async () => {
    let resourceTenant = { oid: 10n, id: 'crg_tn_10' };
    let resourceGroup = {
      oid: 20n,
      id: 'crg_en_20',
      resourceTenant
    };

    mocks.instance.findUnique
      .mockResolvedValueOnce({
        resourceTenantOid: 90n,
        resourceGroupOid: 91n
      })
      .mockResolvedValueOnce({
        oid: 30n,
        id: 'ins_30',
        name: 'Development',
        type: 'development',
        projectOid: 40n,
        project: {
          oid: 40n,
          name: 'Project Forty'
        }
      });
    mocks.resourceTenant.findUnique.mockResolvedValue(null);
    mocks.resourceGroup.findFirst.mockResolvedValue(null);
    mocks.resourceTenant.upsert.mockResolvedValue(resourceTenant);
    mocks.resourceGroup.upsert.mockResolvedValue(resourceGroup);
    mocks.generateId.mockResolvedValueOnce('crg_tn_10').mockResolvedValueOnce('crg_en_20');

    await expect(
      resolveResourceScopeForOwner({
        type: 'instance',
        instance: { id: 'ins_30' }
      })
    ).resolves.toEqual({
      resourceTenant,
      resourceGroup
    });

    expect(mocks.instance.update).toHaveBeenCalledWith({
      where: { oid: 30n },
      data: {
        resourceTenantOid: 10n,
        resourceGroupOid: 20n
      }
    });
  });
});
