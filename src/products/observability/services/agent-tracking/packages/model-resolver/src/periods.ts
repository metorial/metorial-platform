import type { Pricing } from '@metorial/model-catalog/src/types';

export let priceAssumedAfterMs = 7 * 24 * 60 * 60 * 1000;

export type PricePeriodOrigin = 'bootstrap' | 'observed' | 'correction';

export type PricePeriodCloseReason = 'changed' | 'corrected';

export type PricePeriod = {
  id: string;
  pricing: Pricing;
  origin: PricePeriodOrigin;
  closeReason: PricePeriodCloseReason | null;
  validFrom: Date;
  validTo: Date | null;
  confirmedAt: Date;
};

export type PricePeriodMatch = { period: PricePeriod; priceAssumed: boolean };

// Sorted by `validFrom`, without empty periods, which is what `pricePeriodAt` expects.
export let pricePeriodTimeline = (periods: PricePeriod[]) =>
  periods
    .filter(period => !period.validTo || period.validTo > period.validFrom)
    .sort(
      (a, b) =>
        a.validFrom.getTime() - b.validFrom.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );

// 08 §6: before the first period its price is assumed, an open period is assumed once it has gone
// more than 7 days unconfirmed, and the time after a closed period without a successor (a
// correction that ended the price) has no price.
export let pricePeriodAt = (timeline: PricePeriod[], at: Date): PricePeriodMatch | null => {
  let first = timeline[0];
  if (!first) return null;

  let time = at.getTime();
  if (time < first.validFrom.getTime()) return { period: first, priceAssumed: true };

  let low = 0;
  let high = timeline.length - 1;

  while (low < high) {
    let middle = Math.ceil((low + high) / 2);

    if (timeline[middle]!.validFrom.getTime() <= time) low = middle;
    else high = middle - 1;
  }

  let period = timeline[low]!;

  if (!period.validTo) {
    return {
      period,
      priceAssumed: time - period.confirmedAt.getTime() > priceAssumedAfterMs
    };
  }

  return time < period.validTo.getTime() ? { period, priceAssumed: false } : null;
};
