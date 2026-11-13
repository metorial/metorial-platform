import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  KnowledgeChangeType,
  KnowledgeEntity,
  Prisma
} from '../../../prisma/generated/client';
import { db } from '../../db';

export let knowledgeChangeInclude = {
  snapshot: { select: { id: true } }
} satisfies Prisma.KnowledgeChangeInclude;

export type KnowledgeChangeWithSnapshot = Prisma.KnowledgeChangeGetPayload<{
  include: typeof knowledgeChangeInclude;
}>;

class KnowledgeChangeServiceImpl {
  async listChanges(d: {
    entities?: KnowledgeEntity[];
    entityIds?: string[];
    changes?: KnowledgeChangeType[];
    snapshotId?: string;
  }) {
    let snapshot = d.snapshotId
      ? await db.knowledgeSnapshot.findUnique({
          where: { id: d.snapshotId },
          select: { oid: true }
        })
      : null;
    if (d.snapshotId && !snapshot) {
      throw new ServiceError(notFoundError('knowledge_snapshot', d.snapshotId));
    }

    let where: Prisma.KnowledgeChangeWhereInput = {
      entity: d.entities ? { in: d.entities } : undefined,
      entityId: d.entityIds ? { in: d.entityIds } : undefined,
      change: d.changes ? { in: d.changes } : undefined,
      snapshotOid: snapshot?.oid
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.knowledgeChange.findMany({
            ...opts,
            where,
            include: knowledgeChangeInclude
          })
      )
    );
  }
}

export let knowledgeChangeService = Service.create(
  'knowledgeChangeService',
  () => new KnowledgeChangeServiceImpl()
).build();
