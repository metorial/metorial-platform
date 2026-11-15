import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import type { Pricing } from '@metorial/model-catalog/src/types';
import type { KnowledgePricePeriod } from '@mtsrc/agent-tracking-db';
import { withTransaction } from '@mtsrc/agent-tracking-db';
import { getId } from '@mtsrc/agent-tracking-db';
import { queueKnowledgeImpact } from '../queues/knowledgeImpact';
import { expireKnowledgeCheck } from './cache';
import { ingestLockKey } from './ingest';
import { pricingHashOf } from './rows';
import { publishKnowledgeVersion } from './version';

export type CorrectablePeriod = Pick<KnowledgePricePeriod, 'oid' | 'validFrom' | 'validTo'>;

export type PriceCorrectionPlan = {
  close: { oid: bigint; validTo: Date }[];
  remainders: { sourceOid: bigint; validFrom: Date; validTo: Date | null }[];
};

export type KnowledgePriceCorrectionPeriod = {
  id: string;
  origin: string;
  pricing: Pricing;
  validFrom: string;
  validTo: string | null;
};

// The `before` and `after` of the `KnowledgeChange` row a correction writes (entity `offering`).
export type KnowledgePriceCorrectionChange = {
  offeringId: string;
  correction?: {
    from: string;
    to: string | null;
    pricing: Pricing | null;
    reason: string;
    correctedBy: string;
  };
  periods: KnowledgePriceCorrectionPeriod[];
};

let isEmpty = (period: CorrectablePeriod) =>
  !!period.validTo && period.validTo.getTime() <= period.validFrom.getTime();

// Every period overlapping [from, to) is closed with `corrected` where the range starts (a period
// that starts inside the range becomes empty, which lookups skip). The part of a period that
// runs past `to` continues as a new period, so the original row keeps its id and start.
export let planPriceCorrection = (d: {
  periods: CorrectablePeriod[];
  from: Date;
  to: Date | null;
}): PriceCorrectionPlan => {
  let plan: PriceCorrectionPlan = { close: [], remainders: [] };
  let from = d.from.getTime();
  let to = d.to?.getTime() ?? Infinity;

  for (let period of d.periods) {
    let start = period.validFrom.getTime();
    let end = period.validTo?.getTime() ?? Infinity;
    if (isEmpty(period) || end <= from || start >= to) continue;

    plan.close.push({ oid: period.oid, validTo: new Date(Math.max(start, from)) });
    if (end > to) {
      plan.remainders.push({
        sourceOid: period.oid,
        validFrom: d.to!,
        validTo: period.validTo
      });
    }
  }

  return plan;
};

let describePeriod = (period: KnowledgePricePeriod): KnowledgePriceCorrectionPeriod => ({
  id: period.id,
  origin: period.origin,
  pricing: period.pricing,
  validFrom: period.validFrom.toISOString(),
  validTo: period.validTo?.toISOString() ?? null
});

// 08 §6 "Corrections": replaces an offering's periods over [from, to) with one `correction`
// period, or with none when `pricing` is null, which ends the price over the range. Without `to`
// the correction stays in effect until upstream publishes a different price.
export let correctPrices = async (d: {
  offeringId: string;
  from: Date;
  to?: Date | null;
  pricing: Pricing | null;
  reason: string;
  correctedBy: string;
}) => {
  let to = d.to ?? null;
  if (to && to <= d.from) {
    throw new ServiceError(
      badRequestError({ message: 'The range must start before it ends.' })
    );
  }
  if (d.pricing && !d.pricing.text) {
    throw new ServiceError(badRequestError({ message: 'The pricing needs text rates.' }));
  }

  let result = await withTransaction(async tdb => {
    await tdb.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ingestLockKey})`);

    let offering = await tdb.knowledgeOffering.findUnique({ where: { id: d.offeringId } });
    if (!offering) throw new ServiceError(notFoundError('offering', d.offeringId));

    let snapshot = await tdb.knowledgeSnapshot.findFirst({
      where: { status: 'current' },
      orderBy: { generatedAt: 'desc' }
    });
    if (!snapshot) {
      throw new ServiceError(
        preconditionFailedError({ message: 'There is no current model knowledge snapshot.' })
      );
    }

    let periods = await tdb.knowledgePricePeriod.findMany({
      where: {
        offeringOid: offering.oid,
        ...(to ? { validFrom: { lt: to } } : {}),
        OR: [{ validTo: null }, { validTo: { gt: d.from } }]
      },
      orderBy: { validFrom: 'asc' }
    });
    let plan = planPriceCorrection({ periods, from: d.from, to });
    let byOid = new Map(periods.map(period => [period.oid, period]));

    for (let close of plan.close) {
      await tdb.knowledgePricePeriod.update({
        where: { oid: close.oid },
        data: { validTo: close.validTo, closeReason: 'corrected', openOfferingOid: null }
      });
    }

    let created: KnowledgePricePeriod[] = [];
    let now = new Date();

    if (d.pricing) {
      created.push(
        await tdb.knowledgePricePeriod.create({
          data: {
            ...getId('knowledgePricePeriod'),
            vendorId: offering.vendorId,
            modelId: offering.modelId,
            pricing: d.pricing,
            pricingHash: pricingHashOf(d.pricing)!,
            origin: 'correction',
            correctionReason: d.reason,
            correctedBy: d.correctedBy,
            validFrom: d.from,
            validTo: to,
            confirmedAt: now,
            offeringOid: offering.oid,
            openOfferingOid: to ? null : offering.oid
          }
        })
      );
    }

    for (let remainder of plan.remainders) {
      let source = byOid.get(remainder.sourceOid)!;

      created.push(
        await tdb.knowledgePricePeriod.create({
          data: {
            ...getId('knowledgePricePeriod'),
            vendorId: source.vendorId,
            modelId: source.modelId,
            pricing: source.pricing,
            pricingHash: source.pricingHash,
            origin: source.origin,
            closeReason: source.closeReason,
            correctionReason: source.correctionReason,
            correctedBy: source.correctedBy,
            validFrom: remainder.validFrom,
            validTo: remainder.validTo,
            confirmedAt: source.confirmedAt,
            offeringOid: offering.oid,
            openOfferingOid: remainder.validTo ? null : offering.oid
          }
        })
      );
    }

    let closedOids = plan.close.map(close => close.oid);
    let closed = await tdb.knowledgePricePeriod.findMany({
      where: { oid: { in: closedOids } },
      orderBy: { validFrom: 'asc' }
    });
    let before: KnowledgePriceCorrectionChange = {
      offeringId: offering.id,
      periods: closedOids.map(oid => describePeriod(byOid.get(oid)!))
    };
    let after: KnowledgePriceCorrectionChange = {
      offeringId: offering.id,
      correction: {
        from: d.from.toISOString(),
        to: to?.toISOString() ?? null,
        pricing: d.pricing,
        reason: d.reason,
        correctedBy: d.correctedBy
      },
      periods: [...closed, ...created].map(describePeriod)
    };

    await tdb.knowledgeChange.create({
      data: {
        ...getId('knowledgeChange'),
        entity: 'offering',
        entityId: offering.id,
        change: 'changed',
        before: before as never,
        after: after as never,
        snapshotOid: snapshot.oid
      }
    });

    let touched = await tdb.knowledgeSnapshot.update({
      where: { oid: snapshot.oid },
      data: { updatedAt: new Date(Math.max(now.getTime(), snapshot.updatedAt.getTime() + 1)) }
    });

    let timeline = await tdb.knowledgePricePeriod.findMany({
      where: { offeringOid: offering.oid },
      include: { offering: { select: { id: true } } },
      orderBy: [{ validFrom: 'asc' }, { createdAt: 'asc' }]
    });

    return { offering, snapshot: touched, timeline };
  });

  await publishKnowledgeVersion(result.snapshot);
  expireKnowledgeCheck();
  await queueKnowledgeImpact({
    type: 'correction',
    offeringId: result.offering.id,
    from: d.from.toISOString(),
    to: to?.toISOString() ?? null
  });

  return { offering: result.offering, periods: result.timeline };
};
