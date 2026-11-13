import type { Catalog, NameTarget } from '@metorial/model-catalog/src/types';
import {
  vendorModelKey,
  type EntityDiff,
  type HistoryRegressions,
  type StoredRow,
  type StoredState
} from './rows';
import { supportedSchemaVersions } from './parse';
import type { KnowledgeSnapshotAnomaly } from './types';

let maxDropRatio = 0.2;
let maxPriceChangeRatio = 0.25;
let maxHistoryResetRatio = 0.2;
let minDanglingAllowed = 25;
let maxDanglingRatio = 0.005;
let sampleSize = 10;

export type DanglingReference = { from: string; field: string; to: string };

export type GuardrailVerdict = { accepted: true } | { accepted: false; reason: string };

let targetRefs = (target: NameTarget | undefined): [string, string][] => {
  if (!target) return [];
  if (target.kind == 'model') return [['models', target.modelId]];
  if (target.kind == 'release') {
    return [
      ['models', target.modelId],
      ['releases', target.releaseId]
    ];
  }
  if (target.kind == 'pointer') return [['pointers', target.pointerId]];

  return [];
};

export let findDanglingReferences = (catalog: Catalog): DanglingReference[] => {
  let ids = {
    organizations: new Set(catalog.organizations.map(item => item.id)),
    families: new Set(catalog.families.map(item => item.id)),
    models: new Set(catalog.models.map(item => item.id)),
    releases: new Set(catalog.releases.map(item => item.id)),
    pointers: new Set(catalog.pointers.map(item => item.id)),
    vendors: new Set(catalog.vendors.map(item => item.id)),
    agents: new Set((catalog.agents ?? []).map(item => item.id))
  };

  let dangling: DanglingReference[] = [];

  let check = (from: string, field: string, kind: keyof typeof ids, to: string | null) => {
    if (to && !ids[kind].has(to)) dangling.push({ from, field, to });
  };

  let checkTargets = (from: string, targets: (NameTarget | undefined)[]) => {
    for (let target of targets) {
      for (let [kind, to] of targetRefs(target)) {
        check(from, 'target', kind as keyof typeof ids, to);
      }
    }
  };

  for (let family of catalog.families) {
    check(family.id, 'labId', 'organizations', family.labId);
    check(family.id, 'latestModelId', 'models', family.latestModelId);
  }

  for (let model of catalog.models) {
    check(model.id, 'labId', 'organizations', model.labId);
    check(model.id, 'familyId', 'families', model.familyId);
  }

  for (let release of catalog.releases)
    check(release.id, 'modelId', 'models', release.modelId);

  for (let pointer of catalog.pointers) {
    check(pointer.id, 'labId', 'organizations', pointer.labId);
    checkTargets(pointer.id, [pointer.target, ...(pointer.history ?? []).map(p => p.target)]);
  }

  for (let vendor of catalog.vendors) {
    check(vendor.id, 'organizationId', 'organizations', vendor.organizationId);
  }

  for (let endpoint of catalog.endpoints) {
    check(endpoint.id, 'vendorId', 'vendors', endpoint.vendorId);
  }

  for (let offering of catalog.offerings) {
    check(offering.id, 'vendorId', 'vendors', offering.vendorId);
    check(offering.id, 'modelId', 'models', offering.modelId);
    check(offering.id, 'releaseId', 'releases', offering.releaseId);
    check(offering.id, 'pointerId', 'pointers', offering.pointerId);
  }

  for (let name of catalog.names) {
    checkTargets(name.id, [name.target, ...(name.history ?? []).map(p => p.target)]);
  }

  for (let agent of catalog.agents ?? []) {
    check(agent.id, 'makerId', 'organizations', agent.makerId);
    check(agent.id, 'derivedFrom', 'agents', agent.derivedFrom);
    for (let vendor of agent.vendors ?? [])
      check(agent.id, 'vendors', 'vendors', vendor.vendorId);
  }

  return dangling;
};

let entityTotal = (catalog: Catalog) =>
  catalog.organizations.length +
  catalog.families.length +
  catalog.models.length +
  catalog.releases.length +
  catalog.pointers.length +
  catalog.vendors.length +
  catalog.endpoints.length +
  catalog.offerings.length +
  catalog.names.length +
  (catalog.agents?.length ?? 0);

export let collectAnomalies = (d: {
  stored: StoredState;
  diffs: EntityDiff[];
  regressions: HistoryRegressions;
  dangling: DanglingReference[];
}): KnowledgeSnapshotAnomaly[] => {
  let anomalies: KnowledgeSnapshotAnomaly[] = [];

  for (let diff of d.diffs) {
    if (!diff.removed.length) continue;

    anomalies.push({
      kind: 'removed',
      entity: diff.spec.entity,
      count: diff.removed.length,
      sample: diff.removed.slice(0, sampleSize)
    });
  }

  let offerings = d.diffs.find(diff => diff.spec.entity == 'offering');
  if (offerings?.removed.length && offerings.added.length) {
    let removedPairs = new Set(
      offerings.removed.map(id => d.stored.offering.get(id)?.vendorModelKey).filter(Boolean)
    );
    let churned = offerings.added.filter(row =>
      removedPairs.has(vendorModelKey(row.columns.vendorId, row.columns.modelId))
    );

    if (churned.length) {
      anomalies.push({
        kind: 'id_churn',
        entity: 'offering',
        count: churned.length,
        sample: churned.slice(0, sampleSize).map(row => row.id)
      });
    }
  }

  for (let entity of ['offering', 'name'] as const) {
    let clamped = d.regressions.firstSeenClamped[entity];
    if (!clamped.length) continue;

    anomalies.push({
      kind: 'first_seen_regressed',
      entity,
      count: clamped.length,
      sample: clamped.slice(0, sampleSize)
    });
  }

  if (d.regressions.historyLost.length) {
    anomalies.push({
      kind: 'history_reset',
      entity: 'name',
      count: d.regressions.historyLost.length,
      sample: d.regressions.historyLost.slice(0, sampleSize)
    });
  }

  if (d.dangling.length) {
    anomalies.push({
      kind: 'dangling_reference',
      count: d.dangling.length,
      sample: d.dangling
        .slice(0, sampleSize)
        .map(ref => `${ref.from}.${ref.field} → ${ref.to}`)
    });
  }

  return anomalies;
};

let countStored = (rows: Map<string, StoredRow>, include: (row: StoredRow) => boolean) => {
  let count = 0;
  for (let row of rows.values()) if (include(row)) count++;

  return count;
};

let ratio = (part: number, whole: number) => (whole ? part / whole : 0);

let percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

export let evaluateGuardrails = (d: {
  catalog: Catalog;
  stored: StoredState;
  diffs: EntityDiff[];
  regressions: HistoryRegressions;
  dangling: DanglingReference[];
}): GuardrailVerdict => {
  if (!supportedSchemaVersions.includes(d.catalog.schemaVersion)) {
    return { accepted: false, reason: `Unknown schemaVersion ${d.catalog.schemaVersion}.` };
  }

  let danglingAllowed = Math.max(
    minDanglingAllowed,
    entityTotal(d.catalog) * maxDanglingRatio
  );
  if (d.dangling.length > danglingAllowed) {
    return {
      accepted: false,
      reason: `${d.dangling.length} references point to missing entities (allowed ${Math.floor(danglingAllowed)}).`
    };
  }

  let models = d.diffs.find(diff => diff.spec.entity == 'model')!;
  let offerings = d.diffs.find(diff => diff.spec.entity == 'offering')!;

  let storedLiveModels = countStored(d.stored.model, row => !row.removed);
  let incomingModels = models.rows.size;
  if (
    storedLiveModels &&
    ratio(storedLiveModels - incomingModels, storedLiveModels) > maxDropRatio
  ) {
    return {
      accepted: false,
      reason: `Models drop from ${storedLiveModels} to ${incomingModels}.`
    };
  }

  let storedPriced = countStored(d.stored.offering, row => !row.removed && !!row.pricingHash);
  let incomingPriced = 0;
  let priceChanges = 0;

  for (let row of offerings.rows.values()) {
    let pricing = (row.data as { pricing?: unknown }).pricing;
    if (!pricing) continue;

    incomingPriced++;

    let previous = d.stored.offering.get(row.id);
    if (previous?.pricingHash && previous.pricingHash != row.columns.pricingHash)
      priceChanges++;
  }

  if (storedPriced && ratio(storedPriced - incomingPriced, storedPriced) > maxDropRatio) {
    return {
      accepted: false,
      reason: `Priced offerings drop from ${storedPriced} to ${incomingPriced}.`
    };
  }

  if (storedPriced && ratio(priceChanges, storedPriced) > maxPriceChangeRatio) {
    return {
      accepted: false,
      reason: `${priceChanges} of ${storedPriced} priced offerings change price (${percent(ratio(priceChanges, storedPriced))}).`
    };
  }

  let storedOfferings = countStored(d.stored.offering, row => !row.removed);
  let clampedOfferings = d.regressions.firstSeenClamped.offering.length;
  if (ratio(clampedOfferings, storedOfferings) > maxHistoryResetRatio) {
    return {
      accepted: false,
      reason: `${clampedOfferings} offerings report a later firstSeenAt than stored (history reset).`
    };
  }

  let storedNamesWithHistory = countStored(
    d.stored.name,
    row => !row.removed && !!row.historyFrom
  );
  if (ratio(d.regressions.historyLost.length, storedNamesWithHistory) > maxHistoryResetRatio) {
    return {
      accepted: false,
      reason: `${d.regressions.historyLost.length} names lose their earlier history (history reset).`
    };
  }

  return { accepted: true };
};
