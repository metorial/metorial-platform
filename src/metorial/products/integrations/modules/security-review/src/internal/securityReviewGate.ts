import { Service } from '@lowerdeck/service';
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
  includeTenantSignals: boolean;
  billing: { instanceOid: bigint } | null;
};

class InternalSecurityReviewGateServiceImpl {
  private blocked(d: {
    blockReason: SecurityReviewBlockReason;
    thoroughness: SecurityReviewThoroughness;
  }): ReviewGate {
    return {
      allowAi: false,
      blockReason: d.blockReason,
      thoroughness: d.thoroughness,
      includeTenantSignals: false,
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
      includeTenantSignals: false,
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
      includeTenantSignals: true,
      billing: { instanceOid: coreInstance.oid }
    };
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
