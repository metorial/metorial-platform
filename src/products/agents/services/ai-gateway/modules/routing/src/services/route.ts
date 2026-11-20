import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Prisma } from '@mtsrc/ai-gateway-db';
import { modelInclude, routableModelStatuses } from '@mtsrc/ai-gateway-module-catalog';
import { platformConnectionRegistry } from '@mtsrc/ai-gateway-module-credentials';
import { supportedProviderSlugs } from '@mtsrc/ai-gateway-providers';
import {
  hasFeatures,
  providerFeatures,
  type GatewayPrincipal,
  type ProviderFeature
} from '@mtsrc/ai-gateway-spec';
import { isModelAllowed } from '../lib/allowedModels';
import {
  selectCandidates,
  type ConnectionStatus,
  type RouteTarget,
  type RoutingRuleOption
} from '../lib/candidates';
import {
  modelNotAllowedError,
  modelNotFoundError,
  modelUnavailableError
} from '../lib/errors';
import { parseModelName, resolveModelName } from '../lib/modelName';
import { allRoutingRules } from '../definitions/routingRules';
import { databaseModelNameSource } from '../lib/source';

let providerSlugs = new Set(supportedProviderSlugs);

let usableConnectionStatuses: ConnectionStatus[] = ['valid', 'pending'];

let platformRules = (): RoutingRuleOption[] =>
  allRoutingRules.flatMap(rule => {
    let status = platformConnectionRegistry.status(rule.connection.slug);
    if (!status) return [];

    return [
      {
        slug: rule.slug,
        priority: rule.priority,
        weight: rule.weight,
        labSlug: rule.labSlug,
        modelSlug: rule.modelSlug,
        pricingOverride: rule.pricingOverride,
        connection: {
          slug: rule.connection.slug,
          providerSlug: rule.connection.providerSlug,
          status,
          features: rule.connection.features
        }
      }
    ];
  });

let routableOfferingWhere = (providerSlugs: string[]): Prisma.ModelOfferingWhereInput => ({
  removedAt: null,
  status: { in: routableModelStatuses },
  provider: { slug: { in: providerSlugs }, removedAt: null }
});

let requiredFeaturesFor = (d: {
  principal: GatewayPrincipal;
  requiredFeatures?: ProviderFeature[];
}) => {
  let required = new Set(d.requiredFeatures ?? []);
  if (d.principal.instance.settings.zdrRequired) required.add('zdr');

  return [...required];
};

let noFeatureMatchError = (requiredFeatures: ProviderFeature[]) =>
  modelUnavailableError({
    message: `No provider connection with ${requiredFeatures
      .map(feature => providerFeatures[feature].name.toLowerCase())
      .join(' and ')} enabled offers the requested model.`
  });

class RouteServiceImpl {
  async resolveModel(d: { model: string }) {
    let request = parseModelName(d.model, providerSlugs);
    let resolved = await resolveModelName(request, databaseModelNameSource);
    if (!resolved) throw new ServiceError(modelNotFoundError());

    return { request, ...resolved };
  }

  async route(d: {
    principal: GatewayPrincipal;
    model: string;
    requiredFeatures?: ProviderFeature[];
    random?: () => number;
  }) {
    let { request, model, via } = await this.resolveModel({ model: d.model });
    let requiredFeatures = requiredFeaturesFor(d);

    if (
      !isModelAllowed({
        allowedModels: d.principal.token.allowedModels,
        requested: d.model,
        modelSlug: model.slug
      })
    ) {
      throw new ServiceError(modelNotAllowedError());
    }

    let instance = await this.getInstance(d.principal.instance.id);

    let target: RouteTarget =
      request.kind == 'pinned'
        ? {
            kind: 'provider',
            providerSlug: request.providerSlug,
            vendorModelId: via == 'offering' ? request.vendorModelId : undefined
          }
        : request.kind == 'metorial'
          ? { kind: 'metorial' }
          : { kind: 'any' };

    let rules =
      d.principal.instance.settings.metorialProviderEnabled && target.kind != 'provider'
        ? platformRules()
        : [];

    let [offerings, connections] = await Promise.all([
      db.modelOffering.findMany({
        where: {
          ...routableOfferingWhere(supportedProviderSlugs),
          model: { slug: model.slug }
        },
        select: {
          id: true,
          vendorModelId: true,
          pricing: true,
          provider: { select: { slug: true } }
        }
      }),
      db.providerConnection.findMany({
        where: {
          instanceOid: instance.oid,
          archivedAt: null,
          status: { in: usableConnectionStatuses }
        },
        select: {
          id: true,
          priority: true,
          status: true,
          features: true,
          pricingOverride: true,
          createdAt: true,
          provider: { select: { slug: true } }
        }
      })
    ]);

    let candidates = selectCandidates({
      model,
      target,
      metorialEnabled: d.principal.instance.settings.metorialProviderEnabled,
      requiredFeatures,
      random: d.random,

      offerings: offerings.map(offering => ({
        id: offering.id,
        providerSlug: offering.provider.slug,
        vendorModelId: offering.vendorModelId,
        pricing: offering.pricing
      })),

      connections: connections.map(connection => ({
        id: connection.id,
        providerSlug: connection.provider.slug,
        priority: connection.priority,
        status: connection.status,
        features: connection.features,
        pricingOverride: connection.pricingOverride,
        createdAt: connection.createdAt
      })),

      rules
    });

    if (!candidates.length) {
      throw new ServiceError(
        requiredFeatures.length
          ? noFeatureMatchError(requiredFeatures)
          : modelUnavailableError()
      );
    }

    return { request, model, via, candidates };
  }

  async listAvailableModels(d: {
    principal: GatewayPrincipal;
    requiredFeatures?: ProviderFeature[];
  }) {
    let instance = await this.getInstance(d.principal.instance.id);
    let requiredFeatures = requiredFeaturesFor(d);

    let connections = await db.providerConnection.findMany({
      where: {
        instanceOid: instance.oid,
        archivedAt: null,
        status: { in: usableConnectionStatuses }
      },
      select: { features: true, provider: { select: { slug: true } } }
    });

    let rules = d.principal.instance.settings.metorialProviderEnabled
      ? platformRules().filter(
          rule =>
            usableConnectionStatuses.includes(rule.connection.status) &&
            hasFeatures(rule.connection.features, requiredFeatures)
        )
      : [];

    let customerProviders = [
      ...new Set(
        connections
          .filter(connection => hasFeatures(connection.features, requiredFeatures))
          .map(connection => connection.provider.slug)
      )
    ];

    let reachable: Prisma.ModelWhereInput[] = [
      ...(customerProviders.length
        ? [{ offerings: { some: routableOfferingWhere(customerProviders) } }]
        : []),
      ...rules.map(rule => ({
        ...(rule.modelSlug ? { slug: rule.modelSlug } : { lab: { slug: rule.labSlug! } }),
        offerings: { some: routableOfferingWhere([rule.connection.providerSlug]) }
      }))
    ];
    if (!reachable.length) return [];

    let models = await db.model.findMany({
      where: { removedAt: null, status: { in: routableModelStatuses }, OR: reachable },
      include: modelInclude,
      orderBy: { slug: 'asc' }
    });

    return models.filter(model =>
      isModelAllowed({
        allowedModels: d.principal.token.allowedModels,
        requested: model.slug,
        modelSlug: model.slug
      })
    );
  }

  private async getInstance(instanceId: string) {
    let instance = await db.instance.findUnique({
      where: { id: instanceId },
      select: { oid: true }
    });
    if (!instance) throw new ServiceError(notFoundError('instance'));

    return instance;
  }
}

export let routeService = Service.create('routeService', () => new RouteServiceImpl()).build();
