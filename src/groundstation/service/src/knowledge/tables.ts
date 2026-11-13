import { normalizeAgentKey } from '@metorial/model-catalog/src/pipeline/agents';
import type {
  Agent,
  Capabilities,
  Catalog,
  Endpoint,
  Family,
  Model,
  Name,
  NameTarget,
  Offering,
  OfferingVariant,
  Organization,
  Pointer,
  Release,
  Vendor
} from '@metorial/model-catalog/src/types';
import type { KnowledgeEntityName } from './types';

export type ColumnType = 'text' | 'text[]' | 'boolean' | 'integer' | 'date';

export type Column = { name: string; type: ColumnType };

export type TableSpec = {
  entity: KnowledgeEntityName;
  table: string;
  items: (catalog: Catalog) => { id: string }[];
  columns: Column[];
  promote: (item: any) => Record<string, unknown>;
};

let text = (name: string): Column => ({ name, type: 'text' });

let texts = (name: string): Column => ({ name, type: 'text[]' });

let bool = (name: string): Column => ({ name, type: 'boolean' });

export let capabilityList = (capabilities: Capabilities | undefined) => {
  if (!capabilities) return [];

  return [
    capabilities.tools && 'tools',
    capabilities.structuredOutput && 'structured-output',
    capabilities.reasoning && 'reasoning',
    capabilities.temperature && 'temperature',
    capabilities.promptCaching && 'caching',
    capabilities.attachments && 'attachments'
  ].filter((value): value is string => !!value);
};

export let variantKey = (variant: OfferingVariant | undefined) => {
  if (!variant) return '';

  return [
    variant.serving && `serving=${variant.serving}`,
    variant.reasoning && `reasoning=${variant.reasoning}`,
    variant.quantization && `quantization=${variant.quantization}`,
    variant.region && `region=${variant.region}`,
    variant.free && 'free'
  ]
    .filter(Boolean)
    .join(',');
};

export let targetModelId = (target: NameTarget | undefined) =>
  target?.kind == 'model' || target?.kind == 'release' ? target.modelId : null;

let hostOf = (url: string | null) => {
  if (!url) return null;

  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
};

export let tableSpecs: TableSpec[] = [
  {
    entity: 'organization',
    table: 'KnowledgeOrganization',
    items: catalog => catalog.organizations,
    columns: [text('name'), texts('roles'), text('status')],
    promote: (item: Organization) => ({
      name: item.name,
      roles: item.roles ?? [],
      status: item.status
    })
  },
  {
    entity: 'family',
    table: 'KnowledgeFamily',
    items: catalog => catalog.families,
    columns: [
      text('name'),
      text('labId'),
      text('kind'),
      text('status'),
      text('latestModelId')
    ],
    promote: (item: Family) => ({
      name: item.name,
      labId: item.labId,
      kind: item.kind,
      status: item.status,
      latestModelId: item.latestModelId ?? null
    })
  },
  {
    entity: 'model',
    table: 'KnowledgeModel',
    items: catalog => catalog.models,
    columns: [
      text('name'),
      text('labId'),
      text('familyId'),
      text('kind'),
      text('status'),
      { name: 'releaseDate', type: 'date' },
      bool('openWeights'),
      { name: 'contextTokens', type: 'integer' },
      texts('capabilities'),
      texts('inputModalities'),
      texts('outputModalities')
    ],
    promote: (item: Model) => ({
      name: item.name,
      labId: item.labId,
      familyId: item.familyId ?? null,
      kind: item.kind,
      status: item.status,
      releaseDate: item.releaseDate ?? null,
      openWeights: !!item.openWeights,
      contextTokens: item.limits?.contextTokens ?? null,
      capabilities: capabilityList(item.capabilities),
      inputModalities: item.modalities?.input ?? [],
      outputModalities: item.modalities?.output ?? []
    })
  },
  {
    entity: 'release',
    table: 'KnowledgeRelease',
    items: catalog => catalog.releases,
    columns: [text('modelId'), { name: 'date', type: 'date' }, text('status')],
    promote: (item: Release) => ({
      modelId: item.modelId,
      date: item.date,
      status: item.status
    })
  },
  {
    entity: 'pointer',
    table: 'KnowledgePointer',
    items: catalog => catalog.pointers,
    columns: [text('labId'), text('familyId')],
    promote: (item: Pointer) => ({ labId: item.labId, familyId: item.familyId ?? null })
  },
  {
    entity: 'vendor',
    table: 'KnowledgeVendor',
    items: catalog => catalog.vendors,
    columns: [text('name'), text('organizationId'), text('kind'), text('status')],
    promote: (item: Vendor) => ({
      name: item.name,
      organizationId: item.organizationId,
      kind: item.kind,
      status: item.status
    })
  },
  {
    entity: 'endpoint',
    table: 'KnowledgeEndpoint',
    items: catalog => catalog.endpoints,
    columns: [
      text('name'),
      text('vendorId'),
      text('plan'),
      text('region'),
      text('baseUrlHost'),
      text('status')
    ],
    promote: (item: Endpoint) => ({
      name: item.name,
      vendorId: item.vendorId,
      plan: item.plan,
      region: item.region ?? null,
      baseUrlHost: hostOf(item.baseUrl),
      status: item.status
    })
  },
  {
    entity: 'offering',
    table: 'KnowledgeOffering',
    items: catalog => catalog.offerings,
    columns: [
      text('vendorId'),
      text('vendorModelId'),
      text('variantKey'),
      text('name'),
      text('kind'),
      text('status'),
      bool('free'),
      text('modelId'),
      text('releaseId'),
      text('pointerId'),
      text('pricingHash')
    ],
    promote: (item: Offering) => ({
      vendorId: item.vendorId,
      vendorModelId: item.vendorModelId,
      variantKey: variantKey(item.variant),
      name: item.name,
      kind: item.kind,
      status: item.status,
      free: !!item.variant?.free,
      modelId: item.modelId ?? null,
      releaseId: item.releaseId ?? null,
      pointerId: item.pointerId ?? null
    })
  },
  {
    entity: 'name',
    table: 'KnowledgeName',
    items: catalog => catalog.names,
    columns: [
      text('namespace'),
      text('raw'),
      text('key'),
      text('status'),
      text('targetModelId')
    ],
    promote: (item: Name) => ({
      namespace: item.namespace,
      raw: item.raw,
      key: item.key,
      status: item.status,
      targetModelId: targetModelId(item.target)
    })
  },
  {
    entity: 'agent',
    table: 'KnowledgeAgent',
    items: catalog => catalog.agents ?? [],
    columns: [
      text('name'),
      text('makerId'),
      text('status'),
      bool('openSource'),
      texts('surfaces'),
      texts('aliasKeys'),
      text('defaultVendorId'),
      texts('vendorIds')
    ],
    promote: (item: Agent) => ({
      name: item.name,
      makerId: item.makerId,
      status: item.status,
      openSource: !!item.openSource,
      surfaces: item.surfaces ?? [],
      aliasKeys: [
        ...new Set([item.id, ...(item.aliases ?? [])].map(normalizeAgentKey))
      ].sort(),
      defaultVendorId:
        item.vendors?.find(vendor => vendor.role == 'default')?.vendorId ?? null,
      vendorIds: (item.vendors ?? []).map(vendor => vendor.vendorId)
    })
  }
];

export let tableSpecFor = (entity: KnowledgeEntityName) =>
  tableSpecs.find(spec => spec.entity == entity)!;
