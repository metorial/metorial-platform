import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type SecurityReport,
  type SecurityReviewBlockReason,
  type SecurityReviewComputedScores,
  type SecurityReviewMode,
  type SecurityReviewRevisionContext,
  type SecurityReviewRevisionStatus,
  type SecurityReviewSource,
  type SecurityReviewStage,
  type SecurityReviewStatus,
  type SecurityReviewThoroughness,
  type SecurityReviewTrigger,
  type SecuritySpecCensus,
  withTransaction
} from '@metorial-subspace/db';
import { securityReviewGlobalRepository } from '@metorial/multi-region';
import type { GlobalFinding } from '../lib/findings';
import { revisionSummaryColumns } from '../lib/revisions';

let MIRRORED_REVISIONS = 20;

class InternalSecurityReviewMirrorServiceImpl {
  private async resolveLocalSlateVersion(d: {
    slateRegistryId: string;
    slateVersionRegistryId: string;
  }) {
    let slate = await db.slate.findFirst({ where: { slateIdOnRegistry: d.slateRegistryId } });
    if (!slate) return null;

    let slateVersion = await db.slateVersion.findFirst({
      where: { slateOid: slate.oid, versionIdOnRegistry: d.slateVersionRegistryId }
    });
    if (!slateVersion) return null;

    return await db.providerVersion.findFirst({
      where: { slateVersionOid: slateVersion.oid },
      orderBy: { createdAt: 'desc' }
    });
  }

  private async ensureLocalReview(d: {
    global: NonNullable<Awaited<ReturnType<typeof securityReviewGlobalRepository.getReview>>>;
  }) {
    let local = await db.securityReview.findUnique({ where: { globalId: d.global.id } });
    if (local) return local;

    let providerVersion = await this.resolveLocalSlateVersion(d.global);
    if (!providerVersion) return null;

    return await db.securityReview.upsert({
      where: { subjectKey: d.global.subjectKey },
      create: {
        oid: getId('securityReview').oid,
        id: d.global.id,
        globalId: d.global.id,
        subjectType: 'slate_version',
        scope: 'global',
        subjectKey: d.global.subjectKey,
        status: d.global.status as SecurityReviewStatus,
        providerOid: providerVersion.providerOid,
        providerVersionOid: providerVersion.oid
      },
      update: { globalId: d.global.id }
    });
  }

  async mirrorGlobalReview(d: { globalReviewId: string }) {
    let global = await securityReviewGlobalRepository.getReview({ id: d.globalReviewId });
    if (!global) return null;

    let review = await this.ensureLocalReview({ global });
    if (!review) return null;

    let revisions = global.revisions
      .filter(revision => revision.status != 'deleted')
      .slice(0, MIRRORED_REVISIONS);

    return await withTransaction(async db => {
      let localByGlobalId = new Map<string, bigint>();

      for (let revision of revisions) {
        let scores = revision.scores as SecurityReviewComputedScores | null;
        let report = revision.report as SecurityReport | null;

        let data = {
          number: revision.number,
          snapshotOfId: revision.snapshotOfId,
          status: revision.status as SecurityReviewRevisionStatus,
          stage: revision.stage as SecurityReviewStage | null,
          activity: revision.activity,
          mode: revision.mode as SecurityReviewMode,
          trigger: revision.trigger as SecurityReviewTrigger,
          blockReason: revision.blockReason as SecurityReviewBlockReason | null,
          failureCode: revision.failureCode,
          report: report ?? undefined,
          scores: scores ?? undefined,
          ...(scores && report
            ? revisionSummaryColumns({ scores, report })
            : {
                securityScore: null,
                exposure: null,
                risk: null,
                confidence: null,
                provenanceClass: null
              }),
          awaitingTools: revision.awaitingTools,
          census: (revision.census as SecuritySpecCensus | null) ?? undefined,
          context: (revision.context as SecurityReviewRevisionContext | null) ?? undefined,
          evidenceHash: revision.evidenceHash,
          rulesVersion: revision.rulesVersion,
          promptVersion: revision.promptVersion,
          thoroughness: revision.thoroughness as SecurityReviewThoroughness,
          source: revision.source as SecurityReviewSource,
          workspaceKey: revision.workspaceKey,
          heartbeatAt: revision.heartbeatAt,
          startedAt: revision.startedAt,
          completedAt: revision.completedAt
        };

        let mirrored = await db.securityReviewRevision.upsert({
          where: { globalId: revision.id },
          create: {
            oid: getId('securityReviewRevision').oid,
            id: revision.id,
            globalId: revision.id,
            reviewOid: review.oid,
            ...data
          },
          update: data
        });
        localByGlobalId.set(revision.id, mirrored.oid);

        let findings = (revision.findings as GlobalFinding[] | null) ?? [];

        await db.securityReviewFinding.deleteMany({ where: { revisionOid: mirrored.oid } });
        await db.securityReviewFinding.createMany({
          data: findings.map(finding => ({
            ...getId('securityReviewFinding'),
            revisionOid: mirrored.oid,
            key: finding.key,
            kind: finding.kind,
            category: finding.category,
            severity: finding.severity,
            change: finding.change,
            origin: finding.origin,
            isLocked: finding.isLocked,
            value: finding.value
          }))
        });
      }

      let staleRevisions = await db.securityReviewRevision.findMany({
        where: {
          reviewOid: review.oid,
          globalId: { notIn: revisions.map(revision => revision.id) }
        },
        select: { oid: true }
      });

      if (staleRevisions.length) {
        let staleOids = staleRevisions.map(revision => revision.oid);

        await db.securityReview.updateMany({
          where: { oid: review.oid, currentRevisionOid: { in: staleOids } },
          data: { currentRevisionOid: null }
        });
        await db.securityReviewRevision.deleteMany({ where: { oid: { in: staleOids } } });
      }

      return await db.securityReview.update({
        where: { oid: review.oid },
        data: {
          status: global.status as SecurityReviewStatus,
          currentRevisionOid: global.currentRevisionId
            ? (localByGlobalId.get(global.currentRevisionId) ?? null)
            : null
        }
      });
    });
  }
}

export let internalSecurityReviewMirrorService = Service.create(
  'internalSecurityReviewMirrorService',
  () => new InternalSecurityReviewMirrorServiceImpl()
).build();
