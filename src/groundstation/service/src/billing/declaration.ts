import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { BillingMode } from '@metorial/groundstation-spec';
import type { BillingDeclaration, Organization, Prisma } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { followMerged } from '../entities/resolve';
import { getId } from '../id';
import { queuePriceOverrideImpact, type PriceOverrideImpactScope } from '../knowledge/impact';
import { dropOrganizationOverrides, publishPriceOverrideVersion } from '../pricing/cache';
import {
  assertValidBillingDeclaration,
  normalizePlan,
  type BillingDeclarationDefinition
} from './validate';

export let billingDeclarationInclude = {
  project: true,
  user: true
} satisfies Prisma.BillingDeclarationInclude;

export type BillingDeclarationWithRelations = Prisma.BillingDeclarationGetPayload<{
  include: typeof billingDeclarationInclude;
}>;

let impactScopeOf = (declaration: BillingDeclaration): PriceOverrideImpactScope => ({
  target: declaration.agentId ? 'agent' : 'all',
  targetId: declaration.agentId,
  vendorId: null,
  validFrom: declaration.validFrom,
  validTo: declaration.validTo
});

let matchingSignature = (declaration: BillingDeclaration) =>
  JSON.stringify([
    declaration.projectOid?.toString() ?? null,
    declaration.userOid?.toString() ?? null,
    declaration.agentId,
    declaration.mode,
    declaration.plan,
    declaration.validFrom.getTime(),
    declaration.validTo?.getTime() ?? null
  ]);

let definitionOf = (declaration: BillingDeclaration): BillingDeclarationDefinition => ({
  mode: declaration.mode,
  plan: declaration.plan,
  agentId: declaration.agentId,
  validFrom: declaration.validFrom,
  validTo: declaration.validTo
});

class BillingDeclarationServiceImpl {
  async createBillingDeclaration(d: {
    organization: Organization;
    input: {
      name: string;
      reason?: string | null;
      projectId?: string | null;
      userId?: string | null;
      agentId?: string | null;
      mode: BillingMode;
      plan?: string | null;
      createdBy?: string | null;
      validFrom?: Date;
      validTo?: Date | null;
    };
  }) {
    let definition: BillingDeclarationDefinition = {
      mode: d.input.mode,
      plan: normalizePlan(d.input.plan),
      agentId: d.input.agentId ?? null,
      validFrom: d.input.validFrom ?? new Date(),
      validTo: d.input.validTo ?? null
    };
    assertValidBillingDeclaration(definition);

    let [project, user] = await Promise.all([
      this.resolveProject({ organization: d.organization, projectId: d.input.projectId }),
      this.resolveUser({ organization: d.organization, userId: d.input.userId }),
      this.assertKnowledgeAgent(definition.agentId)
    ]);

    let declaration = await withTransaction(
      async tdb =>
        await tdb.billingDeclaration.create({
          data: {
            ...getId('billingDeclaration'),
            name: d.input.name,
            reason: d.input.reason ?? null,
            ...definition,
            createdBy: d.input.createdBy ?? null,
            organizationOid: d.organization.oid,
            projectOid: project?.oid ?? null,
            userOid: user?.oid ?? null
          },
          include: billingDeclarationInclude
        })
    );

    await this.afterChange({
      organization: d.organization,
      impact: { projectOid: declaration.projectOid, before: null, after: declaration }
    });

    return declaration;
  }

  async updateBillingDeclaration(d: {
    organization: Organization;
    billingDeclaration: BillingDeclaration;
    input: {
      name?: string;
      reason?: string | null;
      projectId?: string | null;
      userId?: string | null;
      agentId?: string | null;
      mode?: BillingMode;
      plan?: string | null;
      validFrom?: Date;
      validTo?: Date | null;
    };
  }) {
    this.assertBillingDeclarationActive(d.billingDeclaration);

    let [project, user] = await Promise.all([
      d.input.projectId === undefined
        ? undefined
        : this.resolveProject({ organization: d.organization, projectId: d.input.projectId }),
      d.input.userId === undefined
        ? undefined
        : this.resolveUser({ organization: d.organization, userId: d.input.userId })
    ]);

    let { before, after } = await withTransaction(async tdb => {
      await tdb.$executeRaw`SELECT 1 FROM "BillingDeclaration" WHERE oid = ${d.billingDeclaration.oid} FOR UPDATE`;

      let current = await tdb.billingDeclaration.findUniqueOrThrow({
        where: { oid: d.billingDeclaration.oid }
      });
      this.assertBillingDeclarationActive(current);

      let definition = this.mergeDefinition(definitionOf(current), d.input);
      assertValidBillingDeclaration(definition);
      if (definition.agentId != current.agentId) {
        await this.assertKnowledgeAgent(definition.agentId);
      }

      let updated = await tdb.billingDeclaration.update({
        where: { oid: current.oid },
        data: {
          name: d.input.name,
          reason: d.input.reason,
          ...definition,
          ...(project === undefined ? {} : { projectOid: project?.oid ?? null }),
          ...(user === undefined ? {} : { userOid: user?.oid ?? null })
        },
        include: billingDeclarationInclude
      });

      return { before: current, after: updated };
    });

    await this.afterChange({
      organization: d.organization,
      impact:
        matchingSignature(before) == matchingSignature(after)
          ? null
          : {
              projectOid: before.projectOid == after.projectOid ? after.projectOid : null,
              before,
              after
            }
    });

    return after;
  }

  async archiveBillingDeclaration(d: {
    organization: Organization;
    billingDeclaration: BillingDeclaration;
  }) {
    let { archived, declaration } = await withTransaction(async tdb => {
      await tdb.$executeRaw`SELECT 1 FROM "BillingDeclaration" WHERE oid = ${d.billingDeclaration.oid} FOR UPDATE`;

      let current = await tdb.billingDeclaration.findUniqueOrThrow({
        where: { oid: d.billingDeclaration.oid },
        include: billingDeclarationInclude
      });
      if (current.archivedAt) return { archived: false, declaration: current };

      let declaration = await tdb.billingDeclaration.update({
        where: { oid: current.oid },
        data: { archivedAt: new Date() },
        include: billingDeclarationInclude
      });

      return { archived: true, declaration };
    });

    if (archived) {
      await this.afterChange({
        organization: d.organization,
        impact: { projectOid: declaration.projectOid, before: declaration, after: null }
      });
    }

    return declaration;
  }

  async getBillingDeclarationById(d: {
    organization: Organization;
    billingDeclarationId: string;
  }) {
    let declaration = await db.billingDeclaration.findFirst({
      where: { id: d.billingDeclarationId, organizationOid: d.organization.oid },
      include: billingDeclarationInclude
    });
    if (!declaration) {
      throw new ServiceError(notFoundError('billing_declaration', d.billingDeclarationId));
    }

    return declaration;
  }

  async listBillingDeclarations(d: {
    organization: Organization;
    projectIds?: string[];
    userIds?: string[];
    agentIds?: string[];
    modes?: BillingMode[];
    includeArchived?: boolean;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.billingDeclaration.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              ...(d.includeArchived ? {} : { archivedAt: null }),
              ...(d.projectIds ? { project: { id: { in: d.projectIds } } } : {}),
              ...(d.userIds ? { user: { id: { in: d.userIds } } } : {}),
              ...(d.agentIds ? { agentId: { in: d.agentIds } } : {}),
              ...(d.modes ? { mode: { in: d.modes } } : {})
            },
            include: billingDeclarationInclude
          })
      )
    );
  }

  private mergeDefinition(
    current: BillingDeclarationDefinition,
    input: {
      mode?: BillingMode;
      plan?: string | null;
      agentId?: string | null;
      validFrom?: Date;
      validTo?: Date | null;
    }
  ): BillingDeclarationDefinition {
    return {
      mode: input.mode ?? current.mode,
      plan: input.plan !== undefined ? normalizePlan(input.plan) : current.plan,
      agentId: input.agentId !== undefined ? input.agentId : current.agentId,
      validFrom: input.validFrom ?? current.validFrom,
      validTo: input.validTo !== undefined ? input.validTo : current.validTo
    };
  }

  // Declarations share the overrides' cache entry and version key, and their impact runs
  // through the override impact queue: a rebuild prices with both at once.
  private async afterChange(d: {
    organization: Organization;
    impact: {
      projectOid: bigint | null;
      before: BillingDeclaration | null;
      after: BillingDeclaration | null;
    } | null;
  }) {
    await publishPriceOverrideVersion(d.organization.id);
    dropOrganizationOverrides(d.organization.id);

    if (!d.impact) return;

    await queuePriceOverrideImpact({
      organizationOid: d.organization.oid,
      projectOid: d.impact.projectOid,
      before: d.impact.before ? impactScopeOf(d.impact.before) : null,
      after: d.impact.after ? impactScopeOf(d.impact.after) : null
    });
  }

  private async resolveProject(d: {
    organization: Organization;
    projectId: string | null | undefined;
  }) {
    if (!d.projectId) return null;

    let project = await db.project.findFirst({
      where: {
        OR: [{ id: d.projectId }, { ref: d.projectId }],
        organizationOid: d.organization.oid,
        archivedAt: null
      }
    });
    if (!project) throw new ServiceError(notFoundError('project', d.projectId));

    return project;
  }

  private async resolveUser(d: {
    organization: Organization;
    userId: string | null | undefined;
  }) {
    if (!d.userId) return null;

    let entity = await db.entity.findFirst({
      where: { id: d.userId, organizationOid: d.organization.oid }
    });
    if (!entity) throw new ServiceError(notFoundError('entity', d.userId));

    let user = await followMerged(entity);
    if (
      user.kind != 'user' ||
      user.status == 'merged' ||
      user.status == 'archived' ||
      user.archivedAt
    ) {
      throw new ServiceError(
        badRequestError({ message: `The entity ${d.userId} is not an active user.` })
      );
    }

    return user;
  }

  private async assertKnowledgeAgent(agentId: string | null) {
    if (!agentId) return;

    let agent = await db.knowledgeAgent.findUnique({
      where: { id: agentId },
      select: { oid: true }
    });
    if (!agent) {
      throw new ServiceError(
        badRequestError({ message: `The agent ${agentId} is not in the model knowledge.` })
      );
    }
  }

  private assertBillingDeclarationActive(declaration: BillingDeclaration) {
    if (declaration.archivedAt) {
      throw new ServiceError(
        badRequestError({ message: `The billing declaration ${declaration.id} is archived.` })
      );
    }
  }
}

export let billingDeclarationService = Service.create(
  'billingDeclarationService',
  () => new BillingDeclarationServiceImpl()
).build();
