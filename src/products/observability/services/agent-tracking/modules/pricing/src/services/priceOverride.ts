import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { BillingMode } from '@mtsrc/agent-tracking-spec';
import type { Pricing } from '@metorial/model-catalog/src/types';
import {
  Prisma,
  type Organization,
  type PriceOverride,
  type PriceOverrideKind,
  type PriceOverrideTarget
} from '@mtsrc/agent-tracking-db';
import { db, withTransaction } from '@mtsrc/agent-tracking-db';
import { getId } from '@mtsrc/agent-tracking-db';
import {
  queuePriceOverrideImpact,
  type PriceOverrideImpactScope
} from '@mtsrc/agent-tracking-module-knowledge';
import { dropOrganizationOverrides, publishPriceOverrideVersion } from '../lib/cache';
import {
  assertValidPriceOverride,
  normalizeBillingModes,
  type PriceOverrideDefinition
} from '../lib/validate';

export let priceOverrideInclude = {
  project: true
} satisfies Prisma.PriceOverrideInclude;

export type PriceOverrideWithRelations = Prisma.PriceOverrideGetPayload<{
  include: typeof priceOverrideInclude;
}>;

let impactScopeOf = (override: PriceOverride): PriceOverrideImpactScope => ({
  target: override.target,
  targetId: override.targetId,
  vendorId: override.vendorId,
  validFrom: override.validFrom,
  validTo: override.validTo
});

let pricingSignature = (override: PriceOverride) =>
  JSON.stringify([
    override.projectOid?.toString() ?? null,
    override.target,
    override.targetId,
    override.vendorId,
    override.billingModes,
    override.kind,
    override.multiplier?.toString() ?? null,
    override.rates,
    override.priority,
    override.validFrom.getTime(),
    override.validTo?.getTime() ?? null
  ]);

let definitionOf = (override: PriceOverride): PriceOverrideDefinition => ({
  target: override.target,
  targetId: override.targetId,
  vendorId: override.vendorId,
  billingModes: override.billingModes,
  kind: override.kind,
  multiplier: override.multiplier === null ? null : Number(override.multiplier),
  rates: override.rates,
  validFrom: override.validFrom,
  validTo: override.validTo
});

class PriceOverrideServiceImpl {
  async createPriceOverride(d: {
    organization: Organization;
    input: {
      name: string;
      reason?: string | null;
      projectId?: string | null;
      target: PriceOverrideTarget;
      targetId?: string | null;
      vendorId?: string | null;
      billingModes?: BillingMode[];
      kind: PriceOverrideKind;
      multiplier?: number | null;
      rates?: Pricing | null;
      priority?: number;
      createdBy?: string | null;
      validFrom?: Date;
      validTo?: Date | null;
    };
  }) {
    let definition: PriceOverrideDefinition = {
      target: d.input.target,
      targetId: d.input.targetId ?? null,
      vendorId: d.input.vendorId ?? null,
      billingModes: normalizeBillingModes(d.input.billingModes ?? []),
      kind: d.input.kind,
      multiplier: d.input.multiplier ?? null,
      rates: d.input.rates ?? null,
      validFrom: d.input.validFrom ?? new Date(),
      validTo: d.input.validTo ?? null
    };
    assertValidPriceOverride(definition);

    let [project] = await Promise.all([
      this.resolveProject({ organization: d.organization, projectId: d.input.projectId }),
      this.assertKnowledgeTargets(definition)
    ]);

    let override = await withTransaction(
      async tdb =>
        await tdb.priceOverride.create({
          data: {
            ...getId('priceOverride'),
            name: d.input.name,
            reason: d.input.reason ?? null,
            ...this.definitionData(definition),
            priority: d.input.priority ?? 0,
            createdBy: d.input.createdBy ?? null,
            organizationOid: d.organization.oid,
            projectOid: project?.oid ?? null
          },
          include: priceOverrideInclude
        })
    );

    await this.afterChange({
      organization: d.organization,
      impact: { projectOid: override.projectOid, before: null, after: override }
    });

    return override;
  }

  async updatePriceOverride(d: {
    organization: Organization;
    priceOverride: PriceOverride;
    input: {
      name?: string;
      reason?: string | null;
      projectId?: string | null;
      target?: PriceOverrideTarget;
      targetId?: string | null;
      vendorId?: string | null;
      billingModes?: BillingMode[];
      kind?: PriceOverrideKind;
      multiplier?: number | null;
      rates?: Pricing | null;
      priority?: number;
      validFrom?: Date;
      validTo?: Date | null;
    };
  }) {
    this.assertPriceOverrideActive(d.priceOverride);

    let project =
      d.input.projectId === undefined
        ? undefined
        : await this.resolveProject({
            organization: d.organization,
            projectId: d.input.projectId
          });

    let { before, after } = await withTransaction(async tdb => {
      await tdb.$executeRaw`SELECT 1 FROM "PriceOverride" WHERE oid = ${d.priceOverride.oid} FOR UPDATE`;

      let current = await tdb.priceOverride.findUniqueOrThrow({
        where: { oid: d.priceOverride.oid }
      });
      this.assertPriceOverrideActive(current);

      let definition = this.mergeDefinition(definitionOf(current), d.input);
      assertValidPriceOverride(definition);
      await this.assertKnowledgeTargets(definition);

      let updated = await tdb.priceOverride.update({
        where: { oid: current.oid },
        data: {
          name: d.input.name,
          reason: d.input.reason,
          ...this.definitionData(definition),
          priority: d.input.priority,
          ...(project === undefined ? {} : { projectOid: project?.oid ?? null })
        },
        include: priceOverrideInclude
      });

      return { before: current, after: updated };
    });

    await this.afterChange({
      organization: d.organization,
      impact:
        pricingSignature(before) == pricingSignature(after)
          ? null
          : {
              projectOid: before.projectOid == after.projectOid ? after.projectOid : null,
              before,
              after
            }
    });

    return after;
  }

  async archivePriceOverride(d: { organization: Organization; priceOverride: PriceOverride }) {
    let { archived, override } = await withTransaction(async tdb => {
      await tdb.$executeRaw`SELECT 1 FROM "PriceOverride" WHERE oid = ${d.priceOverride.oid} FOR UPDATE`;

      let current = await tdb.priceOverride.findUniqueOrThrow({
        where: { oid: d.priceOverride.oid },
        include: priceOverrideInclude
      });
      if (current.archivedAt) return { archived: false, override: current };

      let override = await tdb.priceOverride.update({
        where: { oid: current.oid },
        data: { archivedAt: new Date() },
        include: priceOverrideInclude
      });

      return { archived: true, override };
    });

    if (archived) {
      await this.afterChange({
        organization: d.organization,
        impact: { projectOid: override.projectOid, before: override, after: null }
      });
    }

    return override;
  }

  async getPriceOverrideById(d: { organization: Organization; priceOverrideId: string }) {
    let override = await db.priceOverride.findFirst({
      where: { id: d.priceOverrideId, organizationOid: d.organization.oid },
      include: priceOverrideInclude
    });
    if (!override) throw new ServiceError(notFoundError('price_override', d.priceOverrideId));

    return override;
  }

  async listPriceOverrides(d: {
    organization: Organization;
    projectIds?: string[];
    targets?: PriceOverrideTarget[];
    targetIds?: string[];
    kinds?: PriceOverrideKind[];
    includeArchived?: boolean;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.priceOverride.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              ...(d.includeArchived ? {} : { archivedAt: null }),
              ...(d.projectIds ? { project: { id: { in: d.projectIds } } } : {}),
              ...(d.targets ? { target: { in: d.targets } } : {}),
              ...(d.targetIds ? { targetId: { in: d.targetIds } } : {}),
              ...(d.kinds ? { kind: { in: d.kinds } } : {})
            },
            include: priceOverrideInclude
          })
      )
    );
  }

  private mergeDefinition(
    current: PriceOverrideDefinition,
    input: Partial<Omit<PriceOverrideDefinition, 'validFrom'>> & { validFrom?: Date }
  ): PriceOverrideDefinition {
    let kind = input.kind ?? current.kind;
    let target = input.target ?? current.target;

    // Switching kind or target to one that doesn't use a field clears it unless it was passed.
    let keep = <T>(value: T | null | undefined, previous: T | null, used: boolean) =>
      value !== undefined ? value : used ? previous : null;

    return {
      target,
      targetId: keep(input.targetId, current.targetId, target != 'all'),
      vendorId: input.vendorId !== undefined ? input.vendorId : current.vendorId,
      billingModes: normalizeBillingModes(input.billingModes ?? current.billingModes),
      kind,
      multiplier: keep(input.multiplier, current.multiplier, kind == 'multiplier'),
      rates: keep(input.rates, current.rates, kind == 'rates'),
      validFrom: input.validFrom ?? current.validFrom,
      validTo: input.validTo !== undefined ? input.validTo : current.validTo
    };
  }

  private definitionData(definition: PriceOverrideDefinition) {
    return {
      target: definition.target,
      targetId: definition.targetId,
      vendorId: definition.vendorId,
      billingModes: definition.billingModes,
      kind: definition.kind,
      multiplier: definition.multiplier === null ? null : String(definition.multiplier),
      rates: definition.rates ?? Prisma.DbNull,
      validFrom: definition.validFrom,
      validTo: definition.validTo
    };
  }

  // The bump runs after commit: published earlier, another process could reload the old rows
  // under the new version and keep them until the next change.
  private async afterChange(d: {
    organization: Organization;
    impact: {
      projectOid: bigint | null;
      before: PriceOverride | null;
      after: PriceOverride | null;
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

  private async knowledgeEntityExists(target: PriceOverrideTarget, id: string) {
    let where = { id };
    let select = { oid: true };

    if (target == 'model') return !!(await db.knowledgeModel.findUnique({ where, select }));
    if (target == 'family') return !!(await db.knowledgeFamily.findUnique({ where, select }));
    if (target == 'lab')
      return !!(await db.knowledgeOrganization.findUnique({ where, select }));
    if (target == 'offering') {
      return !!(await db.knowledgeOffering.findUnique({ where, select }));
    }
    if (target == 'agent') return !!(await db.knowledgeAgent.findUnique({ where, select }));

    return !!(await db.knowledgeVendor.findUnique({ where, select }));
  }

  private async assertKnowledgeTargets(definition: PriceOverrideDefinition) {
    let references: (readonly [PriceOverrideTarget, string])[] = [
      ...(definition.targetId ? [[definition.target, definition.targetId] as const] : []),
      ...(definition.vendorId ? [['vendor', definition.vendorId] as const] : [])
    ];

    let found = await Promise.all(
      references.map(([target, id]) => this.knowledgeEntityExists(target, id))
    );
    let missing = references.find((_, index) => !found[index]);

    if (missing) {
      throw new ServiceError(
        badRequestError({
          message: `The ${missing[0]} ${missing[1]} is not in the model knowledge.`
        })
      );
    }
  }

  private assertPriceOverrideActive(override: PriceOverride) {
    if (override.archivedAt) {
      throw new ServiceError(
        badRequestError({ message: `The price override ${override.id} is archived.` })
      );
    }
  }
}

export let priceOverrideService = Service.create(
  'priceOverrideService',
  () => new PriceOverrideServiceImpl()
).build();
