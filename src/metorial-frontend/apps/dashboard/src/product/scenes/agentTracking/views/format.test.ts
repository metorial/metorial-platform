import { describe, expect, it } from 'vitest';
import {
  describeFlagCount,
  describeMaxEffort,
  formatInsightShare,
  hasNoReportedSeat,
  insightFlagLabels,
  noSeatReportedNotice,
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

let summary = (members: number, unknownSeatMembers: number | null) =>
  ({
    members,
    seat: unknownSeatMembers === null ? null : { unknownSeatMembers }
  }) as MemberInsights['summary'];

describe('insight formatting', () => {
  it('keeps unknown shares apart from zero', () => {
    expect(formatInsightShare(null)).toBeNull();
    expect(formatInsightShare(undefined)).toBeNull();
    expect(formatInsightShare(0)).toBe('0%');
    expect(formatInsightShare(0.625)).toBe('63%');
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

  it('describes flag counts', () => {
    expect(describeFlagCount(null, 10)).toBeNull();
    expect(describeFlagCount(0, 10)).toBe('Nobody flagged');
    expect(describeFlagCount(3, 1200)).toBe('3 of 1,200 members flagged');
    expect(describeFlagCount(1, 1)).toBe('1 of 1 member flagged');
  });

  it('labels every flag in Title Case', () => {
    for (let label of Object.values(insightFlagLabels)) {
      expect(label.split(' ').every(word => word[0] == word[0]!.toUpperCase())).toBe(true);
    }
  });

  it('notices when no member reported a seat', () => {
    expect(hasNoReportedSeat(summary(4, 4))).toBe(true);
    expect(hasNoReportedSeat(summary(4, 3))).toBe(false);
    expect(hasNoReportedSeat(summary(0, 0))).toBe(false);
    expect(hasNoReportedSeat(summary(4, null))).toBe(false);
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

describe('no seat reported notice', () => {
  it('holds under any sort and explains the seat filter', () => {
    expect(noSeatReportedNotice).not.toContain('ranked');
    expect(noSeatReportedNotice).toContain('flags nobody');
  });
});

describe('kind labels', () => {
  it('labels known kinds and falls back for unknown ones', () => {
    expect(teamViewKindLabel('practices')).toBe('Practices');
    expect(teamViewKindLabel('heatmap')).toBe('Unknown Kind');
  });
});
