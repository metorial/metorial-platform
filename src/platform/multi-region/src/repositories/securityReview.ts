import { Service } from '@lowerdeck/service';
import { cell } from '../cell';
import { globalDB, type Prisma } from '../db';

let SYNC_PAGE_SIZE = 200;

class SecurityReviewGlobalRepositoryImpl {
  async getReviewBySubjectKey(d: { subjectKey: string }) {
    return await globalDB.globalSecurityReview.findUnique({
      where: { subjectKey: d.subjectKey },
      include: { revisions: { orderBy: { number: 'desc' }, take: 1 } }
    });
  }

  async getRevision(d: { id: string }) {
    return await globalDB.globalSecurityReviewRevision.findUnique({ where: { id: d.id } });
  }

  async listRevisions(d: { reviewId: string; take: number }) {
    return await globalDB.globalSecurityReviewRevision.findMany({
      where: { reviewId: d.reviewId },
      orderBy: { number: 'desc' },
      take: d.take
    });
  }

  async ensureReview(d: {
    id: string;
    subjectKey: string;
    slateRegistryId: string;
    slateVersionRegistryId: string;
  }) {
    return await globalDB.globalSecurityReview.upsert({
      where: { subjectKey: d.subjectKey },
      create: {
        id: d.id,
        subjectKey: d.subjectKey,
        slateRegistryId: d.slateRegistryId,
        slateVersionRegistryId: d.slateVersionRegistryId,
        status: 'active'
      },
      update: {}
    });
  }

  async createRevision(d: {
    id: string;
    reviewId: string;
    mode: string;
    trigger: string;
    rulesVersion: string;
    promptVersion: string;
    thoroughness: string;
    workspaceKey?: string;
    context?: Prisma.InputJsonValue;
  }) {
    let currentCell = await cell;
    let last = await globalDB.globalSecurityReviewRevision.findFirst({
      where: { reviewId: d.reviewId },
      orderBy: { number: 'desc' },
      select: { number: true }
    });

    return await globalDB.globalSecurityReviewRevision.create({
      data: {
        ...d,
        number: (last?.number ?? 0) + 1,
        status: 'running',
        runnerOid: currentCell.oid,
        startedAt: new Date(),
        heartbeatAt: new Date()
      }
    });
  }

  async updateRevision(d: {
    id: string;
    data: Prisma.GlobalSecurityReviewRevisionUpdateInput;
  }) {
    return await globalDB.globalSecurityReviewRevision.update({
      where: { id: d.id },
      data: { ...d.data, heartbeatAt: new Date() }
    });
  }

  async completeRevision(d: {
    id: string;
    reviewId: string;
    makeCurrent: boolean;
    data: Prisma.GlobalSecurityReviewRevisionUpdateInput;
  }) {
    let currentCell = await cell;

    return await globalDB.$transaction(async tx => {
      let revision = await tx.globalSecurityReviewRevision.update({
        where: { id: d.id },
        data: { ...d.data, completedAt: new Date(), heartbeatAt: new Date() }
      });

      if (d.makeCurrent) {
        await tx.globalSecurityReview.update({
          where: { id: d.reviewId },
          data: { currentRevisionId: revision.id, ownerOid: currentCell.oid }
        });
      }

      return revision;
    });
  }

  // Keeps the pre-edit content of a revision as a hidden copy so staff edits can be made in
  // place without changing the revision tenants see.
  async snapshotRevision(d: { id: string; snapshotId: string }) {
    return await globalDB.$transaction(async tx => {
      let { id, number, createdAt, updatedAt, ...original } =
        await tx.globalSecurityReviewRevision.findUniqueOrThrow({ where: { id: d.id } });
      let last = await tx.globalSecurityReviewRevision.findFirst({
        where: { reviewId: original.reviewId },
        orderBy: { number: 'desc' },
        select: { number: true }
      });

      return await tx.globalSecurityReviewRevision.create({
        data: {
          ...original,
          id: d.snapshotId,
          number: (last?.number ?? 0) + 1,
          snapshotOfId: id,
          report: original.report ?? undefined,
          scores: original.scores ?? undefined,
          findings: original.findings ?? undefined,
          census: original.census ?? undefined,
          context: original.context ?? undefined
        }
      });
    });
  }

  async setReviewStatus(d: { id: string; status: string }) {
    await globalDB.globalSecurityReview.update({
      where: { id: d.id },
      data: { status: d.status }
    });
  }

  async setCurrentRevision(d: { reviewId: string; revisionId: string | null }) {
    await globalDB.globalSecurityReview.update({
      where: { id: d.reviewId },
      data: { currentRevisionId: d.revisionId }
    });
  }

  async deleteRevision(d: { id: string }) {
    await globalDB.globalSecurityReviewRevision.update({
      where: { id: d.id },
      data: { status: 'deleted' }
    });
  }

  async markOutdatedForSlate(d: { slateRegistryId: string; exceptSubjectKey: string }) {
    await globalDB.globalSecurityReview.updateMany({
      where: {
        slateRegistryId: d.slateRegistryId,
        subjectKey: { not: d.exceptSubjectKey },
        status: 'active'
      },
      data: { status: 'outdated' }
    });
  }

  async getSubjectSetting(d: { slateRegistryId: string }) {
    return await globalDB.globalSecurityReviewSubjectSetting.findUnique({
      where: { slateRegistryId: d.slateRegistryId }
    });
  }

  async setSubjectDisabled(d: { slateRegistryId: string; disabled: boolean }) {
    return await globalDB.globalSecurityReviewSubjectSetting.upsert({
      where: { slateRegistryId: d.slateRegistryId },
      create: { slateRegistryId: d.slateRegistryId, disabled: d.disabled },
      update: { disabled: d.disabled }
    });
  }

  async listReviewsUpdatedSince(d: { since: Date; cursor?: string }) {
    return await globalDB.globalSecurityReview.findMany({
      where: { updatedAt: { gte: d.since }, id: d.cursor ? { gt: d.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: SYNC_PAGE_SIZE
    });
  }

  async listRevisionsUpdatedSince(d: { since: Date; cursor?: string }) {
    return await globalDB.globalSecurityReviewRevision.findMany({
      where: { updatedAt: { gte: d.since }, id: d.cursor ? { gt: d.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: SYNC_PAGE_SIZE
    });
  }

  async listSubjectSettingsUpdatedSince(d: { since: Date; cursor?: string }) {
    return await globalDB.globalSecurityReviewSubjectSetting.findMany({
      where: {
        updatedAt: { gte: d.since },
        slateRegistryId: d.cursor ? { gt: d.cursor } : undefined
      },
      orderBy: { slateRegistryId: 'asc' },
      take: SYNC_PAGE_SIZE
    });
  }

  async listStaleRunningRevisions(d: { heartbeatBefore: Date }) {
    return await globalDB.globalSecurityReviewRevision.findMany({
      where: { status: 'running', heartbeatAt: { lt: d.heartbeatBefore } },
      select: { id: true, reviewId: true },
      take: SYNC_PAGE_SIZE
    });
  }

  async listReviews(d: { status?: string[]; cursor?: string; take: number }) {
    return await globalDB.globalSecurityReview.findMany({
      where: {
        status: d.status ? { in: d.status } : undefined,
        id: d.cursor ? { lt: d.cursor } : undefined
      },
      orderBy: { id: 'desc' },
      take: d.take,
      include: { revisions: { orderBy: { number: 'desc' }, take: 1 } }
    });
  }

  async getReview(d: { id: string }) {
    return await globalDB.globalSecurityReview.findUnique({
      where: { id: d.id },
      include: { revisions: { orderBy: { number: 'desc' } } }
    });
  }
}

export let SECURITY_REVIEW_SYNC_PAGE_SIZE = SYNC_PAGE_SIZE;

export let securityReviewGlobalRepository = Service.create(
  'securityReviewGlobalRepository',
  () => new SecurityReviewGlobalRepositoryImpl()
).build();
