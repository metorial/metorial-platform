import { ServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { pricing } from '../../knowledge/tests/fixtures';
import {
  assertValidPriceOverride,
  normalizeBillingModes,
  type PriceOverrideDefinition
} from '../validate';

let definition = (input: Partial<PriceOverrideDefinition> = {}): PriceOverrideDefinition => ({
  target: 'model',
  targetId: 'claude-sonnet-4-5',
  vendorId: null,
  billingModes: [],
  kind: 'multiplier',
  multiplier: 0.8,
  rates: null,
  validFrom: new Date('2026-01-01T00:00:00Z'),
  validTo: null,
  ...input
});

let rejection = (input: Partial<PriceOverrideDefinition>) => {
  try {
    assertValidPriceOverride(definition(input));
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    return (error as ServiceError<any>).data;
  }

  throw new Error('expected the override to be rejected');
};

describe('assertValidPriceOverride', () => {
  it('accepts each kind with exactly the fields it uses', () => {
    expect(() => assertValidPriceOverride(definition())).not.toThrow();
    expect(() =>
      assertValidPriceOverride(
        definition({ kind: 'rates', multiplier: null, rates: pricing(1) })
      )
    ).not.toThrow();
    expect(() =>
      assertValidPriceOverride(definition({ kind: 'included', multiplier: null }))
    ).not.toThrow();
    expect(() =>
      assertValidPriceOverride(definition({ target: 'all', targetId: null, multiplier: 0 }))
    ).not.toThrow();
  });

  it('rejects a targetId on target all and a missing one elsewhere', () => {
    expect(rejection({ target: 'all' })).toMatchObject({
      code: 'bad_request',
      message: expect.stringContaining('no targetId')
    });
    expect(rejection({ targetId: null }).message).toContain('needs a targetId');
    expect(rejection({ targetId: '' }).message).toContain('needs a targetId');
  });

  it('requires a multiplier between 0 and 1000 for multiplier overrides', () => {
    expect(rejection({ multiplier: null }).message).toContain('needs a multiplier');
    expect(rejection({ multiplier: -0.1 }).message).toContain('between 0 and 1000');
    expect(rejection({ multiplier: 1000.5 }).message).toContain('between 0 and 1000');
    expect(rejection({ multiplier: Number.NaN }).message).toContain('between 0 and 1000');
  });

  it('requires text rates that are not negative for rates overrides', () => {
    expect(rejection({ kind: 'rates', multiplier: null }).message).toContain('needs rates');
    expect(
      rejection({ kind: 'rates', multiplier: null, rates: { ...pricing(1), text: null } })
        .message
    ).toContain('text rates');
    expect(
      rejection({ kind: 'rates', multiplier: null, rates: pricing(-1) }).message
    ).toContain('negative');
    expect(
      rejection({
        kind: 'rates',
        multiplier: null,
        rates: {
          ...pricing(1),
          contextTiers: [{ minInputTokens: 1, input: -2, output: null, cacheRead: null }]
        }
      }).message
    ).toContain('negative');
  });

  it('rejects fields the kind does not use', () => {
    expect(rejection({ kind: 'included' }).message).toContain('takes no multiplier');
    expect(rejection({ kind: 'rates', rates: pricing(1) }).message).toContain(
      'takes no multiplier'
    );
    expect(
      rejection({ kind: 'included', multiplier: null, rates: pricing(1) }).message
    ).toContain('takes no rates');
    expect(rejection({ rates: pricing(1) }).message).toContain('takes no rates');
  });

  it('requires validTo after validFrom', () => {
    expect(rejection({ validTo: new Date('2026-01-01T00:00:00Z') }).message).toContain(
      'validTo must be after validFrom'
    );
    expect(rejection({ validTo: new Date('2025-12-31T00:00:00Z') }).message).toContain(
      'validTo must be after validFrom'
    );
    expect(() =>
      assertValidPriceOverride(definition({ validTo: new Date('2026-01-01T00:00:01Z') }))
    ).not.toThrow();
  });

  it('accepts any set of billing modes, including unknown', () => {
    expect(() =>
      assertValidPriceOverride(definition({ billingModes: ['included', 'unknown'] }))
    ).not.toThrow();
    expect(() =>
      assertValidPriceOverride(
        definition({ billingModes: ['included', 'overage', 'api', 'unknown'] })
      )
    ).not.toThrow();
  });

  it('rejects unknown and repeated billing modes', () => {
    expect(rejection({ billingModes: ['seat' as never] }).message).toContain(
      'seat is not a billing mode'
    );
    expect(rejection({ billingModes: ['api', 'api'] }).message).toContain(
      'must not repeat a mode'
    );
  });
});

describe('normalizeBillingModes', () => {
  it('deduplicates and orders modes like billingModes', () => {
    expect(normalizeBillingModes([])).toEqual([]);
    expect(normalizeBillingModes(['unknown', 'api', 'included', 'api'])).toEqual([
      'included',
      'api',
      'unknown'
    ]);
  });
});
