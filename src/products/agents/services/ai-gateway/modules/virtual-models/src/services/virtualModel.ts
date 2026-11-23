import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  withTransaction,
  type Instance,
  type Organization,
  type Prisma
} from '@mtsrc/ai-gateway-db';
import { Events } from '@mtsrc/ai-gateway-events';
import { routeService } from '@mtsrc/ai-gateway-module-routing';
import {
  decisionModels,
  hasFeatures,
  resolveInstanceSettings,
  virtualModelLimits,
  virtualModelSlugPattern,
  type VirtualModelDefinition
} from '@mtsrc/ai-gateway-spec';
import { compileDefinition } from '../lib/cel';
import { findCustomerDecisionConnection } from '../lib/decisionBackend';
import { definitionTargets, invalidDefinition, parseDefinition } from '../lib/definition';
import { virtualModelSlugTakenError } from '../lib/errors';
import { forgetInstanceVirtualModels } from '../lib/lookup';

export type VirtualModelScope = { organization: Organization; instance: Instance };

export let virtualModelInclude = {
  currentVersion: true,
  instance: true
} as const;

export type VirtualModelWithRelations = Prisma.VirtualModelGetPayload<{
  include: typeof virtualModelInclude;
}>;

let scopeWhere = (scope: VirtualModelScope): Prisma.VirtualModelWhereInput => ({
  organizationOid: scope.organization.oid,
  instanceOid: scope.instance.oid
});

let normalizeSlug = (slug: string) => slug.trim().toLowerCase();

class VirtualModelServiceImpl {
  async createVirtualModel(d: {
    scope: VirtualModelScope;
    input: { slug: string; name: string; description?: string | null; definition: unknown };
  }) {
    let slug = normalizeSlug(d.input.slug);
    this.assertSlugFormat(slug);
    await this.assertSlugAvailable({ scope: d.scope, slug });

    let validated = await this.validateDefinition({
      scope: d.scope,
      definition: d.input.definition,
      slug
    });

    let virtualModel = await withTransaction(async tdb => {
      let created = await tdb.virtualModel.create({
        data: {
          ...getId('virtualModel'),
          slug,
          name: d.input.name,
          description: d.input.description,
          organizationOid: d.scope.organization.oid,
          instanceOid: d.scope.instance.oid
        }
      });

      let version = await tdb.virtualModelVersion.create({
        data: {
          ...getId('virtualModelVersion'),
          number: 1,
          definition: validated.definition,
          targetModelSlugs: validated.targetModelSlugs,
          virtualModelOid: created.oid
        }
      });

      return await tdb.virtualModel.update({
        where: { oid: created.oid },
        data: { currentVersionOid: version.oid },
        include: virtualModelInclude
      });
    });

    await this.fireChanged(virtualModel, 'upserted');

    return { virtualModel, warnings: validated.warnings };
  }

  async getVirtualModelById(d: {
    scope: VirtualModelScope;
    virtualModelId: string;
    includeArchived?: boolean;
  }) {
    let virtualModel = await db.virtualModel.findFirst({
      where: {
        ...scopeWhere(d.scope),
        OR: [{ id: d.virtualModelId }, { slug: normalizeSlug(d.virtualModelId) }],
        archivedAt: d.includeArchived ? undefined : null
      },
      include: virtualModelInclude
    });
    if (!virtualModel) throw new ServiceError(notFoundError('virtual_model'));

    return virtualModel;
  }

  async listVirtualModels(d: { scope: VirtualModelScope }) {
    let where: Prisma.VirtualModelWhereInput = { ...scopeWhere(d.scope), archivedAt: null };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.virtualModel.findMany({ ...opts, where, include: virtualModelInclude })
      )
    );
  }

  async updateVirtualModel(d: {
    scope: VirtualModelScope;
    virtualModel: VirtualModelWithRelations;
    input: { name?: string; description?: string | null; definition?: unknown };
  }) {
    this.assertActive(d.virtualModel);

    let validated =
      d.input.definition === undefined
        ? null
        : await this.validateDefinition({
            scope: d.scope,
            definition: d.input.definition,
            slug: d.virtualModel.slug
          });

    let virtualModel = await withTransaction(async tdb => {
      let versionOid = validated
        ? (await this.createVersion({ tdb, virtualModel: d.virtualModel, ...validated })).oid
        : undefined;

      return await tdb.virtualModel.update({
        where: { oid: d.virtualModel.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          currentVersionOid: versionOid
        },
        include: virtualModelInclude
      });
    });

    await this.fireChanged(virtualModel, 'upserted');

    return { virtualModel, warnings: validated?.warnings ?? [] };
  }

  async listVersions(d: { virtualModel: VirtualModelWithRelations }) {
    let where: Prisma.VirtualModelVersionWhereInput = { virtualModelOid: d.virtualModel.oid };

    return Paginator.create(({ prisma }) =>
      prisma(async opts => await db.virtualModelVersion.findMany({ ...opts, where }))
    );
  }

  async getVersion(d: { virtualModel: VirtualModelWithRelations; versionId: string }) {
    let version = await db.virtualModelVersion.findFirst({
      where: { virtualModelOid: d.virtualModel.oid, id: d.versionId }
    });
    if (!version) throw new ServiceError(notFoundError('virtual_model_version'));

    return version;
  }

  // Rolling back appends a copy of the old version rather than moving the pointer, so the version
  // list stays an append-only history of what was live when.
  async rollbackVirtualModel(d: {
    scope: VirtualModelScope;
    virtualModel: VirtualModelWithRelations;
    versionId: string;
  }) {
    let version = await this.getVersion(d);
    if (version.oid == d.virtualModel.currentVersionOid) {
      return { virtualModel: d.virtualModel, warnings: [] };
    }

    return await this.updateVirtualModel({
      scope: d.scope,
      virtualModel: d.virtualModel,
      input: { definition: version.definition }
    });
  }

  async archiveVirtualModel(d: { virtualModel: VirtualModelWithRelations }) {
    if (d.virtualModel.archivedAt) return d.virtualModel;

    let virtualModel = await db.virtualModel.update({
      where: { oid: d.virtualModel.oid },
      data: { archivedAt: new Date() },
      include: virtualModelInclude
    });

    await this.fireChanged(virtualModel, 'archived');

    return virtualModel;
  }

  async validateDefinition(d: {
    scope: VirtualModelScope;
    definition: unknown;
    slug?: string;
  }) {
    let definition = parseDefinition(d.definition);
    compileDefinition(definition);

    let virtualSlugs = new Set(
      (
        await db.virtualModel.findMany({
          where: { ...scopeWhere(d.scope), archivedAt: null },
          select: { slug: true }
        })
      ).map(virtualModel => virtualModel.slug)
    );
    if (d.slug) virtualSlugs.add(d.slug);

    let targets = definitionTargets(definition);
    let resolved = await Promise.all(
      targets.map(async target => {
        if (virtualSlugs.has(normalizeSlug(target))) {
          throw invalidDefinition(
            `"${target}" is a virtual model. Virtual models cannot route to other virtual models.`
          );
        }

        let result = await routeService.resolveModel({ model: target }).catch(() => null);
        if (!result) throw invalidDefinition(`The model "${target}" does not exist.`);

        return result.model.slug;
      })
    );

    await this.validateDecision({ scope: d.scope, definition });

    let warnings: string[] = [];
    if (d.slug) {
      let shadowed = await routeService.resolveModel({ model: d.slug }).catch(() => null);
      if (shadowed) {
        warnings.push(
          `"${d.slug}" also names the catalog model ${shadowed.model.slug}. Requests for "${d.slug}" in this instance use the virtual model.`
        );
      }
    }

    return { definition, targetModelSlugs: [...new Set(resolved)], warnings };
  }

  private async validateDecision(d: {
    scope: VirtualModelScope;
    definition: VirtualModelDefinition;
  }) {
    let config = d.definition.decision;
    if (!config) return;

    let model = decisionModels[config.model];
    let zdrRequired = resolveInstanceSettings(d.scope.instance.settings).zdrRequired;

    if (!config.connectionId) {
      if (zdrRequired) {
        throw invalidDefinition(
          `This instance requires zero data retention. Use your own ${model.name} connection with zero data retention enabled.`
        );
      }
      return;
    }

    let connection = await findCustomerDecisionConnection({
      instanceId: d.scope.instance.id,
      connectionId: config.connectionId
    });
    if (!connection) throw invalidDefinition('The decision model connection does not exist.');
    if (connection.provider.slug != model.providerSlug) {
      throw invalidDefinition(
        `${model.name} needs a ${model.providerSlug} connection, but the connection is for ${connection.provider.slug}.`
      );
    }
    if (zdrRequired && !hasFeatures(connection.features, ['zdr'])) {
      throw invalidDefinition(
        'This instance requires zero data retention. Enable it on the decision model connection first.'
      );
    }
  }

  private async createVersion(d: {
    tdb: Prisma.TransactionClient;
    virtualModel: VirtualModelWithRelations;
    definition: VirtualModelDefinition;
    targetModelSlugs: string[];
  }) {
    let latest = await d.tdb.virtualModelVersion.findFirst({
      where: { virtualModelOid: d.virtualModel.oid },
      orderBy: { number: 'desc' },
      select: { number: true }
    });

    return await d.tdb.virtualModelVersion.create({
      data: {
        ...getId('virtualModelVersion'),
        number: (latest?.number ?? 0) + 1,
        definition: d.definition,
        targetModelSlugs: d.targetModelSlugs,
        virtualModelOid: d.virtualModel.oid
      }
    });
  }

  private assertSlugFormat(slug: string) {
    if (
      !slug ||
      slug.length > virtualModelLimits.slugLength ||
      !virtualModelSlugPattern.test(slug)
    ) {
      throw invalidDefinition(
        'The slug must start with a letter or digit and contain only lowercase letters, digits, ".", "_" and "-".'
      );
    }
  }

  private async assertSlugAvailable(d: { scope: VirtualModelScope; slug: string }) {
    let existing = await db.virtualModel.findFirst({
      where: { ...scopeWhere(d.scope), slug: d.slug, archivedAt: null },
      select: { oid: true }
    });
    if (existing) throw new ServiceError(virtualModelSlugTakenError());
  }

  private assertActive(virtualModel: VirtualModelWithRelations) {
    if (virtualModel.archivedAt) {
      throw new ServiceError(
        preconditionFailedError({ message: 'An archived virtual model cannot be changed.' })
      );
    }
  }

  private async fireChanged(
    virtualModel: VirtualModelWithRelations,
    change: 'upserted' | 'archived'
  ) {
    await forgetInstanceVirtualModels(virtualModel.instance.id).catch(error =>
      console.warn('[ai-gateway] Could not clear virtual model cache', virtualModel.id, error)
    );

    await Events.fire('virtualModels.virtualModel.changed:after', {
      virtualModelId: virtualModel.id,
      instanceId: virtualModel.instance.id,
      change
    });
  }
}

export let virtualModelService = Service.create(
  'virtualModelService',
  () => new VirtualModelServiceImpl()
).build();
