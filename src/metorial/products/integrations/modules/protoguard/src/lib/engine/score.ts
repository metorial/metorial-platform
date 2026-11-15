import type { RuleStage } from './types';

export let DEFAULT_ALERT_PROBABILITY_THRESHOLD = 0.8;
export let DEFAULT_ALERT_FILTER_COUNT_THRESHOLD = 2;

export interface ScoringFinding {
  ruleKey: string;
  family: string;
  precision: number;
  hardRule: boolean;
  stage: RuleStage;
  isSuppressed: boolean;
}

export interface ScoringFamily {
  key: string;
  scoreWeight: number;
  alertConfidenceThreshold: number;
}

export type AlertReason = 'hard_rule' | 'probability' | 'family_count';

export interface FamilyScore {
  family: string;
  probability: number;
  ruleKeys: string[];
  isTriggered: boolean;
}

export interface ScoreResult {
  probability: number;
  score: number;
  maxScore: number;
  familyScores: FamilyScore[];
  triggeredFamilyCount: number;
  hardRuleKeys: string[];
  isAlert: boolean;
  alertReasons: AlertReason[];
}

let clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Families are treated as independent detectors: P = 1 - prod(1 - p_family), where p_family is the
// best calibrated precision among that family's live findings. Shadow and suppressed findings are
// recorded but never move the score.
export let scoreFindings = (d: {
  findings: ScoringFinding[];
  families: ScoringFamily[];
  alertProbabilityThreshold?: number | null;
  alertFilterCountThreshold?: number | null;
  isAlertFilterCountCustom?: boolean;
}): ScoreResult => {
  let familiesByKey = new Map(d.families.map(family => [family.key, family]));
  let live = d.findings.filter(
    finding =>
      finding.stage == 'active' && !finding.isSuppressed && familiesByKey.has(finding.family)
  );

  let grouped = new Map<string, { probability: number; ruleKeys: Set<string> }>();
  for (let finding of live) {
    let entry = grouped.get(finding.family) ?? { probability: 0, ruleKeys: new Set<string>() };
    entry.probability = Math.max(entry.probability, clamp01(finding.precision));
    entry.ruleKeys.add(finding.ruleKey);
    grouped.set(finding.family, entry);
  }

  let familyScores: FamilyScore[] = [...grouped.entries()]
    .map(([family, entry]) => ({
      family,
      probability: entry.probability,
      ruleKeys: [...entry.ruleKeys].sort(),
      isTriggered: entry.probability >= familiesByKey.get(family)!.alertConfidenceThreshold
    }))
    .sort((a, b) => b.probability - a.probability || a.family.localeCompare(b.family));

  let probability =
    1 - familyScores.reduce((rest, family) => rest * (1 - family.probability), 1);
  let score = familyScores.reduce(
    (sum, family) => sum + family.probability * familiesByKey.get(family.family)!.scoreWeight,
    0
  );
  let maxScore = d.families.reduce((sum, family) => sum + family.scoreWeight, 0);

  let triggeredFamilyCount = familyScores.filter(family => family.isTriggered).length;
  let hardRuleKeys = [...new Set(live.filter(f => f.hardRule).map(f => f.ruleKey))].sort();

  let probabilityThreshold =
    d.alertProbabilityThreshold ?? DEFAULT_ALERT_PROBABILITY_THRESHOLD;
  let countThreshold = d.alertFilterCountThreshold ?? DEFAULT_ALERT_FILTER_COUNT_THRESHOLD;

  // A tenant that chose its own filter count asked for the legacy rule, so the probability path
  // must not alert below that count.
  let isProbabilityAlert =
    !d.isAlertFilterCountCustom &&
    familyScores.length > 0 &&
    probability >= probabilityThreshold;
  let isFamilyCountAlert = triggeredFamilyCount > 0 && triggeredFamilyCount >= countThreshold;

  let alertReasons: AlertReason[] = [];
  if (hardRuleKeys.length) alertReasons.push('hard_rule');
  if (isProbabilityAlert) alertReasons.push('probability');
  if (isFamilyCountAlert) alertReasons.push('family_count');

  return {
    probability: clamp01(probability),
    score,
    maxScore,
    familyScores,
    triggeredFamilyCount,
    hardRuleKeys,
    isAlert: alertReasons.length > 0,
    alertReasons
  };
};
