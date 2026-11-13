import { median } from '../lib/util';
import type { Catalog, NameTarget, Pricing } from '../types';
import { normalizeAgentKey } from './agents';

let outlierFactor = 5;
let outlierMinOfferings = 3;

export interface PriceOutlier {
  offeringId: string;
  modelId: string;
  input: number;
  median: number;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  priceOutliers: PriceOutlier[];
}

let pricesOf = (pricing: Pricing | null) => {
  if (!pricing) return [];

  let values: number[] = [];
  for (let rates of [pricing.text, pricing.image, pricing.audio, pricing.video]) {
    if (!rates) continue;
    values.push(
      ...[rates.input, rates.output, rates.cacheRead, rates.reasoning].filter(
        (value): value is number => value !== null
      ),
      ...rates.cacheWrite.map(write => write.price)
    );
  }

  values.push(...pricing.units.map(unit => unit.price));
  for (let tier of pricing.contextTiers)
    values.push(
      ...[tier.input, tier.output, tier.cacheRead].filter(
        (value): value is number => value !== null
      )
    );

  return values;
};

export let findPriceOutliers = (catalog: Catalog) => {
  let textInputByModel = new Map<string, number[]>();

  for (let offering of catalog.offerings) {
    let input = offering.pricing?.text?.input;
    if (offering.status === 'retired' || !offering.modelId || !input || offering.variant.free)
      continue;

    let list = textInputByModel.get(offering.modelId) ?? [];
    list.push(input);
    textInputByModel.set(offering.modelId, list);
  }

  let outliers: PriceOutlier[] = [];

  for (let offering of catalog.offerings) {
    let input = offering.pricing?.text?.input;
    let samples = offering.modelId ? textInputByModel.get(offering.modelId) : undefined;
    // An override means someone already looked at this link and kept it despite the price.
    if (
      !input ||
      !samples ||
      samples.length < outlierMinOfferings ||
      offering.status === 'retired' ||
      offering.resolution.method === 'override'
    )
      continue;

    let mid = median(samples)!;
    if (input > mid * outlierFactor || input < mid / outlierFactor)
      outliers.push({
        offeringId: offering.id,
        modelId: offering.modelId!,
        input,
        median: mid
      });
  }

  return outliers;
};

export let validateCatalog = (catalog: Catalog): ValidationResult => {
  let errors: string[] = [];
  let warnings: string[] = [];

  let ids = <T extends { id: string }>(label: string, items: T[]) => {
    let set = new Set<string>();
    for (let item of items) {
      if (set.has(item.id)) errors.push(`duplicate ${label} id ${item.id}`);
      set.add(item.id);
    }
    return set;
  };

  let organizations = ids('organization', catalog.organizations);
  let families = ids('family', catalog.families);
  let models = ids('model', catalog.models);
  let releases = ids('release', catalog.releases);
  let pointers = ids('pointer', catalog.pointers);
  let vendors = ids('vendor', catalog.vendors);
  let endpoints = ids('endpoint', catalog.endpoints);
  ids('offering', catalog.offerings);
  ids('name', catalog.names);

  let checkTarget = (owner: string, target: NameTarget) => {
    if (target.kind === 'model' && !models.has(target.modelId))
      errors.push(`${owner} targets missing model ${target.modelId}`);
    if (target.kind === 'release' && !releases.has(target.releaseId))
      errors.push(`${owner} targets missing release ${target.releaseId}`);
    if (target.kind === 'pointer' && !pointers.has(target.pointerId))
      errors.push(`${owner} targets missing pointer ${target.pointerId}`);
  };

  let familyById = new Map(catalog.families.map(family => [family.id, family]));

  for (let family of catalog.families) {
    if (!organizations.has(family.labId))
      errors.push(`family ${family.id} has missing lab ${family.labId}`);
    for (let modelId of family.modelIds)
      if (!models.has(modelId))
        errors.push(`family ${family.id} lists missing model ${modelId}`);
  }

  for (let model of catalog.models) {
    if (!organizations.has(model.labId))
      errors.push(`model ${model.id} has missing lab ${model.labId}`);
    if (model.familyId && !families.has(model.familyId))
      errors.push(`model ${model.id} has missing family ${model.familyId}`);
    if (model.familyId && familyById.get(model.familyId)?.labId !== model.labId)
      errors.push(`model ${model.id} is in family ${model.familyId} of another lab`);
    if (model.derivedFrom && !models.has(model.derivedFrom))
      errors.push(`model ${model.id} derives from missing model ${model.derivedFrom}`);
    if (model.status !== 'retired' && model.offeringCount === 0)
      warnings.push(`model ${model.id} has no offerings`);
  }

  for (let release of catalog.releases)
    if (!models.has(release.modelId))
      errors.push(`release ${release.id} has missing model ${release.modelId}`);

  for (let pointer of catalog.pointers) checkTarget(`pointer ${pointer.id}`, pointer.target);

  for (let vendor of catalog.vendors) {
    if (!organizations.has(vendor.organizationId))
      errors.push(`vendor ${vendor.id} has missing organization ${vendor.organizationId}`);
    for (let endpointId of vendor.endpointIds)
      if (!endpoints.has(endpointId))
        errors.push(`vendor ${vendor.id} lists missing endpoint ${endpointId}`);
  }

  let vendorKinds = new Map(catalog.vendors.map(vendor => [vendor.id, vendor.kind]));

  for (let offering of catalog.offerings) {
    let owner = `offering ${offering.id}`;
    if (!vendors.has(offering.vendorId))
      errors.push(`${owner} has missing vendor ${offering.vendorId}`);
    for (let endpointId of offering.endpointIds)
      if (!endpoints.has(endpointId))
        errors.push(`${owner} has missing endpoint ${endpointId}`);
    if (offering.modelId && !models.has(offering.modelId))
      errors.push(`${owner} has missing model ${offering.modelId}`);
    if (offering.releaseId && !releases.has(offering.releaseId))
      errors.push(`${owner} has missing release ${offering.releaseId}`);
    if (offering.pointerId && !pointers.has(offering.pointerId))
      errors.push(`${owner} has missing pointer ${offering.pointerId}`);
    if (pricesOf(offering.pricing).some(price => price < 0))
      errors.push(`${owner} has a negative price`);

    if (offering.status === 'retired') continue;

    if (
      offering.resolution.method === 'unresolved' &&
      vendorKinds.get(offering.vendorId) === 'first-party'
    )
      warnings.push(`first-party ${owner} is unresolved`);
  }

  for (let name of catalog.names) checkTarget(`name ${name.id}`, name.target);

  let agents = ids('agent', catalog.agents);
  let agentKeys = new Map<string, string>();

  for (let agent of catalog.agents) {
    let owner = `agent ${agent.id}`;
    if (!organizations.has(agent.makerId))
      errors.push(`${owner} has missing maker ${agent.makerId}`);
    if (agent.derivedFrom && !agents.has(agent.derivedFrom))
      errors.push(`${owner} derives from missing agent ${agent.derivedFrom}`);
    for (let link of agent.vendors)
      if (!vendors.has(link.vendorId))
        errors.push(`${owner} links missing vendor ${link.vendorId}`);
    if (agent.vendors.filter(link => link.role === 'default').length > 1)
      errors.push(`${owner} has more than one default vendor`);

    for (let key of new Set([agent.id, ...agent.aliases].map(normalizeAgentKey))) {
      let claimed = agentKeys.get(key);
      if (claimed && claimed !== agent.id)
        errors.push(`${owner} alias ${key} is already used by agent ${claimed}`);
      agentKeys.set(key, claimed ?? agent.id);
    }
  }

  let priceOutliers = findPriceOutliers(catalog);
  for (let outlier of priceOutliers)
    warnings.push(
      `offering ${outlier.offeringId} input price ${outlier.input} is far from the ${outlier.modelId} median ${outlier.median}`
    );

  return { errors, warnings, priceOutliers };
};
