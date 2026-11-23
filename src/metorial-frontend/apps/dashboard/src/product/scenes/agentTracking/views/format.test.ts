import { describe, expect, it } from 'vitest';
import {
  describeInsightsSummary,
  describeMaxEffort,
  describeModelListSummary,
  formatInsightShare,
  outdatedModelStatusLabel,
  partOfCost,
  teamViewKindLabel,
  type MemberInsight,
  type MemberInsights
} from './format';

type Practices = NonNullable<MemberInsight['practices']>;

let practices = (overrides: Partial<Practices> = {}): Practices => ({
  requestsMeasured: 10,
  requestsWithEffort: 8,
  highEffortRequests: 3,
  maxEffortRequests: 2,
  highEffortShare: 0.625,
  fastRequests: 0,
  fastShare: null,
  outdatedCostMicros: null,
  outdatedShare: null,
  cacheHitRate: null,
  outdatedModels: [],
  ...overrides
});

let fullSummary = (
  overrides: Partial<MemberInsights['summary']> = {}
): MemberInsights['summary'] => ({
  cost: {
    currency: 'usd',
    totalMicros: 5_475_550_000,
    billedMicros: null,
    estimatedMicros: 5_475_550_000,
    isEstimate: true,
    reportedByClientMicros: null,
    listPriceMicros: 2_563_480_000,
    requestsWithoutCost: 0,
    requestsWithoutListPrice: 0
  },
  requests: 3400,
  sessions: 120,
  activeMembers: 8,
  countsCapped: false,
  unattributedCostMicros: null,
  members: 8,
  flagCounts: {
    modelShare: 0,
    highEffort: 2,
    fastMode: 0,
    outdatedModels: null,
    lowCacheHitRate: 1,
    lowUsageSeat: 3
  },
  models: { costMicros: 1_200_000_000, requests: 900, costShare: 0.42, requestShare: 0.3 },
  practices: {
    requestsMeasured: 3000,
    requestsWithEffort: 2800,
    highEffortRequests: 1400,
    maxEffortRequests: 200,
    highEffortShare: 0.5,
    fastRequests: 0,
    fastShare: 0,
    outdatedCostMicros: null,
    outdatedShare: null,
    cacheHitRate: 0.9
  },
  seat: { unknownSeatMembers: 4 },
  requestRecordsClipped: false,
  ...overrides
});

describe('insight formatting', () => {
  it('keeps unknown shares apart from zero', () => {
    expect(formatInsightShare(null)).toBeNull();
    expect(formatInsightShare(undefined)).toBeNull();
    expect(formatInsightShare(0)).toBe('0%');
    expect(formatInsightShare(0.625)).toBe('63%');
    expect(formatInsightShare(0.00002)).toBe('<1%');
    expect(formatInsightShare(0.005)).toBe('1%');
  });

  it('describes max effort only when effort was reported', () => {
    expect(describeMaxEffort(practices())).toBe('2 at max effort');
    expect(describeMaxEffort(practices({ highEffortShare: null }))).toBeNull();
  });

  it('labels outdated models', () => {
    expect(outdatedModelStatusLabel({ status: 'retired', isLatest: false })).toBe('Retired');
    expect(outdatedModelStatusLabel({ status: 'deprecated', isLatest: null })).toBe(
      'Deprecated'
    );
    expect(outdatedModelStatusLabel({ status: 'active', isLatest: false })).toBe('Not Latest');
    expect(outdatedModelStatusLabel({ status: null, isLatest: null })).toBe('Outdated');
  });

  it('marks part of an estimated cost as an estimate only when it is not zero', () => {
    let estimated = { isEstimate: true };

    expect(partOfCost(1_500_000, estimated)).toEqual({
      totalMicros: 1_500_000,
      isEstimate: true
    });
    expect(partOfCost(1_500_000, { isEstimate: false })).toEqual({
      totalMicros: 1_500_000,
      isEstimate: false
    });
    expect(partOfCost(0, estimated)).toEqual({ totalMicros: 0, isEstimate: false });
    expect(partOfCost(null, estimated)).toEqual({ totalMicros: null, isEstimate: false });
    expect(partOfCost(undefined, estimated)).toEqual({ totalMicros: null, isEstimate: false });
  });
});

describe('summary line', () => {
  it('sums up the leaderboard', () => {
    expect(describeInsightsSummary('leaderboard', fullSummary())).toBe(
      '~$5,475.55 in the range · 8 active members · 120 sessions with usage · 3,400 requests'
    );
  });

  it('sums up practices with each share and its flagged members', () => {
    expect(describeInsightsSummary('practices', fullSummary())).toBe(
      '8 members · High Effort 50%, 2 flagged · Fast Mode 0% · Cache Hit Rate 90%, 1 flagged'
    );
  });

  it('sums up by model and leaves out a flagged count of zero', () => {
    expect(describeInsightsSummary('by_model', fullSummary())).toBe(
      '~$1,200.00 on the selected models · 42% of all cost · 8 ranked members'
    );
    expect(
      describeInsightsSummary(
        'by_model',
        fullSummary({ flagCounts: { ...fullSummary().flagCounts, modelShare: 1 } })
      )
    ).toContain('· 1 flagged');
  });

  it('sums up seats, keeping a low usage count of zero', () => {
    expect(describeInsightsSummary('seats', fullSummary())).toBe(
      '8 members · 3 with low usage · 4 with no seat reported · ~$2,563.48 at list price'
    );
    expect(
      describeInsightsSummary(
        'seats',
        fullSummary({ flagCounts: { ...fullSummary().flagCounts, lowUsageSeat: 0 } })
      )
    ).toContain('0 with low usage');
  });

  it('leaves out a part whose value is missing', () => {
    let cost = { ...fullSummary().cost, totalMicros: null, listPriceMicros: null };
    let missing = fullSummary({
      cost,
      models: { costMicros: null, requests: 0, costShare: null, requestShare: null }
    });

    expect(describeInsightsSummary('leaderboard', missing)).toBe(
      '8 active members · 120 sessions with usage · 3,400 requests'
    );
    expect(describeInsightsSummary('by_model', missing)).toBe('8 ranked members');
    expect(describeInsightsSummary('seats', missing)).toBe(
      '8 members · 3 with low usage · 4 with no seat reported'
    );
  });

  it('falls back to the totals when a group is missing', () => {
    expect(describeInsightsSummary('practices', fullSummary({ practices: null }))).toBe(
      describeInsightsSummary('leaderboard', fullSummary())
    );
  });
});

describe('model list summary', () => {
  let breakdown = (totalMicros: number | null, kinds: string[]) => ({
    total: { cost: { totalMicros, isEstimate: true } },
    items: kinds.map(kind => ({ kind }))
  });

  it('counts the listed models and leaves out the others row', () => {
    expect(
      describeModelListSummary(breakdown(2_573_700_000, ['model', 'unknown', 'other']))
    ).toBe('~$2,573.70 in the range · 2 models');
    expect(describeModelListSummary(breakdown(null, ['model']))).toBe('1 model');
  });
});

describe('kind labels', () => {
  it('labels known kinds and falls back for unknown ones', () => {
    expect(teamViewKindLabel('practices')).toBe('Practices');
    expect(teamViewKindLabel('heatmap')).toBe('Unknown Kind');
  });
});
