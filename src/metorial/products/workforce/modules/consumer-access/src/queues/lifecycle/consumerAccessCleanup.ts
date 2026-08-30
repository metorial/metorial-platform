import { createSystemAuditScope } from '@metorial/audit-scope';
import { db, type Prisma } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { consumerAccessService } from '../../services/consumerAccess';
import { consumerAccessListingService } from '../../services/consumerAccessListing';

let consumerAccessInclude = {
  surface: true,
  consumerGroup: true,
  providerTemplate: true,
  magicMcpServer: true,
  skill: true,
  skillTemplate: true,
  skillGroup: true,
  skillMarketplace: true,
  skillPlugin: true,
  listing: true
} satisfies Prisma.ConsumerAccessInclude;

let consumerAccessListingInclude = {
  surface: true,
  providerTemplate: true,
  magicMcpServer: true,
  skill: true,
  skillTemplate: true,
  skillGroup: true,
  skillMarketplace: true,
  skillPlugin: true,
  consumerSurfaceProviderGroups: {
    include: {
      consumerSurfaceProviderGroup: true
    }
  }
} satisfies Prisma.ConsumerAccessListingInclude;

let queueJobId = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join('-').replaceAll(':', '-');

type ConsumerTargetAccessCleanupManyInput = {
  organizationId: string;
  providerTemplateId?: string | null;
  magicMcpServerId?: string | null;
  listingCursor?: string | null;
  accessCursor?: string | null;
};

let resolveTarget = async (d: ConsumerTargetAccessCleanupManyInput) => {
  let organization = await db.organization.findUnique({
    where: { id: d.organizationId }
  });
  if (!organization) return null;

  if (d.providerTemplateId) {
    let providerTemplate = await db.providerTemplate.findUnique({
      where: { id: d.providerTemplateId },
      select: { oid: true }
    });
    if (!providerTemplate) return null;

    return {
      organization,
      listingWhere: { providerTemplateOid: providerTemplate.oid },
      accessWhere: { providerTemplateOid: providerTemplate.oid }
    } satisfies {
      organization: typeof organization;
      listingWhere: Prisma.ConsumerAccessListingWhereInput;
      accessWhere: Prisma.ConsumerAccessWhereInput;
    };
  }

  if (d.magicMcpServerId) {
    let magicMcpServer = await db.magicMcpServer.findUnique({
      where: { id: d.magicMcpServerId },
      select: { oid: true }
    });
    if (!magicMcpServer) return null;

    return {
      organization,
      listingWhere: { magicMcpServerOid: magicMcpServer.oid },
      accessWhere: { magicMcpServerOid: magicMcpServer.oid }
    } satisfies {
      organization: typeof organization;
      listingWhere: Prisma.ConsumerAccessListingWhereInput;
      accessWhere: Prisma.ConsumerAccessWhereInput;
    };
  }

  return null;
};

export let consumerTargetAccessCleanupManyQueue =
  createQueue<ConsumerTargetAccessCleanupManyInput>({
    name: 'cons/lc/access/cleanupTargetMany'
  });

export let enqueueConsumerTargetAccessCleanup = async (
  d: Omit<ConsumerTargetAccessCleanupManyInput, 'listingCursor' | 'accessCursor'>
) => {
  if (!d.providerTemplateId && !d.magicMcpServerId) return;
  await consumerTargetAccessCleanupManyQueue.add(d);
};

export let consumerAccessListingDeleteQueue = createQueue<{
  organizationId: string;
  consumerAccessListingId: string;
}>({
  name: 'cons/lc/access/deleteListing'
});

export let consumerAccessDeleteQueue = createQueue<{
  organizationId: string;
  consumerAccessId: string;
}>({
  name: 'cons/lc/access/deleteAccess'
});

export let consumerTargetAccessCleanupManyQueueProcessor =
  consumerTargetAccessCleanupManyQueue.process(async data => {
    let target = await resolveTarget(data);
    if (!target) return;

    if (!data.accessCursor) {
      let listings = await db.consumerAccessListing.findMany({
        where: {
          ...target.listingWhere,
          id: data.listingCursor ? { gt: data.listingCursor } : undefined
        },
        orderBy: { id: 'asc' },
        take: 100,
        select: { id: true }
      });

      if (listings.length) {
        await consumerAccessListingDeleteQueue.addManyWithOps(
          listings.map(listing => ({
            data: {
              organizationId: data.organizationId,
              consumerAccessListingId: listing.id
            },
            opts: {
              id: queueJobId('delete-listing', data.organizationId, listing.id)
            }
          }))
        );
      }

      let lastListing = listings[listings.length - 1];
      if (lastListing) {
        await consumerTargetAccessCleanupManyQueue.add({
          ...data,
          listingCursor: lastListing.id
        });
        return;
      }
    }

    let accesses = await db.consumerAccess.findMany({
      where: {
        ...target.accessWhere,
        listingOid: null,
        id: data.accessCursor ? { gt: data.accessCursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });

    if (accesses.length) {
      await consumerAccessDeleteQueue.addManyWithOps(
        accesses.map(access => ({
          data: {
            organizationId: data.organizationId,
            consumerAccessId: access.id
          },
          opts: {
            id: queueJobId('delete-access', data.organizationId, access.id)
          }
        }))
      );
    }

    let lastAccess = accesses[accesses.length - 1];
    if (!lastAccess) return;

    await consumerTargetAccessCleanupManyQueue.add({
      ...data,
      accessCursor: lastAccess.id
    });
  });

export let consumerAccessListingDeleteQueueProcessor =
  consumerAccessListingDeleteQueue.process(async data => {
    let [organization, consumerAccessListing] = await Promise.all([
      db.organization.findUnique({ where: { id: data.organizationId } }),
      db.consumerAccessListing.findUnique({
        where: { id: data.consumerAccessListingId },
        include: consumerAccessListingInclude
      })
    ]);
    if (!organization || !consumerAccessListing) return;

    await consumerAccessListingService.delete({
      organization,
      consumerAccessListing,
      auditScope: createSystemAuditScope({
        organization,
        job: 'consumerAccess/listingCleanup'
      })
    });
  });

export let consumerAccessDeleteQueueProcessor = consumerAccessDeleteQueue.process(
  async data => {
    let [organization, consumerAccess] = await Promise.all([
      db.organization.findUnique({ where: { id: data.organizationId } }),
      db.consumerAccess.findUnique({
        where: { id: data.consumerAccessId },
        include: consumerAccessInclude
      })
    ]);
    if (!organization || !consumerAccess) return;

    await consumerAccessService.deleteConsumerAccess({
      organization,
      consumerAccess,
      auditScope: createSystemAuditScope({
        organization,
        job: 'consumerAccess/cleanup'
      })
    });
  }
);
