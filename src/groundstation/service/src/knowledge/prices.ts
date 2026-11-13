import type { Offering, Pricing } from '@metorial/model-catalog/src/types';
import { pricingHashOf, type KnowledgeRow } from './rows';

export let confirmIntervalMs = 12 * 60 * 60 * 1000;

export type OpenPricePeriod = {
  oid: bigint;
  offeringOid: bigint;
  pricingHash: string;
  validFrom: Date;
  confirmedAt: Date;
};

export type PeriodToOpen = {
  offeringOid: bigint;
  vendorId: string;
  modelId: string | null;
  pricing: Pricing;
  pricingHash: string;
  origin: 'bootstrap' | 'observed';
  validFrom: Date;
};

export type PeriodToClose = { oid: bigint; validTo: Date };

export type PricePlan = {
  open: PeriodToOpen[];
  close: PeriodToClose[];
  confirm: bigint[];
};

let parseTime = (value: unknown) => {
  let time = typeof value == 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : time;
};

// 08 §6: only a different non-null price ends a period. A null price, a retired offering or one
// missing from the catalog keeps the last price in effect. A correction (§6 "Corrections") stays
// in effect until upstream publishes a price different from the one it published before, which
// the stored offering's `pricingHash` holds.
export let planPriceChanges = (d: {
  offerings: Iterable<KnowledgeRow>;
  offeringOids: Map<string, bigint>;
  addedIds: Set<string>;
  storedOfferings?: Map<string, { pricingHash?: string | null }>;
  openPeriods: Map<bigint, OpenPricePeriod>;
  generatedAt: Date;
  bootstrap: boolean;
}): PricePlan => {
  let plan: PricePlan = { open: [], close: [], confirm: [] };
  let generatedAt = d.generatedAt.getTime();

  for (let row of d.offerings) {
    let offering = row.data as unknown as Offering;
    let pricingHash = pricingHashOf(offering.pricing);
    if (!offering.pricing || !pricingHash) continue;

    let offeringOid = d.offeringOids.get(row.id);
    if (offeringOid === undefined) continue;

    let upstreamUnchanged =
      !d.bootstrap && d.storedOfferings?.get(row.id)?.pricingHash == pricingHash;
    let open = d.openPeriods.get(offeringOid);

    if (!open && upstreamUnchanged) continue;

    let period = {
      offeringOid,
      vendorId: offering.vendorId,
      modelId: offering.modelId ?? null,
      pricing: offering.pricing,
      pricingHash
    };

    if (!open) {
      let firstSeen = parseTime(offering.firstSeenAt);
      let fromFirstSeen = (d.bootstrap || d.addedIds.has(row.id)) && firstSeen !== null;

      plan.open.push({
        ...period,
        origin: d.bootstrap ? 'bootstrap' : 'observed',
        validFrom: new Date(fromFirstSeen ? Math.min(firstSeen!, generatedAt) : generatedAt)
      });
      continue;
    }

    if (open.pricingHash == pricingHash || upstreamUnchanged) {
      if (generatedAt - open.confirmedAt.getTime() >= confirmIntervalMs)
        plan.confirm.push(open.oid);
      continue;
    }

    let changedAt = new Date(Math.max(generatedAt, open.validFrom.getTime()));

    plan.close.push({ oid: open.oid, validTo: changedAt });
    plan.open.push({ ...period, origin: 'observed', validFrom: changedAt });
  }

  return plan;
};
