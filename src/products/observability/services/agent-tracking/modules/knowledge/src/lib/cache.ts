import { normalizeKey } from '@metorial/model-catalog/src/normalize/parseName';
import type {
  LifecycleStatus,
  Name,
  Offering,
  Pointer,
  Pricing
} from '@metorial/model-catalog/src/types';
import { LRUCache } from 'lru-cache';
import type { KnowledgeSnapshot } from '@mtsrc/agent-tracking-db';
import {
  agentInfoOf,
  createResolver,
  createVendorDirectory,
  endpointInfosOf,
  modelInfoFrom,
  reachableModels,
  vendorHint,
  type CatalogIndex,
  type CatalogOffering,
  type ModelRequest,
  type VendorDirectory
} from '@mtsrc/agent-tracking-model-resolver';
import { db } from '@mtsrc/agent-tracking-db';
import {
  pricePeriodTimeline,
  type PricePeriod,
  type PricePeriodCloseReason,
  type PricePeriodOrigin
} from '@mtsrc/agent-tracking-model-resolver';
import {
  currentSnapshot,
  knowledgeVersionOf,
  publishKnowledgeVersion,
  readPublishedVersion
} from './version';

let versionCheckMs = 15_000;
let fallbackCheckMs = 60_000;
let nameCacheSize = 50_000;
let offeringCacheSize = 20_000;
let lookupChunkSize = 2000;

type CoreModel = { labId: string; familyId: string | null; status: LifecycleStatus };

export type KnowledgeCore = {
  models: Map<string, CoreModel>;
  latestModels: Map<string, string | null>;
  pointers: Map<string, Pointer>;
  vendors: VendorDirectory;
};

type OfferingRow = { oid: string; removed: boolean; data: Offering };

type PeriodRow = {
  offeringOid: string;
  id: string;
  pricing: Pricing;
  origin: PricePeriodOrigin;
  closeReason: PricePeriodCloseReason | null;
  validFrom: Date;
  validTo: Date | null;
  confirmedAt: Date;
};

export let loadKnowledgeCore = async (): Promise<KnowledgeCore> => {
  let [models, families, pointers, vendors, endpoints, agents] = await Promise.all([
    db.knowledgeModel.findMany({
      where: { removedAt: null },
      select: { id: true, labId: true, familyId: true, status: true }
    }),
    db.knowledgeFamily.findMany({
      where: { removedAt: null },
      select: { id: true, latestModelId: true }
    }),
    db.knowledgePointer.findMany({ where: { removedAt: null }, select: { data: true } }),
    db.knowledgeVendor.findMany({
      where: { removedAt: null },
      select: { id: true, organizationId: true, kind: true }
    }),
    db.knowledgeEndpoint.findMany({ where: { removedAt: null }, select: { data: true } }),
    db.knowledgeAgent.findMany({ where: { removedAt: null }, select: { data: true } })
  ]);

  return {
    models: new Map(
      models.map(model => [
        model.id,
        {
          labId: model.labId,
          familyId: model.familyId,
          status: model.status as LifecycleStatus
        }
      ])
    ),
    latestModels: new Map(families.map(family => [family.id, family.latestModelId])),
    pointers: new Map(pointers.map(pointer => [pointer.data.id, pointer.data])),
    vendors: createVendorDirectory({
      vendors,
      endpoints: endpointInfosOf({ endpoints: endpoints.map(endpoint => endpoint.data) }),
      agents: agents.map(agent => agentInfoOf(agent.data))
    })
  };
};

// Only what resolution and pricing read, so a cached pool stays small.
let slimOffering = (offering: Offering): Offering =>
  ({
    id: offering.id,
    vendorId: offering.vendorId,
    vendorModelId: offering.vendorModelId,
    modelId: offering.modelId,
    releaseId: offering.releaseId,
    kind: offering.kind,
    status: offering.status,
    variant: offering.variant,
    pricing: offering.pricing
  }) as Offering;

// Each array is chunked in parallel positions (the vendor/model pair arrays stay aligned), so
// one huge prepare can't build an unbounded statement.
let queryChunked = async <R>(
  lists: string[][],
  query: (chunks: string[][]) => Promise<R[]>,
  keyOf: (row: R) => string
) => {
  let longest = Math.max(...lists.map(list => list.length));
  let rows = new Map<string, R>();

  for (let start = 0; start < longest; start += lookupChunkSize) {
    let chunk = await query(lists.map(list => list.slice(start, start + lookupChunkSize)));
    for (let row of chunk) rows.set(keyOf(row), row);
  }

  return [...rows.values()];
};

let vendorModelCacheKey = (vendorId: string, vendorModelId: string) =>
  `vm\0${vendorId}\0${vendorModelId}`;

let modelCacheKey = (modelId: string) => `m\0${modelId}`;

let loadPeriods = async (offeringOids: string[]) => {
  let byOffering = new Map<string, PricePeriod[]>();
  if (!offeringOids.length) return byOffering;

  let rows = await queryChunked(
    [offeringOids],
    ([oids]) =>
      db.$queryRawUnsafe<PeriodRow[]>(
        `SELECT "offeringOid"::text AS "offeringOid", id, pricing, origin, "closeReason",
                "validFrom", "validTo", "confirmedAt"
           FROM "KnowledgePricePeriod" WHERE "offeringOid" = ANY($1::bigint[])`,
        oids
      ),
    row => row.id
  );

  for (let { offeringOid, ...period } of rows) {
    let list = byOffering.get(offeringOid);

    if (list) list.push(period);
    else byOffering.set(offeringOid, [period]);
  }

  return byOffering;
};

export let createKnowledgeIndex = (d: {
  snapshot: Pick<KnowledgeSnapshot, 'id' | 'generatedAt'>;
  core: KnowledgeCore;
}): CatalogIndex => {
  let names = new LRUCache<string, Name[]>({ max: nameCacheSize });
  let offerings = new LRUCache<string, CatalogOffering[]>({ max: offeringCacheSize });

  let loadNames = async (raws: string[], keys: string[]) => {
    let missingRaws = raws.filter(raw => !names.has(`r\0${raw}`));
    let missingKeys = keys.filter(key => !names.has(`k\0${key}`));
    if (!missingRaws.length && !missingKeys.length) return;

    let rows = await queryChunked(
      [missingRaws, missingKeys],
      ([raws, keys]) =>
        db.$queryRawUnsafe<{ data: Name }[]>(
          `SELECT data FROM "KnowledgeName" WHERE "removedAt" IS NULL AND raw = ANY($1::text[])
           UNION ALL
           SELECT data FROM "KnowledgeName" WHERE "removedAt" IS NULL AND key = ANY($2::text[])`,
          raws,
          keys
        ),
      row => row.data.id
    );

    let byRaw = new Map(missingRaws.map(raw => [raw, [] as Name[]]));
    let byKey = new Map(missingKeys.map(key => [key, [] as Name[]]));

    for (let { data } of rows) {
      byRaw.get(data.raw)?.push(data);
      byKey.get(data.key)?.push(data);
    }

    for (let [raw, list] of byRaw) names.set(`r\0${raw}`, list);
    for (let [key, list] of byKey) names.set(`k\0${key}`, list);
  };

  // Removed offerings are loaded too: their open periods keep pricing late usage (08 §6.1).
  let loadOfferings = async (modelIds: string[], vendorModels: [string, string][]) => {
    let missingModels = modelIds.filter(modelId => !offerings.has(modelCacheKey(modelId)));
    let missingPairs = vendorModels.filter(
      ([vendorId, vendorModelId]) =>
        !offerings.has(vendorModelCacheKey(vendorId, vendorModelId))
    );
    if (!missingModels.length && !missingPairs.length) return;

    let rows = await queryChunked(
      [
        missingModels,
        missingPairs.map(([vendorId]) => vendorId),
        missingPairs.map(([, vendorModelId]) => vendorModelId)
      ],
      ([modelIds, vendorIds, vendorModelIds]) =>
        db.$queryRawUnsafe<OfferingRow[]>(
          `SELECT oid::text AS oid, "removedAt" IS NOT NULL AS removed, data
             FROM "KnowledgeOffering" WHERE "modelId" = ANY($1::text[])
           UNION ALL
           SELECT oid::text AS oid, "removedAt" IS NOT NULL AS removed, data
             FROM "KnowledgeOffering"
            WHERE ("vendorId", "vendorModelId") IN (SELECT * FROM unnest($2::text[], $3::text[]))`,
          modelIds,
          vendorIds,
          vendorModelIds
        ),
      row => row.data.id
    );

    let periods = await loadPeriods(rows.map(row => row.oid));

    let byModel = new Map(missingModels.map(modelId => [modelId, [] as CatalogOffering[]]));
    let byPair = new Map(
      missingPairs.map(([vendorId, vendorModelId]) => [
        vendorModelCacheKey(vendorId, vendorModelId),
        [] as CatalogOffering[]
      ])
    );

    for (let row of rows) {
      let entry: CatalogOffering = {
        offering: slimOffering(row.data),
        periods: pricePeriodTimeline(periods.get(row.oid) ?? []),
        ...(row.removed ? { removed: true } : {})
      };

      if (entry.offering.modelId) byModel.get(entry.offering.modelId)?.push(entry);
      byPair
        .get(vendorModelCacheKey(entry.offering.vendorId, entry.offering.vendorModelId))
        ?.push(entry);
    }

    for (let [modelId, list] of byModel) offerings.set(modelCacheKey(modelId), list);
    for (let [key, list] of byPair) offerings.set(key, list);
  };

  return {
    version: d.snapshot.id,
    generatedAt: d.snapshot.generatedAt.toISOString(),
    vendors: d.core.vendors,

    modelInfo: modelId =>
      modelInfoFrom({
        model: d.core.models.get(modelId),
        latestModelId: familyId => d.core.latestModels.get(familyId),
        modelId
      }),

    prepare: async (requests: ModelRequest[]) => {
      let raws = [...new Set(requests.map(request => request.raw))];
      let keys = [...new Set(raws.map(normalizeKey))];
      let pairs = new Map<string, [string, string]>();

      for (let request of requests) {
        let vendorId = vendorHint(d.core.vendors, request);
        if (vendorId) {
          pairs.set(vendorModelCacheKey(vendorId, request.raw), [vendorId, request.raw]);
        }
      }

      await loadNames(raws, keys);

      // The resolver reads from these scoped maps, so LRU evictions by concurrent prepares can't
      // remove entries it was prepared with.
      let scopedNamesByRaw = new Map(raws.map(raw => [raw, names.get(`r\0${raw}`) ?? []]));
      let scopedNamesByKey = new Map(keys.map(key => [key, names.get(`k\0${key}`) ?? []]));

      let modelIds = [
        ...reachableModels(
          [...scopedNamesByRaw.values(), ...scopedNamesByKey.values()].flat(),
          pointerId => d.core.pointers.get(pointerId)
        )
      ];

      await loadOfferings(modelIds, [...pairs.values()]);

      let scopedOfferings = new Map<string, CatalogOffering[]>();
      for (let modelId of modelIds) {
        scopedOfferings.set(
          modelCacheKey(modelId),
          offerings.get(modelCacheKey(modelId)) ?? []
        );
      }
      for (let key of pairs.keys()) scopedOfferings.set(key, offerings.get(key) ?? []);

      return createResolver({
        namesByRaw: raw => scopedNamesByRaw.get(raw) ?? [],
        namesByKey: key => scopedNamesByKey.get(key) ?? [],
        pointer: pointerId => d.core.pointers.get(pointerId),
        labOf: modelId => d.core.models.get(modelId)?.labId,
        offeringsByVendorModel: (vendorId, vendorModelId) =>
          scopedOfferings.get(vendorModelCacheKey(vendorId, vendorModelId)) ?? [],
        offeringsByModel: modelId => scopedOfferings.get(modelCacheKey(modelId)) ?? [],
        vendors: d.core.vendors
      });
    }
  };
};

type KnowledgeState = { version: string; index: CatalogIndex } | null;

let state: KnowledgeState = null;
let checkedAt = -Infinity;
let checkInterval = versionCheckMs;
let refreshing: Promise<void> | null = null;

let refresh = async () => {
  try {
    let published = await readPublishedVersion();
    checkInterval = published ? versionCheckMs : fallbackCheckMs;

    if (published?.version && published.version == state?.version) return;

    let snapshot = await currentSnapshot();
    if (!snapshot) {
      state = null;
      return;
    }

    let version = knowledgeVersionOf(snapshot);
    if (published && !published.version) await publishKnowledgeVersion(snapshot);
    if (version == state?.version) return;

    state = {
      version,
      index: createKnowledgeIndex({ snapshot, core: await loadKnowledgeCore() })
    };
  } catch (error) {
    console.warn('[agent-tracking] model knowledge could not be refreshed', error);
  } finally {
    checkedAt = Date.now();
  }
};

export let getKnowledge = async (): Promise<CatalogIndex | null> => {
  if (Date.now() - checkedAt >= checkInterval) {
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    await refreshing;
  }

  return state?.index ?? null;
};

export let expireKnowledgeCheck = () => {
  checkedAt = -Infinity;
};

export let resetKnowledgeCache = () => {
  state = null;
  expireKnowledgeCheck();
};
