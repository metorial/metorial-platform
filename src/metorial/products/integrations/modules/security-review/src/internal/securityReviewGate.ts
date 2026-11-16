import { Service } from '@lowerdeck/service';
import { paymentRequiredError, ServiceError } from '@lowerdeck/error';
import { rateLimitExceededError, rateLimitService } from '@metorial/module-rate-limit';
import {
  db,
  type SecurityReview,
  type SecurityReviewBlockReason,
  type SecurityReviewThoroughness
} from '@metorial-subspace/db';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { flagService, isFlagEnabled } from '@metorial/module-flags';
import { securityReviewGlobalRepository } from '@metorial/multi-region';
import { isAiReviewAvailable, parseThoroughness } from '../definitions/thoroughness';

let GLOBAL_THOROUGHNESS: SecurityReviewThoroughness = 'standard';
let DEFAULT_THOROUGHNESS: SecurityReviewThoroughness = 'standard';

export type ReviewGate = {
  allowAi: boolean;
  blockReason?: SecurityReviewBlockReason;
  thoroughness: SecurityReviewThoroughness;
  billing: { instanceOid: bigint } | null;
};

class InternalSecurityReviewGateServiceImpl {
  private async getTenantProject(tenantOid: bigint) {
    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: tenantOid } });
    let project = await db.project.findUniqueOrThrow({ where: { oid: tenant.projectOid! } });

    return await metorialDb.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { organization: true }
    });
  }

  async isReviewGenerationAllowed(d: { review: SecurityReview }) {
    if (d.review.scope == 'global') return true;

    return await this.isTenantReviewGenerationAllowed({ tenantOid: d.review.tenantOid! });
  }

  async isTenantReviewGenerationAllowed(d: { tenantOid: bigint }) {
    let project = await this.getTenantProject(d.tenantOid);
    return await flagService.isFlagEnabledForScope({
      project,
      organization: project.organization,
      flag: 'paid-ai-reviews'
    });
  }

  async checkGenerationRateLimit(d: { review: SecurityReview; consume: boolean }) {
    if (d.review.scope == 'global') return { allowed: true } as const;

    let project = await this.getTenantProject(d.review.tenantOid!);
    let params = {
      project,
      organization: project.organization,
      usages: [{ key: 'protoguard.reviews' as const }]
    };

    return d.consume
      ? await rateLimitService.tryConsume(params)
      : await rateLimitService.check(params);
  }

  async assertGenerationAllowed(d: { review: SecurityReview }) {
    if (!(await this.isReviewGenerationAllowed(d))) {
      throw new ServiceError(
        paymentRequiredError({ message: 'Upgrade your plan to generate security reviews.' })
      );
    }

    let result = await this.checkGenerationRateLimit({ ...d, consume: false });
    if (!result.allowed) throw rateLimitExceededError(result);
  }

  private blocked(d: {
    blockReason: SecurityReviewBlockReason;
    thoroughness: SecurityReviewThoroughness;
  }): ReviewGate {
    return {
      allowAi: false,
      blockReason: d.blockReason,
      thoroughness: d.thoroughness,
      billing: null
    };
  }

  // Staff disable a provider as a whole: every version of a Metorial integration in every
  // region, or every version of a custom provider, including versions published later.
  async isAdminDisabled(d: { review: SecurityReview; slateRegistryId: string | null }) {
    if (d.review.isAdminDisabled) return true;

    if (d.review.scope == 'global') {
      if (!d.slateRegistryId) return false;

      let setting = await securityReviewGlobalRepository.getSubjectSetting({
        slateRegistryId: d.slateRegistryId
      });

      return !!setting?.disabled;
    }

    if (d.review.providerOid == null) return false;

    let disabled = await db.securityReview.findFirst({
      where: { providerOid: d.review.providerOid, scope: 'tenant', isAdminDisabled: true },
      select: { oid: true }
    });

    return !!disabled;
  }

  private async resolveGlobalGate(d: {
    review: SecurityReview;
    slateRegistryId: string | null;
  }): Promise<ReviewGate> {
    if (await this.isAdminDisabled(d)) {
      return this.blocked({
        blockReason: 'admin_disabled',
        thoroughness: GLOBAL_THOROUGHNESS
      });
    }

    return {
      allowAi: true,
      thoroughness: GLOBAL_THOROUGHNESS,
      billing: null
    };
  }

  private async resolveTenantGate(d: {
    review: SecurityReview;
    slateRegistryId: string | null;
  }): Promise<ReviewGate> {
    let blockedFor = (
      blockReason: SecurityReviewBlockReason,
      thoroughness = DEFAULT_THOROUGHNESS
    ) => this.blocked({ blockReason, thoroughness });

    if (await this.isAdminDisabled(d)) return blockedFor('admin_disabled');

    let tenant = d.review.tenantOid
      ? await db.tenant.findUnique({ where: { oid: d.review.tenantOid } })
      : null;
    if (!tenant?.projectOid) return blockedFor('ai_disabled');
    if (!tenant.aiAnalysisEnabled || tenant.reducedSubprocessors)
      return blockedFor('ai_disabled');

    let subspaceProject = await db.project.findUnique({ where: { oid: tenant.projectOid } });
    let project = subspaceProject
      ? await metorialDb.project.findUnique({
          where: { id: subspaceProject.id },
          include: { organization: true }
        })
      : null;
    if (!project) return blockedFor('ai_disabled');

    let flags = await flagService.getFlags({ organization: project.organization, project });
    let thoroughness =
      parseThoroughness(flags['ai-review-thoroughness']) ?? DEFAULT_THOROUGHNESS;
    if (!isFlagEnabled(flags['paid-ai-reviews'])) return blockedFor('billing', thoroughness);

    let instances = await db.instance.findMany({
      where: { projectOid: tenant.projectOid, status: 'active' },
      select: { id: true, type: true }
    });
    let instance =
      instances.find(candidate => candidate.type == 'production') ?? instances[0] ?? null;
    let coreInstance = instance
      ? await metorialDb.instance.findUnique({
          where: { id: instance.id },
          select: { oid: true }
        })
      : null;
    if (!coreInstance) return blockedFor('billing', thoroughness);

    return {
      allowAi: true,
      thoroughness,
      billing: { instanceOid: coreInstance.oid }
    };
  }

  async isUsageReviewEnabled(d: { tenantOid: bigint }) {
    let tenant = await db.tenant.findUnique({
      where: { oid: d.tenantOid },
      select: {
        usageReviewsEnabled: true,
        aiAnalysisEnabled: true,
        reducedSubprocessors: true
      }
    });

    return (
      !!tenant?.usageReviewsEnabled &&
      !!tenant.aiAnalysisEnabled &&
      !tenant.reducedSubprocessors
    );
  }

  // Usage reviews never leave a blocked revision behind: when anything stops them they
  // simply do not run, and the dashboard shows that no usage review is available.
  async resolveUsageGate(d: { review: SecurityReview }): Promise<ReviewGate | null> {
    if (!d.review.tenantOid) return null;
    if (!(await this.isUsageReviewEnabled({ tenantOid: d.review.tenantOid }))) return null;

    let gate = await this.resolveReviewGate({ review: d.review, slateRegistryId: null });
    if (!gate.allowAi || !gate.billing) return null;

    return gate;
  }

  async resolveReviewGate(d: { review: SecurityReview; slateRegistryId: string | null }) {
    let gate =
      d.review.scope == 'global'
        ? await this.resolveGlobalGate(d)
        : await this.resolveTenantGate(d);

    if (gate.allowAi && !isAiReviewAvailable()) {
      return this.blocked({ blockReason: 'ai_disabled', thoroughness: gate.thoroughness });
    }

    return gate;
  }
}

export let internalSecurityReviewGateService = Service.create(
  'internalSecurityReviewGateService',
  () => new InternalSecurityReviewGateServiceImpl()
).build();
