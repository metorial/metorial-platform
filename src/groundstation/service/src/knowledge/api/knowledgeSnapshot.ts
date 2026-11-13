import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { KnowledgeSnapshotStatus, Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';

let snapshotQuery = {
  omit: { archive: true },
  include: { source: { select: { id: true, url: true } } }
} satisfies Prisma.KnowledgeSnapshotDefaultArgs;

type SnapshotRow = Prisma.KnowledgeSnapshotGetPayload<typeof snapshotQuery>;

export type KnowledgeSnapshotSummary = SnapshotRow & { hasArchive: boolean };

class KnowledgeSnapshotServiceImpl {
  async listSnapshots(d: { statuses?: KnowledgeSnapshotStatus[] }) {
    let where: Prisma.KnowledgeSnapshotWhereInput = {
      status: d.statuses ? { in: d.statuses } : undefined
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await this.withArchiveFlag(
            await db.knowledgeSnapshot.findMany({ ...opts, ...snapshotQuery, where })
          )
      )
    );
  }

  async getSnapshotById(d: { snapshotId: string }) {
    let snapshot = await db.knowledgeSnapshot.findUnique({
      ...snapshotQuery,
      where: { id: d.snapshotId }
    });
    if (!snapshot) throw new ServiceError(notFoundError('knowledge_snapshot', d.snapshotId));

    return (await this.withArchiveFlag([snapshot]))[0]!;
  }

  async getCurrentSnapshot() {
    let snapshot = await db.knowledgeSnapshot.findFirst({
      ...snapshotQuery,
      where: { status: 'current' },
      orderBy: { generatedAt: 'desc' }
    });
    if (!snapshot) return null;

    return (await this.withArchiveFlag([snapshot]))[0]!;
  }

  private async withArchiveFlag(
    snapshots: SnapshotRow[]
  ): Promise<KnowledgeSnapshotSummary[]> {
    let archived = await db.knowledgeSnapshot.findMany({
      where: { oid: { in: snapshots.map(snapshot => snapshot.oid) }, archive: { not: null } },
      select: { oid: true }
    });

    return snapshots.map(snapshot => ({
      ...snapshot,
      hasArchive: archived.some(row => row.oid == snapshot.oid)
    }));
  }
}

export let knowledgeSnapshotService = Service.create(
  'knowledgeSnapshotService',
  () => new KnowledgeSnapshotServiceImpl()
).build();
