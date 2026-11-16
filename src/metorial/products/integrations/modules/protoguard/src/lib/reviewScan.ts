import { activeRuleset, getFamilyDefinition } from '../definitions/rulesets';
import {
  maskSecrets,
  scanPayloadSync,
  scanToolDefinition,
  type EngineFinding,
  type ToolDefinitionInput
} from './engine';

let REVIEW_MATCH_MAX_LENGTH = 120;
let SECRET_MASK_TEXT = '[REDACTED]';
let OPAQUE_TOKEN_MIN_LENGTH = 24;
let OPAQUE_TOKEN_MIN_ENTROPY = 4;

export let containsTokenForReview = (value: string) => {
  if (maskSecrets(value) != value) return true;

  let candidates = value.match(/[A-Za-z0-9_+/=-]+/g) ?? [];

  return candidates.some(candidate => {
    if (candidate.length < OPAQUE_TOKEN_MIN_LENGTH) return false;
    if (!/[A-Za-z]/.test(candidate) || !/[0-9]/.test(candidate)) return false;

    let counts = new Map<string, number>();
    for (let character of candidate) counts.set(character, (counts.get(character) ?? 0) + 1);

    let entropy = 0;
    for (let count of counts.values()) {
      let probability = count / candidate.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy >= OPAQUE_TOKEN_MIN_ENTROPY;
  });
};

export interface ReviewScanHit {
  ruleKey: string;
  family: string;
  familyName: string;
  severity: string;
  confidence: number;
  matchedText: string;
}

// Reviews only report what would alert, so shadow rules and matches below the family's default
// threshold stay out of reports.
let toReviewHits = (findings: EngineFinding[]): ReviewScanHit[] =>
  findings.flatMap(finding => {
    let family = getFamilyDefinition(finding.family);
    if (!family || finding.stage != 'active') return [];
    if (finding.precision < family.alertConfidenceThreshold) return [];

    return [
      {
        ruleKey: finding.ruleKey,
        family: finding.family,
        familyName: family.name,
        severity: family.severity,
        confidence: finding.precision,
        matchedText: finding.redactMatch
          ? SECRET_MASK_TEXT
          : maskSecrets(finding.matchedText).slice(0, REVIEW_MATCH_MAX_LENGTH)
      }
    ];
  });

export let scanToolDefinitionForReview = (tool: ToolDefinitionInput) =>
  toReviewHits(scanToolDefinition({ ruleset: activeRuleset, tool }).findings);

export let scanTextForReview = (text: string) =>
  toReviewHits(
    scanPayloadSync({ ruleset: activeRuleset, payload: { output: text } }).findings
  );
