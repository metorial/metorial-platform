import { createProtoGuardSampleMarkdown } from './sampleMarkdown';
import type {
  ProtoGuardCheckContext,
  ProtoGuardEffectiveFilter,
  ProtoGuardScoredMatch,
  ProtoGuardScoreResult
} from './types';

let clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export let scoreProtoGuardResults = (d: {
  ctx: ProtoGuardCheckContext;
  filters: ProtoGuardEffectiveFilter[];
  alertFilterCountThreshold: number;
}): ProtoGuardScoreResult => {
  let targetByPath = new Map(d.ctx.targets.map(target => [target.path, target]));
  let matches: ProtoGuardScoredMatch[] = [];
  let maxScore = d.filters.reduce((sum, filter) => sum + filter.definition.scoreWeight, 0);
  let score = 0;
  let alertByConfidence = false;

  for (let filter of d.filters) {
    let result = filter.definition.check(d.ctx);
    if (result.matches.length === 0) continue;

    let bestConfidence = 0;

    for (let match of result.matches) {
      let target = targetByPath.get(match.path);
      let confidence = clamp01(match.confidence);
      bestConfidence = Math.max(bestConfidence, confidence);

      if (confidence >= filter.alertConfidenceThreshold) alertByConfidence = true;

      matches.push({
        ...match,
        confidence,
        filterKey: filter.definition.key,
        filterOid: filter.filterOid,
        filterName: filter.definition.name,
        issueType: filter.definition.issueType,
        severity: filter.definition.severity,
        scoreWeight: filter.definition.scoreWeight,
        alertConfidenceThreshold: filter.alertConfidenceThreshold,
        sampleMarkdown: target
          ? createProtoGuardSampleMarkdown({
              path: match.path,
              content: target.content,
              startOffset: match.startOffset,
              endOffset: match.endOffset
            })
          : `**${match.path}**\n\n<mark>${match.matchedText}</mark>`
      });
    }

    score += bestConfidence * filter.definition.scoreWeight;
  }

  let triggeredFilterCount = new Set(matches.map(match => match.filterKey)).size;
  let confidence = maxScore === 0 ? 0 : clamp01(score / maxScore);
  let alertByFilterCount = triggeredFilterCount >= d.alertFilterCountThreshold;
  let issueTypes = [...new Set(matches.map(match => match.issueType))];

  return {
    score,
    maxScore,
    confidence,
    triggeredFilterCount,
    matchedInstanceCount: matches.length,
    shouldAlert: alertByConfidence || alertByFilterCount,
    alertByConfidence,
    alertByFilterCount,
    matches,
    issueTypes
  };
};
