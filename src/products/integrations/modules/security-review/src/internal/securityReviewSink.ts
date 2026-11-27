import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type SecurityReview,
  type SecurityReviewRevision
} from '@metorial-subspace/db';
import { securityReviewGlobalRepository } from '@metorial/multi-region';
import {
  SECURITY_REVIEW_PROMPT_VERSION,
  SECURITY_REVIEW_RULES_VERSION
} from '../definitions/versions';
import { isReportStatus, toGlobalFindings } from '../lib/findings';
import type { RevisionCompletion, RevisionProgress, RevisionStart } from '../lib/revisions';
import { internalSecurityReviewMirrorService } from './securityReviewMirror';
import { internalSecurityReviewStoreService } from './securityReviewStore';

// Global reviews are written to the multi-region store first and then mirrored into this
// region immediately; other regions pick them up through the mirror cron.
class InternalSecurityReviewSinkServiceImpl {
  private isGlobal(review: SecurityReview): review is SecurityReview & { globalId: string } {
    return review.scope == 'global' && !!review.globalId;
  }

  async start(d: { review: SecurityReview; start: RevisionStart }) {
    if (!this.isGlobal(d.review)) {
      return await internalSecurityReviewStoreService.createTenantRevision(d);
    }

    let revision = await securityReviewGlobalRepository.createRevision({
      id: getId('securityReviewRevision').id,
      reviewId: d.review.globalId,
      mode: d.start.mode,
      trigger: d.start.trigger,
      rulesVersion: SECURITY_REVIEW_RULES_VERSION,
      promptVersion: SECURITY_REVIEW_PROMPT_VERSION,
      thoroughness: d.start.thoroughness,
      workspaceKey: d.start.workspaceKey,
      context: d.start.context
    });
    await securityReviewGlobalRepository.updateRevision({
      id: revision.id,
      data: { stage: 'collecting' }
    });

    await internalSecurityReviewMirrorService.mirrorGlobalReview({
      globalReviewId: d.review.globalId
    });

    return await db.securityReviewRevision.findUniqueOrThrow({
      where: { globalId: revision.id }
    });
  }

  async progress(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision;
    progress: RevisionProgress;
  }) {
    if (this.isGlobal(d.review) && d.revision.globalId) {
      await securityReviewGlobalRepository.updateRevision({
        id: d.revision.globalId,
        data: {
          stage: d.progress.stage,
          activity: d.progress.activity,
          report: d.progress.report,
          scores: d.progress.scores
        }
      });
    }

    await internalSecurityReviewStoreService.updateTenantRevision(d);
  }

  async complete(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision;
    completion: RevisionCompletion;
  }) {
    if (!this.isGlobal(d.review) || !d.revision.globalId) {
      await internalSecurityReviewStoreService.completeTenantRevision(d);
      return;
    }

    await securityReviewGlobalRepository.completeRevision({
      id: d.revision.globalId,
      reviewId: d.review.globalId,
      makeCurrent: isReportStatus(d.completion.status),
      data: {
        status: d.completion.status,
        mode: d.completion.mode,
        blockReason: d.completion.blockReason ?? null,
        failureCode: d.completion.failureCode ?? null,
        stage: null,
        activity: null,
        report: d.completion.report,
        scores: d.completion.scores,
        findings: toGlobalFindings(d.completion.findings),
        census: d.completion.census,
        context: d.completion.context,
        awaitingTools: d.completion.awaitingTools,
        evidenceHash: d.completion.evidenceHash,
        model: d.completion.model ?? null,
        costMicros: BigInt(d.completion.costMicros)
      }
    });

    await internalSecurityReviewMirrorService.mirrorGlobalReview({
      globalReviewId: d.review.globalId
    });
  }
}

export let internalSecurityReviewSinkService = Service.create(
  'internalSecurityReviewSinkService',
  () => new InternalSecurityReviewSinkServiceImpl()
).build();
