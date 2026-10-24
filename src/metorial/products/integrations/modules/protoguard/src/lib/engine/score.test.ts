import { describe, expect, it } from 'vitest';
import { scoreFindings, type ScoringFinding } from './score';

let FAMILIES = [
  { key: 'a', scoreWeight: 1, alertConfidenceThreshold: 0.7 },
  { key: 'b', scoreWeight: 0.5, alertConfidenceThreshold: 0.7 },
  { key: 'c', scoreWeight: 0.25, alertConfidenceThreshold: 0.3 }
];

let finding = (overrides: Partial<ScoringFinding> & { family: string }): ScoringFinding => ({
  ruleKey: `${overrides.family}.rule`,
  precision: 0.5,
  hardRule: false,
  stage: 'active',
  isSuppressed: false,
  ...overrides
});

describe('scoreFindings', () => {
  it('returns a zero score without findings', () => {
    let result = scoreFindings({ findings: [], families: FAMILIES });

    expect(result).toMatchObject({
      probability: 0,
      score: 0,
      maxScore: 1.75,
      familyScores: [],
      isAlert: false,
      alertReasons: []
    });
  });

  it('uses the best precision per family and combines families as independent', () => {
    let result = scoreFindings({
      findings: [
        finding({ family: 'a', precision: 0.3, ruleKey: 'a.one' }),
        finding({ family: 'a', precision: 0.6, ruleKey: 'a.two' }),
        finding({ family: 'b', precision: 0.5 })
      ],
      families: FAMILIES
    });

    expect(result.probability).toBeCloseTo(1 - 0.4 * 0.5);
    expect(result.score).toBeCloseTo(0.6 * 1 + 0.5 * 0.5);
    expect(result.familyScores).toEqual([
      { family: 'a', probability: 0.6, ruleKeys: ['a.one', 'a.two'], isTriggered: false },
      { family: 'b', probability: 0.5, ruleKeys: ['b.rule'], isTriggered: false }
    ]);
  });

  it('ignores shadow, deprecated, suppressed and unknown-family findings', () => {
    let result = scoreFindings({
      findings: [
        finding({ family: 'a', precision: 0.99, stage: 'shadow', hardRule: true }),
        finding({ family: 'a', precision: 0.99, stage: 'deprecated' }),
        finding({ family: 'a', precision: 0.99, isSuppressed: true, hardRule: true }),
        finding({ family: 'zzz', precision: 0.99, hardRule: true })
      ],
      families: FAMILIES
    });

    expect(result.familyScores).toEqual([]);
    expect(result.isAlert).toBe(false);
  });

  it('alerts on a hard rule regardless of probability', () => {
    let result = scoreFindings({
      findings: [finding({ family: 'c', precision: 0.1, hardRule: true, ruleKey: 'c.hard' })],
      families: FAMILIES
    });

    expect(result.hardRuleKeys).toEqual(['c.hard']);
    expect(result.alertReasons).toEqual(['hard_rule']);
  });

  it('alerts when the combined probability crosses the threshold', () => {
    let findings = [
      finding({ family: 'a', precision: 0.6 }),
      finding({ family: 'b', precision: 0.6 })
    ];

    expect(scoreFindings({ findings, families: FAMILIES }).alertReasons).toEqual([
      'probability'
    ]);
    expect(
      scoreFindings({ findings, families: FAMILIES, alertProbabilityThreshold: 0.9 }).isAlert
    ).toBe(false);
  });

  it('alerts when enough families are triggered', () => {
    let findings = [
      finding({ family: 'a', precision: 0.7 }),
      finding({ family: 'c', precision: 0.3 })
    ];

    let result = scoreFindings({
      findings,
      families: FAMILIES,
      alertProbabilityThreshold: 0.99
    });

    expect(result.triggeredFamilyCount).toBe(2);
    expect(result.alertReasons).toEqual(['family_count']);
    expect(
      scoreFindings({
        findings,
        families: FAMILIES,
        alertProbabilityThreshold: 0.99,
        alertFilterCountThreshold: 3
      }).isAlert
    ).toBe(false);
  });

  it('clamps out-of-range precisions', () => {
    let result = scoreFindings({
      findings: [
        finding({ family: 'a', precision: 7 }),
        finding({ family: 'b', precision: -1 })
      ],
      families: FAMILIES
    });

    expect(result.probability).toBe(1);
    expect(result.familyScores.map(family => family.probability)).toEqual([1, 0]);
  });

  it('sorts family scores by probability then key', () => {
    let result = scoreFindings({
      findings: [
        finding({ family: 'c', precision: 0.4 }),
        finding({ family: 'b', precision: 0.4 }),
        finding({ family: 'a', precision: 0.9 })
      ],
      families: FAMILIES
    });

    expect(result.familyScores.map(family => family.family)).toEqual(['a', 'b', 'c']);
  });
});
