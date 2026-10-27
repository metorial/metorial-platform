import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type SecurityReview,
  type SecurityReviewRevision,
  withTransaction
} from '@metorial-subspace/db';
import { skillSecurityVerdict } from '@metorial-subspace/module-security-review-request';
import {
  SECURITY_REVIEW_PROMPT_VERSION,
  SECURITY_REVIEW_RULES_VERSION
} from '../definitions/versions';
import { isReportStatus, toFindingRows } from '../lib/findings';
import {
  type RevisionCompletion,
  type RevisionProgress,
  type RevisionStart,
  revisionSummaryColumns
} from '../lib/revisions';
import { markSkillDestinationsDirty } from './skillDistribution';

class InternalSecurityReviewStoreServiceImpl {
  async previousFindingsFor(d: { revisionOid: bigint | null }) {
    if (!d.revisionOid) return [];

    return await db.securityReviewFinding.findMany({ where: { revisionOid: d.revisionOid } });
  }

  async createTenantRevision(d: { review: SecurityReview; start: RevisionStart }) {
    return await withTransaction(async db => {
      let last = await db.securityReviewRevision.findFirst({
        where: { reviewOid: d.review.oid },
        orderBy: { number: 'desc' },
        select: { number: true }
      });

      return await db.securityReviewRevision.create({
        data: {
          ...getId('securityReviewRevision'),
          reviewOid: d.review.oid,
          number: (last?.number ?? 0) + 1,
          status: 'running',
          mode: d.start.mode,
          trigger: d.start.trigger,
          thoroughness: d.start.thoroughness,
          rulesVersion: SECURITY_REVIEW_RULES_VERSION,
          promptVersion: SECURITY_REVIEW_PROMPT_VERSION,
          context: d.start.context,
          workspaceKey: d.start.workspaceKey,
          skillVersionId: d.start.skillVersionId,
          stage: 'collecting',
          startedAt: new Date(),
          heartbeatAt: new Date()
        }
      });
    });
  }

  async updateTenantRevision(d: {
    revision: SecurityReviewRevision;
    progress: RevisionProgress;
  }) {
    await db.securityReviewRevision.update({
      where: { oid: d.revision.oid },
      data: {
        stage: d.progress.stage,
        activity: d.progress.activity,
        report: d.progress.report,
        scores: d.progress.scores,
        heartbeatAt: new Date()
      }
    });
  }

  async completeTenantRevision(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision;
    completion: RevisionCompletion;
  }) {
    let completion = d.completion;

    let previousCurrent =
      d.review.skillId && d.review.currentRevisionOid
        ? await db.securityReviewRevision.findUnique({
            where: { oid: d.review.currentRevisionOid }
          })
        : null;

    let completed = await withTransaction(async db => {
      let revision = await db.securityReviewRevision.update({
        where: { oid: d.revision.oid },
        data: {
          status: completion.status,
          mode: completion.mode,
          blockReason: completion.blockReason ?? null,
          failureCode: completion.failureCode ?? null,
          stage: null,
          activity: null,
          report: completion.report,
          scores: completion.scores,
          ...revisionSummaryColumns(completion),
          awaitingTools: completion.awaitingTools,
          census: completion.census,
          evidenceHash: completion.evidenceHash,
          contentHash: completion.contentHash ?? null,
          specificationOid: completion.specificationOid ?? null,
          context: completion.context,
          completedAt: new Date(),
          heartbeatAt: new Date()
        }
      });

      await db.securityReviewFinding.deleteMany({ where: { revisionOid: revision.oid } });
      await db.securityReviewFinding.createMany({
        data: toFindingRows(completion.findings, revision.oid)
      });

      if (isReportStatus(completion.status)) {
        await db.securityReview.update({
          where: { oid: d.review.oid },
          data: {
            currentRevisionOid: revision.oid,
            status: d.review.status == 'outdated' ? 'outdated' : 'active'
          }
        });
      }

      return revision;
    });

    if (d.review.skillId && isReportStatus(completion.status)) {
      await this.refreshSkillDistribution({
        review: d.review,
        previous: previousCurrent,
        current: completed
      });
    }

    return completed;
  }

  // Enforcement reads the verdict at sync time, so a changed verdict needs a new sync.
  private async refreshSkillDistribution(d: {
    review: SecurityReview;
    previous: SecurityReviewRevision | null;
    current: SecurityReviewRevision;
  }) {
    let before = skillSecurityVerdict({
      review: d.review,
      current: d.previous,
      inProgress: null
    });
    let after = skillSecurityVerdict({
      review: d.review,
      current: d.current,
      inProgress: null
    });
    if (before == after) return;

    await markSkillDestinationsDirty(d.review.skillId!);
  }

  // A re-check that finds nothing new leaves no revision of its own. Its run moves to the
  // revision it verified, so the cost stays visible and revision numbers stay gapless.
  async completeRecheck(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision;
    previous: SecurityReviewRevision;
    evidenceHash: string;
  }) {
    await withTransaction(async db => {
      await db.securityReviewRun.updateMany({
        where: { revisionOid: d.revision.oid },
        data: { revisionOid: d.previous.oid }
      });
      await db.securityReviewRevision.delete({ where: { oid: d.revision.oid } });

      await db.securityReviewRevision.update({
        where: { oid: d.previous.oid },
        data: { evidenceHash: d.evidenceHash }
      });
      await db.securityReview.update({
        where: { oid: d.review.oid },
        data: { lastCheckedAt: new Date() }
      });
    });
  }

  async createRun(d: {
    revision: SecurityReviewRevision;
    model: string;
    maxCostMicros: number;
    isBillable: boolean;
  }) {
    return await db.securityReviewRun.create({
      data: {
        ...getId('securityReviewRun'),
        revisionOid: d.revision.oid,
        status: 'running',
        model: d.model,
        maxCostMicros: BigInt(d.maxCostMicros),
        isBillable: d.isBillable
      }
    });
  }

  async setRunLog(d: { runOid: bigint; log: string }) {
    await db.securityReviewRun.update({ where: { oid: d.runOid }, data: { log: d.log } });
  }

  async updateRun(d: {
    runOid: bigint;
    status?: 'succeeded' | 'failed' | 'budget_exhausted';
    steps: number;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      costMicros: number;
    };
    billed?: boolean;
    errorMessage?: string;
    log?: string;
  }) {
    await db.securityReviewRun.update({
      where: { oid: d.runOid },
      data: {
        status: d.status,
        errorMessage: d.errorMessage,
        log: d.log,
        steps: d.steps,
        inputTokens: d.usage.inputTokens,
        outputTokens: d.usage.outputTokens,
        cachedInputTokens: d.usage.cachedInputTokens,
        costMicros: BigInt(d.usage.costMicros),
        completedAt: d.status ? new Date() : undefined,
        billedAt: d.billed ? new Date() : undefined
      }
    });
  }
}

export let internalSecurityReviewStoreService = Service.create(
  'internalSecurityReviewStoreService',
  () => new InternalSecurityReviewStoreServiceImpl()
).build();
