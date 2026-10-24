import {
  forbiddenError,
  notFoundError,
  ServiceError,
  tooManyRequestsError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Provider,
  type ProviderVariant,
  type ProviderVersion,
  type SecurityReview,
  type Tenant
} from '@metorial-subspace/db';
import { type MetorialFacing, resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { internalSecurityReviewSubjectService } from '../internal/securityReviewSubject';
import { enqueueSecurityReview } from '../queues/run';

let REASSESS_INTERVAL_MS = 24 * 60 * 60 * 1000;
let VISIBLE_REVISIONS = 5;
let FAILED_RETRY_MS = 60 * 60 * 1000;

let reportStatuses = ['completed', 'completed_with_gaps', 'blocked'] as const;

let reviewInclude = { provider: true, providerVersion: true } as const;

let revisionInclude = {
  findings: { orderBy: [{ severity: 'desc' as const }, { key: 'asc' as const }] }
};

class SecurityReviewServiceImpl {
  private async loadState(d: SecurityReview) {
    let review = await db.securityReview.findUniqueOrThrow({
      where: { oid: d.oid },
      include: reviewInclude
    });

    let [current, inProgress] = await Promise.all([
      review.currentRevisionOid
        ? db.securityReviewRevision.findUnique({
            where: { oid: review.currentRevisionOid },
            include: revisionInclude
          })
        : null,
      // Without a report yet, a failed first run is surfaced so clients stop waiting for it.
      db.securityReviewRevision.findFirst({
        where: {
          reviewOid: review.oid,
          snapshotOfId: null,
          status: {
            in: review.currentRevisionOid
              ? ['queued', 'running']
              : ['queued', 'running', 'failed']
          }
        },
        orderBy: { number: 'desc' },
        include: revisionInclude
      })
    ]);

    return { review, current, inProgress };
  }

  private assertVisible(d: { review: SecurityReview; tenant: Tenant }) {
    if (d.review.status == 'deleted') {
      throw new ServiceError(notFoundError('security_review', d.review.id));
    }
    if (d.review.scope == 'tenant' && d.review.tenantOid != d.tenant.oid) {
      throw new ServiceError(notFoundError('security_review', d.review.id));
    }
  }

  private async ensureForProviderVersion(d: {
    tenant: Tenant;
    providerVersion: ProviderVersion;
  }) {
    let review: SecurityReview | null = null;

    if (d.providerVersion.slateVersionOid) {
      review = await internalSecurityReviewSubjectService.ensureSlateReview({
        providerVersionOid: d.providerVersion.oid
      });
    } else {
      let customProviderVersion = await db.customProviderVersion.findFirst({
        where: { providerVersionOid: d.providerVersion.oid, tenantOid: d.tenant.oid },
        select: { oid: true }
      });
      if (customProviderVersion) {
        review = await internalSecurityReviewSubjectService.ensureCustomProviderReview({
          customProviderVersionOid: customProviderVersion.oid
        });
      }
    }

    if (!review) return null;
    this.assertVisible({ review, tenant: d.tenant });

    let state = await this.loadState(review);

    let canRetry =
      !state.inProgress ||
      (state.inProgress.status == 'failed' &&
        (state.inProgress.completedAt ?? state.inProgress.createdAt).getTime() <
          Date.now() - FAILED_RETRY_MS);

    if (!state.current && canRetry && review.status != 'disabled') {
      await enqueueSecurityReview({
        reviewId: review.id,
        trigger: review.scope == 'global' ? 'page_open' : 'deployment',
        immediate: true
      });
    }

    return state;
  }

  async getSecurityReviewForProvider(
    d: MetorialFacing<{
      provider: Provider & { defaultVariant: ProviderVariant | null };
      providerVersionId?: string;
    }>
  ) {
    let { tenant } = await resolveMetorialFacing(d);

    let currentVersionOid = d.provider.defaultVariant?.currentVersionOid;
    let providerVersion = d.providerVersionId
      ? await db.providerVersion.findFirst({
          where: {
            providerOid: d.provider.oid,
            OR: [{ id: d.providerVersionId }, { identifier: d.providerVersionId }]
          }
        })
      : currentVersionOid
        ? await db.providerVersion.findUnique({ where: { oid: currentVersionOid } })
        : null;
    if (!providerVersion) {
      throw new ServiceError(
        notFoundError('provider_version', d.providerVersionId ?? d.provider.id)
      );
    }

    let state = await this.ensureForProviderVersion({ tenant, providerVersion });
    if (!state) throw new ServiceError(notFoundError('security_review', d.provider.id));

    return state;
  }

  async getSecurityReviewById(d: MetorialFacing<{ securityReviewId: string }>) {
    let { tenant } = await resolveMetorialFacing(d);

    let review = await db.securityReview.findUnique({ where: { id: d.securityReviewId } });
    if (!review) throw new ServiceError(notFoundError('security_review', d.securityReviewId));
    this.assertVisible({ review, tenant });

    return await this.loadState(review);
  }

  async listSecurityReviewRevisions(d: { review: SecurityReview }) {
    let visible = await db.securityReviewRevision.findMany({
      where: {
        reviewOid: d.review.oid,
        snapshotOfId: null,
        status: { in: [...reportStatuses] }
      },
      orderBy: { number: 'desc' },
      take: VISIBLE_REVISIONS,
      select: { oid: true }
    });

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.securityReviewRevision.findMany({
            ...opts,
            where: { oid: { in: visible.map(revision => revision.oid) } },
            include: revisionInclude
          })
      )
    );
  }

  async getSecurityReviewRevision(d: { review: SecurityReview; revisionId: string }) {
    let revision = await db.securityReviewRevision.findFirst({
      where: {
        id: d.revisionId,
        reviewOid: d.review.oid,
        snapshotOfId: null,
        status: { in: [...reportStatuses, 'queued', 'running'] }
      },
      include: revisionInclude
    });
    if (!revision)
      throw new ServiceError(notFoundError('security_review_revision', d.revisionId));

    return revision;
  }

  async reassessSecurityReview(d: { review: SecurityReview }) {
    if (d.review.scope != 'tenant') {
      throw new ServiceError(
        forbiddenError({
          message: 'Reviews of Metorial integrations are maintained by Metorial'
        })
      );
    }
    if (d.review.status == 'disabled' || d.review.isAdminDisabled) {
      throw new ServiceError(
        forbiddenError({ message: 'Security reviews are disabled for this provider' })
      );
    }

    let recent = await db.securityReviewRevision.findFirst({
      where: {
        reviewOid: d.review.oid,
        trigger: 'reassess',
        createdAt: { gt: new Date(Date.now() - REASSESS_INTERVAL_MS) }
      },
      select: { oid: true }
    });
    if (recent) {
      throw new ServiceError(
        tooManyRequestsError({
          message: 'This provider can be reassessed once every 24 hours'
        })
      );
    }

    await enqueueSecurityReview({
      reviewId: d.review.id,
      trigger: 'reassess',
      force: true,
      immediate: true
    });

    return await this.loadState(d.review);
  }
}

export let securityReviewService = Service.create(
  'securityReviewService',
  () => new SecurityReviewServiceImpl()
).build();
