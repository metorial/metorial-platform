import { createSystemAuditScope } from '@metorial/audit-scope';
import {
  consumerSessionInclude,
  getConsumerAccessContextForConsumerProfile
} from '@metorial/consumer-auth';
import { addAfterTransactionHook, db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles
} from '@metorial/module-access';
import { createQueue } from '@metorial/queue';
import { magicMcpEndpointService } from '../../services/magicMcpEndpoint';
import { magicMcpEndpointUpdatedQueue } from './magicMcpEndpoint';

let pageSize = 500;

type RevokedMagicMcpServerAccess =
  | { consumerGroupId: string; magicMcpServerId: string }
  | { consumerGroupId: string; consumerProfileId: string };

export let magicMcpEndpointServerAccessRevokedManyQueue = createQueue<
  RevokedMagicMcpServerAccess & { cursor?: string }
>({
  name: 'mgc/lc/endpoint-server/access-revoked/many',
  workerOpts: { concurrency: 1 }
});

export let magicMcpEndpointServerAccessRevokedManyQueueProcessor =
  magicMcpEndpointServerAccessRevokedManyQueue.process(async data => {
    let removedProfile =
      'consumerProfileId' in data
        ? await db.consumerProfile.findUnique({
            where: { id: data.consumerProfileId },
            select: { consumerOid: true, instanceOid: true }
          })
        : null;
    if ('consumerProfileId' in data && !removedProfile) return;

    let links = await db.magicMcpEndpointServer.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        magicMcpEndpoint: {
          status: 'active',
          consumerProfile: removedProfile
            ? {
                consumerOid: removedProfile.consumerOid,
                instanceOid: removedProfile.instanceOid
              }
            : { isNot: null }
        },
        magicMcpServer:
          'magicMcpServerId' in data
            ? { id: data.magicMcpServerId }
            : { consumerAccesses: { some: { consumerGroup: { id: data.consumerGroupId } } } }
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: { id: true }
    });
    if (!links.length) return;

    await magicMcpEndpointServerAccessRevokedSingleQueue.addMany(
      links.map(link => ({
        magicMcpEndpointServerId: link.id,
        memberOfConsumerGroupId: removedProfile ? undefined : data.consumerGroupId
      }))
    );

    if (links.length == pageSize) {
      await magicMcpEndpointServerAccessRevokedManyQueue.add(
        { ...data, cursor: links[links.length - 1]!.id },
        { delay: 1000 }
      );
    }
  });

export let magicMcpEndpointServerAccessRevokedSingleQueue = createQueue<{
  magicMcpEndpointServerId: string;
  memberOfConsumerGroupId?: string;
}>({
  name: 'mgc/lc/endpoint-server/access-revoked/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let magicMcpEndpointServerAccessRevokedSingleQueueProcessor =
  magicMcpEndpointServerAccessRevokedSingleQueue.process(async data => {
    let link = await db.magicMcpEndpointServer.findUnique({
      where: { id: data.magicMcpEndpointServerId },
      include: {
        magicMcpServer: { select: { oid: true, id: true } },
        magicMcpEndpoint: {
          include: {
            consumerProfile: { include: consumerSessionInclude.consumerProfile.include }
          }
        }
      }
    });
    let endpoint = link?.magicMcpEndpoint;
    let profile = endpoint?.consumerProfile;
    if (!link || !endpoint || !profile || endpoint.status != 'active') return;

    let access = await getConsumerAccessContextForConsumerProfile({ profile });

    if (data.memberOfConsumerGroupId) {
      // An archived group no longer shows up in the profile's effective groups, but its
      // membership rows and SSO mapping are still there.
      let isMember =
        access.consumerGroups.some(group => group.id == data.memberOfConsumerGroupId) ||
        !!(await db.consumerGroup.findFirst({
          where: {
            id: data.memberOfConsumerGroupId,
            status: { not: 'active' },
            surfaceOid: profile.surfaceOid,
            OR: [
              { isDefault: true },
              { profiles: { some: { profileOid: profile.oid } } },
              ...(profile.ssoGroupIds.length
                ? [{ ssoGroupIds: { hasSome: profile.ssoGroupIds } }]
                : [])
            ]
          },
          select: { oid: true }
        }));
      if (!isMember) return;
    }

    let remainingAccess = access.accessTags.length
      ? await db.magicMcpServer.findFirst({
          where: {
            oid: link.magicMcpServer.oid,
            accessTagEntities: {
              some: {
                accessTagOid: { in: access.accessTags },
                accessTagPolicy: {
                  roles: {
                    hasSome: [...consumerMagicMcpReadRoles, ...consumerMagicMcpWriteRoles]
                  }
                }
              }
            }
          },
          select: { oid: true }
        })
      : null;
    if (remainingAccess) return;

    try {
      await magicMcpEndpointService.removeServersFromEndpoint({
        endpoint,
        magicMcpServerIds: [link.magicMcpServer.id],
        auditScope: createSystemAuditScope({
          organization: { oid: profile.organizationOid },
          instance: { oid: endpoint.instanceOid },
          job: 'magicMcp/endpointServerAccessRevoked'
        })
      });
    } catch (error) {
      // The link may already be gone while the endpoint backing still lists the server.
      await magicMcpEndpointUpdatedQueue.add({ magicMcpEndpointId: endpoint.id });

      throw error;
    }
  });

Fabric.listen('consumer.access.deleted:after', async ({ consumerAccess }) => {
  if (consumerAccess.type != 'magic_mcp_server' || !consumerAccess.magicMcpServer) return;

  let revokedAccess = {
    consumerGroupId: consumerAccess.consumerGroup.id,
    magicMcpServerId: consumerAccess.magicMcpServer.id
  };

  await addAfterTransactionHook(() =>
    magicMcpEndpointServerAccessRevokedManyQueue.add(revokedAccess)
  );
});

Fabric.listen(
  'consumer.profile.group.removed:after',
  async ({ consumerProfile, consumerGroup }) => {
    await addAfterTransactionHook(() =>
      magicMcpEndpointServerAccessRevokedManyQueue.add({
        consumerGroupId: consumerGroup.id,
        consumerProfileId: consumerProfile.id
      })
    );
  }
);
