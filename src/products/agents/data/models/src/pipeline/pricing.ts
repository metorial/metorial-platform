import { normalizeKey } from '../normalize/parseName';
import type { PublishedPrice } from '../sources/pricing';
import { requirePrices } from '../sources/pricing';
import type { Offering, Pricing, SourceKind } from '../types';
import type { SecondaryMergeStats } from './secondary';

export let mergePublishedPrices = (d: {
  source: SourceKind;
  vendorId?: string;
  prices: PublishedPrice[];
  offerings: Map<string, Offering>;
}): SecondaryMergeStats => {
  let validated = requirePrices(d.prices, d.source).data;
  let stats: SecondaryMergeStats = {
    source: d.source,
    matched: 0,
    added: 0,
    priceChanges: [],
    delisted: []
  };

  for (let offering of d.offerings.values()) {
    if (
      offering.vendorId !== (d.vendorId ?? d.source) ||
      offering.variant.region ||
      offering.variant.free
    )
      continue;

    let key = normalizeKey(offering.vendorModelId);
    let modelKey = offering.modelId?.split('/').at(-1);
    let matchesScope = (price: PublishedPrice) =>
      (price.serving ?? null) === offering.variant.serving &&
      offering.endpointIds.includes(`${offering.vendorId}/${price.endpoint ?? 'default'}`);
    let prices = validated.filter(
      price => normalizeKey(price.model) === key && matchesScope(price)
    );

    // Anthropic publishes release-family prices; OpenAI snapshots can have different rates.
    if (!prices.length && d.source === 'anthropic' && modelKey)
      prices = validated.filter(
        price => normalizeKey(price.model) === normalizeKey(modelKey) && matchesScope(price)
      );
    if (!prices.length) continue;

    stats.matched++;
    let before = offering.pricing;
    let pricing: Pricing = before
      ? structuredClone(before)
      : {
          currency: 'USD',
          text: null,
          image: null,
          audio: null,
          video: null,
          contextTiers: [],
          units: [],
          webSearchPer1k: null
        };

    delete pricing.validUntil;

    for (let price of prices) {
      pricing[price.modality] =
        price.rates.input === null && price.rates.output === null
          ? null
          : {
              ...price.rates,
              reasoning: pricing[price.modality]?.reasoning ?? null
            };
      if (price.contextTiers !== null) pricing.contextTiers = price.contextTiers;
      if (price.units) {
        let key = (unit: Pricing['units'][number]) =>
          `${unit.modality}/${unit.direction}/${unit.unit}`;
        let updated = new Set(price.units.map(key));
        pricing.units = [
          ...pricing.units.filter(unit => !updated.has(key(unit))),
          ...price.units
        ];
      }
      if (pricing.conditions || price.conditions)
        pricing.conditions = [
          ...(pricing.conditions ?? []).filter(
            condition => condition.modality !== price.modality
          ),
          ...(price.conditions ?? []).map(condition => ({
            ...condition,
            modality: price.modality
          }))
        ];
      if (price.validUntil && (!pricing.validUntil || price.validUntil < pricing.validUntil))
        pricing.validUntil = price.validUntil;
    }
    if (!pricing.conditions?.length) delete pricing.conditions;

    if (JSON.stringify(before) !== JSON.stringify(pricing))
      stats.priceChanges.push({
        offeringId: offering.id,
        before: before?.text ?? null,
        after: pricing.text
      });

    offering.pricing = pricing;
    offering.sources = [...new Set([...offering.sources, d.source])].sort();
  }

  return stats;
};
