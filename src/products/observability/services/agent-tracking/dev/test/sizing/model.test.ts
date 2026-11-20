import { describe, expect, it } from 'vitest';
import estimates from '../../src/sizing/estimates.json';
import {
  formatSizing,
  parseSizingInput,
  perDayCounts,
  pickInstance,
  runSizing,
  storageAt,
  type SizingInput
} from '../../src/sizing/model';

let input = (overrides: Partial<SizingInput> = {}): SizingInput => ({
  ...parseSizingInput(estimates),
  ...overrides
});

describe('sizing model', () => {
  it('accepts the shipped design-doc estimates', () => {
    let parsed = parseSizingInput(estimates);

    expect(parsed.kind).toBe('estimate');
    expect(parsed.sessionsPerDeveloperPerDay).toBe(15);
    expect(parsed.slicesPerSession).toBe(3);
    expect(parsed.retentionDays).toEqual({ records: 90, slices: 400, sessions: 400 });
  });

  it('reproduces the 07 §8.1 slice estimate for 200 developers', () => {
    let daily = perDayCounts(input(), 200);
    let workingDaysPerYear = 52 * 5;

    expect(daily.slices * 365).toBeCloseTo((200 * 15 * 3 * (365 * 5)) / 7, 0);
    expect(daily.slices * 365).toBeGreaterThan(200 * 15 * 3 * workingDaysPerYear * 0.95);
    expect(daily.slices * 365).toBeLessThan(2_400_000);
  });

  it('grows until retention and then stays flat', () => {
    let model = input({
      bytesPerRecord: 1_000,
      recordsPerSession: 100,
      indexFactor: { records: 0, slices: 0, sessions: 0 }
    });
    let at = (days: number) => storageAt(model, 100, days);

    expect(at(90).dataGB.records).toBeCloseTo(
      (((100 * 15 * 5) / 7) * 100 * 90 * 1_000) / 1e9,
      6
    );
    expect(at(200).dataGB.records).toBe(at(90).dataGB.records);
    expect(at(400).dataGB.slices).toBeGreaterThan(at(200).dataGB.slices);
    expect(at(500).dataGB.slices).toBe(at(400).dataGB.slices);
  });

  it('adds index overhead as the stated factor', () => {
    let model = input({ indexFactor: { records: 0.5, slices: 1, sessions: 0 } });
    let point = storageAt(model, 100, 30);

    expect(point.indexGB.records).toBeCloseTo(point.dataGB.records * 0.5, 9);
    expect(point.indexGB.slices).toBeCloseTo(point.dataGB.slices, 9);
    expect(point.indexGB.sessions).toBe(0);
  });

  it('picks the smallest instance class whose memory holds the working set', () => {
    expect(pickInstance(3).name).toBe('db.t4g.medium');
    expect(pickInstance(10).name).toBe('db.r6g.large');
    expect(pickInstance(100).name).toBe('db.r6g.4xlarge');
    expect(pickInstance(10_000).fits).toBe(false);
  });

  it('prices the default without a verdict, next to the assumed reference', () => {
    let result = runSizing(input());

    expect(result.kind).toBe('estimate');
    expect(result.monthlyUsd.total).toBeCloseTo(
      result.monthlyUsd.instances + result.monthlyUsd.storage + result.monthlyUsd.io,
      9
    );
    expect(result.monthlyUsd.perDeveloper).toBeCloseTo(result.monthlyUsd.total / 200, 9);
    expect(result.costPerDeveloper).toEqual({
      modelled: result.monthlyUsd.perDeveloper,
      assumedReference: 2
    });
    expect(formatSizing(result)).not.toMatch(/affordable/i);
    expect(formatSizing(result)).toMatch(/assumed reference/);
    expect(result.per100Developers.horizons.map(point => point.days)).toEqual([
      30, 90, 180, 365, 400
    ]);
    expect(formatSizing(result)).toMatch(/Design-doc estimates/);
  });

  it('rejects incomplete input', () => {
    expect(() => parseSizingInput({ ...estimates, bytesPerRecord: -1 })).toThrow(
      /bytesPerRecord/
    );
    expect(() => parseSizingInput({ label: 'x' })).toThrow();
  });

  it('prints the memory headroom and warns when it is thin', () => {
    let result = runSizing(input());

    expect(result.instance.name).toBe('db.r6g.xlarge');
    expect(result.instance.headroomGiB).toBeCloseTo(
      result.instance.memoryGiB - result.instance.neededGiB,
      9
    );
    expect(result.instance.headroomGiB).toBeLessThan(1);
    expect(result.instance.thin).toBe(true);
    expect(formatSizing(result)).toMatch(/headroom is thin/);

    let roomy = runSizing(input({ developers: 50 }));
    expect(roomy.instance.thin).toBe(false);
  });

  it('lists what it leaves out', () => {
    let result = runSizing(input());

    expect(result.notes.join(' ')).toMatch(/content_texts, session_links and source_health/);
    expect(result.notes.join(' ')).toMatch(/slice and session upserts/);
  });
});
