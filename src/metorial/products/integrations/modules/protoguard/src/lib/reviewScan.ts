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
