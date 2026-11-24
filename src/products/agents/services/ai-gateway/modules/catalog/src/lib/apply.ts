import { db, getId, Prisma } from '@mtsrc/ai-gateway-db';
import type { CatalogSyncCounts } from '@mtsrc/ai-gateway-spec';
import { diffRows, type RowDiff } from './diff';
import type {
  AliasRow,
  CatalogProjection,
  LabRow,
  ModelRow,
  OfferingRow,
  ProviderRow
} from './project';

let createChunkSize = 1000;
let removeChunkSize = 1000;

let chunks = <T>(items: T[], size: number) => {
  let result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }

  return result;
};

let markRemoved = async (
  table: { updateMany: (args: any) => Promise<unknown> },
  stored: { oid: bigint }[]
) => {
  let removedAt = new Date();

  for (let chunk of chunks(stored, removeChunkSize)) {
    await table.updateMany({
      where: { oid: { in: chunk.map(row => row.oid) } },
      data: { removedAt }
    });
  }
};

let jsonOrNull = <T>(value: T | null) => value ?? Prisma.DbNull;

let lookup = (map: Map<string, bigint>, key: string, what: string) => {
  let oid = map.get(key);
  if (oid === undefined) throw new Error(`The catalog references unknown ${what} "${key}".`);

  return oid;
};

let applyLabs = async (desired: LabRow[]) => {
  let stored = await db.lab.findMany();

  let diff = diffRows({
    desired,
    stored,
    key: row => row.slug,
    storedKey: lab => lab.slug,
    storedRow: (lab): LabRow => ({
      slug: lab.slug,
      name: lab.name,
      description: lab.description,
      website: lab.website,
      logo: lab.logo,
      status: lab.status
    })
  });

  for (let chunk of chunks(diff.create, createChunkSize)) {
    await db.lab.createMany({
      data: chunk.map(row => ({ ...getId('lab'), ...row })),
      skipDuplicates: true
    });
  }

  for (let { stored, row } of diff.update) {
    await db.lab.update({ where: { oid: stored.oid }, data: { ...row, removedAt: null } });
  }

  await markRemoved(db.lab, diff.remove);

  return diff;
};

let applyProviders = async (desired: ProviderRow[]) => {
  let stored = await db.provider.findMany();

  let diff = diffRows({
    desired,
    stored,
    key: row => row.slug,
    storedKey: provider => provider.slug,
    storedRow: (provider): ProviderRow => ({
      slug: provider.slug,
      name: provider.name,
      kind: provider.kind,
      website: provider.website,
      docs: provider.docs,
      logo: provider.logo,
      status: provider.status
    })
  });

  for (let chunk of chunks(diff.create, createChunkSize)) {
    await db.provider.createMany({
      data: chunk.map(row => ({ ...getId('provider'), ...row })),
      skipDuplicates: true
    });
  }

  for (let { stored, row } of diff.update) {
    await db.provider.update({
      where: { oid: stored.oid },
      data: { ...row, removedAt: null }
    });
  }

  await markRemoved(db.provider, diff.remove);

  return diff;
};

let applyModels = async (desired: ModelRow[], labOids: Map<string, bigint>) => {
  let stored = await db.model.findMany({ include: { lab: { select: { slug: true } } } });

  let diff = diffRows({
    desired,
    stored,
    key: row => row.slug,
    storedKey: model => model.slug,
    storedRow: (model): ModelRow => ({
      slug: model.slug,
      labSlug: model.lab.slug,
      familySlug: model.familySlug,
      name: model.name,
      description: model.description,
      kind: model.kind,
      status: model.status,
      releaseDate: model.releaseDate,
      openWeights: model.openWeights,
      contextTokens: model.contextTokens,
      outputTokens: model.outputTokens,
      inputModalities: model.inputModalities,
      outputModalities: model.outputModalities,
      capabilities: model.capabilities
    })
  });

  let data = ({ labSlug, ...row }: ModelRow) => ({
    ...row,
    labOid: lookup(labOids, labSlug, 'lab')
  });

  for (let chunk of chunks(diff.create, createChunkSize)) {
    await db.model.createMany({
      data: chunk.map(row => ({ ...getId('model'), ...data(row) })),
      skipDuplicates: true
    });
  }

  for (let { stored, row } of diff.update) {
    await db.model.update({
      where: { oid: stored.oid },
      data: { ...data(row), removedAt: null }
    });
  }

  await markRemoved(db.model, diff.remove);

  return diff;
};

let applyOfferings = async (
  desired: OfferingRow[],
  providerOids: Map<string, bigint>,
  modelOids: Map<string, bigint>
) => {
  let stored = await db.modelOffering.findMany({
    include: { provider: { select: { slug: true } }, model: { select: { slug: true } } }
  });

  let diff = diffRows({
    desired,
    stored,
    key: row => row.catalogId,
    storedKey: offering => offering.catalogId,
    storedRow: (offering): OfferingRow => ({
      catalogId: offering.catalogId,
      providerSlug: offering.provider.slug,
      modelSlug: offering.model?.slug ?? null,
      vendorModelId: offering.vendorModelId,
      name: offering.name,
      status: offering.status,
      apis: offering.apis,
      pricing: offering.pricing,
      pricingHash: offering.pricingHash,
      contextTokens: offering.contextTokens,
      outputTokens: offering.outputTokens,
      inputModalities: offering.inputModalities,
      outputModalities: offering.outputModalities,
      capabilities: offering.capabilities,
      variant: offering.variant
    })
  });

  let data = ({ providerSlug, modelSlug, pricing, ...row }: OfferingRow) => ({
    ...row,
    pricing: jsonOrNull(pricing),
    providerOid: lookup(providerOids, providerSlug, 'provider'),
    modelOid: modelSlug ? lookup(modelOids, modelSlug, 'model') : null
  });

  for (let chunk of chunks(diff.create, createChunkSize)) {
    await db.modelOffering.createMany({
      data: chunk.map(row => ({ ...getId('modelOffering'), ...data(row) })),
      skipDuplicates: true
    });
  }

  for (let { stored, row } of diff.update) {
    await db.modelOffering.update({
      where: { oid: stored.oid },
      data: { ...data(row), removedAt: null }
    });
  }

  await markRemoved(db.modelOffering, diff.remove);

  return diff;
};

let applyAliases = async (desired: AliasRow[], modelOids: Map<string, bigint>) => {
  let stored = await db.modelAlias.findMany({
    include: { model: { select: { slug: true } } }
  });

  let diff = diffRows({
    desired,
    stored,
    key: row => row.catalogId,
    storedKey: alias => alias.catalogId,
    storedRow: (alias): AliasRow => ({
      catalogId: alias.catalogId,
      modelSlug: alias.model.slug,
      namespace: alias.namespace,
      raw: alias.raw,
      key: alias.key
    })
  });

  let data = ({ modelSlug, ...row }: AliasRow) => ({
    ...row,
    modelOid: lookup(modelOids, modelSlug, 'model')
  });

  for (let chunk of chunks(diff.create, createChunkSize)) {
    await db.modelAlias.createMany({
      data: chunk.map(row => ({ ...getId('modelAlias'), ...data(row) })),
      skipDuplicates: true
    });
  }

  for (let { stored, row } of diff.update) {
    await db.modelAlias.update({
      where: { oid: stored.oid },
      data: { ...data(row), removedAt: null }
    });
  }

  await markRemoved(db.modelAlias, diff.remove);

  return diff;
};

let oidsBySlug = async (table: {
  findMany: (args: any) => Promise<{ oid: bigint; slug: string }[]>;
}) => {
  let rows = await table.findMany({ select: { oid: true, slug: true } });

  return new Map(rows.map(row => [row.slug, row.oid]));
};

let countOf = (diff: RowDiff<unknown, unknown & { removedAt: Date | null }>) =>
  diff.create.length + diff.update.length + diff.unchanged;

// Applied in dependency order so every relation can be resolved by slug. The sync is not wrapped
// in one transaction: a failure leaves a partly applied catalog, and since the fingerprint is only
// stored after success the next run re-diffs and finishes the job.
export let applyProjection = async (
  projection: CatalogProjection
): Promise<CatalogSyncCounts> => {
  let labs = await applyLabs(projection.labs);
  let providers = await applyProviders(projection.providers);
  let labOids = await oidsBySlug(db.lab);

  let models = await applyModels(projection.models, labOids);
  let providerOids = await oidsBySlug(db.provider);
  let modelOids = await oidsBySlug(db.model);

  let offerings = await applyOfferings(projection.offerings, providerOids, modelOids);
  let aliases = await applyAliases(projection.aliases, modelOids);

  return {
    labs: countOf(labs),
    providers: countOf(providers),
    models: countOf(models),
    offerings: countOf(offerings),
    aliases: countOf(aliases)
  };
};
