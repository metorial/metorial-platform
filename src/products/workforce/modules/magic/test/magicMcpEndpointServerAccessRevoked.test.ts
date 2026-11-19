import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: any) => Promise<void>>(),
  afterTransactionHooks: [] as (() => any)[],
  getConsumerAccessContextForConsumerProfile: vi.fn(),
  removeServersFromEndpoint: vi.fn(),
  endpointUpdatedQueueAdd: vi.fn()
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumerProfile: { findUnique: vi.fn() },
    consumerGroup: { findFirst: vi.fn() },
    magicMcpEndpointServer: { findMany: vi.fn(), findUnique: vi.fn() },
    magicMcpServer: { findFirst: vi.fn() }
  },
  addAfterTransactionHook: vi.fn(async (hook: () => any) => {
    mocks.afterTransactionHooks.push(hook);
  })
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: vi.fn((name: string, handler: (event: any) => Promise<void>) => {
      mocks.listeners.set(name, handler);
    })
  }
}));

vi.mock('@metorial/consumer-auth', () => ({
  consumerSessionInclude: { consumerProfile: { include: { surface: true } } },
  getConsumerAccessContextForConsumerProfile: mocks.getConsumerAccessContextForConsumerProfile
}));

vi.mock('@metorial/module-access', () => ({
  consumerMagicMcpReadRoles: ['consumer#instance.magic_mcp:read'],
  consumerMagicMcpWriteRoles: ['consumer#instance.magic_mcp:write']
}));

vi.mock('@metorial/audit-scope', () => ({
  createSystemAuditScope: vi.fn(d => ({ system: d }))
}));

vi.mock('../src/services/magicMcpEndpoint', () => ({
  magicMcpEndpointService: { removeServersFromEndpoint: mocks.removeServersFromEndpoint }
}));

vi.mock('../src/queues/lifecycle/magicMcpEndpoint', () => ({
  magicMcpEndpointUpdatedQueue: { add: mocks.endpointUpdatedQueueAdd }
}));

import { db } from '@metorial/db';
import {
  magicMcpEndpointServerAccessRevokedManyQueue,
  magicMcpEndpointServerAccessRevokedManyQueueProcessor,
  magicMcpEndpointServerAccessRevokedSingleQueue,
  magicMcpEndpointServerAccessRevokedSingleQueueProcessor
} from '../src/queues/lifecycle/magicMcpEndpointServerAccess';

let runMany = (data: any) =>
  (magicMcpEndpointServerAccessRevokedManyQueueProcessor as any).handler(data);

let runSingle = (data: any) =>
  (magicMcpEndpointServerAccessRevokedSingleQueueProcessor as any).handler(data);

let profile = {
  oid: 20n,
  id: 'cpf_1',
  organizationOid: 1n,
  surfaceOid: 5n,
  ssoGroupIds: ['sso-eng']
};

let endpointLink = (d: { status?: string; consumerProfile?: any } = {}) => ({
  id: 'mgep_link',
  magicMcpServer: { oid: 10n, id: 'mgs_shared' },
  magicMcpEndpoint: {
    oid: 30n,
    id: 'mge_1',
    instanceOid: 2n,
    status: d.status ?? 'active',
    consumerProfile: d.consumerProfile === undefined ? profile : d.consumerProfile
  }
});

let revokedGroup = { oid: 40n, id: 'cgr_revoked' };
let otherGroup = { oid: 41n, id: 'cgr_other' };

let mockAccessContext = (groups: { oid: bigint; id: string }[]) =>
  mocks.getConsumerAccessContextForConsumerProfile.mockResolvedValue({
    ssoGroupIds: [],
    consumerGroups: groups,
    accessTags: groups.map(group => group.oid + 100n)
  });

describe('magic MCP endpoint server access revoked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterTransactionHooks.length = 0;

    vi.mocked(db.magicMcpEndpointServer.findMany).mockResolvedValue([]);
    vi.mocked(db.magicMcpEndpointServer.findUnique).mockResolvedValue(endpointLink() as any);
    vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue(null);
    vi.mocked(db.consumerGroup.findFirst).mockResolvedValue(null);
    mockAccessContext([revokedGroup]);
  });

  describe('scan', () => {
    it('fans out the consumer endpoints that contain the server', async () => {
      vi.mocked(db.magicMcpEndpointServer.findMany).mockResolvedValue([
        { id: 'mgep_a' },
        { id: 'mgep_b' }
      ] as any);

      await runMany({ consumerGroupId: 'cgr_revoked', magicMcpServerId: 'mgs_shared' });

      expect(db.magicMcpEndpointServer.findMany).toHaveBeenCalledWith({
        where: {
          id: undefined,
          magicMcpEndpoint: { status: 'active', consumerProfile: { isNot: null } },
          magicMcpServer: { id: 'mgs_shared' }
        },
        orderBy: { id: 'asc' },
        take: 500,
        select: { id: true }
      });
      expect(magicMcpEndpointServerAccessRevokedSingleQueue.addMany).toHaveBeenCalledWith([
        { magicMcpEndpointServerId: 'mgep_a', memberOfConsumerGroupId: 'cgr_revoked' },
        { magicMcpEndpointServerId: 'mgep_b', memberOfConsumerGroupId: 'cgr_revoked' }
      ]);
      expect(magicMcpEndpointServerAccessRevokedManyQueue.add).not.toHaveBeenCalled();
    });

    it('continues from the last link when a page is full', async () => {
      let page = Array.from({ length: 500 }, (_, index) => ({
        id: `mgep_${String(index).padStart(3, '0')}`
      }));
      vi.mocked(db.magicMcpEndpointServer.findMany).mockResolvedValue(page as any);

      await runMany({
        consumerGroupId: 'cgr_revoked',
        magicMcpServerId: 'mgs_shared',
        cursor: 'mgep_'
      });

      expect(
        vi.mocked(db.magicMcpEndpointServer.findMany).mock.calls[0]![0]!.where!.id
      ).toEqual({ gt: 'mgep_' });
      expect(magicMcpEndpointServerAccessRevokedManyQueue.add).toHaveBeenCalledWith(
        { consumerGroupId: 'cgr_revoked', magicMcpServerId: 'mgs_shared', cursor: 'mgep_499' },
        { delay: 1000 }
      );
    });

    it('scans the endpoints of a consumer removed from a group for servers shared with it', async () => {
      vi.mocked(db.consumerProfile.findUnique).mockResolvedValue({
        consumerOid: 7n,
        instanceOid: 2n
      } as any);
      vi.mocked(db.magicMcpEndpointServer.findMany).mockResolvedValue([
        { id: 'mgep_a' }
      ] as any);

      await runMany({ consumerGroupId: 'cgr_revoked', consumerProfileId: 'cpf_1' });

      expect(vi.mocked(db.magicMcpEndpointServer.findMany).mock.calls[0]![0]!.where).toEqual({
        id: undefined,
        magicMcpEndpoint: {
          status: 'active',
          consumerProfile: { consumerOid: 7n, instanceOid: 2n }
        },
        magicMcpServer: {
          consumerAccesses: { some: { consumerGroup: { id: 'cgr_revoked' } } }
        }
      });
      expect(magicMcpEndpointServerAccessRevokedSingleQueue.addMany).toHaveBeenCalledWith([
        { magicMcpEndpointServerId: 'mgep_a', memberOfConsumerGroupId: undefined }
      ]);
    });

    it('does nothing for a profile that no longer exists', async () => {
      vi.mocked(db.consumerProfile.findUnique).mockResolvedValue(null);

      await runMany({ consumerGroupId: 'cgr_revoked', consumerProfileId: 'cpf_gone' });

      expect(db.magicMcpEndpointServer.findMany).not.toHaveBeenCalled();
    });
  });

  describe('endpoint server link', () => {
    it('removes the server when the owner has no access left', async () => {
      await runSingle({
        magicMcpEndpointServerId: 'mgep_link',
        memberOfConsumerGroupId: 'cgr_revoked'
      });

      expect(db.magicMcpServer.findFirst).toHaveBeenCalledWith({
        where: {
          oid: 10n,
          accessTagEntities: {
            some: {
              accessTagOid: { in: [140n] },
              accessTagPolicy: {
                roles: {
                  hasSome: [
                    'consumer#instance.magic_mcp:read',
                    'consumer#instance.magic_mcp:write'
                  ]
                }
              }
            }
          }
        },
        select: { oid: true }
      });
      expect(mocks.removeServersFromEndpoint).toHaveBeenCalledWith({
        endpoint: endpointLink().magicMcpEndpoint,
        magicMcpServerIds: ['mgs_shared'],
        auditScope: {
          system: {
            organization: { oid: 1n },
            instance: { oid: 2n },
            job: 'magicMcp/endpointServerAccessRevoked'
          }
        }
      });
    });

    it('keeps the server when the owner still has access through another group', async () => {
      mockAccessContext([revokedGroup, otherGroup]);
      vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue({ oid: 10n } as any);

      await runSingle({
        magicMcpEndpointServerId: 'mgep_link',
        memberOfConsumerGroupId: 'cgr_revoked'
      });

      expect(
        vi.mocked(db.magicMcpServer.findFirst).mock.calls[0]![0]!.where!.accessTagEntities
      ).toMatchObject({ some: { accessTagOid: { in: [140n, 141n] } } });
      expect(mocks.removeServersFromEndpoint).not.toHaveBeenCalled();
    });

    it('keeps the server when the owner never belonged to the revoked group', async () => {
      mockAccessContext([otherGroup]);

      await runSingle({
        magicMcpEndpointServerId: 'mgep_link',
        memberOfConsumerGroupId: 'cgr_revoked'
      });

      expect(db.consumerGroup.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'cgr_revoked',
          status: { not: 'active' },
          surfaceOid: 5n,
          OR: [
            { isDefault: true },
            { profiles: { some: { profileOid: 20n } } },
            { ssoGroupIds: { hasSome: ['sso-eng'] } }
          ]
        },
        select: { oid: true }
      });
      expect(db.magicMcpServer.findFirst).not.toHaveBeenCalled();
      expect(mocks.removeServersFromEndpoint).not.toHaveBeenCalled();
    });

    it('removes the server for a member of a group that was archived', async () => {
      mockAccessContext([otherGroup]);
      vi.mocked(db.consumerGroup.findFirst).mockResolvedValue({ oid: 40n } as any);

      await runSingle({
        magicMcpEndpointServerId: 'mgep_link',
        memberOfConsumerGroupId: 'cgr_revoked'
      });

      expect(mocks.removeServersFromEndpoint).toHaveBeenCalledTimes(1);
    });

    it('checks only the remaining access for a consumer removed from a group', async () => {
      mockAccessContext([]);

      await runSingle({ magicMcpEndpointServerId: 'mgep_link' });

      expect(db.consumerGroup.findFirst).not.toHaveBeenCalled();
      expect(db.magicMcpServer.findFirst).not.toHaveBeenCalled();
      expect(mocks.removeServersFromEndpoint).toHaveBeenCalledTimes(1);
    });

    it('keeps the server for a removed consumer who still has access', async () => {
      mockAccessContext([otherGroup]);
      vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue({ oid: 10n } as any);

      await runSingle({ magicMcpEndpointServerId: 'mgep_link' });

      expect(mocks.removeServersFromEndpoint).not.toHaveBeenCalled();
    });

    it.each([
      ['a link that is gone', null],
      ['an endpoint that is not active', endpointLink({ status: 'archived' })],
      ['an endpoint without a consumer owner', endpointLink({ consumerProfile: null })]
    ])('ignores %s', async (_name, link) => {
      vi.mocked(db.magicMcpEndpointServer.findUnique).mockResolvedValue(link as any);

      await runSingle({
        magicMcpEndpointServerId: 'mgep_link',
        memberOfConsumerGroupId: 'cgr_revoked'
      });

      expect(mocks.getConsumerAccessContextForConsumerProfile).not.toHaveBeenCalled();
      expect(mocks.removeServersFromEndpoint).not.toHaveBeenCalled();
    });

    it('queues an endpoint backing refresh when the removal fails', async () => {
      let failure = new Error('backing unavailable');
      mocks.removeServersFromEndpoint.mockRejectedValue(failure);

      await expect(
        runSingle({
          magicMcpEndpointServerId: 'mgep_link',
          memberOfConsumerGroupId: 'cgr_revoked'
        })
      ).rejects.toBe(failure);

      expect(mocks.endpointUpdatedQueueAdd).toHaveBeenCalledWith({
        magicMcpEndpointId: 'mge_1'
      });
    });
  });

  describe('triggers', () => {
    it('starts a scan after access to a magic MCP server is deleted', async () => {
      await mocks.listeners.get('consumer.access.deleted:after')!({
        consumerAccess: {
          type: 'magic_mcp_server',
          magicMcpServer: { id: 'mgs_shared' },
          consumerGroup: { id: 'cgr_revoked' }
        }
      });

      expect(magicMcpEndpointServerAccessRevokedManyQueue.add).not.toHaveBeenCalled();

      await mocks.afterTransactionHooks[0]!();

      expect(magicMcpEndpointServerAccessRevokedManyQueue.add).toHaveBeenCalledWith({
        consumerGroupId: 'cgr_revoked',
        magicMcpServerId: 'mgs_shared'
      });
    });

    it('ignores deleted access to other targets', async () => {
      await mocks.listeners.get('consumer.access.deleted:after')!({
        consumerAccess: {
          type: 'skill',
          magicMcpServer: null,
          consumerGroup: { id: 'cgr_revoked' }
        }
      });

      expect(mocks.afterTransactionHooks).toHaveLength(0);
    });

    it('starts a scan after a consumer profile is removed from a group', async () => {
      await mocks.listeners.get('consumer.profile.group.removed:after')!({
        consumerProfile: { id: 'cpf_1' },
        consumerGroup: { id: 'cgr_revoked' }
      });
      await mocks.afterTransactionHooks[0]!();

      expect(magicMcpEndpointServerAccessRevokedManyQueue.add).toHaveBeenCalledWith({
        consumerGroupId: 'cgr_revoked',
        consumerProfileId: 'cpf_1'
      });
    });
  });
});
