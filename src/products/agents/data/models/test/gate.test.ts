import { describe, expect, it } from 'vitest';
import type { CatalogDiff } from '../src/pipeline/continuity';
import {
  evaluateDeployGate,
  maxLiveOfferingDrop,
  maxNewPriceOutliers,
  maxRepricedShare,
  type GateCheckId
} from '../src/pipeline/gate';
import type { PriceOutlier } from '../src/pipeline/validate';

let diff = (parts: Partial<CatalogDiff> = {}): CatalogDiff => ({
  hasPrevious: true,
  newModels: [],
  retiredModels: [],
  newOfferings: [],
  retiredOfferings: [],
  newlyUnresolved: [],
  priceChanges: [],
  retargetedNames: [],
  retargetedPointers: [],
  liveOfferings: 1000,
  previousLiveOfferings: 1000,
  previousPricedOfferings: 1000,
  repricedOfferings: 0,
  ...parts
});

let outliers = (count: number): PriceOutlier[] =>
  Array.from({ length: count }, (_, index) => ({
    offeringId: `v:${index}`,
    modelId: 'm/1',
    input: 100,
    median: 1
  }));

let evaluate = (
  parts: Partial<CatalogDiff> = {},
  opts: { newOutliers?: number; allowUnsafe?: boolean } = {}
) =>
  evaluateDeployGate(
    { diff: diff(parts), newPriceOutliers: outliers(opts.newOutliers ?? 0) },
    { allowUnsafe: opts.allowUnsafe ?? false }
  );

let check = (gate: ReturnType<typeof evaluateDeployGate>, id: GateCheckId) =>
  gate.checks.find(item => item.id === id)!;

describe('evaluateDeployGate', () => {
  it('uses the planned thresholds', () => {
    expect([maxRepricedShare, maxLiveOfferingDrop, maxNewPriceOutliers]).toEqual([
      0.1, 0.1, 50
    ]);
  });

  it('passes an unchanged catalog', () => {
    let gate = evaluate();

    expect(gate).toMatchObject({ passed: true, deploy: true, allowUnsafe: false });
    expect(gate.checks.map(item => [item.id, item.passed, item.overridden])).toEqual([
      ['previous-catalog', true, false],
      ['repriced-offerings', true, false],
      ['live-offering-drop', true, false],
      ['new-price-outliers', true, false]
    ]);
  });

  it('allows exactly 10% repriced offerings and fails just above', () => {
    let atLimit = evaluate({ repricedOfferings: 100 });
    let overLimit = evaluate({ repricedOfferings: 101 });

    expect(check(atLimit, 'repriced-offerings')).toMatchObject({
      value: 0.1,
      threshold: 0.1,
      detail: '100 of 1000',
      passed: true
    });
    expect(atLimit.deploy).toBe(true);

    expect(check(overLimit, 'repriced-offerings')).toMatchObject({
      value: 0.101,
      passed: false,
      overridden: false
    });
    expect(overLimit).toMatchObject({ passed: false, deploy: false });
  });

  it('allows a 10% drop in live offerings and fails just above', () => {
    let atLimit = evaluate({ liveOfferings: 900 });
    let overLimit = evaluate({ liveOfferings: 899 });

    expect(check(atLimit, 'live-offering-drop')).toMatchObject({
      value: 0.1,
      detail: '1000 → 900',
      passed: true
    });
    expect(check(overLimit, 'live-offering-drop')).toMatchObject({
      value: 0.101,
      passed: false
    });
    expect(overLimit.deploy).toBe(false);
  });

  it('does not count growth in live offerings as a drop', () => {
    expect(check(evaluate({ liveOfferings: 5000 }), 'live-offering-drop')).toMatchObject({
      value: 0,
      passed: true
    });
  });

  it('allows 50 new price outliers and fails at 51', () => {
    let atLimit = evaluate({}, { newOutliers: 50 });
    let overLimit = evaluate({}, { newOutliers: 51 });

    expect(check(atLimit, 'new-price-outliers')).toMatchObject({
      value: 50,
      threshold: 50,
      passed: true
    });
    expect(check(overLimit, 'new-price-outliers')).toMatchObject({ value: 51, passed: false });
    expect(overLimit.deploy).toBe(false);
  });

  it('treats empty previous counts as no change', () => {
    let gate = evaluate({
      previousLiveOfferings: 0,
      previousPricedOfferings: 0,
      liveOfferings: 0
    });

    expect(gate.passed).toBe(true);
    expect(check(gate, 'repriced-offerings').value).toBe(0);
    expect(check(gate, 'live-offering-drop').value).toBe(0);
  });

  it('fails without a previous catalog and skips the comparisons', () => {
    let gate = evaluate({
      hasPrevious: false,
      previousLiveOfferings: 0,
      previousPricedOfferings: 0
    });

    expect(gate).toMatchObject({ passed: false, deploy: false });
    expect(check(gate, 'previous-catalog')).toMatchObject({ value: 0, passed: false });
    for (let id of ['repriced-offerings', 'live-offering-drop', 'new-price-outliers'] as const)
      expect(check(gate, id)).toMatchObject({ value: null, passed: true });
  });

  it('lets allow-unsafe override failed checks and marks only those', () => {
    let gate = evaluate(
      { hasPrevious: true, repricedOfferings: 500 },
      { newOutliers: 51, allowUnsafe: true }
    );

    expect(gate).toMatchObject({ passed: false, deploy: true, allowUnsafe: true });
    expect(gate.checks.map(item => [item.id, item.passed, item.overridden])).toEqual([
      ['previous-catalog', true, false],
      ['repriced-offerings', false, true],
      ['live-offering-drop', true, false],
      ['new-price-outliers', false, true]
    ]);
  });

  it('lets allow-unsafe deploy without a previous catalog', () => {
    let gate = evaluate({ hasPrevious: false }, { allowUnsafe: true });

    expect(gate).toMatchObject({ passed: false, deploy: true });
    expect(check(gate, 'previous-catalog').overridden).toBe(true);
  });

  it('does not mark anything overridden when allow-unsafe is set on a passing run', () => {
    let gate = evaluate({}, { allowUnsafe: true });

    expect(gate).toMatchObject({ passed: true, deploy: true, allowUnsafe: true });
    expect(gate.checks.some(item => item.overridden)).toBe(false);
  });
});
