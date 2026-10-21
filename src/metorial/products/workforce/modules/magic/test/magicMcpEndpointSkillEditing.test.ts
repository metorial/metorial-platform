import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, isFlagEnabledForInstanceMock, ensureMagicMcpEndpointBackingMock } = vi.hoisted(
  () => ({
    db: {
      magicMcpServer: {
        findMany: vi.fn()
      },
      magicMcpEndpoint: {
        create: vi.fn(),
        update: vi.fn()
      },
      instance: {
        findUniqueOrThrow: vi.fn()
      }
    },
    isFlagEnabledForInstanceMock: vi.fn(),
    ensureMagicMcpEndpointBackingMock: vi.fn()
  })
);

vi.mock('@metorial/db', () => ({
  db,
  ID: {
    generateId: vi.fn(async (prefix: string) => `${prefix}_new`)
  },
  Prisma: {
    JsonNull: 'JSON_NULL',
    PrismaClientKnownRequestError: class extends Error {}
  },
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(db)
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { isFlagEnabledForInstance: isFlagEnabledForInstanceMock }
}));

vi.mock('@metorial/module-access', () => ({
  consumerMagicMcpReadRoles: ['consumer_magic_mcp_read'],
  consumerMagicMcpWriteRoles: ['consumer_magic_mcp_write']
}));

vi.mock('../src/queues/lifecycle/magicMcpEndpoint', () => ({
  magicMcpEndpointDeletedQueue: { add: vi.fn() }
}));

vi.mock('../src/lib/backing', () => ({
  ensureMagicMcpEndpointBacking: ensureMagicMcpEndpointBackingMock
}));

import { magicMcpEndpointService } from '../src/services/magicMcpEndpoint';

let instance = { oid: 20n, id: 'ins_1' } as any;
let project = { oid: 30n, allowConsumerSkillEditing: true };
let auditScope = { organizationOid: 1n, actor: { type: 'system', id: 'test' } } as any;

let endpoint = {
  oid: 10n,
  id: 'mep_1',
  status: 'active',
  instanceOid: instance.oid,
  name: 'Endpoint',
  description: null,
  metadata: {}
} as any;

describe('magicMcpEndpointService skill editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.magicMcpServer.findMany.mockResolvedValue([]);
    db.magicMcpEndpoint.create.mockResolvedValue(endpoint);
    db.magicMcpEndpoint.update.mockResolvedValue(endpoint);
    db.instance.findUniqueOrThrow.mockResolvedValue({ ...instance, project });
    isFlagEnabledForInstanceMock.mockResolvedValue(true);
    ensureMagicMcpEndpointBackingMock.mockResolvedValue({
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: 'ems_1',
      isSubspaceBackingReconciling: false
    });
  });

  it('stores the flag when skills are enabled for the instance', async () => {
    await magicMcpEndpointService.createMagicMcpEndpoint({
      instance,
      auditScope,
      input: { name: 'Endpoint', enableSkillEditing: true }
    });

    expect(isFlagEnabledForInstanceMock).toHaveBeenCalledWith({
      instance,
      flag: 'skills-enabled'
    });
    expect(db.magicMcpEndpoint.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enableSkillEditing: true })
      })
    );
  });

  it('defaults the flag to off without checking flags', async () => {
    await magicMcpEndpointService.createMagicMcpEndpoint({
      instance,
      auditScope,
      input: { name: 'Endpoint' }
    });

    expect(isFlagEnabledForInstanceMock).not.toHaveBeenCalled();
    expect(db.magicMcpEndpoint.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enableSkillEditing: false })
      })
    );
  });

  it('rejects enabling skill editing when skills are disabled', async () => {
    isFlagEnabledForInstanceMock.mockResolvedValue(false);

    await expect(
      magicMcpEndpointService.createMagicMcpEndpoint({
        instance,
        auditScope,
        input: { name: 'Endpoint', enableSkillEditing: true }
      })
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(db.magicMcpEndpoint.create).not.toHaveBeenCalled();
  });

  it('rejects enabling skill editing when the project turned it off', async () => {
    db.instance.findUniqueOrThrow.mockResolvedValue({
      ...instance,
      project: { ...project, allowConsumerSkillEditing: false }
    });

    await expect(
      magicMcpEndpointService.updateMagicMcpEndpoint({
        endpoint,
        auditScope,
        input: { enableSkillEditing: true }
      })
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(db.magicMcpEndpoint.update).not.toHaveBeenCalled();
  });

  it('updates the flag and keeps it when omitted', async () => {
    await magicMcpEndpointService.updateMagicMcpEndpoint({
      endpoint,
      auditScope,
      input: { enableSkillEditing: true }
    });
    await magicMcpEndpointService.updateMagicMcpEndpoint({
      endpoint,
      auditScope,
      input: { name: 'Renamed' }
    });

    expect(db.magicMcpEndpoint.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ enableSkillEditing: true })
      })
    );
    expect(db.magicMcpEndpoint.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ enableSkillEditing: undefined })
      })
    );
    expect(isFlagEnabledForInstanceMock).toHaveBeenCalledTimes(1);
    expect(isFlagEnabledForInstanceMock).toHaveBeenCalledWith({
      instance: { oid: instance.oid },
      flag: 'skills-enabled'
    });
  });

  it('keeps skill editing on without rechecking flags when it is already enabled', async () => {
    isFlagEnabledForInstanceMock.mockResolvedValue(false);

    await magicMcpEndpointService.updateMagicMcpEndpoint({
      endpoint: { ...endpoint, enableSkillEditing: true },
      auditScope,
      input: { name: 'Renamed', enableSkillEditing: true }
    });

    expect(isFlagEnabledForInstanceMock).not.toHaveBeenCalled();
    expect(db.magicMcpEndpoint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Renamed', enableSkillEditing: true })
      })
    );
  });

  it('allows disabling skill editing without checking flags', async () => {
    isFlagEnabledForInstanceMock.mockResolvedValue(false);

    await magicMcpEndpointService.updateMagicMcpEndpoint({
      endpoint,
      auditScope,
      input: { enableSkillEditing: false }
    });

    expect(isFlagEnabledForInstanceMock).not.toHaveBeenCalled();
    expect(db.magicMcpEndpoint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enableSkillEditing: false })
      })
    );
  });
});
