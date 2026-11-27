import type { SecurityUsageSnapshot } from '@metorial-subspace/db';
import { MATERIAL_CALLS_GROWTH_RATIO, MATERIAL_CALLS_MIN_DELTA } from './policy';

let MATERIAL_CONFIG_MIN_DELTA = 10;

let added = (before: string[], after: string[]) => {
  let known = new Set(before);
  return after.filter(item => !known.has(item));
};

let grewSubstantially = (d: { before: number; after: number; minDelta: number }) =>
  d.after - d.before >= d.minDelta && d.after >= d.before * (1 + MATERIAL_CALLS_GROWTH_RATIO);

export let findMaterialUsageChanges = (d: {
  previous: SecurityUsageSnapshot;
  current: SecurityUsageSnapshot;
}) => {
  let { previous, current } = d;
  let reasons: string[] = [];

  if (previous.baseRevisionId != current.baseRevisionId) {
    reasons.push('The base review of the provider was updated.');
  }

  let newTools = added(previous.toolsUsed, current.toolsUsed);
  if (newTools.length) reasons.push(`Newly used tools: ${newTools.join(', ')}.`);

  if (
    added(previous.allowedTools, current.allowedTools).length ||
    added(current.allowedTools, previous.allowedTools).length
  ) {
    reasons.push('The set of allowed tools changed.');
  }

  if (
    added(previous.scopes, current.scopes).length ||
    added(current.scopes, previous.scopes).length
  ) {
    reasons.push('The granted scopes changed.');
  }

  if (
    grewSubstantially({
      before: previous.calls,
      after: current.calls,
      minDelta: MATERIAL_CALLS_MIN_DELTA
    })
  ) {
    reasons.push(`Usage grew from ${previous.calls} to ${current.calls} calls.`);
  }

  if (
    (previous.severeProtoGuardMatches == 0 && current.severeProtoGuardMatches > 0) ||
    grewSubstantially({
      before: previous.severeProtoGuardMatches,
      after: current.severeProtoGuardMatches,
      minDelta: 1
    })
  ) {
    reasons.push('Severe runtime matches increased.');
  }

  for (let key of ['authConfigs', 'configs'] as const) {
    if (
      grewSubstantially({
        before: previous[key],
        after: current[key],
        minDelta: MATERIAL_CONFIG_MIN_DELTA
      })
    ) {
      reasons.push(
        `The number of ${key == 'configs' ? 'configs' : 'auth configs'} grew a lot.`
      );
    }
  }

  return reasons;
};
