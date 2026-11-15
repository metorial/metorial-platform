import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type SecurityReport,
  type SecurityReportFinding,
  type SecurityReview,
  type SecurityReviewComputedScores,
  type SecurityReviewFinding,
  type SecurityReviewLevel,
  type SecurityReviewMode,
  type SecurityReviewRevision,
  type SecurityReviewRevisionContext,
  type SecurityReviewScope,
  type SecurityReviewStatus,
  type SecurityReviewSubjectType,
  type SecurityReviewThoroughness,
  withTransaction
} from '@metorial-subspace/db';
import { securityReviewGlobalRepository } from '@metorial/multi-region';
import { deserializeWorkspace } from '@metorial/review-engine';
import { internalSecurityReviewGateService } from '../internal/securityReviewGate';
import { internalSecurityReviewMirrorService } from '../internal/securityReviewMirror';
import { internalSecurityReviewSubjectService } from '../internal/securityReviewSubject';
import {
  isReportStatus,
  type StoredFinding,
  toFindingRows,
  toGlobalFindings,
  toReportFinding
} from '../lib/findings';
import { revisionSummaryColumns } from '../lib/revisions';
import { computeScores } from '../lib/scoring';
import { workspaceKeyFor, workspaceStore } from '../lib/storage';
import { buildEvidenceFiles, collectEvidence, hashEvidence } from '../lib/subjects';
import { enqueueSecurityReview } from '../queues/run';

let RECENT_FAILURE_MS = 7 * 24 * 60 * 60 * 1000;
let ADMIN_REVISIONS = 50;
let EXPORT_WORKSPACE_FILE_MAX_BYTES = 1024 * 1024;

export let securityReviewAdminInclude = {
  provider: true,
  providerVersion: { include: { slate: true } },
  tenant: true,
  currentRevision: true
} as const;

let adminRevisionInclude = {
  findings: { orderBy: [{ severity: 'desc' as const }, { key: 'asc' as const }] },
  runs: { omit: { log: true }, orderBy: { startedAt: 'desc' as const } }
};

class SecurityReviewAdminServiceImpl {
  private globalIdOf(d: { review: SecurityReview }) {
    return d.review.scope == 'global' ? d.review.globalId : null;
  }

  private isSameFinding(d: { a: SecurityReportFinding; b: SecurityReportFinding }) {
    return JSON.stringify(d.a) == JSON.stringify(d.b);
  }

  private mergeEditedFindings(d: {
    revision: SecurityReviewRevision & { findings: SecurityReviewFinding[] };
    edited: { finding: SecurityReportFinding; isLocked: boolean }[];
  }): StoredFinding[] {
    let editedKeys = new Set<string>();

    for (let entry of d.edited) {
      if (editedKeys.has(entry.finding.key)) {
        throw new ServiceError(
          badRequestError({ message: `Duplicate finding key: ${entry.finding.key}` })
        );
      }

      editedKeys.add(entry.finding.key);
    }

    let rowsByKey = new Map(d.revision.findings.map(row => [row.key, row]));

    let open = d.edited.map(entry => {
      let found = rowsByKey.get(entry.finding.key);
      let base = found && found.change != 'resolved' ? found : null;
      let isUnchanged =
        !!base &&
        base.isLocked == entry.isLocked &&
        this.isSameFinding({ a: toReportFinding(base), b: entry.finding });

      return {
        finding: entry.finding,
        origin:
          base && isUnchanged ? (base.origin as StoredFinding['origin']) : ('admin' as const),
        change: base ? base.change : ('new' as const),
        isLocked: entry.isLocked
      };
    });

    let resolved = d.revision.findings
      .filter(row => row.change == 'resolved' && !editedKeys.has(row.key))
      .map(row => ({
        finding: toReportFinding(row),
        origin: row.origin as StoredFinding['origin'],
        change: 'resolved' as const,
        isLocked: false
      }));

    return [...open, ...resolved];
  }

  // Edits keep the revision's id, number, trigger and dates so tenants cannot tell a staff
  // edit apart from the original run. Scores are recomputed from the edited content, but the
  // original confidence is kept since it describes evidence coverage, which an edit cannot add.
  private buildEdit(d: {
    revision: SecurityReviewRevision & { findings: SecurityReviewFinding[] };
    input: {
      report?: SecurityReport;
      findings?: { finding: SecurityReportFinding; isLocked: boolean }[];
    };
  }) {
    let baseReport = d.revision.report;
    let baseScores = d.revision.scores;

    if (!baseReport || !baseScores || !isReportStatus(d.revision.status)) {
      throw new ServiceError(
        badRequestError({ message: 'Only finished revisions with a report can be edited' })
      );
    }

    let provenance = d.input.report?.provenance ?? baseReport.provenance;
    if (!provenance) {
      throw new ServiceError(
        badRequestError({ message: 'The report needs a provenance section' })
      );
    }

    let edited =
      d.input.findings ??
      d.revision.findings
        .filter(row => row.change != 'resolved')
        .map(row => ({ finding: toReportFinding(row), isLocked: row.isLocked }));
    let findings = this.mergeEditedFindings({ revision: d.revision, edited });
    let openFindings = findings
      .filter(entry => entry.change != 'resolved')
      .map(entry => entry.finding);

    let report: SecurityReport = {
      ...baseReport,
      ...d.input.report,
      provenance,
      findings: openFindings
    };

    let tools = d.revision.awaitingTools ? null : (report.capabilities?.tools ?? []);
    let computed = computeScores({
      provenance: provenance.class,
      tools,
      behaviors: report.capabilities?.behaviors,
      findings: openFindings,
      coverage: {
        toolsExpected: tools ? Math.max(baseScores.counts.tools.expected, tools.length) : null,
        toolsReviewed: tools ? tools.length : 0,
        budgetExhausted: false,
        assessmentComplete: baseScores.assessmentComplete,
        awaitingTools: tools === null
      },
      previous: baseScores.delta
        ? { security: baseScores.delta.previousSecurity, risk: baseScores.delta.previousRisk }
        : undefined
    });
    let scores: SecurityReviewComputedScores = {
      ...computed,
      confidence: baseScores.confidence
    };

    return { report, scores, findings };
  }

  private async editGlobalRevision(d: {
    reviewId: string;
    revision: SecurityReviewRevision & { globalId: string };
    edit: ReturnType<SecurityReviewAdminServiceImpl['buildEdit']>;
    context: SecurityReviewRevisionContext;
  }) {
    await securityReviewGlobalRepository.snapshotRevision({
      id: d.revision.globalId,
      snapshotId: getId('securityReviewRevision').id
    });
    await securityReviewGlobalRepository.updateRevision({
      id: d.revision.globalId,
      data: {
        report: d.edit.report,
        scores: d.edit.scores,
        findings: toGlobalFindings(d.edit.findings),
        context: d.context,
        source: 'admin'
      }
    });

    await internalSecurityReviewMirrorService.mirrorGlobalReview({
      globalReviewId: d.reviewId
    });
  }

  private async editTenantRevision(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision & { findings: SecurityReviewFinding[] };
    edit: ReturnType<SecurityReviewAdminServiceImpl['buildEdit']>;
    context: SecurityReviewRevisionContext;
  }) {
    await withTransaction(async db => {
      let last = await db.securityReviewRevision.findFirst({
        where: { reviewOid: d.review.oid },
        orderBy: { number: 'desc' },
        select: { number: true }
      });

      let {
        oid,
        id,
        number,
        globalId,
        findings,
        createdAt,
        updatedAt,
        usageReport,
        usageScores,
        ...original
      } = d.revision;

      let snapshot = await db.securityReviewRevision.create({
        data: {
          ...original,
          ...getId('securityReviewRevision'),
          number: (last?.number ?? 0) + 1,
          snapshotOfId: id,
          report: original.report ?? undefined,
          scores: original.scores ?? undefined,
          census: original.census ?? undefined,
          context: original.context ?? undefined,
          usageReport: usageReport ?? undefined,
          usageScores: usageScores ?? undefined
        }
      });
      await db.securityReviewFinding.createMany({
        data: findings.map(({ oid, id, revisionOid, createdAt, ...finding }) => ({
          ...finding,
          ...getId('securityReviewFinding'),
          revisionOid: snapshot.oid
        }))
      });

      await db.securityReviewRevision.update({
        where: { oid: d.revision.oid },
        data: {
          report: d.edit.report,
          scores: d.edit.scores,
          ...revisionSummaryColumns(d.edit),
          context: d.context,
          source: 'admin'
        }
      });
      await db.securityReviewFinding.deleteMany({ where: { revisionOid: d.revision.oid } });
      await db.securityReviewFinding.createMany({
        data: toFindingRows(d.edit.findings, d.revision.oid)
      });
    });
  }

  async listSecurityReviews(d: {
    scopes?: SecurityReviewScope[];
    subjectTypes?: SecurityReviewSubjectType[];
    statuses?: SecurityReviewStatus[];
    risks?: SecurityReviewLevel[];
    providerIds?: string[];
    hasRecentFailures?: boolean;
  }) {
    let recentFailure = {
      status: 'failed' as const,
      createdAt: { gt: new Date(Date.now() - RECENT_FAILURE_MS) }
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.securityReview.findMany({
            ...opts,
            where: {
              scope: d.scopes ? { in: d.scopes } : undefined,
              subjectType: d.subjectTypes ? { in: d.subjectTypes } : undefined,
              status: d.statuses ? { in: d.statuses } : undefined,
              currentRevision: d.risks ? { risk: { in: d.risks } } : undefined,
              provider: d.providerIds ? { id: { in: d.providerIds } } : undefined,
              revisions: d.hasRecentFailures ? { some: recentFailure } : undefined
            },
            include: {
              ...securityReviewAdminInclude,
              revisions: {
                where: recentFailure,
                orderBy: { createdAt: 'desc' },
                take: 3,
                select: { id: true, failureCode: true, createdAt: true }
              }
            }
          })
      )
    );
  }

  async getSecurityReviewById(d: { securityReviewId: string }) {
    let review = await db.securityReview.findUnique({
      where: { id: d.securityReviewId },
      include: securityReviewAdminInclude
    });
    if (!review) throw new ServiceError(notFoundError('security_review', d.securityReviewId));

    return review;
  }

  async getSecurityReviewRevisionById(d: { review: SecurityReview; revisionId: string }) {
    let revision = await db.securityReviewRevision.findFirst({
      where: { id: d.revisionId, reviewOid: d.review.oid },
      include: { findings: true }
    });
    if (!revision)
      throw new ServiceError(notFoundError('security_review_revision', d.revisionId));

    return revision;
  }

  async getSecurityReviewDetails(d: {
    review: SecurityReview & {
      providerVersion: { slate: { slateIdOnRegistry: string | null } | null } | null;
    };
  }) {
    let revisions = await db.securityReviewRevision.findMany({
      where: { reviewOid: d.review.oid },
      orderBy: { number: 'desc' },
      take: ADMIN_REVISIONS,
      include: adminRevisionInclude
    });

    let isDisabled = await internalSecurityReviewGateService.isAdminDisabled({
      review: d.review,
      slateRegistryId: d.review.providerVersion?.slate?.slateIdOnRegistry ?? null
    });
    let costMicros = revisions
      .flatMap(revision => revision.runs)
      .reduce((sum, run) => sum + run.costMicros, 0n);

    return { revisions, isDisabled, costMicros };
  }

  async getSecurityReviewRunLog(d: { review: SecurityReview; runId: string }) {
    let run = await db.securityReviewRun.findFirst({
      where: { id: d.runId, revision: { reviewOid: d.review.oid } },
      select: {
        id: true,
        status: true,
        model: true,
        log: true,
        startedAt: true,
        completedAt: true
      }
    });
    if (!run) throw new ServiceError(notFoundError('security_review_run', d.runId));

    return run;
  }

  async exportSecurityReviewEvidence(d: {
    review: SecurityReview & { currentRevision: SecurityReviewRevision | null };
  }) {
    let evidence = await collectEvidence({ review: d.review });
    if (!evidence) {
      throw new ServiceError(
        badRequestError({ message: 'The evidence for this review cannot be collected' })
      );
    }

    let files = buildEvidenceFiles(evidence);
    let evidenceHash = hashEvidence(files);
    let currentEvidenceHash = d.review.currentRevision?.evidenceHash ?? null;

    let workspace: Record<string, string> = {};
    let omitted: string[] = [];

    let stored = await workspaceStore.load(
      workspaceKeyFor({ scope: d.review.scope, reviewId: d.review.id })
    );
    for (let [path, data] of Object.entries(stored ? deserializeWorkspace(stored) : {})) {
      let text = Buffer.from(data).toString('utf8');

      if (data.byteLength > EXPORT_WORKSPACE_FILE_MAX_BYTES || text.includes('\uFFFD')) {
        omitted.push(path);
        continue;
      }

      workspace[path] = text;
    }

    return {
      exportedAt: new Date(),
      reviewId: d.review.id,
      subject: { kind: evidence.kind, title: evidence.title },
      evidenceHash,
      currentRevisionEvidenceHash: currentEvidenceHash,
      matchesCurrentRevision: currentEvidenceHash == evidenceHash,
      files,
      workspace,
      omittedWorkspaceFiles: omitted
    };
  }

  async editSecurityReviewRevision(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision & { findings: SecurityReviewFinding[] };
    actorId: string;
    input: {
      report?: SecurityReport;
      findings?: { finding: SecurityReportFinding; isLocked: boolean }[];
    };
  }) {
    if (d.revision.snapshotOfId) {
      throw new ServiceError(
        badRequestError({ message: 'Snapshots of edited revisions are read-only' })
      );
    }

    let edit = this.buildEdit({ revision: d.revision, input: d.input });
    let context: SecurityReviewRevisionContext = {
      ...d.revision.context,
      admin: { actorId: d.actorId, action: 'edit', at: new Date().toISOString() }
    };

    let globalReviewId = this.globalIdOf(d);

    if (globalReviewId && d.revision.globalId) {
      await this.editGlobalRevision({
        reviewId: globalReviewId,
        revision: { ...d.revision, globalId: d.revision.globalId },
        edit,
        context
      });
    } else {
      await this.editTenantRevision({ review: d.review, revision: d.revision, edit, context });
    }

    return await db.securityReviewRevision.findUniqueOrThrow({
      where: { oid: d.revision.oid },
      include: adminRevisionInclude
    });
  }

  // Deleting a revision also deletes its pre-edit snapshots; when it was current, the latest
  // earlier report becomes current again.
  async deleteSecurityReviewRevision(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision;
  }) {
    if (d.revision.status == 'running' || d.revision.status == 'queued') {
      throw new ServiceError(
        badRequestError({ message: 'Running revisions cannot be deleted' })
      );
    }

    let snapshots = await db.securityReviewRevision.findMany({
      where: { reviewOid: d.review.oid, snapshotOfId: d.revision.id }
    });
    let isCurrent = d.review.currentRevisionOid == d.revision.oid;
    let fallback = isCurrent
      ? await db.securityReviewRevision.findFirst({
          where: {
            reviewOid: d.review.oid,
            snapshotOfId: null,
            number: { lt: d.revision.number },
            status: { in: ['completed', 'completed_with_gaps', 'blocked'] }
          },
          orderBy: { number: 'desc' }
        })
      : null;

    let globalReviewId = this.globalIdOf(d);

    if (globalReviewId && d.revision.globalId) {
      for (let revision of [d.revision, ...snapshots]) {
        if (revision.globalId) {
          await securityReviewGlobalRepository.deleteRevision({ id: revision.globalId });
        }
      }

      if (isCurrent) {
        await securityReviewGlobalRepository.setCurrentRevision({
          reviewId: globalReviewId,
          revisionId: fallback?.globalId ?? null
        });
      }

      await internalSecurityReviewMirrorService.mirrorGlobalReview({ globalReviewId });
      return;
    }

    await withTransaction(async db => {
      if (isCurrent) {
        await db.securityReview.update({
          where: { oid: d.review.oid },
          data: { currentRevisionOid: fallback?.oid ?? null }
        });
      }

      await db.securityReviewRevision.deleteMany({
        where: { oid: { in: [d.revision.oid, ...snapshots.map(snapshot => snapshot.oid)] } }
      });
    });
  }

  async setSecurityReviewDeleted(d: { review: SecurityReview; deleted: boolean }) {
    let status: SecurityReviewStatus = d.deleted ? 'deleted' : 'active';
    let globalReviewId = this.globalIdOf(d);

    if (globalReviewId) {
      await securityReviewGlobalRepository.setReviewStatus({ id: globalReviewId, status });
      await internalSecurityReviewMirrorService.mirrorGlobalReview({ globalReviewId });
    } else {
      await db.securityReview.update({ where: { oid: d.review.oid }, data: { status } });
    }

    return await this.getSecurityReviewById({ securityReviewId: d.review.id });
  }

  async setSecurityReviewDisabled(d: {
    review: SecurityReview & {
      providerVersion: { slate: { slateIdOnRegistry: string | null } | null } | null;
    };
    disabled: boolean;
  }) {
    if (d.review.scope == 'global') {
      let slateRegistryId = d.review.providerVersion?.slate?.slateIdOnRegistry;
      if (!slateRegistryId) {
        throw new ServiceError(
          badRequestError({ message: 'The review has no slate to disable' })
        );
      }

      await securityReviewGlobalRepository.setSubjectDisabled({
        slateRegistryId,
        disabled: d.disabled
      });
    } else {
      await db.securityReview.updateMany({
        where:
          d.review.providerOid != null
            ? { providerOid: d.review.providerOid, scope: 'tenant' }
            : { oid: d.review.oid },
        data: { isAdminDisabled: d.disabled }
      });
    }

    return await this.getSecurityReviewById({ securityReviewId: d.review.id });
  }

  private assertManuallyRunnable(review: SecurityReview) {
    if (review.subjectType != 'slate_version' && review.subjectType != 'skill_version') {
      throw new ServiceError(
        badRequestError({
          message: 'Only Metorial integration and skill reviews can be generated manually'
        })
      );
    }
  }

  async rerunSecurityReview(d: {
    review: SecurityReview;
    actorId: string;
    mode?: SecurityReviewMode;
    thoroughness?: SecurityReviewThoroughness;
  }) {
    this.assertManuallyRunnable(d.review);

    if (d.review.status == 'deleted') {
      throw new ServiceError(
        badRequestError({ message: 'Restore the review before re-running it' })
      );
    }

    await enqueueSecurityReview({
      reviewId: d.review.id,
      trigger: 'admin',
      force: true,
      immediate: true,
      admin: { actorId: d.actorId, mode: d.mode, thoroughness: d.thoroughness }
    });
  }

  async generateSlateSecurityReview(d: {
    providerVersionId: string;
    actorId: string;
    mode?: SecurityReviewMode;
    thoroughness?: SecurityReviewThoroughness;
  }) {
    let providerVersion = await db.providerVersion.findUnique({
      where: { id: d.providerVersionId }
    });
    if (!providerVersion) {
      throw new ServiceError(notFoundError('provider_version', d.providerVersionId));
    }

    let review = await internalSecurityReviewSubjectService.ensureSlateReview({
      providerVersionOid: providerVersion.oid
    });
    if (!review) {
      throw new ServiceError(
        badRequestError({ message: 'This provider version is not a Metorial integration' })
      );
    }

    await this.rerunSecurityReview({ ...d, review });

    return await this.getSecurityReviewById({ securityReviewId: review.id });
  }

  async generateSkillSecurityReview(d: {
    skillId: string;
    actorId: string;
    mode?: SecurityReviewMode;
    thoroughness?: SecurityReviewThoroughness;
  }) {
    let review = await internalSecurityReviewSubjectService.ensureSkillReview({
      skillId: d.skillId
    });
    if (!review) throw new ServiceError(notFoundError('skill', d.skillId));

    await this.rerunSecurityReview({ ...d, review });

    return await this.getSecurityReviewById({ securityReviewId: review.id });
  }
}

export let securityReviewAdminService = Service.create(
  'securityReviewAdminService',
  () => new SecurityReviewAdminServiceImpl()
).build();
