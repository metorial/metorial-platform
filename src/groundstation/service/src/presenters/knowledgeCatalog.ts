import type {
  KnowledgeAgent,
  KnowledgeEndpoint,
  KnowledgeFamily,
  KnowledgeModel,
  KnowledgePointer,
  KnowledgeRelease,
  KnowledgeVendor
} from '../../prisma/generated/client';
import type {
  KnowledgeLab,
  KnowledgeOfferingWithPrice,
  KnowledgeVendorWithDetails
} from '../knowledge/api';

let isoDate = (value: string | null | undefined) => (value ? new Date(value) : null);

export let knowledgeVendorSummaryPresenter = (vendor: KnowledgeVendor) => ({
  id: vendor.id,
  name: vendor.name,
  organizationId: vendor.organizationId,
  kind: vendor.kind,
  status: vendor.status
});

export let knowledgeLabPresenter = (lab: KnowledgeLab) => ({
  object: 'groundstation#knowledge_lab',

  id: lab.id,
  name: lab.name,
  roles: lab.roles,
  status: lab.status,
  aliases: lab.data.aliases ?? [],
  description: lab.data.description ?? null,
  website: lab.data.website ?? null,
  logo: lab.data.logo ?? null,
  country: lab.data.country ?? null,

  familyCount: lab.familyCount,
  modelCount: lab.modelCount,
  firstPartyVendors: lab.firstPartyVendors.map(knowledgeVendorSummaryPresenter),

  removedAt: lab.removedAt,
  createdAt: lab.createdAt,
  updatedAt: lab.updatedAt
});

export let knowledgeFamilyPresenter = (family: KnowledgeFamily) => ({
  object: 'groundstation#knowledge_family',

  id: family.id,
  name: family.name,
  labId: family.labId,
  line: family.data.line ?? null,
  kind: family.kind,
  status: family.status,
  modelIds: family.data.modelIds ?? [],
  latestModelId: family.latestModelId,

  removedAt: family.removedAt,
  createdAt: family.createdAt,
  updatedAt: family.updatedAt
});

export let knowledgeFamilyDetailsPresenter = (
  family: KnowledgeFamily & { models: KnowledgeModel[]; latestModel: KnowledgeModel | null }
) => ({
  ...knowledgeFamilyPresenter(family),
  models: family.models.map(knowledgeModelPresenter),
  latestModel: family.latestModel ? knowledgeModelPresenter(family.latestModel) : null
});

export let knowledgeModelPresenter = (model: KnowledgeModel) => ({
  object: 'groundstation#knowledge_model',

  id: model.id,
  name: model.name,
  description: model.data.description ?? null,
  labId: model.labId,
  familyId: model.familyId,
  kind: model.kind,
  status: model.status,

  version: model.data.version ?? null,
  versionSort: model.data.versionSort ?? [],
  size: model.data.size ?? null,
  derivedFrom: model.data.derivedFrom ?? null,
  releaseDate: model.releaseDate,
  knowledgeCutoff: model.data.knowledgeCutoff ?? null,
  openWeights: model.openWeights,
  license: model.data.license ?? null,
  links: model.data.links ?? [],

  contextTokens: model.contextTokens,
  limits: model.data.limits ?? null,
  modalities: { input: model.inputModalities, output: model.outputModalities },
  capabilityKeys: model.capabilities,
  capabilities: model.data.capabilities ?? null,

  releaseIds: model.data.releaseIds ?? [],
  latestReleaseId: model.data.latestReleaseId ?? null,

  removedAt: model.removedAt,
  createdAt: model.createdAt,
  updatedAt: model.updatedAt
});

export let knowledgeModelDetailsPresenter = (
  model: KnowledgeModel & {
    releases: KnowledgeRelease[];
    pointers: KnowledgePointer[];
    offerings: KnowledgeOfferingWithPrice[];
  }
) => ({
  ...knowledgeModelPresenter(model),
  releases: model.releases.map(knowledgeReleasePresenter),
  pointers: model.pointers.map(knowledgePointerPresenter),
  offerings: model.offerings.map(knowledgeOfferingPresenter)
});

export let knowledgeReleasePresenter = (release: KnowledgeRelease) => ({
  object: 'groundstation#knowledge_release',

  id: release.id,
  modelId: release.modelId,
  date: release.date,
  status: release.status,

  removedAt: release.removedAt
});

export let knowledgePointerPresenter = (pointer: KnowledgePointer) => ({
  object: 'groundstation#knowledge_pointer',

  id: pointer.id,
  labId: pointer.labId,
  familyId: pointer.familyId,
  target: pointer.data.target,
  history: (pointer.data.history ?? []).map(period => ({
    target: period.target,
    from: new Date(period.from),
    to: isoDate(period.to),
    evidence: period.evidence
  })),

  removedAt: pointer.removedAt
});

export let knowledgeEndpointPresenter = (endpoint: KnowledgeEndpoint) => ({
  object: 'groundstation#knowledge_endpoint',

  id: endpoint.id,
  vendorId: endpoint.vendorId,
  name: endpoint.name,
  plan: endpoint.plan,
  region: endpoint.region,
  baseUrl: endpoint.data.baseUrl ?? null,
  baseUrlHost: endpoint.baseUrlHost,
  sdk: endpoint.data.sdk ?? null,
  authEnv: endpoint.data.authEnv ?? [],
  upstreamIds: endpoint.data.upstreamIds ?? [],
  status: endpoint.status,

  removedAt: endpoint.removedAt
});

export let knowledgeVendorPresenter = (vendor: KnowledgeVendorWithDetails) => ({
  object: 'groundstation#knowledge_vendor',

  id: vendor.id,
  name: vendor.name,
  organizationId: vendor.organizationId,
  kind: vendor.kind,
  status: vendor.status,
  website: vendor.data.website ?? null,
  docs: vendor.data.docs ?? null,
  logo: vendor.data.logo ?? null,

  endpoints: vendor.endpoints.map(knowledgeEndpointPresenter),
  offeringCount: vendor.offeringCount,

  removedAt: vendor.removedAt,
  createdAt: vendor.createdAt,
  updatedAt: vendor.updatedAt
});

export let knowledgeOfferingPresenter = (offering: KnowledgeOfferingWithPrice) => {
  let period = offering.openPricePeriod;

  return {
    object: 'groundstation#knowledge_offering',

    id: offering.id,
    vendorId: offering.vendorId,
    vendorModelId: offering.vendorModelId,
    name: offering.name,
    kind: offering.kind,
    status: offering.status,

    modelId: offering.modelId,
    releaseId: offering.releaseId,
    pointerId: offering.pointerId,

    variant: offering.data.variant ?? null,
    variantKey: offering.variantKey,
    free: offering.free,
    endpointIds: offering.data.endpointIds ?? [],
    limits: offering.data.limits ?? null,
    capabilities: offering.data.capabilities ?? null,
    modalities: offering.data.modalities ?? null,
    apis: offering.data.apis ?? [],
    resolutionMethod: offering.data.resolution?.method ?? null,
    sources: offering.data.sources ?? [],

    price: period
      ? {
          pricePeriodId: period.id,
          pricing: period.pricing,
          origin: period.origin,
          validFrom: period.validFrom,
          confirmedAt: period.confirmedAt
        }
      : null,

    firstSeenAt: isoDate(offering.data.firstSeenAt),
    lastSeenAt: isoDate(offering.data.lastSeenAt),
    removedAt: offering.removedAt,
    createdAt: offering.createdAt,
    updatedAt: offering.updatedAt
  };
};

export let knowledgeAgentPresenter = (agent: KnowledgeAgent) => ({
  object: 'groundstation#knowledge_agent',

  id: agent.id,
  name: agent.name,
  makerId: agent.makerId,
  description: agent.data.description ?? null,
  website: agent.data.website ?? null,
  docs: agent.data.docs ?? null,
  repository: agent.data.repository ?? null,
  openSource: agent.openSource,
  license: agent.data.license ?? null,
  surfaces: agent.surfaces,
  aliases: agent.data.aliases ?? [],
  vendors: (agent.data.vendors ?? []).map(link => ({
    vendorId: link.vendorId,
    role: link.role
  })),
  defaultVendorId: agent.defaultVendorId,
  derivedFrom: agent.data.derivedFrom ?? null,
  status: agent.status,

  removedAt: agent.removedAt,
  createdAt: agent.createdAt,
  updatedAt: agent.updatedAt
});
