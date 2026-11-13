import { badRequestError, ServiceError } from '@lowerdeck/error';
import { billingModes, type BillingMode } from '@metorial/groundstation-spec';
import type { Pricing } from '@metorial/model-catalog/src/types';
import type { PriceOverrideKind, PriceOverrideTarget } from '../../prisma/generated/client';

let maxMultiplier = 1000;

export type PriceOverrideDefinition = {
  target: PriceOverrideTarget;
  targetId: string | null;
  vendorId: string | null;
  billingModes: BillingMode[];
  kind: PriceOverrideKind;
  multiplier: number | null;
  rates: Pricing | null;
  validFrom: Date;
  validTo: Date | null;
};

let invalid = (message: string) => new ServiceError(badRequestError({ message }));

let pricingRates = (pricing: Pricing) =>
  [pricing.text, pricing.image, pricing.audio, pricing.video]
    .flatMap(rates =>
      rates
        ? [
            rates.input,
            rates.output,
            rates.cacheRead,
            rates.reasoning,
            ...rates.cacheWrite.map(rate => rate.price)
          ]
        : []
    )
    .concat(
      pricing.contextTiers.flatMap(tier => [tier.input, tier.output, tier.cacheRead]),
      pricing.units.map(unit => unit.price),
      [pricing.webSearchPer1k]
    )
    .filter((rate): rate is number => rate !== null);

// Sorted in the order of `billingModes`, so equal sets compare equal in pricingSignature.
export let normalizeBillingModes = (modes: readonly BillingMode[]): BillingMode[] =>
  [...new Set(modes)].sort((a, b) => billingModes.indexOf(a) - billingModes.indexOf(b));

export let assertValidPriceOverride = (d: PriceOverrideDefinition) => {
  if (d.target == 'all' && d.targetId !== null) {
    throw invalid('An override that targets all usage takes no targetId.');
  }
  if (d.target != 'all' && !d.targetId) {
    throw invalid(`An override that targets a ${d.target} needs a targetId.`);
  }

  let unknownMode = d.billingModes.find(mode => !billingModes.includes(mode));
  if (unknownMode !== undefined) throw invalid(`${unknownMode} is not a billing mode.`);
  if (new Set(d.billingModes).size != d.billingModes.length) {
    throw invalid('billingModes must not repeat a mode.');
  }

  if (d.kind == 'multiplier') {
    if (d.multiplier === null) throw invalid('A multiplier override needs a multiplier.');
    if (!Number.isFinite(d.multiplier) || d.multiplier < 0 || d.multiplier > maxMultiplier) {
      throw invalid(`The multiplier must be between 0 and ${maxMultiplier}.`);
    }
  } else if (d.multiplier !== null) {
    throw invalid(`A ${d.kind} override takes no multiplier.`);
  }

  if (d.kind == 'rates') {
    if (!d.rates) throw invalid('A rates override needs rates.');
    if (!d.rates.text) throw invalid('The override rates need text rates.');
    if (pricingRates(d.rates).some(rate => !Number.isFinite(rate) || rate < 0)) {
      throw invalid('Override rates must not be negative.');
    }
  } else if (d.rates !== null) {
    throw invalid(`A ${d.kind} override takes no rates.`);
  }

  if (d.validTo && d.validTo.getTime() <= d.validFrom.getTime()) {
    throw invalid('validTo must be after validFrom.');
  }
};
